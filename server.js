const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kudiescrow';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});
const SESSION_COOKIE = 'session_token';
const DEMO_PASSWORD = 'demo1234';
const STATE_KEY = 'app_state';

const seedState = () => ({
  users: [
    { id:'u_buyer', name:'Amara Chen', role:'buyer', email:'amara@buyer.test', trust:96, initials:'AC' },
    { id:'u_seller', name:'Obi Trading Co.', role:'seller', email:'obi@seller.test', trust:91, initials:'OT' },
    { id:'u_logi', name:'SwiftHaul Logistics', role:'logistics', email:'ops@swifthaul.test', trust:88, initials:'SH' },
    { id:'u_support', name:'Ada Nwosu', role:'support', email:'ada@kudiescrow.test', trust:100, initials:'AN' },
    { id:'u_admin', name:'Platform Admin', role:'admin', email:'admin@kudiescrow.test', trust:100, initials:'PA' },
  ],
  transactions: [
    {
      id:'tx_10234', ref:'KDE-2026-10234', buyerId:'u_buyer', sellerId:'u_seller', logisticsId:'u_logi',
      item:'200x Ceramic Tile Pallets (Grade A)', amount: 18400, currency:'USD', status:'in_transit',
      createdAt: Date.now() - 1000*60*60*24*6, stages:['Funded','Shipped','In Transit','Delivered','Released'],
      stageIndex: 2, shipmentId:'sh_5521',
    },
    {
      id:'tx_10235', ref:'KDE-2026-10235', buyerId:'u_buyer', sellerId:'u_seller', logisticsId:'u_logi',
      item:'Bulk Order — Cashew Nuts, 2 Metric Tons', amount: 6250, currency:'USD', status:'disputed',
      createdAt: Date.now() - 1000*60*60*24*11, stages:['Funded','Shipped','In Transit','Delivered','Released'],
      stageIndex: 3, shipmentId:'sh_5522',
    },
    {
      id:'tx_10236', ref:'KDE-2026-10236', buyerId:'u_buyer', sellerId:'u_seller', logisticsId:'u_logi',
      item:'Industrial Sewing Machines x12', amount: 9800, currency:'USD', status:'released',
      createdAt: Date.now() - 1000*60*60*24*20, stages:['Funded','Shipped','In Transit','Delivered','Released'],
      stageIndex: 4, shipmentId:'sh_5519',
    },
    {
      id:'tx_10237', ref:'KDE-2026-10237', buyerId:'u_buyer', sellerId:'u_seller', logisticsId:'u_logi',
      item:'Solar Panel Kits, 40 Units', amount: 15300, currency:'USD', status:'funded',
      createdAt: Date.now() - 1000*60*60*8, stages:['Funded','Shipped','In Transit','Delivered','Released'],
      stageIndex: 0, shipmentId:'sh_5523',
    },
  ],
  shipments: [
    { id:'sh_5521', txId:'tx_10234', mode:'sea', origin:'Lagos, NG', destination:'Rotterdam, NL', progress:0.55, eta:'Jul 14, 2026',
      checkpoints:[
        {label:'Picked up — Lagos Warehouse', date:'Jun 29', done:true},
        {label:'Departed Port — Apapa', date:'Jul 01', done:true},
        {label:'Customs Clearance — Origin', date:'Jul 02', done:true},
        {label:'In Transit — Atlantic Route', date:'Jul 05', done:true, current:true},
        {label:'Customs — Rotterdam', date:'Jul 12', done:false},
        {label:'Out for Delivery', date:'Jul 14', done:false},
      ]},
    { id:'sh_5522', txId:'tx_10235', mode:'air', origin:'Accra, GH', destination:'London, UK', progress:0.8, eta:'Delayed — under review',
      checkpoints:[
        {label:'Picked up — Accra Depot', date:'Jun 24', done:true},
        {label:'Departed — Kotoka Intl', date:'Jun 25', done:true},
        {label:'Arrived — Heathrow', date:'Jun 26', done:true},
        {label:'Customs Hold — Documentation', date:'Jun 27', done:true, current:true},
        {label:'Delivery', date:'Pending dispute resolution', done:false},
      ]},
    { id:'sh_5519', txId:'tx_10236', mode:'road', origin:'Kano, NG', destination:'Abuja, NG', progress:1, eta:'Delivered Jun 18, 2026',
      checkpoints:[
        {label:'Picked up — Kano Facility', date:'Jun 16', done:true},
        {label:'In Transit', date:'Jun 17', done:true},
        {label:'Delivered & Signed', date:'Jun 18', done:true, current:true},
      ]},
    { id:'sh_5523', txId:'tx_10237', mode:'sea', origin:'Guangzhou, CN', destination:'Lagos, NG', progress:0.05, eta:'Aug 02, 2026',
      checkpoints:[
        {label:'Order Confirmed', date:'Jul 05', done:true, current:true},
        {label:'Pickup Scheduled', date:'Jul 07', done:false},
        {label:'Departed Port', date:'Jul 10', done:false},
        {label:'In Transit', date:'—', done:false},
        {label:'Arrival & Customs', date:'—', done:false},
      ]},
  ],
  messages: {
    tx_10234: [
      { from:'u_seller', text:'Shipment has cleared origin customs, on the water now.', t: Date.now()-1000*60*60*70 },
      { from:'u_buyer', text:'Great, thank you for the update!', t: Date.now()-1000*60*60*69 },
      { from:'system', text:'Tracking updated: In Transit — Atlantic Route', t: Date.now()-1000*60*60*20 },
    ],
    tx_10235: [
      { from:'u_buyer', text:'The delivered quantity is short by 4 bags versus the invoice.', t: Date.now()-1000*60*60*40 },
      { from:'u_seller', text:'We packed the full order — please share photos of the received pallets.', t: Date.now()-1000*60*60*39 },
      { from:'system', text:'Dispute opened by buyer. Escrow funds frozen.', t: Date.now()-1000*60*60*38, dispute:true },
      { from:'u_support', text:'Support has joined this conversation to help resolve the dispute. Please upload any evidence (photos, weighbridge tickets) here.', t: Date.now()-1000*60*60*37 },
      { from:'u_buyer', text:'Uploaded delivery photos and the warehouse weight slip.', t: Date.now()-1000*60*60*30 },
    ],
    tx_10236: [
      { from:'system', text:'Delivery confirmed by buyer. Funds released to seller.', t: Date.now()-1000*60*60*24*2 },
    ],
    tx_10237: [
      { from:'system', text:'Escrow funded. Seller notified to begin fulfilment.', t: Date.now()-1000*60*60*8 },
    ],
  },
  auditLog: [
    { text:'Admin PA verified seller "Obi Trading Co." business documents.', t: Date.now()-1000*60*60*24*30, actor:'Platform Admin' },
    { text:'Support AN assigned to dispute on KDE-2026-10235.', t: Date.now()-1000*60*60*37, actor:'Ada Nwosu' },
    { text:'Escrow released for KDE-2026-10236 to Obi Trading Co.', t: Date.now()-1000*60*60*24*2, actor:'System' },
  ],
  notifications: [
    { text:'Escrow funded for KDE-2026-10237', t: Date.now()-1000*60*60*8, read:false },
    { text:'New evidence uploaded on KDE-2026-10235', t: Date.now()-1000*60*60*30, read:false },
    { text:'Tracking update: KDE-2026-10234 in transit', t: Date.now()-1000*60*60*20, read:true },
  ],
});

