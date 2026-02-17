import pg from 'pg';

const { Pool } = pg;

// PostgreSQL connection configuration
const PG_CONFIG = {
  // Connection pool settings
  max: 10, // reduced from 20
  idleTimeoutMillis: 10000, // reduced from 30000
  connectionTimeoutMillis: 5000, // reduced from 2000
  // Add keepalive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

if (process.env.DATABASE_URL) {
  PG_CONFIG.connectionString = process.env.DATABASE_URL;
  PG_CONFIG.ssl = {
    rejectUnauthorized: false
  };
} else {
  PG_CONFIG.user = process.env.PG_USER || 'postgres';
  PG_CONFIG.host = process.env.PG_HOST || 'localhost';
  PG_CONFIG.database = process.env.PG_DATABASE || 'dashboard';
  PG_CONFIG.password = process.env.PG_PASSWORD || 'postgres';
  PG_CONFIG.port = process.env.PG_PORT || 5432;
}

let pool;

export function getDB() {
  try {
    if (!pool) {
      pool = new Pool(PG_CONFIG);

      // Handle pool errors
      pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        // Don't exit process, just log the error
      });

      console.log("✅ PostgreSQL connected securely");
    }
    return pool;
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err.message);
    throw new Error(`Failed to connect to PostgreSQL: ${err.message}`);
  }
}

// Helper function to execute queries
export async function query(text, params) {
  const client = await getDB().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Helper function to execute multiple queries in a transaction
export async function queryTransaction(queries) {
  const client = await getDB().connect();
  try {
    await client.query('BEGIN');

    const results = [];
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }

    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
