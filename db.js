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

// Seed data for all 33 videos (prices in paise)
const VIDEO_SEED_DATA = [
  // Football (1-4)
  { title: 'Liverpool 1-2 Man City — Haaland 93rd Minute Winner!', category: 'Premier League', sport: 'football', price: 7900, thumbnail_url: 'https://img.youtube.com/vi/VJHvtNFXZcU/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=VJHvtNFXZcU', duration: '12:34', channel_name: 'Man City', channel_avatar: 'M', views: '4.2M', likes: '120K', tag: null, is_live: false, is_premium: false },
  { title: 'Sunderland vs Liverpool — Full Match Highlights', category: 'Premier League', sport: 'football', price: 7900, thumbnail_url: 'https://img.youtube.com/vi/4Rh62rguksI/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=4Rh62rguksI', duration: '15:07', channel_name: 'NBC Sports', channel_avatar: 'N', views: '1.8M', likes: '48K', tag: null, is_live: false, is_premium: false },
  { title: 'Champions League 2025/26 — Best Goals So Far', category: 'Champions League', sport: 'football', price: 9900, thumbnail_url: 'https://img.youtube.com/vi/rYmbj-bQ_eg/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=rYmbj-bQ_eg', duration: '08:45', channel_name: 'UEFA', channel_avatar: 'U', views: '6.1M', likes: '210K', tag: null, is_live: false, is_premium: false },
  { title: 'Celta Vigo 2-4 Barcelona — Lewandowski Hat-Trick', category: 'La Liga', sport: 'football', price: 7900, thumbnail_url: 'https://img.youtube.com/vi/Rtd5qKulpRc/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=Rtd5qKulpRc', duration: '10:22', channel_name: 'LaLiga', channel_avatar: 'L', views: '2.4M', likes: '85K', tag: null, is_live: false, is_premium: false },
  // Basketball (5-8)
  { title: "NBA's Top 10 Plays of the Night — Insane Dunks & Clutch Shots", category: 'NBA', sport: 'basketball', price: 4900, thumbnail_url: 'https://img.youtube.com/vi/2sfKtkr5r3E/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=2sfKtkr5r3E', duration: '2:34', channel_name: 'NBA', channel_avatar: 'N', views: '2.1M', likes: '95K', tag: 'TRENDING', is_live: false, is_premium: false },
  { title: 'Most Nasty Dunks of the 2025-26 Season — 60 Min Compilation', category: 'NBA', sport: 'basketball', price: 14900, thumbnail_url: 'https://img.youtube.com/vi/fcrO52NeETI/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=fcrO52NeETI', duration: '60:00', channel_name: 'NBA', channel_avatar: 'N', views: '5.6M', likes: '210K', tag: null, is_live: false, is_premium: false },
  { title: 'The Top Dunks of Week 3 — 2025-26 NBA Season', category: 'NBA', sport: 'basketball', price: 4900, thumbnail_url: 'https://img.youtube.com/vi/JcJWZsmA8lQ/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=JcJWZsmA8lQ', duration: '20:40', channel_name: 'NBA', channel_avatar: 'N', views: '111K', likes: '5K', tag: null, is_live: false, is_premium: false },
  { title: 'EuroLeague Top 10 Plays — Round 3 Best Moments', category: 'EuroLeague', sport: 'basketball', price: 4900, thumbnail_url: 'https://img.youtube.com/vi/CtbWw5ADUVU/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=CtbWw5ADUVU', duration: '3:50', channel_name: 'EuroLeague', channel_avatar: 'E', views: '680K', likes: '29K', tag: null, is_live: false, is_premium: false },
  // Combat Sports (9-12)
  { title: 'Greatest Knockouts From 2025 So Far — Official UFC', category: 'UFC', sport: 'combat', price: 14900, thumbnail_url: 'https://img.youtube.com/vi/LA2j4Du1PHs/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=LA2j4Du1PHs', duration: '43:12', channel_name: 'UFC', channel_avatar: 'U', views: '6.8M', likes: '280K', tag: 'VIRAL', is_live: false, is_premium: false },
  { title: 'These Knockouts Are Stuck In My Head — Full Compilation', category: 'UFC', sport: 'combat', price: 14900, thumbnail_url: 'https://img.youtube.com/vi/VzvMuJ8qek8/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=VzvMuJ8qek8', duration: '58:20', channel_name: 'UFC', channel_avatar: 'U', views: '4.2M', likes: '150K', tag: null, is_live: false, is_premium: false },
  { title: 'Greatest Finishes From Noche UFC — Best of the Night', category: 'UFC', sport: 'combat', price: 7900, thumbnail_url: 'https://img.youtube.com/vi/-5Z041ALmyg/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=-5Z041ALmyg', duration: '17:05', channel_name: 'UFC', channel_avatar: 'U', views: '1.9M', likes: '67K', tag: null, is_live: false, is_premium: false },
  { title: 'Heavyweight Championship — Full Fight Highlights', category: 'Boxing', sport: 'combat', price: 14900, thumbnail_url: 'https://img.youtube.com/vi/VzvMuJ8qek8/hqdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=boxing+heavyweight+championship+2025+highlights', duration: '22:10', channel_name: 'DAZN', channel_avatar: 'D', views: '1.8M', likes: '67K', tag: null, is_live: false, is_premium: true },
  // Super Bowl (13)
  { title: 'Seahawks vs Patriots — Full Game Highlights (29-13)', category: 'Super Bowl LX', sport: 'football', price: 19900, thumbnail_url: 'https://img.youtube.com/vi/ksG9O8PHXbI/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=ksG9O8PHXbI', duration: '23:10', channel_name: 'NFL', channel_avatar: 'N', views: '2.8M', likes: '180K', tag: 'MUST WATCH', is_live: false, is_premium: false },
  // Formula 1 (14-15)
  { title: "Ferrari SF-26 Reveal — First Look at Hamilton's New Car", category: 'Formula 1', sport: 'f1', price: 9900, thumbnail_url: 'https://img.youtube.com/vi/S4s2OmLI_Fg/maxresdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=ferrari+sf-26+reveal+hamilton+2026', duration: '12:05', channel_name: 'FORMULA 1', channel_avatar: 'F', views: '2.8M', likes: '150K', tag: null, is_live: false, is_premium: false },
  { title: "Hamilton's First Laps in the SF-26 — Fiorano Shakedown", category: 'Formula 1', sport: 'f1', price: 4900, thumbnail_url: 'https://img.youtube.com/vi/1SfIa9mtgjU/hqdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=hamilton+ferrari+fiorano+shakedown+sf-26', duration: '4:33', channel_name: 'FORMULA 1', channel_avatar: 'F', views: '4.1M', likes: '220K', tag: null, is_live: false, is_premium: false },
  // Olympics (16-17)
  { title: 'Milano Cortina 2026 Opening Ceremony — Full Highlights', category: 'Olympics', sport: 'olympics', price: 19900, thumbnail_url: 'https://img.youtube.com/vi/ksG9O8PHXbI/hqdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=winter+olympics+2026+opening+ceremony+highlights', duration: '28:40', channel_name: 'Olympics', channel_avatar: 'O', views: '12M', likes: '580K', tag: null, is_live: false, is_premium: false },
  { title: 'Figure Skating Team Event — Stunning Performances', category: 'Olympics', sport: 'olympics', price: 7900, thumbnail_url: 'https://img.youtube.com/vi/LA2j4Du1PHs/hqdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=winter+olympics+2026+figure+skating+highlights', duration: '15:22', channel_name: 'Olympics', channel_avatar: 'O', views: '3.8M', likes: '190K', tag: null, is_live: false, is_premium: false },
  // Cricket (18-21)
  { title: 'RCB vs PBKS — IPL 2025 Final Full Highlights', category: 'IPL 2025', sport: 'cricket', price: 19900, thumbnail_url: 'https://img.youtube.com/vi/uzUcaSSXvIw/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=uzUcaSSXvIw', duration: '22:15', channel_name: 'IPL', channel_avatar: 'I', views: '18M', likes: '820K', tag: 'MUST WATCH', is_live: false, is_premium: false },
  { title: "Kohli's RCB End 18-Year Wait For Title — Celebration & Trophy Lift", category: 'IPL 2025', sport: 'cricket', price: 9900, thumbnail_url: 'https://img.youtube.com/vi/1SfIa9mtgjU/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=1SfIa9mtgjU', duration: '8:42', channel_name: 'N18', channel_avatar: 'N', views: '12M', likes: '650K', tag: null, is_live: false, is_premium: false },
  { title: "ICC T20 World Cup 2026 — Suryakumar's Heroics Save India", category: 'T20 World Cup 2026', sport: 'cricket', price: 19900, thumbnail_url: 'https://img.youtube.com/vi/uzUcaSSXvIw/hqdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=ICC+T20+World+Cup+2026+highlights+India', duration: '15:30', channel_name: 'ICC', channel_avatar: 'I', views: '8.4M', likes: '420K', tag: null, is_live: true, is_premium: false },
  { title: "West Indies Beat England by 30 Runs — Rutherford 76* Masterclass", category: 'T20 World Cup 2026', sport: 'cricket', price: 7900, thumbnail_url: 'https://img.youtube.com/vi/F_8tVupeoos/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=F_8tVupeoos', duration: '12:18', channel_name: 'ICC', channel_avatar: 'I', views: '3.1M', likes: '95K', tag: null, is_live: false, is_premium: false },
  // Kabaddi (22-24)
  { title: 'U Mumba vs Bengaluru Bulls — PKL Season 12 Full Highlights', category: 'Pro Kabaddi S12', sport: 'kabaddi', price: 9900, thumbnail_url: 'https://img.youtube.com/vi/PV1YNd_asP4/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=PV1YNd_asP4', duration: '26:40', channel_name: 'PKL', channel_avatar: 'P', views: '4.2M', likes: '180K', tag: 'TRENDING', is_live: false, is_premium: false },
  { title: "Bengaluru Bulls vs Dabang Delhi K.C. — Pawan Sehrawat's Raid Masterclass", category: 'Pro Kabaddi S12', sport: 'kabaddi', price: 7900, thumbnail_url: 'https://img.youtube.com/vi/frTDzB4Il0Q/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=frTDzB4Il0Q', duration: '24:15', channel_name: 'PKL', channel_avatar: 'P', views: '3.1M', likes: '145K', tag: null, is_live: false, is_premium: false },
  { title: 'PKL Season 12 Grand Final — Dabang Delhi vs Puneri Paltan', category: 'Pro Kabaddi S12', sport: 'kabaddi', price: 14900, thumbnail_url: 'https://img.youtube.com/vi/PV1YNd_asP4/hqdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=pro+kabaddi+season+12+final+highlights', duration: '32:10', channel_name: 'PKL', channel_avatar: 'P', views: '6.8M', likes: '310K', tag: null, is_live: false, is_premium: true },
  // Badminton (25-27)
  { title: 'PV Sindhu at India Open 2026 — Can She Reclaim Her Crown?', category: 'India Open 2026', sport: 'badminton', price: 9900, thumbnail_url: 'https://img.youtube.com/vi/rMQ3lvZiZRc/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=rMQ3lvZiZRc', duration: '18:24', channel_name: 'BWF', channel_avatar: 'B', views: '5.6M', likes: '280K', tag: 'FEATURED', is_live: false, is_premium: false },
  { title: 'Lakshya Sen vs Viktor Axelsen — Paris 2024 Semi-Final Highlights', category: 'All England Open', sport: 'badminton', price: 7900, thumbnail_url: 'https://img.youtube.com/vi/h4mLMQyq7-M/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=h4mLMQyq7-M', duration: '15:08', channel_name: 'BWF', channel_avatar: 'B', views: '3.8M', likes: '190K', tag: null, is_live: false, is_premium: false },
  { title: "Satwik-Chirag Dominate — India's World No. 1 Doubles Pair in Action", category: 'BWF Tour', sport: 'badminton', price: 4900, thumbnail_url: 'https://img.youtube.com/vi/rMQ3lvZiZRc/hqdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=Satwik+Chirag+doubles+badminton+India+2026', duration: '12:45', channel_name: 'BWF', channel_avatar: 'B', views: '2.4M', likes: '120K', tag: null, is_live: false, is_premium: false },
  // Hockey (28-30)
  { title: 'India 4-1 Korea — Asia Cup Final Highlights | World Cup 2026 Qualified!', category: 'Asia Cup 2025', sport: 'hockey', price: 19900, thumbnail_url: 'https://img.youtube.com/vi/KvP8c8nd-4Y/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=KvP8c8nd-4Y', duration: '18:30', channel_name: 'Hockey India', channel_avatar: 'H', views: '8.2M', likes: '520K', tag: 'MUST WATCH', is_live: false, is_premium: false },
  { title: 'India Wins Hockey Asia Cup After 8-Year Wait — Trophy Celebration', category: 'Asia Cup 2025', sport: 'hockey', price: 4900, thumbnail_url: 'https://img.youtube.com/vi/5jbj-RSZp_s/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=5jbj-RSZp_s', duration: '10:15', channel_name: 'Hockey India', channel_avatar: 'H', views: '5.1M', likes: '340K', tag: null, is_live: false, is_premium: false },
  { title: 'Kalinga Lancers 3-2 Ranchi Royals — HIL 2026 Grand Final', category: 'Hockey India League', sport: 'hockey', price: 14900, thumbnail_url: 'https://img.youtube.com/vi/KvP8c8nd-4Y/hqdefault.jpg', video_url: 'https://www.youtube.com/results?search_query=Hockey+India+League+2026+final+highlights+Kalinga+Lancers', duration: '22:40', channel_name: 'HIL', channel_avatar: 'H', views: '2.8M', likes: '165K', tag: null, is_live: false, is_premium: true },
  // ISL Football (31-33)
  { title: 'Mohun Bagan Super Giant — ISL Season Highlights | Top Goals & Saves', category: 'ISL 2025-26', sport: 'isl', price: 9900, thumbnail_url: 'https://img.youtube.com/vi/AZtKB9QdltE/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=AZtKB9QdltE', duration: '12:30', channel_name: 'ISL', channel_avatar: 'I', views: '2.1M', likes: '95K', tag: 'TRENDING', is_live: false, is_premium: false },
  { title: 'Kerala Blasters vs FC Goa — Jawaharlal Nehru Stadium on Fire!', category: 'ISL 2025-26', sport: 'isl', price: 4900, thumbnail_url: 'https://img.youtube.com/vi/FskiiCytTO4/maxresdefault.jpg', video_url: 'https://www.youtube.com/watch?v=FskiiCytTO4', duration: '10:45', channel_name: 'ISL', channel_avatar: 'I', views: '1.8M', likes: '78K', tag: null, is_live: false, is_premium: false },
  { title: "Bengaluru FC's Title Challenge — Best Goals of the Season", category: 'ISL 2025-26', sport: 'isl', price: 4900, thumbnail_url: 'https://img.youtube.com/vi/AZtKB9QdltE/hqdefault.jpg', video_url: 'https://www.youtube.com/watch?v=AZtKB9QdltE', duration: '14:20', channel_name: 'ISL', channel_avatar: 'I', views: '1.2M', likes: '62K', tag: null, is_live: false, is_premium: false },
];

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

      // Seed videos if table is empty
      const countResult = await client.query('SELECT COUNT(*) FROM videos');
      if (parseInt(countResult.rows[0].count) === 0) {
        for (const v of VIDEO_SEED_DATA) {
          await client.query(
            `INSERT INTO videos (title, category, sport, price, thumbnail_url, video_url, duration, channel_name, channel_avatar, views, likes, tag, is_live, is_premium)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [v.title, v.category, v.sport, v.price, v.thumbnail_url, v.video_url, v.duration, v.channel_name, v.channel_avatar, v.views, v.likes, v.tag, v.is_live, v.is_premium]
          );
        }
        console.log(`  Seeded ${VIDEO_SEED_DATA.length} videos`);
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

module.exports = { pool, initDB, isDBReady, VIDEO_SEED_DATA };
