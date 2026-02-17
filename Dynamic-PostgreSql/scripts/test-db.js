import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

console.log('Testing connection to:', connectionString.replace(/:[^:]*@/, ':****@')); // Mask password

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Successfully acquired client from pool');
    const res = await client.query('SELECT NOW() as now');
    console.log('✅ Query successful:', res.rows[0].now);
    client.release();
    await pool.end();
    console.log('✅ Connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection error:', err);
    process.exit(1);
  }
}

testConnection();
