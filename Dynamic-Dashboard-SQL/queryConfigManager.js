import pool from './db.js';

/**
 * Query Configuration Management - Minimal Implementation
 * Provides essential CRUD operations for saved query templates
 */

// Safe JSON parsing function
function parseJSONSafely(jsonString) {
  if (!jsonString) return [];
  
  try {
    // Handle both string and object inputs
    if (typeof jsonString === 'string') {
      return JSON.parse(jsonString);
    }
    return jsonString; // Already parsed
  } catch (error) {
    console.warn('⚠️ JSON parse warning:', error.message, 'Value:', jsonString);
    return []; // Return empty array as fallback
  }
}

// Initialize query_configs table
export async function initializeConfigTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS query_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filters JSON,
        aggregation JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('✅ Query configs table initialized');
  } catch (error) {
    console.error('❌ Failed to initialize query configs table:', error.message);
  }
}

// Save query configuration
export async function saveQueryConfig(name, description, filters = [], aggregation = []) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO query_configs (name, description, filters, aggregation) VALUES (?, ?, ?, ?)`,
      [name, description, JSON.stringify(filters), JSON.stringify(aggregation)]
    );
    
    return {
      success: true,
      id: result.insertId,
      name,
      description,
      filters,
      aggregation,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Save query config error:', error);
    return { success: false, error: error.message };
  }
}

// Get all query configurations
export async function getAllQueryConfigs() {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, description, filters, aggregation, created_at, updated_at 
       FROM query_configs ORDER BY created_at DESC`
    );
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      filters: parseJSONSafely(row.filters),
      aggregation: parseJSONSafely(row.aggregation),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error('❌ Get query configs error:', error);
    return [];
  }
}

// Get query configuration by ID
export async function getQueryConfigById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, description, filters, aggregation, created_at, updated_at 
       FROM query_configs WHERE id = ?`, [id]
    );
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      filters: parseJSONSafely(row.filters),
      aggregation: parseJSONSafely(row.aggregation),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('❌ Get query config by ID error:', error);
    return null;
  }
}

// Update query configuration
export async function updateQueryConfig(id, updates) {
  try {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.filters !== undefined) {
      fields.push('filters = ?');
      values.push(JSON.stringify(updates.filters));
    }
    if (updates.aggregation !== undefined) {
      fields.push('aggregation = ?');
      values.push(JSON.stringify(updates.aggregation));
    }
    
    if (fields.length === 0) {
      return { success: false, error: 'No fields to update' };
    }
    
    values.push(id);
    
    const [result] = await pool.execute(
      `UPDATE query_configs SET ${fields.join(', ')} WHERE id = ?`, values
    );
    
    if (result.affectedRows === 0) {
      return { success: false, error: 'Configuration not found' };
    }
    
    return { success: true, message: 'Configuration updated successfully' };
  } catch (error) {
    console.error('❌ Update query config error:', error);
    return { success: false, error: error.message };
  }
}

// Delete query configuration
export async function deleteQueryConfig(id) {
  try {
    const [result] = await pool.execute(`DELETE FROM query_configs WHERE id = ?`, [id]);
    
    if (result.affectedRows === 0) {
      return { success: false, error: 'Configuration not found' };
    }
    
    return { success: true, message: 'Configuration deleted successfully' };
  } catch (error) {
    console.error('❌ Delete query config error:', error);
    return { success: false, error: error.message };
  }
}

// Search query configurations
export async function searchQueryConfigs(searchTerm) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, description, filters, aggregation, created_at, updated_at 
       FROM query_configs WHERE name LIKE ? OR description LIKE ?
       ORDER BY created_at DESC`, [`%${searchTerm}%`, `%${searchTerm}%`]
    );
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      filters: parseJSONSafely(row.filters),
      aggregation: parseJSONSafely(row.aggregation),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error('❌ Search query configs error:', error);
    return [];
  }
}