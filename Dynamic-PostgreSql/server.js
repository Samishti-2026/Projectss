import express from "express";
import cors from "cors";
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import { getDB, query } from "./db.js";
import { buildJoinPlan, buildJoinClauses, buildSelectFields } from "./joinPlanner.js";
import { buildWhereClause } from "./filterBuilder.js";
import OPERATORS from './operators.js';

const app = express();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
//////////////////////////////////////////////////////

app.use('/query', limiter); // Apply to your query endpoint security layer

// Custom sanitization middleware
function sanitizeInput(req, res, next) {
  if (req.body && req.body.filters && Array.isArray(req.body.filters)) {
    for (const filter of req.body.filters) {
      // Sanitize collection names
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
  const cols = [...new Set(filters.map(f => f.collection))];

  // If invoices is one of the collections being filtered, make it the root
  if (cols.includes('invoices')) {
    return 'invoices';
  }

  // If there are multiple collections being filtered, default to invoices
  // since it's the central transactional collection
  if (cols.length > 1) {
    return 'invoices';
  }

  // If only one collection is being filtered, check if it has relationships
  // to invoices - if so, use invoices as root to allow proper joins
  const relatedToInvoices = ['customers', 'products', 'categories'];
  if (cols.length === 1 && relatedToInvoices.includes(cols[0])) {
    return 'invoices';
  }

  // Otherwise, use the collection directly
  return cols[0] || 'invoices';
}

function resolveFieldPath(root, f) {
  return f.collection === root ? f.field : `${f.collection}.${f.field}`;
}

function validateFilter(filter) {
  // Validate collection name (whitelist approach)
  const allowedCollections = ['invoices', 'customers', 'products', 'categories'];
  if (!allowedCollections.includes(filter.collection)) {
    throw new Error(`Invalid collection: ${filter.collection}`);
  }

  // Validate field names (prevent special MongoDB operators)
  if (typeof filter.field === 'string' && (filter.field.includes('$') || filter.field.includes('.'))) {
    throw new Error(`Invalid field name: ${filter.field}`);
  }

  // Validate operator (whitelist approach)
  const allowedOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'between', 'in', 'regex', 'sum', 'avg', 'min', 'max', 'count'];
  if (!allowedOperators.includes(filter.operator)) {
    throw new Error(`Invalid operator: ${filter.operator}`);
  }

  // Validate value types
  if (typeof filter.value === 'object' && filter.value !== null && !Array.isArray(filter.value)) {
    // Allow objects for 'between' operator
    if (filter.operator !== 'between') {
      throw new Error('Object values not allowed for security reasons');
    }
  }

  return true;
}

// Build pipeline for detailed records (without aggregation)
function buildDetailedRecordsPipeline(filters) {
  const pipeline = [];

  // Build joins if needed
  const root = resolveRoot(filters);
  const joins = buildJoinPlan(root, filters);

  joins.forEach(j => {
    pipeline.push({
      $lookup: {
        from: j.from,
        localField: j.localField,
        foreignField: j.foreignField,
        as: j.as
      }
    });
    pipeline.push({ $unwind: `$${j.as}` });
  });

  // Add match stage for filters
  if (filters.length > 0) {
    const matchFilters = filters.map(f => ({
      field: resolveFieldPath(root, f),
      operator: f.operator,
      value: f.value
    })).filter(f => !['sum', 'avg', 'min', 'max', 'count'].includes(f.operator));

    if (matchFilters.length > 0) {
      pipeline.push({ $match: buildMatch(matchFilters) });
    }
  }

  return pipeline;
}

// Unified aggregation pipeline builder for complex queries with filters, aggregations, and HAVING
function buildAggregationPipeline(filters, aggregationOps = [], havingFilters = [], groupByFields = []) {
  const pipeline = [];

  // Build joins if needed
  const root = resolveRoot(filters);
  const joins = buildJoinPlan(root, filters);

  joins.forEach(j => {
    pipeline.push({
      $lookup: {
        from: j.from,
        localField: j.localField,
        foreignField: j.foreignField,
        as: j.as
      }
    });
    pipeline.push({ $unwind: `$${j.as}` });
  });

  // Add match stage for filters (WHERE clause)
  if (filters.length > 0) {
    const matchFilters = filters.map(f => ({
      field: resolveFieldPath(root, f),
      operator: f.operator,
      value: f.value
    })).filter(f => !['sum', 'avg', 'min', 'max', 'count'].includes(f.operator));

    if (matchFilters.length > 0) {
      pipeline.push({ $match: buildMatch(matchFilters) });
    }
  }

  // Add aggregation stages if needed
  if (aggregationOps.length > 0) {
    // Determine grouping fields - for now, we'll group by all available fields if groupByFields is provided
    // If no specific groupByFields are provided, we group all together for overall aggregates
    let groupStage = groupByFields && groupByFields.length > 0 ? { _id: {} } : { _id: null };

    // Add grouping fields to the _id object if specified
    if (groupByFields && groupByFields.length > 0) {
      groupByFields.forEach(fieldObj => {
        const fieldName = resolveFieldPath(root, fieldObj);
        groupStage._id[fieldObj.field] = `$${fieldName}`;
      });
    }

    aggregationOps.forEach(op => {
      if (op.operator === 'count') {
        groupStage[op.alias || 'count'] = { $sum: 1 };
      } else if (['sum', 'avg', 'min', 'max'].includes(op.operator)) {
        const fieldName = resolveFieldPath(root, { collection: op.collection, field: op.field });
        groupStage[op.alias || op.operator] = {
          [`$${op.operator}`]: `$${fieldName}`
        };
      }
    });

    pipeline.push({ $group: groupStage });
  }

  // Add post-aggregation match stage (HAVING clause)
  if (havingFilters.length > 0) {
    const havingMatch = {};

    havingFilters.forEach(h => {
      // Resolve field paths for HAVING clause (these refer to aggregation results)
      const field = h.field;  // In HAVING, this refers to the aggregation result field
      const operator = h.operator;
      const value = h.value;

      if (!OPERATORS[operator]) {
        throw new Error(`Invalid operator in HAVING clause: ${operator}`);
      }

      const condition = OPERATORS[operator](value);

      if (!havingMatch[field]) {
        havingMatch[field] = condition;
      } else {
        Object.assign(havingMatch[field], condition);
      }
    });

    if (Object.keys(havingMatch).length > 0) {
      pipeline.push({ $match: havingMatch });
    }
  }

  return pipeline;
}

app.post("/query", async (req, res) => {
  try {
    const { database, filters = [], aggregation = [], having = [], groupBy = [], preview = false } = req.body;

    console.log('Received filters:', JSON.stringify(filters, null, 2));

    if (!database) {
      return res.status(400).json({ error: "Database name is required" });
    }

    let detailedData = [];
    let aggregationData = [];
    let response = {};

    if (aggregation && aggregation.length > 0) {
      // When aggregation is present, build PostgreSQL query with GROUP BY
      // We must consider ALL collections involved (filters, aggregation, groupBy) to build the join plan
      // otherwise tables used only in aggregation/groupBy won't be joined
      const allSources = [...filters, ...aggregation, ...groupBy];

      const root = resolveRoot(allSources);
      const joinClauses = buildJoinClauses(root, allSources);

      // Resolve field paths for WHERE clause to avoid ambiguous column errors
      const resolvedFilters = filters.map(f => ({
        ...f,
        field: resolveFieldPath(root, f)
      }));
      const whereClause = buildWhereClause(resolvedFilters);

      // Build SELECT clause with aggregation functions
      const selectFields = [];
      const groupByFields = [];

      // Add grouping fields
      if (groupBy && groupBy.length > 0) {
        groupBy.forEach(gb => {
          const field = resolveFieldPath(root, gb);
          selectFields.push(`${field} as ${gb.field}`);
          groupByFields.push(field);
        });
      }

      // Add aggregation functions
      aggregation.forEach(op => {
        if (op.operator === 'count') {
          selectFields.push(`COUNT(*) as ${op.alias || 'count'}`);
        } else if (['sum', 'avg', 'min', 'max'].includes(op.operator)) {
          const fieldName = resolveFieldPath(root, { collection: op.collection, field: op.field });
          selectFields.push(`${OPERATORS[op.operator](fieldName, op.alias)}`);
        }
      });

      // Build GROUP BY clause
      const groupByClause = groupByFields.length > 0 ? `GROUP BY ${groupByFields.join(', ')}` : '';

      // Build HAVING clause
      let havingClause = '';
      const havingParams = [];
      if (having && having.length > 0) {
        const havingConditions = [];
        const havingParamCountRef = { count: whereClause.params.length + 1 };

        having.forEach(h => {
          if (!OPERATORS[h.operator]) {
            throw new Error(`Invalid operator in HAVING clause: ${h.operator}`);
          }

          // Check if h.field corresponds to an aggregation alias
          const aggOp = aggregation.find(op => op.alias === h.field);
          let fieldExpression = h.field;

          if (aggOp) {
            // Resolve alias to the actual aggregation expression
            // e.g. 'sum_total_amount' -> 'SUM(invoices.total_amount)'
            if (['sum', 'avg', 'min', 'max'].includes(aggOp.operator)) {
              const fieldName = resolveFieldPath(root, { collection: aggOp.collection, field: aggOp.field });
              fieldExpression = OPERATORS[aggOp.operator](fieldName, null).split(' AS ')[0]; // format: SUM(...)
            } else if (aggOp.operator === 'count') {
              fieldExpression = 'COUNT(*)';
            }
          }

          // Generate condition using the resolved expression
          const result = OPERATORS[h.operator](fieldExpression, h.value, havingParamCountRef);

          if (result.clause) {
            havingConditions.push(result.clause);
            if (Array.isArray(result.values)) {
              havingParams.push(...result.values);
            } else if (result.value !== undefined) {
              havingParams.push(result.value);
            }
          }
        });

        if (havingConditions.length > 0) {
          havingClause = `HAVING ${havingConditions.join(' AND ')}`;
        }
      }

      // Build final aggregation query
      // Execute aggregation query
      // Execute aggregation query
      const finalQueryParams = [...whereClause.params, ...havingParams];

      // Build final aggregation query
      const selectClause = selectFields.length > 0 ? `SELECT ${selectFields.join(', ')}` : 'SELECT *';
      const fromClause = `FROM ${root}`;
      const queryText = `${selectClause} ${fromClause} ${joinClauses} ${whereClause.clause} ${groupByClause} ${havingClause}`;

      console.log('Resolved Filters:', JSON.stringify(resolvedFilters, null, 2));
      console.log('Generated SQL:', queryText);
      console.log('Query Params:', finalQueryParams);

      // Handle preview mode
      if (preview) {
        try {
          const previewQuery = `${queryText} LIMIT 5`;
          const previewResult = await query(previewQuery, finalQueryParams);
          return res.json({
            success: true,
            type: 'preview',
            sql: queryText,
            data: previewResult.rows
          });
        } catch (err) {
          return res.json({
            success: false,
            type: 'preview',
            sql: queryText,
            error: err.message
          });
        }
      }

      // Execute aggregation query
      const aggregationResult = await query(queryText, finalQueryParams);
      aggregationData = aggregationResult.rows;

      // For detailed records when HAVING is used
      let detailedQuery = '';
      let detailedParams = [];

      if (having.length > 0 && groupBy.length > 0 && aggregationData.length > 0) {
        // Get the group values that passed HAVING
        const passingGroups = aggregationData.map(row => {
          const groupValues = {};
          groupBy.forEach(gb => {
            groupValues[gb.field] = row[gb.field];
          });
          return groupValues;
        });

        // Build detailed query with group filtering
        const selectFields = buildSelectFields(root, filters);
        const fromClause = `FROM ${root}`;

        // Build WHERE conditions for group filtering
        const groupConditions = [];
        let groupParamCount = 1;
        const groupParams = [];

        passingGroups.forEach((group, groupIndex) => {
          const groupCondition = [];
          Object.entries(group).forEach(([field, value]) => {
            if (value !== null && value !== undefined) {
              groupCondition.push(`${field} = $${groupParamCount++}`);
              groupParams.push(value);
            }
          });

          if (groupCondition.length > 0) {
            groupConditions.push(`(${groupCondition.join(' AND ')})`);
          }
        });

        const groupWhereClause = groupConditions.length > 0 ?
          `WHERE ${groupConditions.join(' OR ')}` : '';

        // Re-build the user filters WHERE clause with the correct parameter offset
        // The offset is: existing main query params + group params + 1
        const startIndex = groupParams.length + 1;

        // We need to resolve field paths again just like before
        const resolvedFiltersForDetail = filters.map(f => ({
          ...f,
          field: resolveFieldPath(root, f)
        }));

        const whereClauseForDetail = buildWhereClause(resolvedFiltersForDetail, startIndex);

        const userWhereClause = whereClauseForDetail.clause ?
          (groupWhereClause ? `AND ${whereClauseForDetail.clause.replace('WHERE ', '')}` : whereClauseForDetail.clause) :
          '';

        detailedQuery = `SELECT ${selectFields} ${fromClause} ${joinClauses} ${groupWhereClause} ${userWhereClause}`;
        detailedParams = [...groupParams, ...whereClauseForDetail.params];
      } else {
        // Regular detailed query
        const selectFields = buildSelectFields(root, filters);
        const fromClause = `FROM ${root}`;
        detailedQuery = `SELECT ${selectFields} ${fromClause} ${joinClauses} ${whereClause.clause}`;
        detailedParams = whereClause.params;
      }

      // Execute detailed query
      const detailedResult = await query(detailedQuery, detailedParams);
      detailedData = detailedResult.rows;

      response = {
        success: true,
        type: 'both',
        detailed_query: detailedQuery,
        aggregation_query: `${selectClause} ${fromClause} ${joinClauses} ${whereClause.clause} ${groupByClause} ${havingClause}`,
        detailed_count: detailedData.length,
        aggregation_count: aggregationData.length,
        detailed_data: detailedData,
        aggregation_data: aggregationData
      };
    } else {
      // Handle regular query (no aggregation)
      const root = resolveRoot(filters);
      const joinClauses = buildJoinClauses(root, filters);

      // Resolve field paths for WHERE clause to avoid ambiguous column errors
      const resolvedFilters = filters.map(f => ({
        ...f,
        field: resolveFieldPath(root, f)
      }));
      const whereClause = buildWhereClause(resolvedFilters);
      const selectFields = buildSelectFields(root, filters);
      const fromClause = `FROM ${root}`;

      const queryText = `SELECT ${selectFields} ${fromClause} ${joinClauses} ${whereClause.clause}`;

      if (preview) {
        try {
          const previewQuery = `${queryText} LIMIT 5`;
          const previewResult = await query(previewQuery, whereClause.params);
          return res.json({
            success: true,
            type: 'preview',
            sql: queryText,
            data: previewResult.rows
          });
        } catch (err) {
          return res.json({
            success: false,
            type: 'preview',
            sql: queryText,
            error: err.message
          });
        }
      }

      const result = await query(queryText, whereClause.params);
      detailedData = result.rows;

      response = {
        success: true,
        type: 'regular',
        root,
        query: queryText,
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
      // Send generic error message to prevent information disclosure but include details for debugging
      res.status(500).json({ error: "Internal server error", details: err.message });
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

    // Query to get table information from PostgreSQL
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    const tablesResult = await query(tablesQuery, []);
    const fields = [];

    for (const table of tablesResult.rows) {
      const columnsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        AND column_name != 'id'
      `;

      const columnsResult = await query(columnsQuery, [table.table_name]);

      columnsResult.rows.forEach(column => {
        fields.push({
          collection: table.table_name,
          value: column.column_name
        });
      });
    }

    res.json({ fields });
  } catch (err) {
    console.error('All-fields error:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Simple in-memory cache for suggestions
const suggestionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Endpoint to fetch distinct values for auto-suggestions using Materialized View
app.get("/suggestions", async (req, res) => {
  try {
    const { database, collection, field, query: searchQuery } = req.query;

    if (!collection || !field) {
      return res.status(400).json({ error: "Collection and field are required" });
    }

    // Basic sanitization
    const safeCollection = collection.replace(/[^a-zA-Z0-9_]/g, '');
    const safeField = field.replace(/[^a-zA-Z0-9_]/g, '');
    const safeQuery = searchQuery ? searchQuery.replace(/'/g, "''") : ''; // Escape single quotes

    // Generate cache key
    const cacheKey = `${safeCollection}:${safeField}:${safeQuery || '*'}`;

    // Check cache
    const cached = suggestionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      // console.log(`⚡ Serving suggestions from cache: ${cacheKey}`);
      return res.json({ suggestions: cached.data });
    }

    let sqlQuery;
    let params = [];

    // Query the Materialized View
    if (safeQuery) {
      // Optimized query using Composite GIN Index
      sqlQuery = `
        SELECT value
        FROM mv_search_suggestions 
        WHERE collection = $1 
        AND field = $2
        AND value ILIKE $3
        ORDER BY value
        LIMIT 10
      `;
      // GIN index supports efficient substring search, so we can do %query%
      params.push(safeCollection, safeField, `%${safeQuery}%`);
    } else {
      // Return first 10 distinct values if no query
      sqlQuery = `
        SELECT value
        FROM mv_search_suggestions 
        WHERE collection = $1 
        AND field = $2
        ORDER BY value
        LIMIT 10
      `;
      params.push(safeCollection, safeField);
    }

    const result = await query(sqlQuery, params);

    // Extract values
    const suggestions = result.rows.map(row => row.value);

    // Store in cache
    suggestionCache.set(cacheKey, {
      timestamp: Date.now(),
      data: suggestions
    });

    // Cleanup old cache entries periodically (every 100 requests roughly)
    if (suggestionCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of suggestionCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          suggestionCache.delete(key);
        }
      }
    }

    res.json({ suggestions });
  } catch (err) {
    console.error('Suggestions error:', err);
    // Fallback to empty suggestions on error rather than crashing
    res.status(500).json({ error: "Internal server error", suggestions: [] });
  }
});



// Function to enhance results with joined field information
async function enhanceResultsWithJoinedFields(db, data, filters) {
  if (!data || data.length === 0) return data;

  // Identify which collections were joined based on the filters
  const joinedCollections = new Set();
  filters.forEach(filter => {
    if (filter.collection !== 'invoices') { // assuming invoices is usually root
      joinedCollections.add(filter.collection);
    }
  });

  // Create a map of ID fields to collection mappings
  const idFieldMappings = {
    'customer_id': 'customers',
    'product_id': 'products',
    'category_id': 'categories'
  };

  // Process each record to add meaningful field information
  const enhancedRecords = [];

  for (const record of data) {
    const enhancedRecord = { ...record };

    // Check for ID fields in the root record and resolve them to names
    for (const [idField, collection] of Object.entries(idFieldMappings)) {
      if (enhancedRecord[idField]) {
        // Get the name/label for this ID from the corresponding collection
        const idValue = enhancedRecord[idField];

        try {
          // Fetch the document with this ID from the appropriate collection
          const doc = await db.collection(collection).findOne({ _id: idValue });
          if (doc) {
            // Find a suitable name field in the document
            const nameField = doc.name || doc.title || doc.label || doc._id;

            // Add a new field with the resolved name
            enhancedRecord[`${collection}_name`] = nameField;

            // Optionally, also add other useful fields
            if (doc.name) enhancedRecord[`${collection}_name`] = doc.name;
            if (doc.region) enhancedRecord[`customer_region`] = doc.region;
            if (doc.zone) enhancedRecord[`customer_zone`] = doc.zone;
          }
        } catch (error) {
          console.warn(`Could not resolve ${idField} to ${collection} name:`, error.message);
        }
      }
    }

    enhancedRecords.push(enhancedRecord);
  }

  return enhancedRecords;
}

// Save query configuration endpoint
app.post("/save-query-config", async (req, res) => {
  try {
    const { name, description, filters = [], aggregation = [], having = [], groupBy = [] } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    // Create query_configs table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS query_configs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filters JSONB,
        aggregation JSONB,
        "having" JSONB,
        group_by JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await query(createTableQuery, []);

    // Ensure 'having' column exists (migration for existing tables)
    try {
      await query(`ALTER TABLE query_configs ADD COLUMN IF NOT EXISTS "having" JSONB`, []);
    } catch (e) {
      console.log('Migration note: checking for having column');
    }

    // Insert the configuration
    const insertQuery = `
      INSERT INTO query_configs (name, description, filters, aggregation, "having", group_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const result = await query(insertQuery, [
      name,
      description,
      JSON.stringify(filters),
      JSON.stringify(aggregation),
      JSON.stringify(having),
      JSON.stringify(groupBy)
    ]);

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Save query config error:', err);
    res.status(500).json({ error: "Failed to save query config", details: err.message });
  }
});

// Get all saved query configurations
app.get("/query-configs", async (req, res) => {
  try {
    // Create query_configs table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS query_configs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filters JSONB,
        aggregation JSONB,
        "having" JSONB,
        group_by JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await query(createTableQuery, []);

    // Ensure 'having' column exists (migration for existing tables)
    try {
      await query(`ALTER TABLE query_configs ADD COLUMN IF NOT EXISTS "having" JSONB`, []);
    } catch (e) {
      // Ignore error if column exists or not supported (though IF NOT EXISTS handles most)
      console.log('Migration note: checking for having column');
    }

    // Get all configurations
    const selectQuery = `
      SELECT id, name, description, filters, aggregation, "having", group_by, created_at, updated_at
      FROM query_configs
      ORDER BY created_at DESC
    `;

    const result = await query(selectQuery, []);

    // Parse JSON fields
    const configs = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      filters: row.filters || [],
      aggregation: row.aggregation || [],
      having: row.having || [],
      groupBy: row.group_by || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({ configs });
  } catch (err) {
    console.error('Fetch configs error:', err);
    res.status(500).json({ error: "Failed to fetch query configs", details: err.message });
  }
});

// Delete saved query configuration
app.delete("/query-config/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Create query_configs table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS query_configs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filters JSONB,
        aggregation JSONB,
        "having" JSONB,
        group_by JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await query(createTableQuery, []);

    // Delete the configuration
    const deleteQuery = `DELETE FROM query_configs WHERE id = $1`;
    const result = await query(deleteQuery, [id]);

    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete config error:', err);
    res.status(500).json({ error: "Failed to delete query config" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
