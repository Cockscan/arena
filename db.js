const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let dbReady = false;

// Only create pool if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

// Create the users table if it doesn't exist
async function initDB() {
  if (!pool) {
    console.log('  No DATABASE_URL set — running without database (auth will use fallback)');
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          payment_status VARCHAR(20) DEFAULT 'pending',
          payment_id VARCHAR(255),
          payment_amount INTEGER DEFAULT 0,
          paid_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Add payment columns if they don't exist (for existing databases)
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_amount INTEGER DEFAULT 0;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
        END $$;
      `);

      // Create indexes for fast lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));
      `);

      dbReady = true;
      console.log('  PostgreSQL connected — Users table ready');
    } finally {
      client.release();
    }
  } catch (err) {
    console.log('  Could not connect to PostgreSQL — running without database');
    console.log(`  (${err.message})`);
    dbReady = false;
  }
}

function isDBReady() {
  return dbReady && pool !== null;
}

module.exports = { pool, initDB, isDBReady };
