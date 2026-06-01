'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const crypto = require('crypto');
const Fastify = require('fastify');
const jwt = require('jsonwebtoken');
const { query } = require('./db');

const app = Fastify({ logger: false });

const JWT_SECRET    = process.env.JWT_SECRET        ?? 'sketch-dev-secret-change-me';

// Dynamic URL detection: Use environment variable if set, otherwise infer from request origin
// This allows the same code to work on localhost, Vercel, and other deployments
const getURLs = (req) => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  
  // Try to get origin from environment first
  let FRONTEND_URL = process.env.FRONTEND_URL;
  let API_URL = process.env.API_URL || process.env.FRONTEND_URL; // API might be on same domain
  
  // If in production and URLs not explicitly set, try to infer from request
  if (isProduction && !FRONTEND_URL && req) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    FRONTEND_URL = `${proto}://${host}`;
    API_URL = FRONTEND_URL;
  }
  
  // Fallback to localhost for development
  FRONTEND_URL = FRONTEND_URL || 'http://localhost:5173';
  API_URL = API_URL || 'http://localhost:3001';
  
  return { FRONTEND_URL, API_URL };
};

// For Google OAuth callback URL, use environment or construct from API_URL
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 
  `${process.env.API_URL || 'http://localhost:3001'}/auth/google/callback`;

// ── CORS ──────────────────────────────────────────────────────────────────────

app.addHook('onRequest', async (req, rep) => {
  const origin = req.headers.origin ?? '*';
  rep.header('Access-Control-Allow-Origin', origin);
  rep.header('Access-Control-Allow-Credentials', 'true');
  rep.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  rep.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    rep.code(204).send();
  }
});

// ── Auth middleware ───────────────────────────────────────────────────────────

async function authenticate(req, rep) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { rep.code(401).send({ error: 'Missing authorization token' }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
  } catch {
    rep.code(401).send({ error: 'Invalid or expired token' });
  }
}

app.addHook('preHandler', async (req, rep) => {
  const p = req.url.split('?')[0];
  // Public share endpoints (/api/share/:token …) need no auth — anyone with the link.
  if (p.startsWith('/api/') && !p.startsWith('/api/share/')) {
    await authenticate(req, rep);
  }
});

// ── Google OAuth (redirect flow) ──────────────────────────────────────────────

// Step 1 — redirect the browser to Google's consent screen
app.get('/auth/google', async (req, rep) => {
  const { FRONTEND_URL, API_URL } = getURLs(req);
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `${API_URL}/auth/google/callback`;
  
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  callbackUrl,
    response_type: 'code',
    scope:         'openid email profile',
    prompt:        'select_account',
  });
  // Fastify v4: redirect(url, statusCode?) — url comes first
  return rep.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
});

// Step 2 — Google redirects here with ?code=...
app.get('/auth/google/callback', async (req, rep) => {
  const { FRONTEND_URL, API_URL } = getURLs(req);
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `${API_URL}/auth/google/callback`;
  
  const { code, error } = req.query;
  if (error || !code) {
    return rep.redirect(`${FRONTEND_URL}/?error=auth_failed`, 302);
  }

  try {
    // Exchange authorisation code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  callbackUrl,
        grant_type:    'authorization_code',
      }).toString(),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error(`No access_token: ${JSON.stringify(tokens)}`);

    // Fetch user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const userId  = profile.sub;
    const email   = profile.email   ?? '';
    const name    = profile.name    ?? email;
    const picture = profile.picture ?? null;

    await ensureUser(userId, email);

    // Issue our own 30-day JWT
    const appToken = jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: '30d' });

    // Send the token to the frontend via redirect + query params
    const userParam = encodeURIComponent(JSON.stringify({ id: userId, email, name, picture }));
    return rep.redirect(`${FRONTEND_URL}/auth/callback?token=${appToken}&user=${userParam}`, 302);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return rep.redirect(`${FRONTEND_URL}/?error=auth_failed`, 302);
  }
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', async () => ({ ok: true }));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureUser(userId, email = null) {
  await query(
    `INSERT INTO users(id, email) VALUES($1, $2)
     ON CONFLICT(id) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)`,
    [userId, email],
  );
}

