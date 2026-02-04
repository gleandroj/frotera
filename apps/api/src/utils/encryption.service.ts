import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 32 bytes for AES-256
  private readonly ivLength = 16; // 16 bytes for IV
  private readonly saltLength = 64; // 64 bytes for salt
  private readonly tagLength = 16; // 16 bytes for GCM tag
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Ensure key is exactly 32 bytes (256 bits) for AES-256
    if (encryptionKey.length !== this.keyLength) {
      // If key is not exactly 32 bytes, derive a key from it using PBKDF2
      this.key = crypto.pbkdf2Sync(encryptionKey, 'salt', 100000, this.keyLength, 'sha256');
    } else {
      this.key = Buffer.from(encryptionKey, 'utf8');
    }
  }

  /**
   * Encrypts a string value
   */
  encrypt(value: string): string {
    if (!value) {
      return value;
    }

    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt
      let encrypted = cipher.update(value, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine IV, tag, and encrypted data
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'base64'),
      ]);

      // Return as base64 string
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts an encrypted string value
   */
  decrypt(encryptedValue: string): string {
    if (!encryptedValue) {
      return encryptedValue;
    }

    try {
      // Decode from base64
      const combined = Buffer.from(encryptedValue, 'base64');

      // Extract IV, tag, and encrypted data
      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(tag);

      // Decrypt
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}
