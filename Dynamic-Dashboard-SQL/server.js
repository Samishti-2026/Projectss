import express from "express";
import cors from "cors";
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import pool from "./db.js";
import { buildJoinPlan } from "./joinPlanner.js";
import { executeSQLQuery, getTableSchema, getTableList } from "./sqlQueryBuilder.js";
import { initializeConfigTable, saveQueryConfig, getAllQueryConfigs, getQueryConfigById, updateQueryConfig, deleteQueryConfig, searchQueryConfigs } from "./queryConfigManager.js";

const app = express();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
///////////////////////////////
app.use('/query', limiter); // Apply to your query endpoint

// Custom sanitization middleware
function sanitizeInput(req, res, next) {
  if (req.body && req.body.filters && Array.isArray(req.body.filters)) {
    for (const filter of req.body.filters) {
      // Sanitize table names
      if (typeof filter.collection === 'string') {
        filter.collection = filter.collection.replace(/[^a-zA-Z0-9_]/g, '');
      }
      // Sanitize field names
      if (typeof filter.field === 'string') {
        filter.field = filter.field.replace(/[.$]/g, ''); // Remove dangerous chars
      }
      // Sanitize operator names
      if (typeof filter.operator === 'string') {
        filter.operator = filter.operator.replace(/[^a-zA-Z0-9_]/g, '');
      }
    }
  }
  next();
}

app.use('/query', sanitizeInput); // Apply sanitization

