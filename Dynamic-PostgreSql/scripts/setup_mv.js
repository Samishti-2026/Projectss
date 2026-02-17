
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// PostgreSQL connection configuration
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

async function setupMaterializedView() {
  let client;
  try {
    client = await pool.connect();
    console.log('🔌 Connected to database...');

    const tables = ['invoices', 'customers', 'products', 'categories'];
    let unionQueries = [];

    for (const table of tables) {
      // Check if table exists
      const tableCheck = await client.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = $1
         )`,
        [table]
      );

      if (!tableCheck.rows[0].exists) {
        console.warn(`⚠️ Table '${table}' does not exist, skipping...`);
        continue;
      }

      // Get text columns
      const columnsRes = await client.query(
        `SELECT column_name
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = $1 
         AND data_type IN ('character varying', 'text', 'character')`,
        [table]
      );

      if (columnsRes.rows.length === 0) {
        console.warn(`⚠️ No text columns found in '${table}', skipping...`);
        continue;
      }

      // Build UNION query part for this table
      const columnSelects = columnsRes.rows.map(col => {
        return `SELECT DISTINCT "${col.column_name}" AS value, '${table}' AS collection, '${col.column_name}' AS field FROM "${table}" WHERE "${col.column_name}" IS NOT NULL`;
      });

      unionQueries.push(...columnSelects);
      console.log(`✅ Found ${columnsRes.rows.length} text columns in '${table}'`);
    }

    if (unionQueries.length === 0) {
      console.error('❌ No suitable columns found to build the view.');
      return;
    }

    const fullQuery = unionQueries.join(' UNION ');

    // Create Materialized View
    console.log('🔄 Creating Materialized View (mv_search_suggestions)...');

    await client.query('DROP MATERIALIZED VIEW IF EXISTS mv_search_suggestions CASCADE');

    await client.query(`
      CREATE MATERIALIZED VIEW mv_search_suggestions AS
      ${fullQuery}
    `);

    console.log('✅ Materialized View created.');

    // Enable pg_trgm extension for GIN indexing
    console.log('🔌 Enabling pg_trgm extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    // Enable btree_gin extension for composite GIN indexing
    console.log('🔌 Enabling btree_gin extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gin');

    // Composite GIN Index for fast filtering AND text search
    // This allows Postgres to use ONE index to filter by collection/field AND search text
    console.log('🚀 Creating Optimized Composite GIN Index...');
    await client.query(`
      CREATE INDEX idx_mv_suggestions_combined 
      ON mv_search_suggestions USING GIN (collection, field, value gin_trgm_ops)
    `);

    // UNIQUE Index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
    console.log('🔒 Creating UNIQUE Index...');
    await client.query(`
      CREATE UNIQUE INDEX idx_mv_suggestions_unique
      ON mv_search_suggestions (collection, field, value)
    `);

    console.log('✅ Optimized Indexes created successfully.');
    console.log('🎉 Autosuggestion setup complete!');

  } catch (err) {
    console.error('❌ Error setting up Materialized View:', err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setupMaterializedView();
