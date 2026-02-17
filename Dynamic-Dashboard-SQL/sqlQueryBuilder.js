import pool from './db.js';
import { buildSQLFilter } from './filterBuilderSQL.js';

/**
 * Executes SQL query with joins and filters
 * @param {Object} queryPlan - Query plan from joinPlanner
 * @param {Object} filter - Filter object from UI
 * @param {Array} aggregations - Aggregation operations
 * @returns {Object} Query results
 */
export async function executeSQLQuery(queryPlan, filter, aggregations) {
  try {
    const { tables, joins, projection } = queryPlan;
    
    if (tables.length === 0) {
      throw new Error('No tables specified in query plan');
    }

    // Build SELECT clause
    const selectFields = projection.map(field => {
      if (field.includes('.')) {
        return field; // Already qualified (table.column)
      }
      // Qualify with first table if not already qualified
      return `${tables[0]}.${field}`;
    }).join(', ');

    // Build FROM clause
    let fromClause = tables[0];
    
    // Build JOIN clauses
    const joinClauses = joins.map(join => {
      const { from, to, type = 'INNER' } = join;
      
      // Validate that from and to exist and have the expected format
      if (!from || !to) {
        console.warn('Invalid join configuration:', join);
        return '';
      }
      
      const [fromTable, fromField] = from.split('.');
      const [toTable, toField] = to.split('.');
      
      // Validate that we have proper table.field format
      if (!fromTable || !fromField || !toTable || !toField) {
        console.warn('Invalid join format (expected table.field format):', join);
        return '';
      }
      
      return `${type} JOIN ${toTable} ON ${fromTable}.${fromField} = ${toTable}.${toField}`;
    }).filter(clause => clause.trim() !== '').join(' ');

    // Build WHERE clause
    const { whereClause, params } = buildSQLFilter(filter, tables);

    // Build main query
    let query = `SELECT ${selectFields} FROM ${fromClause}`;
    if (joinClauses) query += ` ${joinClauses}`;
    if (whereClause) query += ` ${whereClause}`;

    console.log('🔍 Executing SQL Query:', query);
    console.log('📋 Parameters:', params);

    // Execute main query
    const [rows] = await pool.execute(query, params);

    // Handle aggregations
    let aggregationResults = [];
    if (aggregations && aggregations.length > 0) {
      aggregationResults = await executeAggregations(aggregations, queryPlan, filter);
    }

    return {
      success: true,
      data: rows,
      aggregations: aggregationResults,
      query: query,
      params: params
    };

  } catch (error) {
    console.error('❌ SQL Query Execution Error:', error);
    return {
      success: false,
      error: error.message,
      data: [],
      aggregations: []
    };
  }
}

/**
 * Execute aggregation operations
 * @param {Array} aggregations - Array of aggregation operations
 * @param {Object} queryPlan - Query plan
 * @param {Object} filter - Filter object
 * @returns {Array} Aggregation results
 */
async function executeAggregations(aggregations, queryPlan, filter) {
  const results = [];
  
  for (const agg of aggregations) {
    try {
      const { operation, field, alias } = agg;
      const { tables, joins } = queryPlan;
      
      let aggQuery = `SELECT `;
      
      // Build aggregation expression
      switch (operation.toLowerCase()) {
        case 'count':
          aggQuery += field === '*' ? 'COUNT(*)' : `COUNT(${field})`;
          break;
        case 'sum':
          aggQuery += `SUM(${field})`;
          break;
        case 'avg':
          aggQuery += `AVG(${field})`;
          break;
        case 'min':
          aggQuery += `MIN(${field})`;
          break;
        case 'max':
          aggQuery += `MAX(${field})`;
          break;
        default:
          throw new Error(`Unsupported aggregation operation: ${operation}`);
      }
      
      aggQuery += ` as ${alias || operation}_${field.replace(/\./g, '_')}`;
      
      // Build FROM and JOIN clauses
      aggQuery += ` FROM ${tables[0]}`;
      if (joins.length > 0) {
        const joinClauses = joins.map(join => {
          const { from, to, type = 'INNER' } = join;
          
          // Validate that from and to exist and have the expected format
          if (!from || !to) {
            console.warn('Invalid join configuration in aggregation:', join);
            return '';
          }
          
          const [fromTable, fromField] = from.split('.');
          const [toTable, toField] = to.split('.');
          
          // Validate that we have proper table.field format
          if (!fromTable || !fromField || !toTable || !toField) {
            console.warn('Invalid join format in aggregation (expected table.field format):', join);
            return '';
          }
          
          return `${type} JOIN ${toTable} ON ${fromTable}.${fromField} = ${toTable}.${toField}`;
        }).filter(clause => clause.trim() !== '').join(' ');
        aggQuery += ` ${joinClauses}`;
      }
      
      // Add filter
      const { whereClause, params } = buildSQLFilter(filter, tables);
      if (whereClause) {
        aggQuery += ` ${whereClause}`;
      }
      
      console.log('📊 Executing Aggregation:', aggQuery);
      
      const [aggRows] = await pool.execute(aggQuery, params);
      results.push({
        operation,
        field,
        alias: alias || `${operation}_${field.replace(/\./g, '_')}`,
        value: aggRows[0][Object.keys(aggRows[0])[0]]
      });
      
    } catch (error) {
      console.error(`❌ Aggregation Error (${agg.operation} on ${agg.field}):`, error);
      results.push({
        operation: agg.operation,
        field: agg.field,
        alias: agg.alias || `${agg.operation}_${agg.field.replace(/\./g, '_')}`,
        error: error.message,
        value: null
      });
    }
  }
  
  return results;
}

/**
 * Get table schema information
 * @param {string} tableName - Name of the table
 * @returns {Object} Table schema
 */
export async function getTableSchema(tableName) {
  try {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z0-9_$]+$/.test(tableName)) {
      throw new Error('Invalid table name');
    }
    
    const [rows] = await pool.execute(
      `DESCRIBE \`${tableName}\``
    );
    
    return {
      success: true,
      tableName,
      columns: rows.map(row => ({
        name: row.Field,
        type: row.Type,
        nullable: row.Null === 'YES',
        key: row.Key,
        default: row.Default,
        extra: row.Extra
      }))
    };
  } catch (error) {
    console.error(`❌ Error getting schema for table ${tableName}:`, error);
    return {
      success: false,
      tableName,
      error: error.message,
      columns: []
    };
  }
}

/**
 * Get list of all tables in database
 * @returns {Array} List of table names
 */
export async function getTableList() {
  try {
    const [rows] = await pool.execute('SHOW TABLES');
    const tableNames = rows.map(row => Object.values(row)[0]);
    
    return {
      success: true,
      tables: tableNames
    };
  } catch (error) {
    console.error('❌ Error getting table list:', error);
    return {
      success: false,
      error: error.message,
      tables: []
    };
  }
}