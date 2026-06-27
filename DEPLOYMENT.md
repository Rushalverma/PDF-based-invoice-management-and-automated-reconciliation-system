# Deployment Guide

## Architecture on Render

| Service | Type | Root Dir |
|---------|------|----------|
| Backend | Web Service (Node) | repository root |
| Frontend | Static Site | `frontend/` |

---

## Backend — Render Web Service

1. Create a **Web Service** in Render.
2. Set **Root Directory** to `.` (repository root).
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.
5. Set **Node Version** to `18` or later.
6. Add the environment variables listed below.
7. Redeploy after any backend config change.

### Backend Environment Variables

| Variable | Example / Notes |
|----------|-----------------|
| `PORT` | Leave blank — Render sets this automatically |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Long random string (32+ chars) |
| `MYSQL_HOST` | Aiven host, e.g. `mysql-xxx.aivencloud.com` |
| `MYSQL_PORT` | Aiven port, e.g. `16994` |
| `MYSQL_USER` | `avnadmin` |
| `MYSQL_PASSWORD` | Aiven password |
| `MYSQL_DATABASE` | `defaultdb` |
| `MYSQL_POOL_LIMIT` | `10` |
| `CORS_ORIGINS` | Your Render frontend URL, e.g. `https://reconflow.onrender.com` |

> **Do not** set `UPLOADS_DIR` on Render — the default `./uploads` relative to `process.cwd()` is correct.

---

## Frontend — Render Static Site

1. Create a **Static Site** in Render.
2. Set **Root Directory** to `frontend`.
3. Set **Build Command** to `npm install && npm run build`.
4. Set **Publish Directory** to `dist`.
5. Render will automatically serve `frontend/public/_redirects` for SPA routing.
   The `_redirects` file (`/* /index.html 200`) is already committed and ensures
   that refreshing on any React route returns `index.html` instead of a 404.

### Frontend Environment Variables (Build-time)

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://your-backend.onrender.com/api/v1` |

> **Important**: `VITE_` prefix is required — Vite only embeds variables that start with `VITE_`.

---

## Connecting to Aiven MySQL

- SSL is required. The app connects with `rejectUnauthorized: false`, which is
  required for the managed certificate used by Aiven MySQL.
- Do not hardcode any credentials — the backend reads all from environment variables.

---

## Running Locally

**Backend:**
```bash
cp .env.example .env
# Fill in MYSQL_* and JWT_SECRET
npm install
npm start          # production mode
npm run dev        # nodemon watch mode
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:3000/api/v1
npm install
npm run dev
```

---

## Importing `schema.sql`

If the Aiven database is empty, import the schema once:

```bash
mysql -h <host> -P <port> -u <user> -p <database> < config/schema.sql
```

Alternatively, the app runs `initSchema()` on every startup which executes
`config/schema.sql` using `CREATE TABLE IF NOT EXISTS`, so tables are created
automatically on first boot.

---

## Uploads on Render

The app stores uploaded PDFs and CSVs on local disk under `uploads/`.

> **Warning**: Render ephemeral file systems do not persist across redeploys or
> instance restarts. Files uploaded in one deploy will be lost after the next.
> For production durability, migrate uploads to Cloudinary, Amazon S3, or
> another object storage service.

---

## Health Check

Render pings your backend to confirm it is alive. Configure the health check
path to `/health` in the Render Web Service settings.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Backend fails to start | Missing env var — check Render logs for `Missing required environment variables` |
| MySQL connection fails | SSL must be enabled; confirm Aiven credentials and port |
| Frontend API calls fail with CORS error | `CORS_ORIGINS` on backend must exactly match the frontend Render URL (no trailing slash) |
| Refreshing a dashboard route returns 404 | `frontend/public/_redirects` missing or Render publish dir is wrong |
| Uploaded files disappear | Ephemeral disk — move to object storage |
| `npm install` fails on Render | `package.json` must be committed (not in `.gitignore`) |