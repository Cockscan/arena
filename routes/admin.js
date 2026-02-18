const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { pool, isDBReady } = require('../db');
const { isR2Ready, generateUploadKey, uploadFile, uploadLargeFile, downloadFile, deleteFile, getPublicUrl } = require('../services/r2');
const { generateThumbnail, getVideoDuration } = require('../services/thumbnail');

const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'pixelplex-admin-secret-change-in-production';

// Multer config — memory storage (Railway has ephemeral filesystem)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

// ── Admin Auth Middleware ──
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ ok: false, error: 'Not authorized' });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired admin token' });
  }
}

// ══════════════════════════════════════════
//  ADMIN AUTH
// ══════════════════════════════════════════

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ isAdmin: true, username }, ADMIN_JWT_SECRET, { expiresIn: '24h' });
    return res.json({ ok: true, token });
  }

  return res.status(401).json({ ok: false, error: 'Invalid admin credentials' });
});

// ══════════════════════════════════════════
//  DASHBOARD STATS
// ══════════════════════════════════════════

router.get('/stats', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const [videosCount, categoriesCount, usersCount, storageResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM videos'),
      pool.query('SELECT COUNT(*) FROM categories'),
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COALESCE(SUM(file_size), 0) as total_storage FROM videos WHERE source_type = 'r2'"),
    ]);

    return res.json({
      ok: true,
      stats: {
        total_videos: parseInt(videosCount.rows[0].count),
        total_categories: parseInt(categoriesCount.rows[0].count),
        total_users: parseInt(usersCount.rows[0].count),
        total_storage_bytes: parseInt(storageResult.rows[0].total_storage),
        total_storage_mb: Math.round(parseInt(storageResult.rows[0].total_storage) / (1024 * 1024)),
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ ok: false, error: 'Could not load stats' });
  }
});

// ══════════════════════════════════════════
//  CATEGORY MANAGEMENT
// ══════════════════════════════════════════

// GET all categories with video count
router.get('/categories', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const result = await pool.query(`
      SELECT c.*, COUNT(v.id) as video_count
      FROM categories c
      LEFT JOIN videos v ON v.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);

    return res.json({ ok: true, categories: result.rows });
  } catch (err) {
    console.error('Admin categories error:', err);
    return res.status(500).json({ ok: false, error: 'Could not load categories' });
  }
});

// CREATE category
router.post('/categories', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const { name, icon, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, error: 'Category name is required' });
    }

    const slug = name.trim().toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    // Get max sort_order
    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM categories');
    const sortOrder = maxOrder.rows[0].next_order;

    const result = await pool.query(
      'INSERT INTO categories (name, slug, icon, description, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name.trim(), slug, icon || '📁', description || null, sortOrder]
    );

    return res.json({ ok: true, category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ ok: false, error: 'A category with this name already exists' });
    }
    console.error('Admin create category error:', err);
    return res.status(500).json({ ok: false, error: 'Could not create category' });
  }
});

// UPDATE category
router.put('/categories/:id', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const { id } = req.params;
    const { name, icon, description, is_active, sort_order } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      const slug = name.trim().toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`);
      values.push(name.trim(), slug);
    }
    if (icon !== undefined) { updates.push(`icon = $${paramIndex++}`); values.push(icon); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
    if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); values.push(is_active); }
    if (sort_order !== undefined) { updates.push(`sort_order = $${paramIndex++}`); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(parseInt(id));

    const result = await pool.query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }

    return res.json({ ok: true, category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ ok: false, error: 'A category with this name already exists' });
    }
    console.error('Admin update category error:', err);
    return res.status(500).json({ ok: false, error: 'Could not update category' });
  }
});

// DELETE category
router.delete('/categories/:id', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const { id } = req.params;

    // Unlink videos from this category (set category_id to null)
    await pool.query('UPDATE videos SET category_id = NULL WHERE category_id = $1', [parseInt(id)]);

    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [parseInt(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }

    return res.json({ ok: true, message: 'Category deleted' });
  } catch (err) {
    console.error('Admin delete category error:', err);
    return res.status(500).json({ ok: false, error: 'Could not delete category' });
  }
});

