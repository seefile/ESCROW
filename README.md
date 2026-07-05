# KudiEscrow — Front-End Prototype

A static, vanilla HTML/CSS/JS prototype of the KudiEscrow escrow + logistics
platform described in the PRD. It's built to demonstrate the core flows and
UI across every role — it is **not** wired to a real payment processor,
KYC provider, or backend database. All "data" lives in the browser via
`localStorage` so the demo persists across page loads.

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

No build step needed — it's plain static files.

```bash
# any static server works, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` (or the port shown) and click **Log In**,
then pick any demo role (Buyer, Seller, Logistics, Support, Admin) to explore
that dashboard.

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

If you add a Postgres database in Render, set the `DATABASE_URL` environment variable to the connection string provided by Render.

The server will expose a simple health endpoint at `/api/health` and can be extended with Postgres-backed API routes later.

Alternatively, if you want to deploy locally for testing:
```bash
DATABASE_URL=postgres://user:password@localhost:5432/kudiescrow
npm install
npm start
```

## What's real vs. simulated

- **Real:** all UI flows, role-based dashboards, escrow status transitions,
  chat, dispute lifecycle, audit logging, live-tracking map animation —
  all driven by actual JS logic and persisted to `localStorage`.
- **Simulated:** payments, KYC/business verification, SMS/email/push
  notifications, live GPS/customs data, and the developer API sandbox.
  These are shown as UI only.

## Resetting demo data

Open the browser console on any page and run:
```js
KUDI.reset()
```
This clears localStorage and reseeds the original demo transactions.

## Next steps toward production

- Replace `js/app.js`'s `localStorage` layer with real REST/GraphQL calls
- Add a real auth provider (email/phone OTP, social login, 2FA)
- Integrate a payments processor + crypto rails behind the wallet UI
- Connect a real mapping provider (Mapbox/Google Maps) and GPS/AIS feeds
  for tracking instead of the illustrative SVG route
- Add server-side rendering for the public marketing/SEO pages
