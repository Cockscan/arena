const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { pool, initDB, isDBReady } = require('./db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'arena-sports-secret-key-change-in-production';

// ── Razorpay instance ──
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const PLAN_AMOUNT = parseInt(process.env.PLAN_AMOUNT || '9900'); // Amount in paise (9900 = ₹99)

let razorpay = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  console.log('  Razorpay initialized');
}

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
      user = { id: memoryUsers.length + 1, username: trimmedUsername, email: trimmedEmail, password_hash: passwordHash, payment_status: 'pending', created_at: new Date().toISOString() };
      memoryUsers.push(user);
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, payment_status: 'pending' },
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
      user: { id: user.id, username: user.username, email: user.email, payment_status: 'pending' }
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
        'SELECT id, username, email, password_hash, payment_status FROM users WHERE email = $1 OR LOWER(username) = $1',
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

    const paymentStatus = user.payment_status || 'pending';

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, payment_status: paymentStatus },
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
      user: { id: user.id, username: user.username, email: user.email, payment_status: paymentStatus }
    });

  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({ ok: false, error: 'Server error. Please try again.' });
  }
});

// GET /api/me — get current authenticated user
app.get('/api/me', authenticateToken, async (req, res) => {
  if (!req.user) {
    return res.json({ ok: false, user: null });
  }
  // Fetch fresh payment status from DB
  let paymentStatus = 'pending';
  if (isDBReady()) {
    try {
      const result = await pool.query('SELECT payment_status FROM users WHERE id = $1', [req.user.id]);
      if (result.rows.length > 0) paymentStatus = result.rows[0].payment_status;
    } catch (e) { /* use default */ }
  } else {
    const memUser = memoryUsers.find(u => u.id === req.user.id);
    if (memUser) paymentStatus = memUser.payment_status || 'pending';
  }
  return res.json({ ok: true, user: { ...req.user, payment_status: paymentStatus } });
});

// POST /api/signout
app.post('/api/signout', (req, res) => {
  res.clearCookie('arena_token');
  return res.json({ ok: true });
});

// ══════════════════════════════════════════
//  PAYMENT API ROUTES (Razorpay UPI)
// ══════════════════════════════════════════

// GET /api/payment/config — returns public key and amount for frontend
app.get('/api/payment/config', (req, res) => {
  return res.json({
    key_id: RAZORPAY_KEY_ID,
    amount: PLAN_AMOUNT,
    currency: 'INR',
    name: 'Arena Sports',
    description: 'Arena Sports Premium Access',
    enabled: !!razorpay
  });
});

// POST /api/payment/create-order — creates a Razorpay order
app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Please sign in first' });
  if (!razorpay) return res.status(503).json({ ok: false, error: 'Payment system not configured' });

  try {
    const order = await razorpay.orders.create({
      amount: PLAN_AMOUNT,
      currency: 'INR',
      receipt: `arena_${req.user.id}_${Date.now()}`,
      notes: { user_id: String(req.user.id), username: req.user.username, email: req.user.email }
    });

    return res.json({ ok: true, order });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ ok: false, error: 'Could not create payment order' });
  }
});

// POST /api/payment/verify — verifies payment signature and activates account
app.post('/api/payment/verify', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Please sign in first' });
  if (!razorpay) return res.status(503).json({ ok: false, error: 'Payment system not configured' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ ok: false, error: 'Missing payment details' });
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ ok: false, error: 'Payment verification failed' });
  }

  // Mark user as paid
  try {
    if (isDBReady()) {
      await pool.query(
        'UPDATE users SET payment_status = $1, payment_id = $2, payment_amount = $3, paid_at = NOW() WHERE id = $4',
        ['paid', razorpay_payment_id, PLAN_AMOUNT, req.user.id]
      );
    } else {
      const memUser = memoryUsers.find(u => u.id === req.user.id);
      if (memUser) {
        memUser.payment_status = 'paid';
        memUser.payment_id = razorpay_payment_id;
      }
    }

    // Issue new token with paid status
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username, email: req.user.email, payment_status: 'paid' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('arena_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ ok: true, message: 'Payment verified! Welcome to Arena Sports Premium.' });
  } catch (err) {
    console.error('Payment verify DB error:', err);
    return res.status(500).json({ ok: false, error: 'Server error while activating account' });
  }
});

// ── Root redirect ──
app.get('/', (req, res) => {
  res.redirect('/public/index.html');
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