// ══════════════════════════════════════════
//  VIDEO MANAGEMENT
// ══════════════════════════════════════════

// GET all videos (with filtering)
router.get('/videos', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const { category_id, search, source_type } = req.query;
    let query = `
      SELECT v.*, c.name as category_name, c.icon as category_icon
      FROM videos v
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      params.push(parseInt(category_id));
      query += ` AND v.category_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND v.title ILIKE $${params.length}`;
    }
    if (source_type) {
      params.push(source_type);
      query += ` AND v.source_type = $${params.length}`;
    }

    query += ' ORDER BY v.id DESC';

    const result = await pool.query(query, params);

    return res.json({ ok: true, videos: result.rows });
  } catch (err) {
    console.error('Admin videos error:', err);
    return res.status(500).json({ ok: false, error: 'Could not load videos' });
  }
});

// UPLOAD video
router.post('/videos/upload', adminAuth, upload.single('video'), async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });
    if (!isR2Ready()) return res.status(503).json({ ok: false, error: 'Storage (R2) not configured' });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No video file uploaded' });

    const { title, tag, category_id, price } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ ok: false, error: 'Video title is required' });
    }
    if (!category_id) {
      return res.status(400).json({ ok: false, error: 'Category is required' });
    }

    // Price in paise (e.g. 4900 = ₹49). Default to 0 (free) if not provided.
    const priceInPaise = price ? parseInt(price) : 0;

    const videoBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;

    // 1. Upload video to R2
    const videoKey = generateUploadKey('videos', originalName);
    let videoUrl;
    if (fileSize > 50 * 1024 * 1024) {
      // Use multipart upload for files > 50MB
      videoUrl = await uploadLargeFile(videoBuffer, videoKey, mimeType);
    } else {
      videoUrl = await uploadFile(videoBuffer, videoKey, mimeType);
    }

    // 2. Generate thumbnail
    let thumbnailUrl = null;
    let thumbnailKey = null;
    const thumbBuffer = await generateThumbnail(videoBuffer);
    if (thumbBuffer) {
      thumbnailKey = generateUploadKey('thumbnails', originalName.replace(/\.[^.]+$/, '.jpg'));
      thumbnailUrl = await uploadFile(thumbBuffer, thumbnailKey, 'image/jpeg');
    } else {
      // Generate a simple SVG placeholder thumbnail and upload it
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
        <rect width="1280" height="720" fill="#1f2326"/>
        <polygon points="600,300 600,420 700,360" fill="#85c742" opacity="0.8"/>
        <text x="640" y="500" text-anchor="middle" fill="#959da5" font-family="sans-serif" font-size="24">${title.trim().substring(0, 40)}</text>
      </svg>`;
      const placeholderBuffer = Buffer.from(placeholderSvg, 'utf-8');
      thumbnailKey = generateUploadKey('thumbnails', 'placeholder.svg');
      thumbnailUrl = await uploadFile(placeholderBuffer, thumbnailKey, 'image/svg+xml');
    }

    // 3. Get video duration
    const durationSeconds = await getVideoDuration(videoBuffer);

    // 4. Format duration string
    let durationStr = '0:00';
    if (durationSeconds) {
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // 5. Insert into database
    const result = await pool.query(
      `INSERT INTO videos (title, category, sport, price, thumbnail_url, video_url, duration, channel_name, channel_avatar, views, likes, tag, is_live, is_premium, category_id, file_key, thumbnail_key, file_size, mime_type, duration_seconds, upload_status, source_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'completed', 'r2')
       RETURNING *`,
      [
        title.trim(),
        '', // category text (legacy, using category_id now)
        '', // sport (legacy)
        priceInPaise,
        thumbnailUrl || '',
        videoUrl,
        durationStr,
        '', // channel_name (not used for R2 uploads)
        '', // channel_avatar (not used for R2 uploads)
        '0',
        '0',
        tag || null,
        false,
        false,
        parseInt(category_id),
        videoKey,
        thumbnailKey,
        fileSize,
        mimeType,
        durationSeconds,
      ]
    );

    return res.json({ ok: true, video: result.rows[0] });
  } catch (err) {
    console.error('Admin video upload error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Could not upload video' });
  }
});

