# Environment Variables Reference

Complete reference for all environment variables used in LegacyVideo.

## Database

### `DATABASE_URL` (Required)
PostgreSQL connection string.

**Format**: `postgresql://user:password@host:port/database?schema=public`

**Example**:
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/legacyvideo"
```

**Used by**: API, Worker

---

### `REDIS_URL` (Required)
Redis connection string for BullMQ queues.

**Format**: `redis://[username]:[password]@host:port`

**Example**:
```bash
REDIS_URL="redis://localhost:6379"
REDIS_URL="redis://default:password@red-xyz.railway.app:6379"
```

**Used by**: API, Worker

---

## Authentication & Security

### `API_SECRET` (Required)
Secret key for signing JWT tokens. Must be cryptographically random.

**Generate**: `openssl rand -base64 32`

**Example**:
```bash
API_SECRET="Xk7Np9Qm2Vf8Hs4Lw6Rt1Yz3Ub5Jc0Ae"
```

**Used by**: API, Worker

---

### `NEXTAUTH_SECRET` (Required for Web)
Secret for NextAuth.js session encryption.

**Generate**: `openssl rand -base64 32`

**Example**:
```bash
NEXTAUTH_SECRET="Ab3Cd4Ef5Gh6Ij7Kl8Mn9Op0Qr1St2Uv"
```

**Used by**: Web

---

### `NEXTAUTH_URL` (Required for Web)
Public URL of the web application.

**Example**:
```bash
# Development
NEXTAUTH_URL="http://localhost:3000"

# Production
NEXTAUTH_URL="https://legacyvideo.com"
```

**Used by**: Web

---

### `MASTER_ENCRYPTION_KEY` (Required, CRITICAL)
Master key for envelope encryption. Encrypts per-video data encryption keys.

**⚠️ SECURITY CRITICAL**: This key protects all video content. Loss = permanent data loss. Leak = complete compromise.

**Generate**: `openssl rand -base64 32`

**Example**:
```bash
MASTER_ENCRYPTION_KEY="dGhpc2lzYTMyYnl0ZWtleWVuY29kZWRpbmJhc2U2NA=="
```

**Storage**:
- Development: `.env` file (never commit)
- Production: Railway/Vercel secret variables
- Recommended: AWS Secrets Manager, HashiCorp Vault, etc.

**Used by**: API, Worker

---

## S3 Storage

### `S3_ENDPOINT` (Required)
S3 API endpoint URL.

**Examples**:
```bash
# AWS S3
S3_ENDPOINT="https://s3.amazonaws.com"
S3_ENDPOINT="https://s3.us-east-1.amazonaws.com"

# Cloudflare R2
S3_ENDPOINT="https://abc123.r2.cloudflarestorage.com"

# MinIO
S3_ENDPOINT="https://minio.example.com"
```

**Used by**: API

---

### `S3_REGION` (Required)
AWS region or S3-compatible region identifier.

**Example**:
```bash
S3_REGION="us-east-1"
S3_REGION="auto"  # For Cloudflare R2
```

**Used by**: API

---

### `S3_BUCKET` (Required)
Name of the S3 bucket for video storage.

**Example**:
```bash
S3_BUCKET="legacyvideo-production"
S3_BUCKET="legacyvideo-dev"
```

**Used by**: API

---

### `S3_ACCESS_KEY_ID` (Required)
S3 access key ID.

**Example**:
```bash
S3_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
```

**Used by**: API

---

### `S3_SECRET_ACCESS_KEY` (Required)
S3 secret access key.

**Example**:
```bash
S3_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

**Used by**: API

---

## Email (Resend)

### `RESEND_API_KEY` (Required)
API key for Resend email service.

**Get from**: https://resend.com/api-keys

**Example**:
```bash
RESEND_API_KEY="re_AbCdEfGh_123456789"
```

**Used by**: Worker

---

### `FROM_EMAIL` (Required)
Email address used as sender for all outgoing emails.

**Requirements**:
- Must be verified in Resend
- Should be a real inbox for replies

**Example**:
```bash
FROM_EMAIL="noreply@legacyvideo.com"
FROM_EMAIL="notifications@yourdomain.com"
```

**Used by**: Worker, API

---

### `ADMIN_EMAIL` (Optional)
Email address for admin notifications (release requests, etc.).

**Example**:
```bash
ADMIN_EMAIL="admin@legacyvideo.com"
```

**Used by**: API, Worker

---

## Application URLs

### `APP_URL` (Required)
Public URL of the web application (no trailing slash).

**Example**:
```bash
# Development
APP_URL="http://localhost:3000"

# Production
APP_URL="https://legacyvideo.com"
```

**Used by**: API, Worker

---

### `API_URL` (Required for Web)
Public URL of the API (no trailing slash).

**Example**:
```bash
# Development
API_URL="http://localhost:4000"
NEXT_PUBLIC_API_URL="http://localhost:4000"

