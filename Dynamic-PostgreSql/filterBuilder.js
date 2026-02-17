import OPERATORS from "./operators.js";

export function buildWhereClause(filters, startIndex = 1) {
  if (!filters || filters.length === 0) {
    return { clause: '', params: [] };
  }

  const groups = [];
  const params = [];
  const paramCountRef = { count: startIndex };

  // Grouping Algorithm:
  // We process filters sequentially.
  // - Logic 'AND' starts a new group.
  // - Logic 'OR' appends to the current group.
  // - "Smart AND" (Same Field EQ) is treated as 'OR' -> appends to current group.

  let currentGroup = [];

  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    if (!OPERATORS[f.operator]) {
      throw new Error(`Invalid operator: ${f.operator}`);
    }

    const result = OPERATORS[f.operator](f.field, f.value, paramCountRef);

    if (result.clause) {
      let logic = f.logic || 'AND';

      // Smart Logic Check: Switch AND to OR for consecutive same-field Equality checks
      if (i > 0) {
        const prevFilter = filters[i - 1];
        if (prevFilter.field === f.field &&
          prevFilter.operator === 'eq' &&
          f.operator === 'eq' &&
          logic === 'AND') {
          logic = 'OR';
        }
      }

      // Push values regardless of group logic (order is preserved by iteration)
      if (Array.isArray(result.values)) {
        params.push(...result.values);
      } else if (result.value !== undefined) {
        params.push(result.value);
      }

      // Grouping Decision
      if (groups.length === 0 && currentGroup.length === 0) {
        // First item always starts the first group
        currentGroup.push(result.clause);
      } else if (logic === 'OR') {
        // OR means "Add to current group" (tight binding)
        currentGroup.push(result.clause);
      } else {
        // AND means "Close current group and start new one"
        // Push completed group
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        // Start new group with this item
        currentGroup = [result.clause];
      }
    }
  }

  // Push the final group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Build String: (A OR B) AND (C OR D)
  const groupStrings = groups.map(g => {
    if (g.length === 1) return g[0];
    return `(${g.join(' OR ')})`;
  });

  const whereClause = groupStrings.length > 0 ? `WHERE ${groupStrings.join(' AND ')}` : '';

  return {
    clause: whereClause,
    params: params
  };
}

// For backward compatibility
export function buildMatch(filters) {
  return buildWhereClause(filters);
}
