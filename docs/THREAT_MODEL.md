# Threat Model & Security Analysis

## Overview

LegacyVideo handles extremely sensitive data: posthumous video messages intended for loved ones. The threat model addresses both technical and social attack vectors.

## Threat Categories

### 1. Account Takeover

**Threat**: Attacker gains access to user account and can view/modify legacy plans.

**Mitigations**:
- Strong password requirements (8+ chars, mixed case, numbers, special chars)
- Rate limiting on login endpoints (10 attempts/minute)
- JWT tokens with 7-day expiry
- No password reset without email verification
- Account locking capability for admin

**Residual Risk**: Low - Standard web app security practices applied

---

### 2. Verifier Collusion

**Threat**: Multiple verifiers collude to release videos prematurely or maliciously.

**Mitigations**:
- Configurable approval thresholds (require multiple independent approvals)
- Immutable audit log tracking all verifier actions with timestamps and IP addresses
- Admin oversight and ability to revoke verifiers
- Email notifications to plan owner (if alive) when release is requested
- No automatic release - always requires human verification

**Residual Risk**: Medium - Depends on user's choice of verifiers

---

### 3. Recipient Link Leakage

**Threat**: Access link intercepted or shared, allowing unauthorized video viewing.

**Mitigations**:
- Short-lived tokens (24 hours)
- Tokens bound to specific recipient email
- Single-use or view-tracked tokens
- Immediate revocation capability
- Access logged in audit trail with IP and user agent

**Residual Risk**: Low-Medium - Links can still be shared within 24h window

---

### 4. Insider Access (Database Admin)

**Threat**: Database administrator or attacker with DB access attempts to view videos.

**Mitigations**:
- Envelope encryption: Videos encrypted with per-message data keys (DEKs)
- DEKs encrypted with master key (KEK) stored only in environment variables
- Master key never logged or stored in database
- Even with DB access, videos remain encrypted
- S3 bucket also has server-side encryption

**Residual Risk**: Low - Would require compromise of both database AND environment/runtime

---

### 5. Replay Attacks

**Threat**: Attacker intercepts and replays API requests or tokens.

**Mitigations**:
- JWT tokens include expiry timestamps
- Recipient access tokens are short-lived (24h)
- HTTPS enforced in production
- CSRF tokens for state-changing operations
- SameSite cookie attributes

**Residual Risk**: Very Low - Standard web security mitigations

---

### 6. SQL Injection

**Threat**: Attacker injects malicious SQL through user inputs.

**Mitigations**:
- Prisma ORM with parameterized queries
- Zod schema validation on all inputs
- No raw SQL queries in application code
- Input sanitization at API boundary

**Residual Risk**: Very Low - ORM provides strong protection

---

### 7. SSRF (Server-Side Request Forgery)

**Threat**: Attacker tricks server into making requests to internal services.

**Mitigations**:
- No user-controlled URLs for server-side fetching
- S3 presigned URLs generated server-side only
- No URL parameters accepted for external requests
- Strict input validation

**Residual Risk**: Very Low - Attack surface minimized

---

### 8. CSRF (Cross-Site Request Forgery)

**Threat**: Attacker tricks user into making unwanted API requests.

**Mitigations**:
- SameSite cookies (Lax or Strict)
- CSRF tokens on state-changing operations
- Origin header validation
- Authorization header required (not just cookies)

**Residual Risk**: Very Low - Multiple layers of protection

---

### 9. Video Content Abuse

**Threat**: User uploads illegal, harmful, or abusive video content.

**Mitigations**:
- Store metadata only (no content scanning to preserve privacy)
- Reporting mechanism for recipients
- Admin ability to lock accounts and revoke access
- Audit trail for accountability
- Terms of service and acceptable use policy

**Residual Risk**: Medium - Privacy vs. content moderation tradeoff

---

### 10. Data Leakage in Logs

**Threat**: Sensitive data exposed through application logs.

**Mitigations**:
- Structured logging with PII redaction
- Email addresses hashed or redacted in non-critical logs
- Password/token fields automatically redacted by pino
- No encryption keys ever logged
- Log retention policies

**Residual Risk**: Low - Comprehensive log sanitization

---

### 11. Supply Chain Attacks

**Threat**: Malicious code in dependencies.

**Mitigations**:
- Lock file committed (pnpm-lock.yaml)
- Dependabot alerts enabled
- Regular dependency audits
- Minimal dependency footprint
- Critical packages pinned

**Residual Risk**: Medium - Inherent to npm ecosystem

---

### 12. Denial of Service (DoS)

**Threat**: Attacker overwhelms system with requests.

**Mitigations**:
- Rate limiting on all endpoints (configurable per route)
- Upload size limits (2GB max per video)
- Queue-based email sending (prevents email spam)
- Cloudflare or similar DDoS protection recommended for production

**Residual Risk**: Medium - Depends on infrastructure provider

---

## Security Best Practices

### Secrets Management
- All secrets via environment variables
- Never commit secrets to git
- Different secrets for dev/staging/prod
- Rotate secrets quarterly

### Encryption Key Management
- Master encryption key generated using cryptographically secure random
- Store in environment variable only (not config files)
- Consider AWS KMS or similar for production
- Key rotation strategy (complex with encrypted videos)

### Audit & Monitoring
- All sensitive actions logged
- Audit log is append-only (no updates/deletes)
- Monitor for unusual patterns:
  - Multiple failed login attempts
  - Rapid release requests
  - Bulk access token generation
  - Admin actions

### Incident Response
1. Lock affected accounts immediately
2. Revoke active access tokens
3. Review audit logs for scope
4. Notify affected users
5. Rotate compromised secrets

### Data Minimization
- Store only necessary personal data
- No PII in logs where avoidable
- Email addresses hashed for analytics
- Video content never inspected/analyzed

## Compliance Considerations

While not formally certified, the system design aligns with:

- **GDPR**: Right to deletion (user can delete all data), audit trails, data minimization
- **CCPA**: Data access and deletion rights
- **HIPAA** (not applicable but security level comparable): Encryption at rest and in transit, audit logs, access controls

## Security Roadmap

Future enhancements:
1. Two-factor authentication (2FA)
2. Hardware security module (HSM) for key storage
3. Content hashing and integrity verification
4. Automated threat detection
5. Penetration testing program
6. Bug bounty program

## Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Email: security@legacyvideo.com (with PGP key if available)

Response SLA: 24 hours for acknowledgment, 7 days for initial assessment
