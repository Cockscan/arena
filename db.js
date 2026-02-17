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

// No seed data — all videos are managed via admin panel uploads

// Create tables and seed data
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

      // Videos table
      await client.query(`
        CREATE TABLE IF NOT EXISTS videos (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          sport VARCHAR(50) NOT NULL,
          price INTEGER NOT NULL DEFAULT 4900,
          thumbnail_url TEXT NOT NULL,
          video_url TEXT,
          duration VARCHAR(20) NOT NULL DEFAULT '0:00',
          channel_name VARCHAR(100) NOT NULL,
          channel_avatar CHAR(1) NOT NULL DEFAULT 'A',
          views VARCHAR(20) DEFAULT '0',
          likes VARCHAR(20) DEFAULT '0',
          tag VARCHAR(50),
          is_live BOOLEAN DEFAULT false,
          is_premium BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Purchases table
      await client.query(`
        CREATE TABLE IF NOT EXISTS purchases (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
          payment_id VARCHAR(255) NOT NULL,
          order_id VARCHAR(255),
          payment_amount INTEGER NOT NULL,
          purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, video_id)
        );
      `);

      // Wallets table
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallets (
          id SERIAL PRIMARY KEY,
          user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Wallet transactions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'PURCHASE', 'REFUND')),
          amount INTEGER NOT NULL,
          balance_before INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          payment_id VARCHAR(255),
          order_id VARCHAR(255),
          reference_type VARCHAR(50),
          reference_id INTEGER,
          description TEXT,
          metadata JSONB,
          status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_purchases_video ON purchases(video_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_videos_sport ON videos(sport);`);

      // Wallet indexes
      await client.query(`CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);`);

      // Add payment_method columns to purchases table if they don't exist
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'razorpay'
            CHECK (payment_method IN ('razorpay', 'wallet'));
          ALTER TABLE purchases ADD COLUMN IF NOT EXISTS wallet_transaction_id INTEGER REFERENCES wallet_transactions(id);
        END $$;
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_purchases_payment_method ON purchases(payment_method);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_purchases_wallet_transaction ON purchases(wallet_transaction_id);`);

      // Create wallets for existing users who don't have one (migration)
      await client.query(`
        INSERT INTO wallets (user_id, balance)
        SELECT id, 0 FROM users
        WHERE id NOT IN (SELECT user_id FROM wallets)
      `);

      // ── Categories table ──
      await client.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          slug VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          icon VARCHAR(10),
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Add new columns to videos table for self-hosted content
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE videos ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
          ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_key VARCHAR(500);
          ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_key VARCHAR(500);
          ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_size BIGINT;
          ALTER TABLE videos ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
          ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
          ALTER TABLE videos ADD COLUMN IF NOT EXISTS upload_status VARCHAR(20) DEFAULT 'completed';
          ALTER TABLE videos ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'youtube';
        END $$;
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_videos_category_id ON videos(category_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_videos_source_type ON videos(source_type);`);

      // Seed default categories
      const defaultCategories = [
        { name: 'Football', slug: 'football', icon: '⚽', sort_order: 1 },
        { name: 'Basketball', slug: 'basketball', icon: '🏀', sort_order: 2 },
        { name: 'Combat Sports', slug: 'combat', icon: '🥊', sort_order: 3 },
        { name: 'Cricket', slug: 'cricket', icon: '🏏', sort_order: 4 },
        { name: 'Formula 1', slug: 'f1', icon: '🏎️', sort_order: 5 },
        { name: 'Olympics', slug: 'olympics', icon: '🏅', sort_order: 6 },
        { name: 'Kabaddi', slug: 'kabaddi', icon: '🤼', sort_order: 7 },
        { name: 'Badminton', slug: 'badminton', icon: '🏸', sort_order: 8 },
        { name: 'Hockey', slug: 'hockey', icon: '🏑', sort_order: 9 },
        { name: 'ISL', slug: 'isl', icon: '⚽', sort_order: 10 },
      ];

      for (const cat of defaultCategories) {
        await client.query(
          `INSERT INTO categories (name, slug, icon, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO NOTHING`,
          [cat.name, cat.slug, cat.icon, cat.sort_order]
        );
      }

      // Link existing videos to categories by sport field
      await client.query(`
        UPDATE videos SET category_id = c.id
        FROM categories c
        WHERE videos.category_id IS NULL AND LOWER(videos.sport) = LOWER(c.slug)
      `);

      // Remove any old YouTube seed videos (migration — only admin-uploaded videos remain)
      const deleteResult = await client.query(
        `DELETE FROM videos WHERE source_type = 'youtube' OR source_type IS NULL`
      );
      if (deleteResult.rowCount > 0) {
        console.log(`  Cleaned up ${deleteResult.rowCount} old YouTube seed videos`);
      }

      dbReady = true;
      console.log('  PostgreSQL connected — Users, Videos, Purchases tables ready');
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
