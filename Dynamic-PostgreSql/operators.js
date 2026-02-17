// Regular operators for PostgreSQL
function maybeNumber(v) {
  if (typeof v === "string" && v.trim() !== "" && !isNaN(v)) {
    return Number(v);
  }
  return v;
}

function maybeDate(v) {
  // Check if it looks like a date string (YYYY-MM-DD or DD-MM-YYYY)
  if (typeof v === "string") {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const date = new Date(v);
      if (date.toString() !== 'Invalid Date') return date.toISOString().split('T')[0];
    }
    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = v.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (dmyMatch) {
      const [_, day, month, year] = dmyMatch;
      const date = new Date(`${year}-${month}-${day}`);
      if (date.toString() !== 'Invalid Date') return date.toISOString().split('T')[0];
    }
  }
  return v;
}

// PostgreSQL operator builder functions
const STANDARD_OPERATORS = {
  eq: (field, value, paramCountRef) => {
    const processedValue = maybeDate(maybeNumber(value));
    const isEmptyString = processedValue === '';

    // If field contains a function call (like SUM(...)), don't cast to TEXT
    // because that breaks the function syntax or context
    const isFunctionCall = field.includes('(') && field.includes(')');

    // Only cast plain fields to text for empty string comparison
    const castField = isEmptyString && !isFunctionCall ? `CAST(${field} AS TEXT)` : field;

    return {
      clause: `${castField} = $${paramCountRef.count++}`,
      value: processedValue
    };
  },

  ne: (field, value, paramCountRef) => {
    const processedValue = maybeDate(maybeNumber(value));
    const isEmptyString = processedValue === '';

    // Check if field contains a function call
    const isFunctionCall = field.includes('(') && field.includes(')');
    const castField = isEmptyString && !isFunctionCall ? `CAST(${field} AS TEXT)` : field;

    return {
      clause: `${castField} != $${paramCountRef.count++}`,
      value: processedValue
    };
  },

  gt: (field, value, paramCountRef) => {
    return {
      clause: `${field} > $${paramCountRef.count++}`,
      value: maybeDate(maybeNumber(value))
    };
  },

  gte: (field, value, paramCountRef) => {
    return {
      clause: `${field} >= $${paramCountRef.count++}`,
      value: maybeDate(maybeNumber(value))
    };
  },

  lt: (field, value, paramCountRef) => {
    return {
      clause: `${field} < $${paramCountRef.count++}`,
      value: maybeDate(maybeNumber(value))
    };
  },

  lte: (field, value, paramCountRef) => {
    return {
      clause: `${field} <= $${paramCountRef.count++}`,
      value: maybeDate(maybeNumber(value))
    };
  },

  startsWith: (field, value, paramCountRef) => ({
    clause: `CAST(${field} AS TEXT) ILIKE $${paramCountRef.count++}`,
    value: `${value}%`
  }),

  endsWith: (field, value, paramCountRef) => ({
    clause: `CAST(${field} AS TEXT) ILIKE $${paramCountRef.count++}`,
    value: `%${value}`
  }),

  contains: (field, value, paramCountRef) => ({
    clause: `CAST(${field} AS TEXT) ILIKE $${paramCountRef.count++}`,
    value: `%${value}%`
  }),

  in: (field, values, paramCountRef) => {
    if (!Array.isArray(values)) values = [values];
    const placeholders = values.map((_, i) => `$${paramCountRef.count + i}`).join(', ');
    const processedValues = values.map(item => maybeDate(maybeNumber(item)));
    paramCountRef.count += values.length;
    return {
      clause: `${field} IN (${placeholders})`,
      values: processedValues
    };
  },

  between: (field, value, paramCountRef) => ({
    clause: `${field} BETWEEN $${paramCountRef.count++} AND $${paramCountRef.count++}`,
    values: [maybeDate(maybeNumber(value.from)), maybeDate(maybeNumber(value.to))]
  })
};

// Aggregation functions for PostgreSQL
const AGGREGATION_FUNCTIONS = {
  sum: (field, alias) => `SUM(${field}) AS ${alias || 'sum'}`,
  avg: (field, alias) => `AVG(${field}) AS ${alias || 'avg'}`,
  min: (field, alias) => `MIN(${field}) AS ${alias || 'min'}`,
  max: (field, alias) => `MAX(${field}) AS ${alias || 'max'}`,
  count: (field, alias) => `COUNT(*) AS ${alias || 'count'}`,
  first: (field, alias) => `FIRST_VALUE(${field}) AS ${alias || 'first'}`, // Using FIRST_VALUE instead of FIRST
  last: (field, alias) => `LAST_VALUE(${field}) AS ${alias || 'last'}`     // Using LAST_VALUE instead of LAST
};

// Combined operators
const OPERATORS = {
  ...STANDARD_OPERATORS,
  ...AGGREGATION_FUNCTIONS
};

export { AGGREGATION_FUNCTIONS };
export default OPERATORS;
