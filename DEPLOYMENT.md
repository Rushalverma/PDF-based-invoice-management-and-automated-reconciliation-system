# Deployment Guide

## Render Deployment

1. Create a new Web Service in Render for the backend.
2. Set the build command to `npm install`.
3. Set the start command to `npm start`.
4. Set the root directory to the repository root.
5. Add the environment variables listed below.
6. Redeploy after every backend config change.

## Required Environment Variables

Backend:

- `PORT`
- `JWT_SECRET`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_POOL_LIMIT`
- `UPLOADS_DIR`
- `CORS_ORIGINS`
- `FRONTEND_ORIGIN`

Frontend build:

- `VITE_API_BASE_URL`

## Connecting to Aiven MySQL

Use the Aiven connection details in your Render environment variables and keep SSL enabled. The application connects with `rejectUnauthorized: false`, which is required for the managed certificate setup used by Aiven MySQL.

Do not hardcode a production database host or IP address. The backend reads all credentials from environment variables.

## Running Locally

Backend:

1. Copy `.env.example` to `.env`.
2. Fill in local MySQL credentials and JWT secret.
3. Run `npm install`.
4. Start the server with `npm start`.

Frontend:

1. Copy `frontend/.env.example` to `frontend/.env`.
2. Set `VITE_API_BASE_URL` to your backend base URL, for example your Render service URL ending in `/api/v1`.
3. Run `npm install` in `frontend/`.
4. Start the dev server with `npm run dev`.

## Importing `schema.sql`

If the schema is not already present in Aiven, import `config/schema.sql` using the MySQL client or a GUI tool such as MySQL Workbench or DBeaver.

Example:

```bash
mysql -h <host> -P <port> -u <user> -p <database> < config/schema.sql
```

## Uploads on Render

The app currently stores uploaded PDFs and CSV files on local disk under `uploads/`.

This works on a single Render instance, but files are not durable across redeploys or instance restarts. For production-grade persistence, move uploads to Cloudinary, Amazon S3, or another object storage service.

## Troubleshooting

- If startup fails, verify every required environment variable is set.
- If MySQL connection fails, confirm SSL is enabled and the Aiven credentials are correct.
- If the frontend cannot reach the API, verify `VITE_API_BASE_URL` and `CORS_ORIGINS`.
- If uploads disappear after redeploy, migrate file storage off local disk.