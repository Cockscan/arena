const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool, initDB, isDBReady } = require('./db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'arena-sports-secret-key-change-in-production';

// ── In-memory fallback store (for local dev without PostgreSQL) ──
const memoryUsers = [];

// ── Middleware ──
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Serve static files ──
app.use(express.static(path.join(__dirname)));

// ── Auth Middleware ──
function authenticateToken(req, res, next) {
  const token = req.cookies.arena_token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    req.user = null;
    next();
  }
}

// ══════════════════════════════════════════
//  AUTH API ROUTES
// ══════════════════════════════════════════

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ ok: false, error: 'Username must be at least 3 characters' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    let user;

    if (isDBReady()) {
      // ── PostgreSQL path ──
      const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ ok: false, error: 'An account with this email already exists' });
      }

      const existingUsername = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [trimmedUsername]);
      if (existingUsername.rows.length > 0) {
        return res.status(400).json({ ok: false, error: 'This username is taken' });
      }

      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
        [trimmedUsername, trimmedEmail, passwordHash]
      );
      user = result.rows[0];

    } else {
      // ── In-memory fallback ──
      if (memoryUsers.find(u => u.email === trimmedEmail)) {
        return res.status(400).json({ ok: false, error: 'An account with this email already exists' });
      }
      if (memoryUsers.find(u => u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
        return res.status(400).json({ ok: false, error: 'This username is taken' });
      }
      user = { id: memoryUsers.length + 1, username: trimmedUsername, email: trimmedEmail, password_hash: passwordHash, created_at: new Date().toISOString() };
      memoryUsers.push(user);
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('arena_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      ok: true,
      user: { id: user.id, username: user.username, email: user.email }
    });

  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ ok: false, error: 'Server error. Please try again.' });
  }
});

// POST /api/signin
app.post('/api/signin', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ ok: false, error: 'Please enter your credentials' });
    }

    const trimmedIdentifier = identifier.trim().toLowerCase();
    let user;

    if (isDBReady()) {
      // ── PostgreSQL path ──
      const result = await pool.query(
        'SELECT id, username, email, password_hash FROM users WHERE email = $1 OR LOWER(username) = $1',
        [trimmedIdentifier]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ ok: false, error: 'Invalid username/email or password' });
      }
      user = result.rows[0];

    } else {
      // ── In-memory fallback ──
      user = memoryUsers.find(u => u.email === trimmedIdentifier || u.username.toLowerCase() === trimmedIdentifier);
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Invalid username/email or password' });
      }
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ ok: false, error: 'Invalid username/email or password' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('arena_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      ok: true,
      user: { id: user.id, username: user.username, email: user.email }
    });

  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({ ok: false, error: 'Server error. Please try again.' });
  }
});

// GET /api/me — get current authenticated user
app.get('/api/me', authenticateToken, (req, res) => {
  if (!req.user) {
    return res.json({ ok: false, user: null });
  }
  return res.json({ ok: true, user: req.user });
});

// POST /api/signout
app.post('/api/signout', (req, res) => {
  res.clearCookie('arena_token');
  return res.json({ ok: true });
});

// ── Catch-all: serve index.html for unmatched routes ──
app.get('/public/*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

// ── Start server ──
async function start() {
  await initDB();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Arena Sports server running at http://localhost:${PORT}`);
    console.log(`  Open http://localhost:${PORT}/public/index.html`);
    if (!isDBReady()) {
      console.log(`  Warning: Running without database — using in-memory auth (data resets on restart)`);
      console.log(`  Set DATABASE_URL in .env to connect to PostgreSQL\n`);
    } else {
      console.log(`  PostgreSQL connected\n`);
    }
  });

  server.keepAliveTimeout = 65000;
}

start();
