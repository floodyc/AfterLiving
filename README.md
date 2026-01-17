# LegacyVideo

Secure posthumous video message delivery platform. Store encrypted video messages for loved ones and release them after you pass away using a trusted verifier workflow.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▶│  Fastify API │────▶│  PostgreSQL  │
│   (Vercel)   │     │  (Railway)   │     │  (Railway)   │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐     ┌──────────────┐
                     │ BullMQ Worker│────▶│    Redis     │
                     │   (Railway)  │     │  (Railway)   │
                     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │  S3 Storage  │
                     │   (Videos)   │
                     └──────────────┘
```

## Key Features

- **Envelope Encryption**: Videos encrypted with per-message data keys, protected by master key
- **Trusted Verifiers**: User nominates 1-3 trusted people who can request release
- **Configurable Thresholds**: Require multiple verifier approvals (e.g., 2-of-3)
- **Audit Trail**: Immutable append-only log for all sensitive operations
- **Expiring Access Links**: Recipients get 24-hour signed URLs
- **Admin Console**: Oversight and emergency intervention capability

## Project Structure

```
AfterLiving/
├── apps/
│   ├── api/          # Fastify API server
│   ├── worker/       # BullMQ background workers
│   └── web/          # Next.js frontend
├── packages/
│   ├── db/           # Prisma schema & migrations
│   └── shared/       # Shared types & utilities
└── docs/             # Documentation
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Redis 7+
- S3-compatible storage

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed database (optional, for development)
pnpm db:seed
```

### Development

```bash
# Start all services in development mode
pnpm dev

# Or start individually:
pnpm --filter @legacyvideo/api dev
pnpm --filter @legacyvideo/worker dev
pnpm --filter @legacyvideo/web dev
```

Access the application:
- Web: http://localhost:3000
- API: http://localhost:4000

### Production Build

```bash
# Build all apps
pnpm build

# Run production
pnpm --filter @legacyvideo/api start
pnpm --filter @legacyvideo/worker start
pnpm --filter @legacyvideo/web start
```

## Environment Variables

See [docs/ENV_VARS.md](./docs/ENV_VARS.md) for complete reference.

Critical variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `MASTER_ENCRYPTION_KEY` - Base64-encoded 32-byte encryption key
- `API_SECRET` - JWT signing secret
- `S3_*` - S3 storage credentials
- `RESEND_API_KEY` - Email service API key

## Deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed deployment instructions.

### Railway (API + Worker + DB)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link project
railway login
railway link

# Deploy
railway up
```

### Vercel (Web)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd apps/web
vercel
```

## Security

See [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) for complete threat analysis.

Key security features:
- Server-side envelope encryption
- Rate limiting on all endpoints
- RBAC authorization
- Audit logging without PII
- Signed short-lived access tokens
- No keys in logs or database plaintext

## Testing

```bash
# Run all tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## License

Proprietary - All rights reserved

## Support

For issues and questions, please open a GitHub issue.