// UPDATE video metadata
router.put('/videos/:id', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const { id } = req.params;
    const { title, tag, category_id, is_premium, price } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { updates.push(`title = $${paramIndex++}`); values.push(title.trim()); }
    if (tag !== undefined) { updates.push(`tag = $${paramIndex++}`); values.push(tag || null); }
    if (category_id !== undefined) { updates.push(`category_id = $${paramIndex++}`); values.push(parseInt(category_id)); }
    if (is_premium !== undefined) { updates.push(`is_premium = $${paramIndex++}`); values.push(is_premium); }
    if (price !== undefined) { updates.push(`price = $${paramIndex++}`); values.push(parseInt(price)); }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No fields to update' });
    }

    values.push(parseInt(id));
    const result = await pool.query(
      `UPDATE videos SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Video not found' });
    }

    return res.json({ ok: true, video: result.rows[0] });
  } catch (err) {
    console.error('Admin update video error:', err);
    return res.status(500).json({ ok: false, error: 'Could not update video' });
  }
});

// DELETE video
router.delete('/videos/:id', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const { id } = req.params;

    // Get video to find R2 keys
    const videoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [parseInt(id)]);
    if (videoResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Video not found' });
    }

    const video = videoResult.rows[0];

    // Delete from R2 if it's an R2-hosted video
    if (video.source_type === 'r2' && isR2Ready()) {
      try {
        if (video.file_key) await deleteFile(video.file_key);
        if (video.thumbnail_key) await deleteFile(video.thumbnail_key);
      } catch (r2Err) {
        console.error('R2 delete error (continuing):', r2Err.message);
      }
    }

    // Delete purchase records first (foreign key constraint)
    await pool.query('DELETE FROM purchases WHERE video_id = $1', [parseInt(id)]);

    // Delete from database
    await pool.query('DELETE FROM videos WHERE id = $1', [parseInt(id)]);

    return res.json({ ok: true, message: 'Video deleted' });
  } catch (err) {
    console.error('Admin delete video error:', err);
    return res.status(500).json({ ok: false, error: 'Could not delete video' });
  }
});

// ══════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════

router.get('/users', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.created_at,
             COALESCE(w.balance, 0) as wallet_balance,
             COUNT(p.id) as total_purchases
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      LEFT JOIN purchases p ON p.user_id = u.id
      GROUP BY u.id, u.username, u.email, u.created_at, w.balance
      ORDER BY u.created_at DESC
    `);

    return res.json({ ok: true, users: result.rows });
  } catch (err) {
    console.error('Admin users error:', err);
    return res.status(500).json({ ok: false, error: 'Could not load users' });
  }
});

// ══════════════════════════════════════════
//  TRANSACTIONS
// ══════════════════════════════════════════

router.get('/transactions', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const { type } = req.query;

    // Get video purchases
    let purchases = [];
    if (!type || type === 'purchases') {
      const purchaseResult = await pool.query(`
        SELECT p.id, p.payment_id, p.order_id, p.payment_amount, p.payment_method,
               p.purchased_at, u.username, u.email, v.title as video_title
        FROM purchases p
        JOIN users u ON u.id = p.user_id
        JOIN videos v ON v.id = p.video_id
        ORDER BY p.purchased_at DESC
      `);
      purchases = purchaseResult.rows;
    }

    // Get wallet transactions
    let walletTxns = [];
    if (!type || type === 'wallet') {
      const walletResult = await pool.query(`
        SELECT wt.id, wt.type, wt.amount, wt.balance_before, wt.balance_after,
               wt.payment_id, wt.description, wt.status, wt.created_at,
               u.username, u.email
        FROM wallet_transactions wt
        JOIN users u ON u.id = wt.user_id
        ORDER BY wt.created_at DESC
      `);
      walletTxns = walletResult.rows;
    }

    return res.json({ ok: true, purchases, wallet_transactions: walletTxns });
  } catch (err) {
    console.error('Admin transactions error:', err);
    return res.status(500).json({ ok: false, error: 'Could not load transactions' });
  }
});

