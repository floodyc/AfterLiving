import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE_BYTES } from './constants';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .regex(PASSWORD_PATTERN, 'Password must contain uppercase, lowercase, number, and special character'),
});

export const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Plan schemas
export const createPlanSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional(),
  approvalThreshold: z.number().int().min(1).max(10),
  totalVerifiers: z.number().int().min(1).max(10),
});

export const updatePlanSchema = createPlanSchema.partial();

// Message schemas
export const createMessageSchema = z.object({
  planId: z.string().cuid(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  releaseConditions: z.string().max(1000).optional(),
  recipientEmails: z.array(z.string().email()).max(50).optional().default([]),
});

export const uploadMetadataSchema = z.object({
  contentType: z.enum(ALLOWED_VIDEO_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid video format' }),
  }),
  sizeBytes: z.number().int().positive().max(MAX_VIDEO_SIZE_BYTES, 'File too large (max 2GB)'),
  durationSeconds: z.number().int().positive().optional(),
});

export const finalizeUploadSchema = z.object({
  messageId: z.string().cuid(),
  encryptedDataKey: z.string().min(1),
});

// Verifier schemas
export const inviteVerifierSchema = z.object({
  planId: z.string().cuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
});

export const acceptVerifierSchema = z.object({
  token: z.string().min(1),
});

// Release schemas
export const createReleaseRequestSchema = z.object({
  planId: z.string().cuid(),
  note: z.string().max(1000).optional(),
});

export const approveReleaseSchema = z.object({
  requestId: z.string().cuid(),
  approved: z.boolean(),
  note: z.string().max(500).optional(),
});

// Admin schemas
export const lockUserSchema = z.object({
  userId: z.string().cuid(),
  locked: z.boolean(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Recipient access schema
export const recipientAccessSchema = z.object({
  token: z.string().min(1),
});

