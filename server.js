const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kudiescrow';
const shouldUseSsl = /sslmode=(require|verify-full|verify-ca)|ssl=true/i.test(dbUrl) || ['require','verify-ca','verify-full'].includes(process.env.PGSSLMODE);
const pool = new Pool({
  connectionString: dbUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
});
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'session_token';
const SESSION_SECRET = process.env.SESSION_SECRET || 'kudiescrow-dev-secret';
const STATE_KEY = 'app_state';

function isDevelopmentEnvironment() {
  return process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';
}

function isResetAllowed() {
  if (process.env.ALLOW_DEV_RESET === 'true') return true;
  return isDevelopmentEnvironment();
}

function getAdminConfig() {
  return {
    name: process.env.ADMIN_NAME || 'Platform Admin',
    email: process.env.ADMIN_EMAIL || 'admin@kudiescrow.local',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
    role: process.env.ADMIN_ROLE || 'admin',
  };
}

function initialsOfName(name) {
  return (name || 'Admin').split(' ').filter(Boolean).map(word => word[0]).slice(0,2).join('').toUpperCase() || 'AD';
}

function buildSeedState() {
  const admin = getAdminConfig();
  return {
    meta: {
      seededAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      adminEmail: admin.email,
      seedMode: 'minimal',
    },
    users: [
      {
        id: 'u_admin',
        name: admin.name,
        role: admin.role,
        email: admin.email,
        trust: 100,
        initials: initialsOfName(admin.name),
      },
    ],
    roles: [
      { id: 'role_admin', code: 'admin', name: 'Administrator' },
      { id: 'role_buyer', code: 'buyer', name: 'Buyer' },
      { id: 'role_seller', code: 'seller', name: 'Seller' },
      { id: 'role_logistics', code: 'logistics', name: 'Logistics' },
      { id: 'role_support', code: 'support', name: 'Support' },
    ],
    permissions: [
      { id: 'perm_admin_all', roleId: 'role_admin', resource: '*', action: 'manage' },
    ],
    configuration: {
      appName: 'KudiEscrow',
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'NGN', 'EUR'],
      defaultCountry: 'NG',
      supportedCountries: ['NG', 'US', 'GB', 'DE'],
      allowSignup: false,
      seedMode: 'minimal',
    },
    countries: [
      { code: 'NG', name: 'Nigeria' },
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'DE', name: 'Germany' },
    ],
    currencies: [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
    ],
    transactions: [],
    shipments: [],
    messages: {},
    auditLog: [],
    notifications: [],
  };
}

const seedState = () => buildSeedState();