// ── Workspaces ────────────────────────────────────────────────────────────────

app.get('/api/workspaces', async (req) => {
  await ensureUser(req.userId);
  const res = await query(
    'SELECT id, name, emoji, color, created_at, updated_at FROM workspaces WHERE user_id = $1 ORDER BY created_at ASC',
    [req.userId],
  );
  return res.rows;
});

app.post('/api/workspaces', async (req) => {
  const { id, name, emoji, color, created_at, updated_at } = req.body;
  await ensureUser(req.userId);
  await query(
    `INSERT INTO workspaces(id, user_id, name, emoji, color, created_at, updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(id) DO UPDATE SET name=$3, emoji=$4, color=$5, updated_at=$7`,
    [id, req.userId, name, emoji, color, created_at, updated_at],
  );
  return { ok: true };
});

app.put('/api/workspaces/:id', async (req) => {
  const { name, emoji, color, updated_at } = req.body;
  await query(
    `UPDATE workspaces SET name=$1, emoji=$2, color=$3, updated_at=$4
     WHERE id=$5 AND user_id=$6`,
    [name, emoji, color, updated_at, req.params.id, req.userId],
  );
  return { ok: true };
});

app.delete('/api/workspaces/:id', async (req) => {
  await query(
    'DELETE FROM workspaces WHERE id=$1 AND user_id=$2',
    [req.params.id, req.userId],
  );
  return { ok: true };
});

// ── Files ─────────────────────────────────────────────────────────────────────

app.get('/api/workspaces/:wsId/files', async (req) => {
  const res = await query(
    'SELECT id, workspace_id, name, created_at, updated_at FROM files WHERE workspace_id=$1 AND user_id=$2 ORDER BY created_at ASC',
    [req.params.wsId, req.userId],
  );
  return res.rows;
});

app.post('/api/files', async (req) => {
  const { id, workspace_id, name, created_at, updated_at } = req.body;
  await query(
    `INSERT INTO files(id, workspace_id, user_id, name, created_at, updated_at)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(id) DO UPDATE SET name=$4, updated_at=$6`,
    [id, workspace_id, req.userId, name, created_at, updated_at],
  );
  return { ok: true };
});

app.put('/api/files/:id', async (req) => {
  const { name, updated_at } = req.body;
  await query(
    `UPDATE files SET name=$1, updated_at=$2 WHERE id=$3 AND user_id=$4`,
    [name, updated_at, req.params.id, req.userId],
  );
  return { ok: true };
});

app.delete('/api/files/:id', async (req) => {
  await query(
    'DELETE FROM files WHERE id=$1 AND user_id=$2',
    [req.params.id, req.userId],
  );
  return { ok: true };
});

// ── Canvas snapshots ──────────────────────────────────────────────────────────

app.get('/api/files/:id/canvas', async (req, rep) => {
  const own = await query(
    'SELECT id FROM files WHERE id=$1 AND user_id=$2',
    [req.params.id, req.userId],
  );
  if (own.rows.length === 0) {
    rep.code(403).send({ error: 'Forbidden' });
    return;
  }
  const res = await query(
    'SELECT objects, bg_color, grid_style FROM canvas_snapshots WHERE file_id=$1',
    [req.params.id],
  );
  if (res.rows.length === 0) return { objects: {}, bg_color: '#F7F7F8', grid_style: 'dots' };
  return {
    objects:    res.rows[0].objects,
    bg_color:   res.rows[0].bg_color,
    grid_style: res.rows[0].grid_style ?? 'dots',
  };
});

app.put('/api/files/:id/canvas', async (req, rep) => {
  const own = await query(
    'SELECT id FROM files WHERE id=$1 AND user_id=$2',
    [req.params.id, req.userId],
  );
  if (own.rows.length === 0) {
    rep.code(403).send({ error: 'Forbidden' });
    return;
  }
  const { objects, bg_color, grid_style } = req.body;
  await query(
    `INSERT INTO canvas_snapshots(file_id, objects, bg_color, grid_style, updated_at)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(file_id) DO UPDATE SET objects=$2, bg_color=$3, grid_style=$4, updated_at=$5`,
    [req.params.id, JSON.stringify(objects ?? {}), bg_color ?? '#F7F7F8', grid_style ?? 'dots', Date.now()],
  );
  return { ok: true };
});

