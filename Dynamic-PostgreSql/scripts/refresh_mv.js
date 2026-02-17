
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const config = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
};

if (!process.env.DATABASE_URL) {
  config.user = process.env.PG_USER || 'postgres';
  config.host = process.env.PG_HOST || 'localhost';
  config.database = process.env.PG_DATABASE || 'dashboard';
  config.password = process.env.PG_PASSWORD || 'postgres';
  config.port = process.env.PG_PORT || 5432;
}

const pool = new Pool(config);

async function refreshMaterializedView() {
  const client = await pool.connect();
  try {
    console.log('🔄 Refreshing Materialized View (CONCURRENTLY)...');

    const start = Date.now();
    await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_suggestions');
    const duration = Date.now() - start;

    console.log(`✅ Refreshed successfully in ${duration}ms`);
  } catch (err) {
    console.error('❌ Error refreshing MV:', err.message);
    if (err.message.includes('does not have a unique index')) {
      console.log('💡 Hint: Run "node scripts/setup_mv.js" to create the required unique index.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

refreshMaterializedView();
