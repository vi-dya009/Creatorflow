import express from 'express';
import session from 'express-session';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'creatorflow.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'creatorflow-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({ error: 'Authentication required.' });
}

export async function ensureDemoUser() {
  const existing = await dbGet('SELECT id FROM users WHERE email = ?', ['demo@creatorflow.dev']);

  if (existing) {
    const passwordHash = await bcrypt.hash('demo1234', 10);
    await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, existing.id]);
    return;
  }

  const passwordHash = await bcrypt.hash('demo1234', 10);
  await dbRun('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [
    'Demo Creator',
    'demo@creatorflow.dev',
    passwordHash,
  ]);
}

export async function resetDatabase() {
  await dbRun('DROP TABLE IF EXISTS content_posts');
  await dbRun('DROP TABLE IF EXISTS users');
  await initDatabase();
}

async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS content_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await ensureDemoUser();
}

async function getSessionUser(req) {
  if (!req.session?.userId) {
    return null;
  }

  return dbGet('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.session.userId]);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'CreatorFlow API is running.' });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await dbRun('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [
    String(name).trim(),
    normalizedEmail,
    passwordHash,
  ]);

  const user = await dbGet('SELECT id, name, email, created_at FROM users WHERE id = ?', [result.id]);
  req.session.userId = user.id;

  return res.status(201).json({ message: 'Registration successful.', user });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await dbGet('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  const safeUser = { id: user.id, name: user.name, email: user.email, created_at: user.created_at };
  return res.json({ message: 'Login successful.', user: safeUser });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const user = await getSessionUser(req);
  res.json({ user });
});

app.put('/api/me', requireAuth, async (req, res) => {
  const { name, email } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existingUser = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [normalizedEmail, req.session.userId]);

  if (existingUser) {
    return res.status(400).json({ error: 'That email is already in use.' });
  }

  await dbRun('UPDATE users SET name = ?, email = ? WHERE id = ?', [String(name).trim(), normalizedEmail, req.session.userId]);

  const user = await getSessionUser(req);
  res.json({ message: 'Profile updated successfully.', user });
});

app.get('/api/posts', requireAuth, async (req, res) => {
  const posts = await dbAll(
    'SELECT * FROM content_posts WHERE user_id = ? ORDER BY scheduled_at IS NULL, scheduled_at ASC, created_at DESC',
    [req.session.userId]
  );

  res.json({ posts });
});

