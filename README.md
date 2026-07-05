# KudiEscrow — Node/Express Prototype

A Node/Express prototype of the KudiEscrow escrow + logistics platform.
It now includes server-side session authentication and persists state via
Postgres-backed JSON storage. The UI still demonstrates the core flows and
role-based dashboards, but the data is no longer stored in browser
`localStorage`.

## What's included

| File | Purpose |
|---|---|
| `index.html` | Marketing / landing page |
| `login.html` | Login with quick "demo as role" switcher |
| `signup.html` | Sign-up flow with role selection |
| `dashboard-buyer.html` | Buyer dashboard — transactions, wallet, notifications |
| `dashboard-seller.html` | Seller dashboard — orders, payouts, trust score |
| `dashboard-logistics.html` | Logistics provider dashboard — shipments, fleet |
| `dashboard-admin.html` | Admin/support dashboard — dispute queue, audit log |
| `transaction.html` | Escrow transaction detail: timeline, chat, evidence, actions |
| `tracking.html` | Live shipment tracking with animated map |
| `css/style.css` | Shared design system (tokens, components) |
| `js/app.js` | Mock data layer (seeded demo data) + shared utilities |

## Try it locally

### Option 1: Local development with Docker (recommended)

This requires Docker and `docker-compose`.

```bash
# Start the Postgres container
docker-compose up -d

# Install dependencies
npm install

# Start the server
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kudiescrow npm start
```

The server will run on `http://localhost:3000`. Open it and click **Log In**,
then pick any demo role (Buyer, Seller, Logistics, Support, Admin) to explore
that dashboard.

### Option 2: Static file serving (legacy, without backend state)

For a static-only prototype without Postgres:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` and explore the UI (demo data is in-memory only).

## Deploy to Netlify

**Option A — drag and drop**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag this whole folder onto the page
3. Done — Netlify gives you a live URL immediately

**Option B — Netlify CLI**
```bash
npm install -g netlify-cli
cd kudiescrow
netlify deploy --prod
```

**Option C — Git-based deploy**
1. Push this folder to a GitHub/GitLab repo
2. In Netlify: "Add new site" → "Import an existing project" → connect the repo
3. Build command: *(leave blank)* — Publish directory: `.`
4. Deploy

`netlify.toml` is already included with sensible security headers and a
custom 404 fallback.

## Deploy to Render

This prototype can also deploy on Render as a simple Node web service.

1. Push this repository to GitHub.
2. Add a new service in Render and connect your repo.
3. Set the service type to **Web Service** and the environment to **Node**.
4. Use the default branch and set the start command to:
```bash
node server.js
```
5. Render will install dependencies from `package.json` and start the app.

### Postgres support

If you add a Postgres database in Render, set the `DATABASE_URL` environment
variable to the connection string provided by Render.

The server exposes a health endpoint at `/api/health` and also supports:

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET /api/session`
- `GET /api/db`
- `POST /api/db`
- `POST /api/db/reset`

Alternatively, if you want to deploy locally for testing:
```bash
DATABASE_URL=postgres://user:password@localhost:5432/kudiescrow
npm install
npm start
```

## What's real vs. simulated

- **Real:** all UI flows, role-based dashboards, escrow status transitions,
  chat, dispute lifecycle, audit logging, live-tracking map animation —
  all driven by actual JS logic and persisted through the server API.
- **Simulated:** payments, KYC/business verification, SMS/email/push
  notifications, live GPS/customs data, and the developer API sandbox.
  These are shown as UI only.

## Resetting demo data

Open the browser console on any page and run:
```js
KUDI.reset()
```
This resets the demo dataset in the backend state store when using the server.

## Next steps toward production

- Replace `js/app.js`'s `localStorage` layer with real REST/GraphQL calls
- Add a real auth provider (email/phone OTP, social login, 2FA)
- Integrate a payments processor + crypto rails behind the wallet UI
- Connect a real mapping provider (Mapbox/Google Maps) and GPS/AIS feeds
  for tracking instead of the illustrative SVG route
- Add server-side rendering for the public marketing/SEO pages