// ── Sharing (owner endpoints — authed) ─────────────────────────────────────────

// Current share state for a file the caller owns
app.get('/api/files/:id/share', async (req, rep) => {
  const r = await query(
    'SELECT share_token, share_mode FROM files WHERE id=$1 AND user_id=$2',
    [req.params.id, req.userId],
  );
  if (r.rows.length === 0) { rep.code(403).send({ error: 'Forbidden' }); return; }
  return { token: r.rows[0].share_token ?? null, mode: r.rows[0].share_mode ?? null };
});

// Enable (or update) sharing with a permission mode
app.post('/api/files/:id/share', async (req, rep) => {
  const { mode } = req.body ?? {};
  if (mode !== 'view' && mode !== 'edit') { rep.code(400).send({ error: 'Invalid mode' }); return; }

  const r = await query(
    'SELECT share_token FROM files WHERE id=$1 AND user_id=$2',
    [req.params.id, req.userId],
  );
  if (r.rows.length === 0) { rep.code(403).send({ error: 'Forbidden' }); return; }

  const token = r.rows[0].share_token ?? crypto.randomUUID();
  await query(
    'UPDATE files SET share_token=$1, share_mode=$2 WHERE id=$3 AND user_id=$4',
    [token, mode, req.params.id, req.userId],
  );
  return { token, mode };
});

// Revoke sharing
app.delete('/api/files/:id/share', async (req, rep) => {
  const r = await query(
    'UPDATE files SET share_token=NULL, share_mode=NULL WHERE id=$1 AND user_id=$2',
    [req.params.id, req.userId],
  );
  if (r.rowCount === 0) { rep.code(403).send({ error: 'Forbidden' }); return; }
  return { ok: true };
});

// ── Sharing (public endpoints — no auth) ────────────────────────────────────────

// Load a shared canvas by token
app.get('/api/share/:token', async (req, rep) => {
  const f = await query(
    'SELECT id, name, share_mode FROM files WHERE share_token=$1',
    [req.params.token],
  );
  if (f.rows.length === 0 || !f.rows[0].share_mode) {
    rep.code(404).send({ error: 'Shared canvas not found' });
    return;
  }
  const file = f.rows[0];
  const snap = await query(
    'SELECT objects, bg_color, grid_style FROM canvas_snapshots WHERE file_id=$1',
    [file.id],
  );
  const s = snap.rows[0] ?? {};
  return {
    name:       file.name,
    mode:       file.share_mode,
    objects:    s.objects ?? {},
    bg_color:   s.bg_color ?? '#F7F7F8',
    grid_style: s.grid_style ?? 'dots',
  };
});

// Save edits to a shared canvas (only when share_mode === 'edit')
app.put('/api/share/:token/canvas', async (req, rep) => {
  const f = await query(
    'SELECT id, share_mode FROM files WHERE share_token=$1',
    [req.params.token],
  );
  if (f.rows.length === 0 || f.rows[0].share_mode !== 'edit') {
    rep.code(403).send({ error: 'This canvas is not editable' });
    return;
  }
  const fileId = f.rows[0].id;
  const { objects, bg_color, grid_style } = req.body ?? {};
  const now = Date.now();
  await query(
    `INSERT INTO canvas_snapshots(file_id, objects, bg_color, grid_style, updated_at)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(file_id) DO UPDATE SET objects=$2, bg_color=$3, grid_style=$4, updated_at=$5`,
    [fileId, JSON.stringify(objects ?? {}), bg_color ?? '#F7F7F8', grid_style ?? 'dots', now],
  );
  await query('UPDATE files SET updated_at=$1 WHERE id=$2', [now, fileId]);
  return { ok: true };
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`API server running on http://localhost:${PORT}`);
});
