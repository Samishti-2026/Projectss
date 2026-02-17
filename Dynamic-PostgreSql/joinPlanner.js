import RELATIONS from "./relations.js";
import { findPath } from "./pathResolver.js";

function dedupe(arr, keyFn) {
  const seen = new Set();
  return arr.filter(i => {
    const k = keyFn(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function buildJoinPlan(root, filters) {
  let joins = [];

  for (const f of filters) {
    if (f.collection === root) continue;

    const path = findPath(root, f.collection);
    if (!path) continue;

    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];

      const rel = RELATIONS.find(
        r =>
          (r.from === a && r.to === b) ||
          (r.from === b && r.to === a)
      );

      joins.push({
        from: b,
        localField: rel.from === a ? rel.local : rel.foreign,
        foreignField: rel.from === a ? rel.foreign : rel.local,
        as: b
      });
    }
  }

  return dedupe(
    joins,
    j => `${j.from}:${j.localField}:${j.foreignField}`
  );
}

// Generate PostgreSQL JOIN clauses
export function buildJoinClauses(root, filters) {
  const joins = buildJoinPlan(root, filters);
  const joinClauses = [];
  
  for (const join of joins) {
    // Convert field names to PostgreSQL format (assuming snake_case)
    const localField = join.localField.replace(/_id$/, '_id'); // Keep as is for IDs
    const foreignField = join.foreignField.replace(/_id$/, '_id');
    
    joinClauses.push(
      `JOIN ${join.from} ON ${root}.${localField} = ${join.from}.${foreignField}`
    );
  }
  
  return joinClauses.join(' ');
}

// Generate SELECT fields for joined tables
export function buildSelectFields(root, filters, additionalFields = []) {
  const fields = [`${root}.*`]; // Start with all fields from root table
  
  // Add fields from joined tables
  const joins = buildJoinPlan(root, filters);
  for (const join of joins) {
    // Add common fields from joined tables
    fields.push(`${join.from}.name as ${join.from}_name`);
    fields.push(`${join.from}.id as ${join.from}_id`);
    
    // Add any additional fields specified
    if (additionalFields.includes(join.from)) {
      fields.push(`${join.from}.*`);
    }
  }
  
  return fields.join(', ');
}
