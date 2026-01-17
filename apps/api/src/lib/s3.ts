import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';

export class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'us-east-1';
    this.bucket = process.env.S3_BUCKET || '';

    if (!this.bucket) {
      throw new Error('S3_BUCKET environment variable is required');
    }

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: !!endpoint, // Required for some S3-compatible services
    });
  }

  /**
   * Generate a unique storage key for a video
   */
  generateStorageKey(userId: string, messageId: string): string {
    const timestamp = Date.now();
    const random = randomBytes(8).toString('hex');
    return `videos/${userId}/${messageId}/${timestamp}-${random}.enc`;
  }

  /**
   * Generate a presigned URL for uploading a video
   * Client will upload encrypted video directly to S3
   */
  async generateUploadUrl(
    storageKey: string,
    contentType: string,
    sizeBytes: number
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: contentType,
      ContentLength: sizeBytes,
      ServerSideEncryption: 'AES256', // S3-level encryption in addition to our app-level encryption
      Metadata: {
        'encrypted': 'true',
      },
    });

    // URL expires in 1 hour
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  /**
   * Generate a presigned URL for downloading/streaming a video
   * Recipient will stream video directly from S3
   */
  async generateDownloadUrl(storageKey: string, expiresIn: number = 86400): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Delete a video from S3 (for revoked messages)
   */
  async deleteVideo(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    await this.client.send(command);
  }

  /**
   * Check if S3 service is accessible (health check)
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to generate a signed URL (doesn't make actual request)
      await this.generateDownloadUrl('health-check', 60);
      return true;
    } catch {
      return false;
    }
  }
}

export const s3Service = new S3Service();
