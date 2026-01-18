# LegacyVideo - Quick Start Checklist

Follow these steps in order to get your application fully functional.

## ✅ Checklist

### □ Step 1: Generate Secrets (5 minutes)

Run this locally:
```bash
./generate-secrets.sh
```

Or manually:
```bash
node -e "console.log('API_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('MASTER_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
```

**Save both values** - you'll need them for Railway.

---

### □ Step 2: Set Up Cloudflare R2 (10 minutes)

1. Sign up: https://dash.cloudflare.com/sign-up
2. Go to **R2** → **Create bucket** → Name: `legacyvideo-videos`
3. **Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**
   - Copy **Access Key ID** and **Secret Access Key**
4. Copy your R2 endpoint from bucket settings

You'll have:
- `S3_ENDPOINT`: `https://xxxxx.r2.cloudflarestorage.com`
- `S3_BUCKET`: `legacyvideo-videos`
- `S3_ACCESS_KEY_ID`: `<your-key>`
- `S3_SECRET_ACCESS_KEY`: `<your-secret>`

---

### □ Step 3: Set Up Resend Email (5 minutes)

1. Sign up: https://resend.com/signup
2. **API Keys** → **Create API Key** → Name: `legacyvideo` → **Full Access**
3. Copy the API key (starts with `re_`)

For quick testing, use:
- `RESEND_API_KEY`: `re_xxxxx`
- `FROM_EMAIL`: `onboarding@resend.dev`

For production, add and verify your domain first.

---

### □ Step 4: Configure Railway API Service (5 minutes)

Railway → **API Service** → **Variables** → Add these:

```
NODE_ENV=production
PORT=4000
API_SECRET=<from-step-1>
MASTER_ENCRYPTION_KEY=<from-step-1>
S3_ENDPOINT=<from-step-2>
S3_REGION=auto
S3_BUCKET=<from-step-2>
S3_ACCESS_KEY_ID=<from-step-2>
S3_SECRET_ACCESS_KEY=<from-step-2>
```

**Link services:**
- Click **+ New Variable** → **Add Reference** → Select Postgres → `DATABASE_URL`
- Click **+ New Variable** → **Add Reference** → Select Redis → `REDIS_URL`

---

### □ Step 5: Configure Railway Worker Service (3 minutes)

Railway → **Worker Service** → **Variables** → Add these:

```
NODE_ENV=production
MASTER_ENCRYPTION_KEY=<SAME-AS-API>
RESEND_API_KEY=<from-step-3>
FROM_EMAIL=onboarding@resend.dev
APP_NAME=LegacyVideo
APP_URL=https://your-frontend.vercel.app
API_URL=https://<your-api>.up.railway.app
```

**To get API_URL:**
- Go to API Service → Settings → Networking → Copy public domain

**Link services** (same as Step 4):
- Add DATABASE_URL reference
- Add REDIS_URL reference

---

### □ Step 6: Run Database Migration (2 minutes)

Option 1 - Railway Shell:
1. Railway → **API Service** → **Deployments** → Click latest
2. Click **Shell** button
3. Run:
```bash
cd /app && pnpm --filter @legacyvideo/db migrate:deploy
```

Option 2 - Local (if Railway CLI installed):
```bash
railway run --service api pnpm --filter @legacyvideo/db migrate:deploy
```

---

### □ Step 7: Verify Everything Works (5 minutes)

**Check API:**
```bash
curl https://<your-api>.up.railway.app/health
```
Expected: `{"status":"ok","timestamp":"..."}`

**Check Worker Logs:**
- Railway → Worker Service → View Logs
- Should see: "🔄 Workers started and listening for jobs..."
- Should NOT see warnings about missing env vars

**Test Registration:**
```bash
curl -X POST https://<your-api>.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'
```

Expected: `{"success":true,"user":{...}}`

---

## 🎉 Done!

Your backend is now fully functional!

**What's working:**
- ✅ API server running on Railway
- ✅ Worker processing jobs (email, video release, cleanup)
- ✅ Database connected and migrated
- ✅ Redis queue system operational
- ✅ S3 storage configured for video uploads
- ✅ Email service ready to send notifications

**Next Steps:**
1. Deploy frontend to Vercel
2. Test complete user workflow
3. Configure custom domain (optional)
4. Set up monitoring and alerts

---

## 🆘 Quick Troubleshooting

**API won't start?**
- Check Railway logs for errors
- Verify all variables are set
- Ensure DATABASE_URL and REDIS_URL are linked

**Worker shows missing vars?**
- Verify RESEND_API_KEY is set
- Check MASTER_ENCRYPTION_KEY matches API

**Migration failed?**
- Wait for API to fully start (check logs)
- Ensure DATABASE_URL is accessible
- Try running migration command again

**Need detailed help?** See `SETUP_SECRETS.md` for comprehensive guide.
