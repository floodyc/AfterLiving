# Deployment Guide

## Overview

LegacyVideo deploys across three platforms:
- **Railway**: API + Worker + PostgreSQL + Redis
- **Vercel**: Next.js web application
- **S3-compatible**: Video storage (AWS S3, Cloudflare R2, etc.)

## Prerequisites

1. Railway account (https://railway.app)
2. Vercel account (https://vercel.com)
3. S3-compatible storage provider
4. Resend account for email (https://resend.com)
5. Domain name (optional but recommended)

## Environment Variables Reference

See `.env.example` for all required variables. Critical ones:

### Database & Cache
```bash
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
```

### Authentication
```bash
API_SECRET="..." # Generate: openssl rand -base64 32
NEXTAUTH_SECRET="..." # Generate: openssl rand -base64 32
NEXTAUTH_URL="https://your-domain.com"
```

### Encryption
```bash
# CRITICAL: Generate and store securely
MASTER_ENCRYPTION_KEY="..." # Generate: openssl rand -base64 32
```

### S3 Storage
```bash
S3_ENDPOINT="https://s3.amazonaws.com"
S3_REGION="us-east-1"
S3_BUCKET="legacyvideo-prod"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
```

### Email
```bash
RESEND_API_KEY="re_..."
FROM_EMAIL="noreply@yourdomain.com"
```

### Application
```bash
APP_NAME="LegacyVideo"
APP_URL="https://your-domain.com"
API_URL="https://api.your-domain.com"
```

## Step 1: Set Up S3 Storage

### AWS S3

```bash
# Create bucket
aws s3 mb s3://legacyvideo-prod --region us-east-1

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket legacyvideo-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Configure CORS
aws s3api put-bucket-cors \
  --bucket legacyvideo-prod \
  --cors-configuration file://cors.json
```

**cors.json:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://your-domain.com"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### Cloudflare R2 (Alternative)

```bash
# Create bucket via Cloudflare dashboard
# Get credentials from R2 API tokens page
```

## Step 2: Deploy to Railway

### 2.1 Create New Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### 2.2 Add Services

Add the following services in Railway dashboard:

1. **PostgreSQL**
   - Template: PostgreSQL
   - Note the DATABASE_URL

2. **Redis**
   - Template: Redis
   - Note the REDIS_URL

3. **API Service**
   - Source: GitHub repo
   - Root directory: `/apps/api`
   - Build command: `pnpm install && pnpm build`
   - Start command: `pnpm start`

4. **Worker Service**
   - Source: GitHub repo (same)
   - Root directory: `/apps/worker`
   - Build command: `pnpm install && pnpm build`
   - Start command: `pnpm start`

### 2.3 Configure Environment Variables

For API service, add:
```bash
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
API_SECRET=<generate-secure-secret>
MASTER_ENCRYPTION_KEY=<generate-secure-key>
S3_ENDPOINT=...
S3_REGION=...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
RESEND_API_KEY=...
FROM_EMAIL=...
APP_URL=https://your-domain.com
WEB_URL=https://your-domain.com
NODE_ENV=production
```

For Worker service, add the same variables.

### 2.4 Run Database Migrations

```bash
# Connect to API service
railway run pnpm --filter @legacyvideo/db migrate:deploy

# Alternatively, use Railway CLI
railway run --service api sh
cd ../../packages/db
npx prisma migrate deploy
```

### 2.5 Set Up Custom Domain (Optional)

In Railway dashboard:
- Go to API service → Settings → Domains
- Add custom domain: `api.your-domain.com`
- Configure DNS CNAME record

## Step 3: Deploy to Vercel

### 3.1 Connect Repository

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
cd apps/web
vercel link
```

### 3.2 Configure Environment Variables

In Vercel dashboard or via CLI:

```bash
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://api.your-domain.com

vercel env add NEXTAUTH_SECRET production
# Enter: <generate-secure-secret>

vercel env add NEXTAUTH_URL production
# Enter: https://your-domain.com
```

### 3.3 Deploy

```bash
# Deploy to production
vercel --prod
```

### 3.4 Set Up Custom Domain

In Vercel dashboard:
- Settings → Domains
- Add: `your-domain.com`
- Configure DNS records

## Step 4: Post-Deployment

### 4.1 Verify Services

```bash
# Check API health
curl https://api.your-domain.com/health

# Check web app
curl https://your-domain.com

# Verify database connection
railway run --service api npx prisma db pull
```

### 4.2 Create Admin User

```bash
# SSH into API service
railway run --service api sh

# Run seed or create user manually
npx prisma studio
# Create user with role: ADMIN
```

### 4.3 Test Email Delivery

Use Resend dashboard to send test email and verify delivery.

### 4.4 Test Upload Flow

1. Register test account
2. Create legacy plan
3. Create message
4. Attempt video upload
5. Verify S3 storage

## Step 5: Set Up CI/CD

GitHub Actions workflow is included at `.github/workflows/ci.yml`.

### Configure GitHub Secrets

In GitHub repo settings → Secrets and variables → Actions:

```bash
RAILWAY_TOKEN=<railway-token>
VERCEL_TOKEN=<vercel-token>
VERCEL_ORG_ID=<org-id>
VERCEL_PROJECT_ID=<project-id>
```

## Monitoring & Maintenance

### Logs

**Railway:**
```bash
railway logs --service api
railway logs --service worker
```

**Vercel:**
```bash
vercel logs
```

### Database Backups

Railway PostgreSQL includes automatic backups. For additional safety:

```bash
# Manual backup
railway run --service api pg_dump $DATABASE_URL > backup.sql

# Restore
railway run --service api psql $DATABASE_URL < backup.sql
```

### Scaling

**Railway:**
- Auto-scales based on load
- Configure in service settings

**Vercel:**
- Serverless, auto-scales
- No configuration needed

### Cost Optimization

1. **Railway**: Start with Hobby plan ($5/mo), upgrade to Pro if needed
2. **Vercel**: Free tier for hobby, Pro ($20/mo) for production
3. **S3**: Use lifecycle policies to move old videos to cheaper storage
4. **Redis**: Consider managed Redis for high availability

## Troubleshooting

### Database Connection Errors

```bash
# Verify DATABASE_URL format
echo $DATABASE_URL

# Test connection
railway run --service api npx prisma db pull
```

### Upload Failures

1. Check S3 credentials
2. Verify CORS configuration
3. Check S3 bucket permissions
4. Review API logs for errors

### Email Not Sending

1. Verify RESEND_API_KEY
2. Check Resend dashboard for errors
3. Verify FROM_EMAIL is authorized
4. Check worker logs

### Worker Not Processing Jobs

1. Verify REDIS_URL connection
2. Check worker logs
3. Verify BullMQ queues:
   ```bash
   railway run --service worker sh
   npx bull-board
   ```

## Security Checklist

- [ ] All secrets rotated from development values
- [ ] MASTER_ENCRYPTION_KEY generated and secured
- [ ] HTTPS enforced on all services
- [ ] CORS configured correctly
- [ ] Rate limiting verified
- [ ] Admin account created
- [ ] Database backups confirmed
- [ ] Audit logs verified
- [ ] Email delivery tested
- [ ] Upload encryption tested

## Rollback Procedure

### Rollback API/Worker

```bash
# List deployments
railway deployments

# Rollback to previous
railway rollback <deployment-id>
```

### Rollback Web

```bash
# List deployments
vercel ls

# Rollback
vercel rollback <deployment-url>
```

### Rollback Database Migration

```bash
# DANGEROUS: Only if migration hasn't been deployed long

railway run --service api sh
npx prisma migrate resolve --rolled-back <migration-name>
```

## Support

For deployment issues:
- Railway: https://railway.app/help
- Vercel: https://vercel.com/support
- Project-specific: Open GitHub issue
