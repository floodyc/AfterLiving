export type UserRole = 'USER' | 'ADMIN';
export type PlanStatus = 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';
export type MessageStatus = 'DRAFT' | 'PENDING_UPLOAD' | 'UPLOADED' | 'READY' | 'RELEASED' | 'REVOKED';
export type VerifierStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';
export type RecipientStatus = 'PENDING' | 'NOTIFIED' | 'VIEWED';
export type ReleaseRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  messageId: string;
  storageKey: string;
}

export interface VideoMetadata {
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
}

export interface RecipientAccessToken {
  messageId: string;
  recipientId: string;
  exp: number;
}
