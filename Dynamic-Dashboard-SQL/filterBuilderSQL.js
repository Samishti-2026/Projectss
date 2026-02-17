// SQL Operators mapping
const SQL_OPERATORS = {
  // Comparison operators
  '$eq': '=',
  '$ne': '!=',
  '$gt': '>',
  '$gte': '>=',
  '$lt': '<',
  '$lte': '<=',
  '$in': 'IN',
  '$nin': 'NOT IN',
  '$regex': 'LIKE',
  '$exists': 'IS NOT NULL',
  '$notexists': 'IS NULL',
  
  // Logical operators
  '$and': 'AND',
  '$or': 'OR',
  '$not': 'NOT'
};

// Aggregation operators
const AGGREGATION_OPERATORS = {
  sum: 'SUM',
  avg: 'AVG',
  min: 'MIN',
  max: 'MAX',
  count: 'COUNT'
};

/**
 * Builds SQL WHERE clause from filter object
 * @param {Object} filter - Filter object from UI
 * @param {Array} tables - List of tables in query
 * @returns {Object} { whereClause, params }
 */
export function buildSQLFilter(filter, tables) {
  if (!filter || Object.keys(filter).length === 0) {
    return { whereClause: '', params: [] };
  }

  const conditions = [];
  const params = [];

  function buildCondition(key, value, prefix = '') {
    if (value === null || value === undefined) return;

    // Handle nested operators like $gt, $lt, etc.
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, opValue] of Object.entries(value)) {
        if (SQL_OPERATORS[op]) {
          const sqlOp = SQL_OPERATORS[op];
          const column = prefix ? `${prefix}.${key}` : key;
          
          if (op === '$in' || op === '$nin') {
            // Handle array values for IN/NOT IN
            if (Array.isArray(opValue)) {
              const placeholders = opValue.map(() => '?').join(', ');
              conditions.push(`${column} ${sqlOp} (${placeholders})`);
              params.push(...opValue);
            }
          } else if (op === '$regex') {
            // Handle regex patterns
            if (typeof opValue === 'string') {
              conditions.push(`${column} LIKE ?`);
              params.push(opValue.replace(/\.\*/g, '%').replace(/\*/g, '%'));
            }
          } else {
            // Standard operators
            conditions.push(`${column} ${sqlOp} ?`);
            params.push(opValue);
          }
        }
      }
    } else {
      // Direct equality
      const column = prefix ? `${prefix}.${key}` : key;
      conditions.push(`${column} = ?`);
      params.push(value);
    }
  }

  // Process each filter condition
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('$')) {
      // Logical operators like $and, $or
      if (key === '$and' && Array.isArray(value)) {
        const andConditions = [];
        value.forEach(cond => {
          const { whereClause: subClause, params: subParams } = buildSQLFilter(cond, tables);
          if (subClause) {
            andConditions.push(`(${subClause})`);
            params.push(...subParams);
          }
        });
        if (andConditions.length > 0) {
          conditions.push(andConditions.join(' AND '));
        }
      } else if (key === '$or' && Array.isArray(value)) {
        const orConditions = [];
        value.forEach(cond => {
          const { whereClause: subClause, params: subParams } = buildSQLFilter(cond, tables);
          if (subClause) {
            orConditions.push(`(${subClause})`);
            params.push(...subParams);
          }
        });
        if (orConditions.length > 0) {
          conditions.push(orConditions.join(' OR '));
        }
      }
    } else {
      // Regular field condition
      buildCondition(key, value);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}