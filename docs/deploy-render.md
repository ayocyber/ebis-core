# Deploying to Render (free)

Everything here is free and needs no card. Sign up to each service with GitHub.

| Piece | Service |
|---|---|
| App | Render free web service (built from `Dockerfile`) |
| Database | Neon Postgres |
| Vault files | Supabase Storage (S3-compatible) |
| Email | Gmail SMTP with an app password |

Free-plan limits: the app sleeps after 15 minutes idle, so the first page after
that takes about a minute. Expiry reminders only run while it is awake.

## 1. Neon (database)
1. neon.tech → New project → region **Europe (Frankfurt)**.
2. Copy the **connection string**. It looks like
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   → this is **`DB_URL`**.

## 2. Supabase (file storage)
1. supabase.com → New project → region **Frankfurt**.
2. Storage → New bucket → name **`vault`**, keep it **private**.
3. Project Settings → Storage → **S3 Connection**:
   - Endpoint → **`AWS_ENDPOINT`** (e.g. `https://xxxx.storage.supabase.co/storage/v1/s3`)
   - Region → **`AWS_DEFAULT_REGION`** (e.g. `eu-central-1`)
4. Same page → **New access key** → **`AWS_ACCESS_KEY_ID`** and **`AWS_SECRET_ACCESS_KEY`**.

## 3. Gmail (email)
1. On the Gmail account that will send mail, turn on 2-Step Verification.
2. myaccount.google.com/apppasswords → create one named "EBIS".
3. Gmail address → **`MAIL_USERNAME`** and **`MAIL_FROM_ADDRESS`**;
   the 16-character app password (no spaces) → **`MAIL_PASSWORD`**.

## 4. App key
Run locally and copy the output (starts with `base64:`) → **`APP_KEY`**:

    php artisan key:generate --show

## 5. Render
1. render.com → **New → Blueprint** → pick the `ebis-core` repo. It reads `render.yaml`.
2. Fill in the secrets from steps 1–4, plus:
   - **`APP_URL`**: `https://ebis-core.onrender.com` (use the URL Render shows; fix it after the first deploy if different)
   - **`DEMO_PASSWORD`**: a password for the demo login (not `password`)
3. Apply. The first build takes ~10 minutes. Check **Logs** if it fails.

## 6. Test it
- Open the URL. Sign in as **emma@bluewave.example** with your `DEMO_PASSWORD`.
- Upload a document in the vault, download it, and invite yourself by email.

Every push to `main` redeploys automatically. Once the demo is loaded you can
set `DEMO_SEED` to `false`, although leaving it on is harmless.