app.post('/api/posts', requireAuth, async (req, res) => {
  const { title, body, platform, status, scheduled_at } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const validPlatforms = ['YouTube', 'Instagram', 'LinkedIn', 'Other'];
  const validStatuses = ['Idea', 'Draft', 'Ready', 'Scheduled', 'Published (demo)', 'Cancelled'];

  if (!platform || !validPlatforms.includes(platform)) {
    return res.status(400).json({ error: 'Please select a valid platform.' });
  }

  const finalStatus = validStatuses.includes(status) ? status : 'Idea';

  if (finalStatus === 'Scheduled' && (!scheduled_at || Number.isNaN(new Date(scheduled_at).getTime()))) {
    return res.status(400).json({ error: 'Planned date/time is required when status is Scheduled.' });
  }

  const result = await dbRun(`
    INSERT INTO content_posts (user_id, title, body, platform, status, scheduled_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    req.session.userId,
    String(title).trim(),
    body || '',
    platform,
    finalStatus,
    finalStatus === 'Scheduled' ? scheduled_at : null,
  ]);

  const post = await dbGet('SELECT * FROM content_posts WHERE id = ?', [result.id]);
  res.status(201).json({ message: 'Content created successfully.', post });
});

app.put('/api/posts/:id', requireAuth, async (req, res) => {
  const postId = Number(req.params.id);
  const existingPost = await dbGet('SELECT * FROM content_posts WHERE id = ? AND user_id = ?', [postId, req.session.userId]);

  if (!existingPost) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  const { title, body, platform, status, scheduled_at } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const validPlatforms = ['YouTube', 'Instagram', 'LinkedIn', 'Other'];
  const validStatuses = ['Idea', 'Draft', 'Ready', 'Scheduled', 'Published (demo)', 'Cancelled'];

  if (!platform || !validPlatforms.includes(platform)) {
    return res.status(400).json({ error: 'Please select a valid platform.' });
  }

  const finalStatus = validStatuses.includes(status) ? status : 'Idea';

  if (finalStatus === 'Scheduled' && (!scheduled_at || Number.isNaN(new Date(scheduled_at).getTime()))) {
    return res.status(400).json({ error: 'Planned date/time is required when status is Scheduled.' });
  }

  await dbRun(`
    UPDATE content_posts
    SET title = ?, body = ?, platform = ?, status = ?, scheduled_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `, [
    String(title).trim(),
    body || '',
    platform,
    finalStatus,
    finalStatus === 'Scheduled' ? scheduled_at : null,
    postId,
    req.session.userId,
  ]);

  const updatedPost = await dbGet('SELECT * FROM content_posts WHERE id = ?', [postId]);
  res.json({ message: 'Content updated successfully.', post: updatedPost });
});

app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  const postId = Number(req.params.id);
  const existingPost = await dbGet('SELECT id FROM content_posts WHERE id = ? AND user_id = ?', [postId, req.session.userId]);

  if (!existingPost) {
    return res.status(404).json({ error: 'Post not found.' });
  }

  await dbRun('DELETE FROM content_posts WHERE id = ? AND user_id = ?', [postId, req.session.userId]);
  res.json({ message: 'Content deleted successfully.' });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const total = await dbGet('SELECT COUNT(*) as count FROM content_posts WHERE user_id = ?', [req.session.userId]);
  const drafts = await dbGet('SELECT COUNT(*) as count FROM content_posts WHERE user_id = ? AND status = ?', [req.session.userId, 'Draft']);
  const scheduled = await dbGet('SELECT COUNT(*) as count FROM content_posts WHERE user_id = ? AND status = ?', [req.session.userId, 'Scheduled']);
  const published = await dbGet('SELECT COUNT(*) as count FROM content_posts WHERE user_id = ? AND status = ?', [req.session.userId, 'Published (demo)']);

  const recentPosts = await dbAll(
    'SELECT * FROM content_posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
    [req.session.userId]
  );

  res.json({
    total: Number(total.count),
    drafts: Number(drafts.count),
    scheduled: Number(scheduled.count),
    publishedDemo: Number(published.count),
    recentPosts,
  });
});

app.get('/api/calendar', requireAuth, async (req, res) => {
  const posts = await dbAll(
    'SELECT * FROM content_posts WHERE user_id = ? AND status = ? AND scheduled_at IS NOT NULL ORDER BY scheduled_at ASC',
    [req.session.userId, 'Scheduled']
  );

  res.json({ posts });
});

app.get('/api/analytics', requireAuth, async (req, res) => {
  const totals = await dbGet('SELECT COUNT(*) as total, SUM(CASE WHEN status = "Draft" THEN 1 ELSE 0 END) as drafts, SUM(CASE WHEN status = "Scheduled" THEN 1 ELSE 0 END) as scheduled, SUM(CASE WHEN status = "Published (demo)" THEN 1 ELSE 0 END) as published FROM content_posts WHERE user_id = ?', [req.session.userId]);

  const chartData = [
    { label: 'Drafts', value: Number(totals.drafts || 0) },
    { label: 'Scheduled', value: Number(totals.scheduled || 0) },
    { label: 'Published demo', value: Number(totals.published || 0) },
  ];

  res.json({
    demoData: true,
    label: 'Demo data',
    summary: {
      totalPosts: Number(totals.total || 0),
      draftCount: Number(totals.drafts || 0),
      scheduledCount: Number(totals.scheduled || 0),
      publishedDemoCount: Number(totals.published || 0),
    },
    chartData,
    note: 'This analytics view is demo-only and clearly labelled as sample data.',
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export { app, db };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initDatabase()
    .then(() => {
      const port = Number(process.env.PORT || 3000);
      app.listen(port, () => {
        console.log(`CreatorFlow MVP running on http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error('Failed to initialize database:', error);
      process.exit(1);
    });
}