app.use(cors());
app.use(express.json({
  // Limit payload size to prevent large request attacks
  limit: '10mb'
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.static("public"));

function resolveRoot(filters) {
  const tables = [...new Set(filters.map(f => f.collection))];

  // If invoices is one of the tables being filtered, make it the root
  if (tables.includes('invoices')) {
    return 'invoices';
  }

  // If there are multiple tables being filtered, default to invoices
  if (tables.length > 1) {
    return 'invoices';
  }

  // If only one table is being filtered, use that table as root
  // This ensures we get all fields from the table being filtered
  if (tables.length === 1) {
    return tables[0];
  }

  // Fallback
  return 'invoices';
}

function resolveFieldPath(root, f) {
  return f.collection === root ? f.field : `${f.collection}.${f.field}`;
}

function validateFilter(filter) {
  // Validate table name (whitelist approach)
  const allowedTables = ['invoices', 'customers', 'products', 'categories'];
  if (!allowedTables.includes(filter.collection)) {
    throw new Error(`Invalid table: ${filter.collection}`);
  }

  // Validate field names (prevent SQL injection)
  if (typeof filter.field === 'string' && (filter.field.includes('`') || filter.field.includes(';'))) {
    throw new Error(`Invalid field name: ${filter.field}`);
  }

  // Validate operator (whitelist approach)
  const allowedOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'between', 'in', 'regex', 'sum', 'avg', 'min', 'max', 'count'];
  if (!allowedOperators.includes(filter.operator)) {
    throw new Error(`Invalid operator: ${filter.operator}`);
  }

  // Validate value types
  if (typeof filter.value === 'object' && filter.value !== null && !Array.isArray(filter.value)) {
    throw new Error('Object values not allowed for security reasons');
  }

  return true;
}

// Build query plan for detailed records (without aggregation)
function buildDetailedQueryPlan(filters) {
  const root = resolveRoot(filters);
  const joins = buildJoinPlan(root, filters);

  // Build projection to include all fields from root table
  let projection = [`${root}.*`];
  
  // Add any fields from other tables that are being filtered
  const otherTableFilters = filters.filter(f => f.collection !== root && !['sum', 'avg', 'min', 'max', 'count'].includes(f.operator));
  projection = projection.concat(otherTableFilters.map(f => resolveFieldPath(root, f)));
  
  // Remove duplicates
  projection = [...new Set(projection)];

  return {
    tables: [root],
    joins,
    projection
  };
}

// Handle aggregation queries
function buildAggregationQueryPlan(filters, aggregationOps = []) {
  const root = resolveRoot(filters);
  
  // Create pseudo-filters for aggregation fields to ensure proper joins
  const aggregationFilters = aggregationOps.map(op => ({
    collection: op.collection,
    field: op.field,
    operator: 'exists' // Dummy operator, just for join planning
  }));
  
  // Combine filters and aggregation fields for join planning
  const allFilters = [...filters, ...aggregationFilters];
  const joins = buildJoinPlan(root, allFilters);

  // Build projection for aggregation
  const projection = aggregationOps.map(op => {
    if (op.operator === 'count') {
      return '*';
    }
    return resolveFieldPath(root, { collection: op.collection, field: op.field });
  });

  return {
    tables: [root],
    joins,
    projection
  };
}

app.post("/query", async (req, res) => {
  try {
    const { database, filters = [], aggregation = [] } = req.body;

    if (!database) {
      return res.status(400).json({ error: "Database name is required" });
    }

    let detailedData = [];
    let aggregationData = [];
    let response = {};

    // Convert UI filters to SQL filter format
    const sqlFilter = {};
    const aggregationOps = [];

    filters.forEach(f => {
      validateFilter(f);
      const fieldPath = resolveFieldPath(resolveRoot(filters), f);

      if (['sum', 'avg', 'min', 'max', 'count'].includes(f.operator)) {
        // Aggregation operation
        aggregationOps.push({
          operation: f.operator,
          field: fieldPath,
          alias: f.alias || `${f.operator}_${fieldPath.replace(/\./g, '_')}`
        });
      } else {
        // Regular filter
        if (!sqlFilter[fieldPath]) {
          sqlFilter[fieldPath] = {};
        }
        sqlFilter[fieldPath][`$${f.operator}`] = f.value;
      }
    });

    if (aggregation && aggregation.length > 0) {
      // When aggregation is present, get both detailed records and aggregated results

      // Transform aggregation array to match expected format
      const transformedAggregations = aggregation.map(agg => ({
        operation: agg.operator,
        field: `${agg.collection}.${agg.field}`,
        alias: agg.alias || `${agg.operator}_${agg.field}`
      }));

      // Get detailed records
      const detailedQueryPlan = buildDetailedQueryPlan(filters);
      const detailedResult = await executeSQLQuery(detailedQueryPlan, sqlFilter, []);
      detailedData = detailedResult.data;

      // Get aggregated results
      const aggregationQueryPlan = buildAggregationQueryPlan(filters, aggregation);
      const aggregationResult = await executeSQLQuery(aggregationQueryPlan, sqlFilter, transformedAggregations);
      aggregationData = aggregationResult.aggregations;

      response = {
        success: true,
        type: 'both',
        detailed_count: detailedData.length,
        aggregation_count: aggregationData.length,
        detailed_data: detailedData,
        aggregation_data: aggregationData
      };
    } else {
      // Handle regular query (backward compatibility)
      const root = resolveRoot(filters);
      const joins = buildJoinPlan(root, filters);

      // Validate filters
      for (const f of filters) {
        validateFilter(f);
        if (!f.collection || !f.field || !f.operator) {
          return res.status(400).json({
            error: "Each filter must have collection, field, and operator"
          });
        }
      }

      // Build projection to include all fields from root table
      let projection = [];

      // Always include all fields from the root table
      // This ensures we get full customer details when filtering on customer fields
      projection = [`${root}.*`];

      // Add any fields from other tables that are being filtered
      const otherTableFilters = filters.filter(f => f.collection !== root);
      projection = projection.concat(otherTableFilters.map(f => resolveFieldPath(root, f)));

      // Remove duplicates
      projection = [...new Set(projection)];

      const queryPlan = {
        tables: [root],
        joins,
        projection: projection
      };

      const result = await executeSQLQuery(queryPlan, sqlFilter, []);
      detailedData = result.data;

      response = {
        success: true,
        type: 'regular',
        root,
        count: detailedData.length,
        data: detailedData
      };
    }

    res.json(response);
  } catch (err) {
    // Check if this is a validation error (user-generated) or internal error
    if (err.message.includes('Invalid') || err.message.includes('validation')) {
      console.error('Validation error:', err);
      res.status(400).json({ error: err.message });
    } else {
      console.error('Query error:', err); // Log full error for debugging
      // Send generic error message to prevent information disclosure
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// GET endpoint to fetch all available fields
app.get("/all-fields/:database", async (req, res) => {
  try {
    const { database } = req.params;

    // Get table list
    const tableList = await getTableList();
    if (!tableList.success) {
      return res.status(500).json({ error: tableList.error });
    }

    const fields = [];

    // Get schema for each table
    for (const tableName of tableList.tables) {
      const schema = await getTableSchema(tableName);
      if (schema.success) {
        schema.columns.forEach(column => {
          if (column.name !== 'id') { // Skip id field if you want
            fields.push({
              collection: tableName,
              value: column.name
            });
          }
        });
      }
    }

    res.json({ fields });
  } catch (err) {
    console.error('All-fields error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DEBUG endpoint to inspect table data
app.get("/debug/:database/:table", async (req, res) => {
  try {
    const { database, table } = req.params;

    // Get table schema
    const schema = await getTableSchema(table);

    // Get sample rows
    const [samples] = await pool.execute(`SELECT * FROM ?? LIMIT 5`, [table]);

    // Get distinct values for specific fields (if they exist)
    let distinctRegions = [];
    let distinctZones = [];
    let dateRange = {};

    try {
      const [regions] = await pool.execute(`SELECT DISTINCT region FROM ?? WHERE region IS NOT NULL`, [table]);
      distinctRegions = regions.map(row => row.region);

      const [zones] = await pool.execute(`SELECT DISTINCT zone FROM ?? WHERE zone IS NOT NULL`, [table]);
      distinctZones = zones.map(row => row.zone);

      // Get min/max dates
      const [dates] = await pool.execute(`
        SELECT MIN(invoice_date) as min_date, MAX(invoice_date) as max_date 
        FROM ?? 
        WHERE invoice_date IS NOT NULL
      `, [table]);

      if (dates.length > 0 && dates[0].min_date) {
        dateRange = {
          min: dates[0].min_date,
          max: dates[0].max_date
        };
      }
    } catch (err) {
      console.log(`Could not get distinct values for ${table}:`, err.message);
    }

    // Get row count
    const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM ??`, [table]);

    res.json({
      table,
      schema: schema.columns,
      sampleRows: samples,
      distinctRegions: distinctRegions || [],
      distinctZones: distinctZones || [],
      dateRange: dateRange,
      totalRows: countResult[0].total
    });
  } catch (err) {
    console.error('Debug endpoint error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Query Configuration Management Endpoints

// Save query configuration
app.post("/save-query-config", async (req, res) => {
  try {
    const { name, description, filters, aggregation } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Configuration name is required" });
    }
    
    const result = await saveQueryConfig(name, description, filters, aggregation);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    console.error('Save config error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all query configurations
app.get("/query-configs", async (req, res) => {
  try {
    const configs = await getAllQueryConfigs();
    res.json({ configs });
  } catch (err) {
    console.error('Get configs error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get query configuration by ID
app.get("/query-configs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const config = await getQueryConfigById(id);
    
    if (config) {
      res.json(config);
    } else {
      res.status(404).json({ error: "Configuration not found" });
    }
  } catch (err) {
    console.error('Get config by ID error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update query configuration
app.put("/query-configs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const result = await updateQueryConfig(id, updates);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (err) {
    console.error('Update config error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete query configuration
app.delete("/query-configs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteQueryConfig(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (err) {
    console.error('Delete config error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search query configurations
app.get("/search-query-configs", async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: "Search term is required" });
    }
    
    const configs = await searchQueryConfigs(q);
    res.json({ configs });
  } catch (err) {
    console.error('Search configs error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000, () =>
  console.log("Server running at http://localhost:3000")
);
