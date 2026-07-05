# Deploying KudiEscrow to Render

This guide walks you through deploying the KudiEscrow backend to Render with a PostgreSQL database.

## Prerequisites

- GitHub account with the ESCROW repository pushed
- Render account (https://render.com)
- Basic familiarity with Render's dashboard

## Step 1: Create a PostgreSQL Database on Render

1. Log in to [Render](https://render.com)
2. Click **New** → **PostgreSQL**
3. Configure:
   - **Name:** `kudiescrow-db`
   - **Database:** `kudiescrow`
   - **User:** `postgres`
   - **Region:** Choose closest to your users (default: Ohio)
   - **PostgreSQL Version:** 15
4. Click **Create Database**
5. Wait for the database to initialize (may take a few minutes)
6. Copy the **Internal Database URL** — you'll need this in Step 3

## Step 2: Create a Web Service

1. Click **New** → **Web Service**
2. Connect your GitHub repository:
   - Select **GitHub** as the source
   - Find and select `seefile/ESCROW`
   - Click **Connect**
3. Configure the service:
   - **Name:** `kudiescrow-api`
   - **Environment:** Node
   - **Region:** Same as your database (recommended)
   - **Branch:** `main`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Add environment variables:
   - Click **Advanced** → **Environment**
   - Add:
     ```
     DATABASE_URL=<paste the Internal Database URL from Step 1>
     PORT=3000
     ```
5. Click **Create Web Service**

## Step 3: Verify Deployment

After deployment completes (1-2 minutes):

1. Open the service URL (e.g., `https://kudiescrow-api.onrender.com`)
2. Test the health endpoint:
   ```bash
   curl https://kudiescrow-api.onrender.com/api/health
   ```
   You should see: `{"status":"ok","database":"connected"}`

3. Access the UI by visiting the service URL directly

## Step 4: Using the Deployed App

### Login & Demo Accounts

Visit your Render URL and use the demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Buyer | `amara@buyer.test` | `demo1234` |
| Seller | `obi@seller.test` | `demo1234` |
| Logistics | `ops@swifthaul.test` | `demo1234` |
| Admin | `admin@kudiescrow.test` | `demo1234` |

Or use the quick **"Demo as Role"** buttons on the login page.

### Real-Time Features

- **Session-based authentication:** Login sessions persist for 7 days
- **WebSocket chat:** Real-time messaging in transaction details
- **Persistent state:** All changes saved to Postgres

## Step 5: Monitoring & Logs

1. Go to your service dashboard
2. Click **Logs** to view server output
3. Monitor database usage:
   - Go to your PostgreSQL instance
   - Click **Connections** to see active clients
   - Click **Backups** to view automatic backups

## Common Issues

### Database connection fails

**Symptom:** `Error: connect ECONNREFUSED`

**Solution:**
1. Verify `DATABASE_URL` is set in your environment variables
2. Ensure the database instance is in `Available` state
3. Check that the web service is in the same region (recommended)

### Port already in use

**Symptom:** `Error: listen EADDRINUSE :::3000`

**Solution:**
Render automatically assigns ports. The app listens on `$PORT` by default, but if issues persist:
1. Check the service health in the Render dashboard
2. Try redeploying the service

### WebSocket connection fails

**Symptom:** Real-time chat not working

**Solution:**
- The web service must support long-lived connections
- Render's free tier includes WebSocket support
- Verify you're using `wss://` (not `ws://`) if connecting over HTTPS

## Step 6: Making Changes

To deploy updates:

1. Make changes locally
2. Commit and push to `main` branch:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```
3. Render automatically deploys on push (usually within 1-2 minutes)
4. Watch the **Deploys** tab in Render dashboard

## Step 7: Database Backups

Render automatically backs up PostgreSQL databases:

- **Backups kept:** 7 daily + 4 weekly
- **Automatic retention:** Configurable in database settings
- **Manual backup:** Available in database dashboard

To restore a backup, contact Render support or use their dashboard.

## Production Checklist

Before production use, ensure:

- [ ] Environment variables are set (no `.env` file checked in)
- [ ] Database is in a stable region
- [ ] Backups are enabled
- [ ] SSL/TLS is enforced (Render provides free SSL)
- [ ] Monitor logs regularly
- [ ] Test critical workflows (login, transactions, chat)

## Next Steps

- Add authentication with real email verification
- Integrate a payment processor (Stripe, Paystack, etc.)
- Set up monitoring/alerts (Render native or third-party)
- Enable custom domain with SSL
- Configure CDN for static assets
- Add rate limiting and security headers

## Support

For Render-specific issues:
- Visit [Render Docs](https://render.com/docs)
- Check [Render Status](https://status.render.com)
- Contact Render support in dashboard

For KudiEscrow-specific issues:
- Review server logs in Render dashboard
- Check GitHub issues for known problems
- Test locally with Docker Compose first
