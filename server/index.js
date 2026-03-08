const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Auth ──────────────────────────────────────────────
const PW_HASH = '0d3a90423860092472866dc909adb178af9f7e2790a3f0d6925c87b015633300';
const AUTH_COOKIE = 'ta_auth';

function hashStr(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function isAuthed(req) {
  return req.cookies && req.cookies[AUTH_COOKIE] === PW_HASH;
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  res.redirect('/login');
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Cookie parser (simple, no extra dep)
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=');
    if (k) req.cookies[k.trim()] = decodeURIComponent(v.join('=').trim());
  });
  next();
});

// Login page
app.get('/login', (req, res) => {
  if (isAuthed(req)) return res.redirect('/');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Login — Todo App</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0a0612; font-family: system-ui, sans-serif; color: #e8deff;
    }
    .box {
      background: rgba(18,10,35,0.9); border: 1px solid rgba(168,85,247,0.3);
      border-radius: 16px; padding: 2.5rem 2rem; width: 100%; max-width: 360px;
      display: flex; flex-direction: column; gap: 1rem; text-align: center;
    }
    h1 { font-size: 1.5rem; background: linear-gradient(90deg,#a855f7,#ec4899,#60a5fa);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    p { color: #9b8ec4; font-size: 0.88rem; }
    input {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(168,85,247,0.4);
      border-radius: 10px; color: #e8deff; font-size: 1rem; padding: 0.75rem 1rem;
      width: 100%; outline: none; text-align: center; letter-spacing: 0.1em;
    }
    input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.2); }
    button {
      background: linear-gradient(90deg,#a855f7,#7c3aed); border: none; border-radius: 10px;
      color: #fff; cursor: pointer; font-size: 0.95rem; font-weight: 700;
      padding: 0.75rem; width: 100%; transition: opacity 0.2s;
    }
    button:hover { opacity: 0.85; }
    .error { color: #f87171; font-size: 0.85rem; min-height: 1rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>✦ Todo App ✦</h1>
    <p>enter password to continue</p>
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="••••••••" autocomplete="current-password" autofocus />
      <br/><br/>
      <button type="submit">Enter ✦</button>
    </form>
    ${req.query.err ? '<div class="error">incorrect password — try again</div>' : '<div class="error"></div>'}
  </div>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (hashStr(password || '') === PW_HASH) {
    res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${PW_HASH}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`);
    return res.redirect('/');
  }
  res.redirect('/login?err=1');
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
  res.redirect('/login');
});

// Protect everything after login routes
app.use(requireAuth);
// ─────────────────────────────────────────────────────

// Run DB migration on startup
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        list VARCHAR(50) NOT NULL CHECK (list IN ('work', 'personal')),
        due_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

// GET /api/tasks?list=work|personal
app.get('/api/tasks', async (req, res) => {
  const { list } = req.query;
  if (!list || !['work', 'personal'].includes(list)) {
    return res.status(400).json({ error: 'Invalid or missing list parameter' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE list = $1 ORDER BY created_at ASC',
      [list]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks
app.post('/api/tasks', async (req, res) => {
  const { title, list, due_date } = req.body;
  if (!title || !list || !['work', 'personal'].includes(list)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, list, due_date) VALUES ($1, $2, $3) RETURNING *',
      [title, list, due_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id
app.patch('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { completed, title, due_date } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (completed !== undefined) {
      fields.push(`completed = $${idx++}`);
      values.push(completed);
    }
    if (title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(title);
    }
    if (due_date !== undefined) {
      fields.push(`due_date = $${idx++}`);
      values.push(due_date);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted', task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
