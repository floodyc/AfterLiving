# LegacyVideo - Railway Deployment Setup Guide

## Step 1: Generate Secrets

Run these commands locally to generate your secrets:

```bash
# Generate API_SECRET (for JWT signing)
node -e "console.log('API_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate MASTER_ENCRYPTION_KEY (for video encryption)
node -e "console.log('MASTER_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
```

**⚠️ CRITICAL:** Save the `MASTER_ENCRYPTION_KEY` somewhere safe (password manager, etc.). If you lose this key, all encrypted videos become permanently unrecoverable!

Copy the output - you'll need these values for Railway configuration.

---

## Step 2: Set Up Cloudflare R2 (S3-Compatible Storage)

### Why R2?
- **Free tier**: 10GB storage free
- **No egress fees** (AWS charges for downloads)
- **S3-compatible** (same API as AWS S3)
- **Easier setup** than AWS

### Setup Steps:

1. **Sign up for Cloudflare** (if you don't have an account):
   - Go to https://dash.cloudflare.com/sign-up
   - Create a free account

2. **Create an R2 Bucket**:
   - Log in to Cloudflare dashboard
   - Click **R2** in the left sidebar
   - Click **Create bucket**
   - Bucket name: `legacyvideo-videos` (or your choice)
   - Location: Choose closest to your users
   - Click **Create bucket**

3. **Generate API Tokens**:
   - In R2 dashboard, click **Manage R2 API Tokens**
   - Click **Create API token**
   - Token name: `legacyvideo-api`
   - Permissions: Select **Object Read & Write**
   - Click **Create API token**
   - **IMPORTANT:** Copy the **Access Key ID** and **Secret Access Key** immediately (you won't see the secret again!)

4. **Get your R2 endpoint**:
   - In your R2 bucket overview, look for **S3 API**
   - Copy the endpoint URL (format: `https://<account-id>.r2.cloudflarestorage.com`)

### Your R2 Configuration:
```bash
S3_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=legacyvideo-videos
S3_ACCESS_KEY_ID=<your-access-key-id>
S3_SECRET_ACCESS_KEY=<your-secret-access-key>
```

---

## Step 3: Set Up Resend (Email Service)

### Setup Steps:

1. **Sign up for Resend**:
   - Go to https://resend.com/signup
   - Create account (free tier: 100 emails/day, 3,000/month)

2. **Verify your domain** (recommended) OR **use onboarding domain** (quick start):

   **Option A: Quick Start (Testing)**
   - Resend provides `onboarding@resend.dev` for testing
   - You can only send to your verified email address
   - Use this to test first

   **Option B: Production Domain**
   - Add your domain in Resend dashboard
   - Add DNS records (SPF, DKIM, etc.) to your domain
   - Verify domain
   - Use `noreply@yourdomain.com` as FROM_EMAIL

3. **Get API Key**:
   - In Resend dashboard, click **API Keys**
   - Click **Create API Key**
   - Name: `legacyvideo-production`
   - Permission: **Full Access**
   - Click **Create**
   - Copy the API key (starts with `re_`)

### Your Resend Configuration:
```bash
# For testing (Resend onboarding domain):
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=onboarding@resend.dev

# For production (your domain):
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=noreply@yourdomain.com
```

---

## Step 4: Configure Railway Environment Variables

Now we'll add all the environment variables to Railway.

### API Service Variables:

Go to Railway → Your Project → **API Service** → **Variables** tab

Add these variables one by one (click **+ New Variable** for each):

```bash
# Core Configuration
NODE_ENV=production
PORT=4000
API_SECRET=<paste-the-generated-api-secret>
MASTER_ENCRYPTION_KEY=<paste-the-generated-encryption-key>

# S3 Storage (from Step 2)
S3_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=legacyvideo-videos
S3_ACCESS_KEY_ID=<your-r2-access-key>
S3_SECRET_ACCESS_KEY=<your-r2-secret-key>

# Optional (defaults shown)
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
LOG_LEVEL=info
```

**Note:** `DATABASE_URL` and `REDIS_URL` should already be auto-injected if you linked the Postgres and Redis services. If not:
- Click **+ New Variable** → **Add Reference**
- Select your Postgres service → Choose `DATABASE_URL`
- Repeat for Redis → Choose `REDIS_URL`

### Worker Service Variables:

Go to Railway → Your Project → **Worker Service** → **Variables** tab

Add these variables:

```bash
# Core Configuration
NODE_ENV=production
MASTER_ENCRYPTION_KEY=<SAME-VALUE-AS-API>

# Email (from Step 3)
RESEND_API_KEY=<your-resend-api-key>
FROM_EMAIL=onboarding@resend.dev

# App URLs
APP_NAME=LegacyVideo
APP_URL=https://your-frontend.vercel.app
API_URL=https://<your-railway-api-domain>.up.railway.app
```

**To find your API URL:**
- Go to Railway → API Service → **Settings** → **Networking**
- Copy the public domain (format: `something.up.railway.app`)
- Use as: `https://something.up.railway.app`

**Note:** Link Postgres and Redis the same way as API service.

---

## Step 5: Run Database Migrations

After setting environment variables, Railway will redeploy. Once both services are running:

### Option A: Using Railway Dashboard (Easier)

1. Go to Railway → **API Service** → Click on latest deployment
2. Click **View Logs** and wait for "🚀 API server listening..." message
3. Go back to API Service → Click **Shell** (or **3 dots** → **Shell**)
4. In the shell, run:
```bash
cd /app && pnpm --filter @legacyvideo/db migrate:deploy
```
5. You should see output like:
```
Applying migration `20240101000000_init`
✔ Applied migration(s)
```

### Option B: Add as Railway Deploy Command

1. Go to Railway → **API Service** → **Settings**
2. Scroll to **Deploy**
3. Under **Custom Build Command**, click **+ Add**
4. Enter:
```bash
pnpm --filter @legacyvideo/db build && pnpm --filter @legacyvideo/api build && pnpm --filter @legacyvideo/db migrate:deploy
```
5. Save and trigger a new deployment

---

## Step 6: Test Your Deployment

### Check API Health:

```bash
curl https://<your-railway-api-domain>.up.railway.app/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

### Check Worker Logs:

1. Go to Railway → **Worker Service** → **Deployments** → Latest
2. Click **View Logs**
3. Should see:
```
🔄 Workers started and listening for jobs...
```
4. Should NOT see the warning about missing env vars anymore

### Test API Endpoints:

```bash
# Register a new user
curl -X POST https://<your-api-url>/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

---

## Troubleshooting

### API won't start:
- Check logs for error messages
- Verify all environment variables are set
- Ensure DATABASE_URL and REDIS_URL are linked

### Worker shows missing env vars:
- Double-check RESEND_API_KEY is set
- Verify MASTER_ENCRYPTION_KEY matches API's value

### Database migration fails:
- Ensure DATABASE_URL is accessible
- Check Postgres service is running
- Try running migration again

### S3 upload errors:
- Verify R2 API tokens are correct
- Check bucket name matches configuration
- Ensure tokens have Read & Write permissions

---

## Next Steps

Once everything is working:

1. **Set up Frontend** (Vercel deployment)
2. **Configure custom domains** (optional)
3. **Set up monitoring** (Railway provides basic metrics)
4. **Review security settings** (rate limits, CORS, etc.)
5. **Test complete workflow** (register → upload video → invite verifier → etc.)

---

## Important Security Notes

✅ **DO:**
- Save MASTER_ENCRYPTION_KEY in a password manager
- Use strong, unique API_SECRET
- Keep Resend API key secret
- Use your own domain for production emails

❌ **DON'T:**
- Commit secrets to Git
- Share API keys publicly
- Use the same encryption key for dev/prod
- Lose the MASTER_ENCRYPTION_KEY (videos become unrecoverable!)

---

## Need Help?

If you encounter issues:
1. Check Railway logs (API and Worker services)
2. Verify environment variables are set correctly
3. Ensure external services (R2, Resend) are configured properly
4. Review the error messages - they usually indicate what's missing

Ready to continue? Follow the steps above and let me know when you need help with any specific step!