async function initDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (key text PRIMARY KEY, value jsonb NOT NULL);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (token text PRIMARY KEY, user_id text, created_at timestamptz DEFAULT now(), expires_at timestamptz);`);
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

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function createSession(userId) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,$3)', [token, userId, expiresAt]);
  return token;
}

async function getSession(req) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await pool.query('SELECT user_id, expires_at FROM sessions WHERE token = $1', [token]);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (new Date(row.expires_at) < new Date()) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    return null;
  }
  return { token, userId: row.user_id };
}

async function clearSession(req) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  }
}

app.use(cookieParser());
app.use(express.json());
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
  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const state = await loadState();
  const user = state.users.find(u => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ userId: user.id, user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  const state = await loadState();
  let user = null;
  if (email) {
    user = state.users.find(u => u.email === email);
  } else if (role) {
    user = state.users.find(u => u.role === role);
  }
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }
  if (password && password !== DEMO_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  res.json({ userId: user.id, user });
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, role, country, password } = req.body;
  if (!name || !email || !role || !password) {
    return res.status(400).json({ error: 'Missing signup fields' });
  }
  const state = await loadState();
  if (state.users.some(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already in use' });
  }
  const id = `u_${crypto.randomBytes(3).toString('hex')}`;
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const user = { id, name, role, email, trust: 85, initials };
  state.users.push(user);
  await saveState(state);
  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  res.json({ userId: user.id, user });
});

app.post('/api/auth/logout', async (req, res) => {
  await clearSession(req);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
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

app.post('/api/db/reset', async (req, res) => {
  const state = seedState();
  await saveState(state);
  res.json(state);
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

    server.listen(port, () => {
      const hostname = process.env.RENDER_EXTERNAL_HOSTNAME || process.env.HOSTNAME || 'localhost';
      const protocol = process.env.PORT ? 'https' : 'http';
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
