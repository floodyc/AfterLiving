import { Job } from 'bullmq';
import { prisma } from '@legacyvideo/db';
import { logger } from '../lib/logger';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.API_SECRET || 'replace-with-secure-secret';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

interface ReleaseProcessJob {
  releaseRequestId: string;
  planId: string;
}

export async function processReleaseJob(job: Job<ReleaseProcessJob>) {
  const { releaseRequestId, planId } = job.data;

  logger.info({ jobId: job.id, releaseRequestId, planId }, 'Processing release');

  try {
    // Get release request with all related data
    const releaseRequest = await prisma.releaseRequest.findUnique({
      where: { id: releaseRequestId },
      include: {
        plan: {
          include: {
            messages: {
              where: {
                status: 'READY',
              },
              include: {
                recipients: true,
              },
            },
          },
        },
      },
    });

    if (!releaseRequest) {
      throw new Error('Release request not found');
    }

    if (releaseRequest.status !== 'APPROVED') {
      throw new Error('Release request is not approved');
    }

    // Process each message in the plan
    for (const message of releaseRequest.plan.messages) {
      // Update message status
      await prisma.videoMessage.update({
        where: { id: message.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      // Create access tokens for each recipient
      for (const recipient of message.recipients) {
        // Generate recipient access token
        const accessToken = jwt.sign(
          {
            messageId: message.id,
            recipientId: recipient.id,
            type: 'recipient_access',
          },
          JWT_SECRET,
          {
            expiresIn: '24h',
            issuer: 'legacyvideo-api',
          }
        );

        // Create recipient access record
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await prisma.recipientAccess.create({
          data: {
            messageId: message.id,
            recipientId: recipient.id,
            token: accessToken,
            expiresAt,
          },
        });

        // Update recipient status
        await prisma.recipient.update({
          where: { id: recipient.id },
          data: { status: 'NOTIFIED' },
        });

        // Send email to recipient (queue another email job)
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const viewUrl = `${APP_URL}/view?token=${accessToken}`;
        const emailHtml = `
          <h1>You Have a Video Message</h1>
          <p>Someone special has left you a video message: "${message.title}"</p>
          <p><a href="${viewUrl}">View Message</a></p>
          <p><strong>Important:</strong> This link will expire in 24 hours.</p>
          <p>This message was stored securely with LegacyVideo and released according to the sender's wishes.</p>
        `;

        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'noreply@legacyvideo.com',
          to: recipient.email,
          subject: `You have a video message: ${message.title}`,
          html: emailHtml,
        });

        logger.info(
          { recipientEmail: recipient.email, messageId: message.id },
          'Recipient notified'
        );

        // Create audit event
        await prisma.auditEvent.create({
          data: {
            action: 'RECIPIENT_NOTIFIED',
            entityType: 'Recipient',
            entityId: recipient.id,
            metadata: {
              messageId: message.id,
              recipientEmail: recipient.email,
            },
          },
        });
      }
    }

    // Update plan status to completed
    await prisma.legacyPlan.update({
      where: { id: planId },
      data: { status: 'COMPLETED' },
    });

    // Create final audit event
    await prisma.auditEvent.create({
      data: {
        action: 'RELEASE_FINALIZED',
        entityType: 'ReleaseRequest',
        entityId: releaseRequestId,
        metadata: {
          planId,
          messageCount: releaseRequest.plan.messages.length,
        },
      },
    });

    logger.info({ releaseRequestId, planId }, 'Release processed successfully');

    return { success: true, messagesReleased: releaseRequest.plan.messages.length };
  } catch (error: any) {
    logger.error(
      { jobId: job.id, error: error.message, releaseRequestId },
      'Failed to process release'
    );
    throw error;
  }
}