async function initDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (key text PRIMARY KEY, value jsonb NOT NULL);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_sessions (
    sid varchar PRIMARY KEY,
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
  );`);
  const { rows } = await pool.query('SELECT value FROM app_state WHERE key = $1', [STATE_KEY]);
  if (rows.length === 0) {
    await pool.query('INSERT INTO app_state(key,value) VALUES($1,$2)', [STATE_KEY, seedState()]);
  }
}

async function loadState() {
  const { rows } = await pool.query('SELECT value FROM app_state WHERE key = $1', [STATE_KEY]);
  if (rows.length === 0) {
    const state = seedState();
    await saveState(state);
    return state;
  }
  const state = rows[0].value;
  if (!state || !state.users) {
    console.error('Invalid state loaded from DB:', state);
    const freshState = seedState();
    await saveState(freshState);
    return freshState;
  }
  return state;
}

async function saveState(state) {
  await pool.query('INSERT INTO app_state(key,value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [STATE_KEY, state]);
}

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json());
app.use(session({
  name: SESSION_COOKIE,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    pruneSessionInterval: 0,
    createTableIfMissing: true,
  }),
  proxy: true,
  cookie: {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
  },
}));
app.use(express.static(path.join(__dirname)));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', database: 'unavailable' });
  }
});

app.get('/api/session', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const state = await loadState();
  const user = state.users.find(u => u.id === req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const safeUser = Object.assign({}, user);
  delete safeUser.passwordHash;
  res.json({ userId: user.id, user: safeUser });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  const state = await loadState();
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  let user = null;

  if (normalizedEmail) {
    user = state.users.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
  } else if (role) {
    user = state.users.find(u => u.role === role);
  }

  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  if (password) {
    if (!user.passwordHash) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid password' });
    }
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  // Explicitly ensure session cookie is set before responding
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'Unable to create session' });
    }
    // Force Set-Cookie header to be sent
    res.setHeader('Cache-Control', 'no-store');
    const safe = Object.assign({}, user); delete safe.passwordHash;
    res.json({ userId: user.id, user: safe });
  });
});

app.post(['/api/auth/signup', '/api/auth/register'], async (req, res) => {
  const { name, email, role, country, password } = req.body;
  if (!name || !email || !role || !password) {
    return res.status(400).json({ error: 'Missing signup fields' });
  }
  const state = await loadState();
  const normalizedEmail = email.trim().toLowerCase();
  if (state.users.some(u => u.email && u.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ error: 'Email already in use' });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const id = `u_${crypto.randomBytes(3).toString('hex')}`;
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const user = { id, name, role, email: normalizedEmail, country, trust: 85, initials, passwordHash };
  state.users.push(user);
  await saveState(state);
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'Unable to create session' });
    }
    res.json({ userId: user.id, user: { ...user, passwordHash: undefined } });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });
});

app.get('/api/db', async (req, res) => {
  const state = await loadState();
  res.json(state);
});

app.post('/api/db', async (req, res) => {
  const { db } = req.body;
  if (!db || typeof db !== 'object') {
    return res.status(400).json({ error: 'Invalid db payload' });
  }
  await saveState(db);
  res.json({ ok: true });
});

// Debug endpoint for inspecting cookies and session (dev only or when ALLOW_DEBUG=true)
app.get('/api/debug/session', async (req, res) => {
  const allow = process.env.ALLOW_DEBUG === 'true' || isDevelopmentEnvironment();
  if (!allow) return res.status(404).json({ error: 'Not found' });
  try {
    const sessionInfo = {
      headers: req.headers,
      cookies: req.cookies,
      session: req.session,
    };
    // include some rows from the session store for debugging if available
    let sessionRows = null;
    try {
      const { rows } = await pool.query('SELECT sid, expire FROM user_sessions ORDER BY expire DESC LIMIT 10');
      sessionRows = rows;
    } catch (e) {
      sessionRows = { error: 'unable to query user_sessions table', message: e.message };
    }
    res.json({ sessionInfo, sessionRows });
  } catch (err) {
    console.error('Debug endpoint error:', err);
    res.status(500).json({ error: 'Debug error' });
  }
});

app.post('/api/db/reset', async (req, res) => {
  if (!isResetAllowed()) {
    return res.status(403).json({ error: 'Development database reset is disabled in this environment' });
  }

  try {
    await initDatabase();
    await pool.query('TRUNCATE TABLE user_sessions, app_state RESTART IDENTITY CASCADE');
    const state = seedState();
    await pool.query('INSERT INTO app_state(key,value) VALUES($1,$2)', [STATE_KEY, state]);
    res.json(state);
  } catch (error) {
    console.error('Database reset failed:', error);
    res.status(500).json({ error: 'Database reset failed' });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not implemented' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDatabase()
  .then(() => {
    // Create HTTP server and attach WebSocket
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });

    // Map to store connected clients by transaction ID
    const transactionConnections = new Map();

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const txId = url.searchParams.get('txId');
      const userId = url.searchParams.get('userId');

      if (!txId || !userId) {
        ws.close(1008, 'Missing txId or userId');
        return;
      }

      // Store connection
      if (!transactionConnections.has(txId)) {
        transactionConnections.set(txId, []);
      }
      transactionConnections.get(txId).push({ ws, userId });

      console.log(`WebSocket: User ${userId} joined transaction ${txId}`);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          // Save message to database
          const state = await loadState();
          if (!state.messages[txId]) state.messages[txId] = [];
          state.messages[txId].push({
            from: userId,
            text: data.text,
            t: Date.now(),
            evidence: data.evidence || null
          });
          await saveState(state);

          // Broadcast to all clients in this transaction
          const clients = transactionConnections.get(txId) || [];
          const broadcast = {
            type: 'message',
            from: userId,
            text: data.text,
            t: Date.now(),
            evidence: data.evidence || null
          };
          clients.forEach(({ ws: client }) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(broadcast));
            }
          });
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      });

      ws.on('close', () => {
        const clients = transactionConnections.get(txId) || [];
        const idx = clients.findIndex(c => c.ws === ws);
        if (idx !== -1) clients.splice(idx, 1);
        console.log(`WebSocket: User ${userId} left transaction ${txId}`);
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
      });
    });

    server.listen(port, '0.0.0.0', () => {
      const hostname = process.env.RENDER_EXTERNAL_HOSTNAME || process.env.HOSTNAME || 'localhost';
      const protocol = process.env.RENDER_EXTERNAL_HOSTNAME ? 'https' : (process.env.PORT ? 'http' : 'http');
      const baseUrl = hostname === 'localhost' ? `http://localhost:${port}` : `${protocol}://${hostname}`;
      const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
      console.log(`KudiEscrow backend running on ${baseUrl}`);
      console.log(`WebSocket server available at ${wsProtocol}://${hostname}:${port}`);
    });
  })
  .catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
