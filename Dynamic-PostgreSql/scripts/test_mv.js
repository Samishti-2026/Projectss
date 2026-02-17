
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

async function testMaterializedView() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing Materialized View...');

    // Check count
    const countRes = await client.query('SELECT COUNT(*) FROM mv_search_suggestions');
    console.log(`📊 Total suggestions in MV: ${countRes.rows[0].count}`);

    // Check sample data
    const sampleRes = await client.query('SELECT * FROM mv_search_suggestions LIMIT 5');
    console.log('👀 Sample suggestions:');
    console.table(sampleRes.rows);

    // Test search query (simulate autosuggestion)
    // We'll pick a value from the sample to search for
    if (sampleRes.rows.length > 0) {
      const sample = sampleRes.rows[0];
      const partial = sample.value.substring(0, 3);
      console.log(`🔎 Testing search for prefix '${partial}' in ${sample.collection}.${sample.field}...`);

      const searchRes = await client.query(`
        SELECT value 
        FROM mv_search_suggestions 
        WHERE collection = $1 
        AND field = $2 
        AND value ILIKE $3
        LIMIT 5
      `, [sample.collection, sample.field, `${partial}%`]);

      console.log(`✅ Found ${searchRes.rows.length} matches.`);
      console.table(searchRes.rows);
    }

  } catch (err) {
    console.error('❌ Error testing MV:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

testMaterializedView();