// ══════════════════════════════════════════
//  ADMIN WALLET CREDIT
// ══════════════════════════════════════════

// POST /api/admin/users/:id/add-balance — credit a user's wallet
router.post('/users/:id/add-balance', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });

    const userId = parseInt(req.params.id);
    const { amount } = req.body; // amount in paise

    if (!amount || amount < 100 || amount > 10000000) {
      return res.status(400).json({ ok: false, error: 'Amount must be between ₹1 and ₹1,00,000' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify user exists
      const userResult = await client.query('SELECT id, username FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'User not found' });
      }

      // Get or create wallet with row lock
      let walletResult = await client.query(
        'SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      if (walletResult.rows.length === 0) {
        walletResult = await client.query(
          'INSERT INTO wallets (user_id, balance) VALUES ($1, 0) RETURNING id, balance',
          [userId]
        );
      }

      const wallet = walletResult.rows[0];
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + parseInt(amount);

      // Update wallet balance
      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2',
        [balanceAfter, wallet.id]
      );

      // Create transaction record
      await client.query(
        `INSERT INTO wallet_transactions
          (user_id, wallet_id, type, amount, balance_before, balance_after, description, status)
         VALUES ($1, $2, 'DEPOSIT', $3, $4, $5, $6, 'completed')`,
        [
          userId,
          wallet.id,
          parseInt(amount),
          balanceBefore,
          balanceAfter,
          `Admin credit of ₹${Math.round(amount / 100)} by ${req.admin.username}`
        ]
      );

      await client.query('COMMIT');

      return res.json({
        ok: true,
        message: `₹${Math.round(amount / 100)} added to ${userResult.rows[0].username}'s wallet`,
        new_balance: balanceAfter,
        new_balance_rupees: Math.round(balanceAfter / 100)
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin add balance error:', err);
    return res.status(500).json({ ok: false, error: 'Could not add balance' });
  }
});

// REGENERATE thumbnail
router.post('/videos/:id/regenerate-thumbnail', adminAuth, async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ ok: false, error: 'Database not available' });
    if (!isR2Ready()) return res.status(503).json({ ok: false, error: 'Storage (R2) not configured' });

    const { id } = req.params;
    const videoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [parseInt(id)]);
    if (videoResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Video not found' });
    }

    const video = videoResult.rows[0];
    if (!video.file_key) {
      return res.status(400).json({ ok: false, error: 'No video file to generate thumbnail from' });
    }

    // Download video from R2
    const videoBuffer = await downloadFile(video.file_key);

    // Generate thumbnail
    const thumbBuffer = await generateThumbnail(videoBuffer);
    if (!thumbBuffer) {
      return res.status(500).json({ ok: false, error: 'Thumbnail generation failed — ffmpeg may not be available' });
    }

    // Delete old thumbnail from R2 if exists
    if (video.thumbnail_key) {
      try { await deleteFile(video.thumbnail_key); } catch (e) { /* ignore */ }
    }

    // Upload new thumbnail
    const thumbnailKey = generateUploadKey('thumbnails', `video-${id}.jpg`);
    const thumbnailUrl = await uploadFile(thumbBuffer, thumbnailKey, 'image/jpeg');

    // Update database
    await pool.query(
      'UPDATE videos SET thumbnail_url = $1, thumbnail_key = $2 WHERE id = $3',
      [thumbnailUrl, thumbnailKey, parseInt(id)]
    );

    return res.json({ ok: true, thumbnail_url: thumbnailUrl });
  } catch (err) {
    console.error('Admin regenerate thumbnail error:', err);
    return res.status(500).json({ ok: false, error: 'Could not regenerate thumbnail' });
  }
});

module.exports = router;
