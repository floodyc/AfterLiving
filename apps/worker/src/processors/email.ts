import { Job } from 'bullmq';
import { Resend } from 'resend';
import { logger } from '../lib/logger';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@legacyvideo.com';

interface EmailJob {
  to: string;
  subject: string;
  html: string;
  metadata?: Record<string, unknown>;
}

export async function processEmailJob(job: Job<EmailJob>) {
  const { to, subject, html } = job.data;

  logger.info({ jobId: job.id, to, subject }, 'Sending email');

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    logger.info({ jobId: job.id, emailId: result.data?.id }, 'Email sent successfully');

    return { success: true, emailId: result.data?.id };
  } catch (error: any) {
    logger.error({ jobId: job.id, error: error.message }, 'Failed to send email');
    throw error; // BullMQ will retry based on job settings
  }
}
