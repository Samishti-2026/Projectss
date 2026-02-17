
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

async function getDef() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT definition FROM pg_matviews WHERE matviewname = 'mv_search_suggestions'");
    if (res.rows.length > 0) {
      console.log('---BEGIN DEF---');
      console.log(res.rows[0].definition);
      console.log('---END DEF---');
    } else {
      console.log('View not found');
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

getDef();
