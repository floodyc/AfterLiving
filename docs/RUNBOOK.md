# Operations Runbook

Operational procedures for running and maintaining LegacyVideo in production.

## Table of Contents

1. [Service Health Checks](#service-health-checks)
2. [Common Operations](#common-operations)
3. [Incident Response](#incident-response)
4. [Troubleshooting](#troubleshooting)
5. [Maintenance Tasks](#maintenance-tasks)
6. [Monitoring & Alerts](#monitoring--alerts)

---

## Service Health Checks

### Quick Health Check

```bash
# Check API
curl https://api.your-domain.com/health
# Expected: {"status":"ok","timestamp":"2024-..."}

# Check Web
curl https://your-domain.com
# Expected: HTTP 200

# Check database
railway run --service api npx prisma db pull
# Expected: Schema pulled successfully

# Check Redis
redis-cli -u $REDIS_URL ping
# Expected: PONG
```

### Component Status

| Component | Health Endpoint | Expected Response |
|-----------|----------------|-------------------|
| API       | `/health`      | `{"status":"ok"}` |
| Database  | N/A            | Check via Prisma  |
| Redis     | N/A            | `redis-cli ping`  |
| Worker    | N/A            | Check logs        |
| S3        | N/A            | Check via SDK     |

---

## Common Operations

### Restart Services

**API:**
```bash
railway restart --service api
```

**Worker:**
```bash
railway restart --service worker
```

**Web:**
```bash
# Trigger redeploy on Vercel
vercel --prod
```

### View Logs

**API Logs:**
```bash
railway logs --service api --tail
railway logs --service api --since 1h
```

**Worker Logs:**
```bash
railway logs --service worker --tail
```

**Web Logs:**
```bash
vercel logs
vercel logs --follow
```

### Database Operations

**Run Migration:**
```bash
railway run --service api pnpm db:migrate:deploy
```

**Rollback Migration (DANGEROUS):**
```bash
railway run --service api sh
npx prisma migrate resolve --rolled-back <migration-name>
```

**Database Backup:**
```bash
# Export
railway run --service api pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Import
railway run --service api psql $DATABASE_URL < backup-20240101.sql
```

**Open Prisma Studio:**
```bash
railway run --service api npx prisma studio
# Opens on localhost:5555
```

### User Management

**Create Admin User:**
```bash
railway run --service api sh
npx prisma studio
# Create user with role: ADMIN
```

**Lock User Account:**
```bash
# Via API (requires admin token)
curl -X POST https://api.your-domain.com/api/admin/users/lock \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-id","locked":true}'
```

**Reset User Password:**
```bash
railway run --service api sh
npx ts-node -e "
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('newpassword', 12);
console.log('Hash:', hash);
// Update via Prisma Studio
"
```

### Queue Management

**View Queue Status:**
```bash
redis-cli -u $REDIS_URL
> KEYS bull:*
> LLEN bull:email:wait
> LLEN bull:email:active
> LLEN bull:email:failed
```

**Clear Failed Jobs:**
```bash
redis-cli -u $REDIS_URL
> DEL bull:email:failed
> DEL bull:release-process:failed
```

**Retry Failed Jobs:**
```bash
# Restart worker (will retry failed jobs automatically)
railway restart --service worker
```

---

## Incident Response

### Service Down

**Symptoms:**
- Health check fails
- 500 errors
- Timeout errors

**Steps:**
1. Check service status: `railway status`
2. Check logs: `railway logs --service api --tail`
3. Check database: `railway run --service api npx prisma db pull`
4. Check Redis: `redis-cli -u $REDIS_URL ping`
5. Restart service: `railway restart --service api`
6. If issue persists, check Railway dashboard for platform issues

---

### Database Connection Errors

**Symptoms:**
- "Can't reach database server"
- Connection timeout

**Steps:**
1. Verify DATABASE_URL: `railway variables --service api`
2. Check database service: `railway status`
3. Test connection: `railway run --service api npx prisma db pull`
4. Check connection limits: PostgreSQL max_connections
5. Restart API: `railway restart --service api`

---

### High Memory/CPU Usage

**Symptoms:**
- Slow response times
- Service restarts
- OOM errors

**Steps:**
1. Check Railway metrics dashboard
2. Identify resource-hungry queries in logs
3. Check for stuck jobs in queues
4. Scale vertically (upgrade Railway plan)
5. Scale horizontally (add replicas)

---

### Upload Failures

**Symptoms:**
- "Failed to upload video"
- 403 errors from S3

**Steps:**
1. Verify S3 credentials: `railway variables --service api`
2. Check S3 bucket permissions
3. Test S3 access:
   ```bash
   aws s3 ls s3://$S3_BUCKET --region $S3_REGION
   ```
4. Check CORS configuration
5. Review API logs for presigned URL generation errors

---

### Email Not Sending

**Symptoms:**
- Users not receiving emails
- Failed jobs in email queue

**Steps:**
1. Check Resend dashboard for errors
2. Verify RESEND_API_KEY: `railway variables --service worker`
3. Check FROM_EMAIL is verified
4. Check email queue:
   ```bash
   redis-cli -u $REDIS_URL LLEN bull:email:failed
   ```
5. Review worker logs: `railway logs --service worker`
6. Test email manually via Resend dashboard

---

### Data Breach / Security Incident

**IMMEDIATE STEPS:**
1. Lock all affected user accounts
2. Rotate all secrets (API_SECRET, MASTER_ENCRYPTION_KEY, etc.)
3. Revoke all active access tokens
4. Enable audit log review
5. Notify affected users
6. Document incident timeline

**Investigation:**
1. Review audit logs for suspicious activity
2. Check access logs for unusual IPs
3. Review recent deployments
4. Check for unauthorized database access
5. Scan for compromised dependencies

**Post-Incident:**
1. Implement additional security measures
2. Update threat model
3. Conduct security review
4. Consider external security audit

---

## Troubleshooting

### API Returns 500 Error

```bash
# Check recent logs
railway logs --service api --tail

# Common causes:
# - Database connection lost
# - Missing environment variable
# - Unhandled exception

# Quick fix
railway restart --service api
```

### Worker Not Processing Jobs

```bash
# Check worker is running
railway status --service worker

# Check logs
railway logs --service worker --tail

# Check Redis connection
redis-cli -u $REDIS_URL ping

# Restart worker
railway restart --service worker
```

### "Invalid or Expired Token" Errors

```bash
# Verify API_SECRET matches between services
railway variables --service api | grep API_SECRET
railway variables --service worker | grep API_SECRET

# If mismatch, update and restart
railway variables --set API_SECRET="new-secret" --service worker
railway restart --service worker
```

### Slow Query Performance

```bash
# Enable query logging in Prisma
# In code: log: ['query', 'info', 'warn', 'error']

# Review slow queries
railway logs --service api | grep "query took"

# Add database indexes if needed
railway run --service api npx prisma studio
```

---

## Maintenance Tasks

### Daily

- [ ] Check error rates in logs
- [ ] Verify email delivery (Resend dashboard)
- [ ] Monitor disk usage (Railway dashboard)

### Weekly

- [ ] Review audit logs for anomalies
- [ ] Check failed job queues
- [ ] Review database backup status
- [ ] Update dependencies (if security updates)

### Monthly

- [ ] Rotate secrets (API_SECRET, etc.)
- [ ] Review and archive old audit logs
- [ ] Database optimization (VACUUM, ANALYZE)
- [ ] Review and update documentation
- [ ] Check for dependency updates

### Quarterly

- [ ] Security audit
- [ ] Penetration testing
- [ ] Disaster recovery drill
- [ ] Review and update threat model
- [ ] Rotate MASTER_ENCRYPTION_KEY (with data migration)

---

## Monitoring & Alerts

### Key Metrics to Monitor

**Application:**
- Request rate (requests/sec)
- Error rate (%)
- Response time (p50, p95, p99)
- Database query time

**Infrastructure:**
- CPU usage (%)
- Memory usage (%)
- Disk usage (%)
- Network I/O

**Business:**
- Active users
- Video uploads per day
- Release requests per day
- Failed uploads

### Recommended Alerts

**Critical (page immediately):**
- Service down (health check fails)
- Database connection lost
- Error rate > 5%
- Disk usage > 90%

**Warning (notify during business hours):**
- Error rate > 1%
- Response time p99 > 2s
- Failed email delivery > 10%
- Memory usage > 80%

**Info (daily digest):**
- New user signups
- Release requests
- Failed jobs
- Dependency updates available

### Alert Channels

Configure alerts via:
1. Railway: Built-in notifications
2. Vercel: Deployment notifications
3. External: PagerDuty, Opsgenie, etc.
4. Slack/Discord webhooks for team notifications

---

## Emergency Contacts

**Platform Support:**
- Railway: https://railway.app/help
- Vercel: https://vercel.com/support
- Resend: support@resend.com

**On-Call Schedule:**
- Primary: [Name] - [Contact]
- Secondary: [Name] - [Contact]
- Escalation: [Name] - [Contact]

**External Services:**
- AWS Support (S3): [Phone/Email]
- Database Vendor: [Phone/Email]

---

## Disaster Recovery

### Data Loss Scenarios

**Database Corruption:**
1. Restore from latest Railway backup
2. If unavailable, restore from manual backup
3. Replay recent transactions from audit log

**S3 Data Loss:**
1. Videos are unrecoverable if not backed up
2. Check S3 versioning if enabled
3. Notify affected users

**Complete Infrastructure Loss:**
1. Provision new Railway project
2. Restore database from backup
3. Redeploy API and Worker
4. Update DNS to new infrastructure
5. Validate data integrity

### Recovery Time Objectives

| Scenario | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|----------|-------------------------------|--------------------------------|
| API crash | 5 minutes | 0 (no data loss) |
| Database failure | 30 minutes | 1 hour |
| Complete outage | 4 hours | 24 hours |

---

## Runbook Updates

This runbook should be reviewed and updated:
- After each incident
- When new features are deployed
- Quarterly as part of security review
- When infrastructure changes

**Last Updated:** 2024-01-17
**Next Review:** 2024-04-17