# Production
API_URL="https://api.legacyvideo.com"
NEXT_PUBLIC_API_URL="https://api.legacyvideo.com"
```

**Note**: Web app needs `NEXT_PUBLIC_` prefix for client-side access.

**Used by**: Web, Worker

---

### `WEB_URL` (Optional)
Alternative way to specify web URL for CORS.

**Example**:
```bash
WEB_URL="https://legacyvideo.com"
```

**Used by**: API (CORS configuration)

---

## Application Config

### `APP_NAME` (Optional)
Application name shown in emails and UI.

**Default**: `LegacyVideo`

**Example**:
```bash
APP_NAME="Legacy Messages"
```

**Used by**: Worker, Web

---

### `NODE_ENV` (Auto-set)
Node.js environment.

**Values**: `development` | `production` | `test`

**Example**:
```bash
NODE_ENV="production"
```

**Used by**: All

---

### `PORT` (Optional)
Port for API server to listen on.

**Default**: `4000`

**Example**:
```bash
PORT="8080"
```

**Used by**: API

---

### `HOST` (Optional)
Host for API server to bind to.

**Default**: `0.0.0.0`

**Example**:
```bash
HOST="127.0.0.1"
```

**Used by**: API

---

## Rate Limiting

### `RATE_LIMIT_MAX` (Optional)
Maximum requests per window.

**Default**: `100`

**Example**:
```bash
RATE_LIMIT_MAX="200"
```

**Used by**: API

---

### `RATE_LIMIT_WINDOW` (Optional)
Rate limit window in milliseconds.

**Default**: `60000` (1 minute)

**Example**:
```bash
RATE_LIMIT_WINDOW="60000"
```

**Used by**: API

---

## Logging

### `LOG_LEVEL` (Optional)
Logging level for pino.

**Values**: `fatal` | `error` | `warn` | `info` | `debug` | `trace`

**Default**: `info`

**Example**:
```bash
LOG_LEVEL="debug"  # Development
LOG_LEVEL="warn"   # Production
```

**Used by**: API, Worker

---

## CI/CD Secrets (GitHub Actions)

These are set in GitHub repository settings, not in `.env`:

### `RAILWAY_TOKEN`
Railway CLI authentication token.

Get from: `railway login` then `railway whoami -t`

---

### `RAILWAY_PROJECT_ID`
Railway project identifier.

Get from: Railway dashboard or `railway status`

---

### `VERCEL_TOKEN`
Vercel authentication token.

Get from: https://vercel.com/account/tokens

---

### `VERCEL_ORG_ID`
Vercel organization/team ID.

Get from: Vercel project settings → General

---

### `VERCEL_PROJECT_ID`
Vercel project ID.

Get from: Vercel project settings → General

---

## Environment-Specific Examples

### Development (`.env.local`)
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legacyvideo_dev"
REDIS_URL="redis://localhost:6379"
API_SECRET="dev-secret-not-for-production"
MASTER_ENCRYPTION_KEY="ZGV2LWtleS1ub3QtZm9yLXByb2R1Y3Rpb24tbXVzdC1iZS0zMmJ5dGVz"
S3_ENDPOINT="http://localhost:9000"  # MinIO
S3_REGION="us-east-1"
S3_BUCKET="legacyvideo-dev"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
RESEND_API_KEY="re_dev_key"
FROM_EMAIL="dev@localhost"
APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:4000"
NODE_ENV="development"
LOG_LEVEL="debug"
```

### Production (Railway/Vercel)
```bash
DATABASE_URL="${DATABASE_URL}"  # Injected by Railway
REDIS_URL="${REDIS_URL}"  # Injected by Railway
API_SECRET="<generated-with-openssl>"
MASTER_ENCRYPTION_KEY="<generated-with-openssl>"
S3_ENDPOINT="https://s3.amazonaws.com"
S3_REGION="us-east-1"
S3_BUCKET="legacyvideo-prod"
S3_ACCESS_KEY_ID="<aws-access-key>"
S3_SECRET_ACCESS_KEY="<aws-secret-key>"
RESEND_API_KEY="<resend-api-key>"
FROM_EMAIL="noreply@legacyvideo.com"
ADMIN_EMAIL="admin@legacyvideo.com"
APP_URL="https://legacyvideo.com"
API_URL="https://api.legacyvideo.com"
NEXT_PUBLIC_API_URL="https://api.legacyvideo.com"
WEB_URL="https://legacyvideo.com"
NODE_ENV="production"
LOG_LEVEL="warn"
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="60000"
```

---

## Security Best Practices

1. **Never commit secrets**: Add `.env*` to `.gitignore`
2. **Rotate regularly**: Change secrets quarterly
3. **Different per environment**: Dev, staging, prod should have different secrets
4. **Use secret managers**: AWS Secrets Manager, HashiCorp Vault for production
5. **Principle of least privilege**: API keys should have minimum required permissions
6. **Audit access**: Review who has access to secrets
7. **Monitor usage**: Set up alerts for unusual API usage

---

## Validation

You can validate your environment configuration:

```bash
# Check required variables are set
pnpm --filter @legacyvideo/api dev
# Server will error if critical variables are missing

# Test database connection
pnpm db:studio

# Test encryption key format
node -e "console.log(Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'base64').length)"
# Should output: 32
```
