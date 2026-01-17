import { queueEmail } from './queue';
import { logger } from './logger';

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@legacyvideo.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const APP_NAME = process.env.APP_NAME || 'LegacyVideo';

export class EmailService {
  /**
   * Send verification email to new users
   */
  async sendVerificationEmail(to: string, token: string) {
    const verifyUrl = `${APP_URL}/auth/verify?token=${token}`;

    await queueEmail({
      to,
      subject: `Verify your ${APP_NAME} account`,
      html: `
        <h1>Welcome to ${APP_NAME}</h1>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, you can safely ignore this email.</p>
      `,
      metadata: { type: 'verification', token },
    });

    logger.info({ to }, 'Verification email queued');
  }

  /**
   * Send magic link for passwordless login
   */
  async sendMagicLink(to: string, token: string) {
    const loginUrl = `${APP_URL}/auth/magic?token=${token}`;

    await queueEmail({
      to,
      subject: `Your ${APP_NAME} login link`,
      html: `
        <h1>Your Login Link</h1>
        <p>Click the link below to log in to ${APP_NAME}:</p>
        <p><a href="${loginUrl}">Log In</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      metadata: { type: 'magic_link', token },
    });

    logger.info({ to }, 'Magic link email queued');
  }

  /**
   * Send verifier invitation
   */
  async sendVerifierInvitation(to: string, planTitle: string, userName: string, token: string) {
    const acceptUrl = `${APP_URL}/verifier/accept?token=${token}`;

    await queueEmail({
      to,
      subject: `You've been invited as a trusted verifier`,
      html: `
        <h1>Trusted Verifier Invitation</h1>
        <p><strong>${userName}</strong> has invited you to be a trusted verifier for their Legacy Plan: "${planTitle}".</p>
        <p>As a trusted verifier, you may be asked to help release important video messages to their loved ones in the future.</p>
        <p><a href="${acceptUrl}">Accept Invitation</a></p>
        <p>This invitation will expire in 7 days.</p>
        <p>Learn more about ${APP_NAME} at ${APP_URL}</p>
      `,
      metadata: { type: 'verifier_invitation', token, planTitle },
    });

    logger.info({ to, planTitle }, 'Verifier invitation email queued');
  }

  /**
   * Notify verifiers of a release request
   */
  async notifyVerifierOfRequest(to: string, planTitle: string, requestNote: string) {
    const dashboardUrl = `${APP_URL}/verifier/dashboard`;

    await queueEmail({
      to,
      subject: `Action needed: Release request for ${planTitle}`,
      html: `
        <h1>Release Request Pending</h1>
        <p>A release request has been submitted for the Legacy Plan: "${planTitle}".</p>
        ${requestNote ? `<p><strong>Note:</strong> ${requestNote}</p>` : ''}
        <p>Please review and approve or deny this request:</p>
        <p><a href="${dashboardUrl}">Review Request</a></p>
      `,
      metadata: { type: 'release_request', planTitle },
    });

    logger.info({ to, planTitle }, 'Release request notification queued');
  }

  /**
   * Send video access link to recipient
   */
  async sendRecipientAccessLink(to: string, messageTitle: string, accessToken: string) {
    const viewUrl = `${APP_URL}/view?token=${accessToken}`;

    await queueEmail({
      to,
      subject: `You have a video message: ${messageTitle}`,
      html: `
        <h1>You Have a Video Message</h1>
        <p>Someone special has left you a video message: "${messageTitle}"</p>
        <p><a href="${viewUrl}">View Message</a></p>
        <p><strong>Important:</strong> This link will expire in 24 hours.</p>
        <p>This message was stored securely with ${APP_NAME} and released according to the sender's wishes.</p>
      `,
      metadata: { type: 'recipient_access', messageTitle, accessToken },
    });

    logger.info({ to, messageTitle }, 'Recipient access email queued');
  }

  /**
   * Notify admin of new release request
   */
  async notifyAdminOfRequest(requestId: string, planTitle: string, verifierEmail: string) {
    const adminUrl = `${APP_URL}/admin/releases/${requestId}`;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      logger.warn('ADMIN_EMAIL not configured, skipping admin notification');
      return;
    }

    await queueEmail({
      to: adminEmail,
      subject: `[Admin] New release request: ${planTitle}`,
      html: `
        <h1>New Release Request</h1>
        <p><strong>Plan:</strong> ${planTitle}</p>
        <p><strong>Requested by:</strong> ${verifierEmail}</p>
        <p><a href="${adminUrl}">Review in Admin Console</a></p>
      `,
      metadata: { type: 'admin_notification', requestId, planTitle },
    });

    logger.info({ requestId, planTitle }, 'Admin notification queued');
  }
}

export const emailService = new EmailService();
