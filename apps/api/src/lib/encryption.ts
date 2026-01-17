import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Envelope Encryption Service
 *
 * Uses a master key (KEK) stored in environment to encrypt/decrypt
 * data encryption keys (DEK) that are unique per video.
 *
 * Flow:
 * 1. Generate random DEK for each video
 * 2. Encrypt video with DEK (client-side or during upload)
 * 3. Encrypt DEK with master KEK
 * 4. Store encrypted DEK in database
 * 5. Never log or expose keys
 */
export class EncryptionService {
  private masterKey: Buffer;

  constructor() {
    const masterKeyBase64 = process.env.MASTER_ENCRYPTION_KEY;
    if (!masterKeyBase64) {
      throw new Error('MASTER_ENCRYPTION_KEY environment variable is required');
    }

    try {
      this.masterKey = Buffer.from(masterKeyBase64, 'base64');
      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error(`Master key must be ${KEY_LENGTH} bytes`);
      }
    } catch (err) {
      throw new Error('Invalid MASTER_ENCRYPTION_KEY format. Must be base64-encoded 32-byte key');
    }
  }

  /**
   * Generate a new data encryption key (DEK)
   */
  generateDataKey(): Buffer {
    return randomBytes(KEY_LENGTH);
  }

  /**
   * Encrypt a data encryption key with the master key
   */
  encryptDataKey(dataKey: Buffer): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);

    const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  /**
   * Decrypt a data encryption key with the master key
   */
  decryptDataKey(encryptedDataKey: string): Buffer {
    const [ivBase64, authTagBase64, encryptedBase64] = encryptedDataKey.split(':');

    if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new Error('Invalid encrypted data key format');
    }

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Encrypt data with a data key (for server-side encryption if needed)
   */
  encryptData(data: Buffer, dataKey: Buffer): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, dataKey, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return { encrypted, iv, authTag };
  }

  /**
   * Decrypt data with a data key
   */
  decryptData(encrypted: Buffer, dataKey: Buffer, iv: Buffer, authTag: Buffer): Buffer {
    const decipher = createDecipheriv(ALGORITHM, dataKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Generate a deterministic key ID from the data key (for reference)
   */
  getKeyId(dataKey: Buffer): string {
    return createHash('sha256').update(dataKey).digest('hex').substring(0, 16);
  }
}

export const encryptionService = new EncryptionService();
