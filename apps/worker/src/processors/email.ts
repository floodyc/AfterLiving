import { Job } from 'bullmq';
import { Resend } from 'resend';
import { logger } from '../lib/logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@legacyvideo.com';

// Initialize Resend client lazily to avoid startup crashes
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error(
      'RESEND_API_KEY environment variable is not set. ' +
      'Please configure it in Railway to enable email sending. ' +
      'Get your API key from https://resend.com'
    );
  }

  if (!resend) {
    resend = new Resend(RESEND_API_KEY);
    logger.info('Resend email client initialized');
  }

  return resend;
}

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
    const client = getResendClient();
    const result = await client.emails.send({
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
