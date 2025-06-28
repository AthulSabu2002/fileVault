import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY environment variable must be set and at least 32 characters long');
}

/**
 * Encrypt a file buffer
 * @param buffer - The file buffer to encrypt
 * @returns Object containing encrypted data, initialization vector, and auth tag
 */
export const encryptFile = (buffer: Buffer): { 
  encryptedData: Buffer; 
  iv: string;
  authTag: string;
} => {
  // Generate a random initialization vector
  const iv = crypto.randomBytes(16);
  
  // Create cipher using the encryption key and IV
  const cipher = crypto.createCipheriv(
    ALGORITHM, 
    Buffer.from(ENCRYPTION_KEY).slice(0, 32), 
    iv
  );
  
  // Encrypt the buffer
  const encryptedData = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

/**
 * Decrypt an encrypted file buffer
 * @param encryptedData - The encrypted data buffer
 * @param iv - The initialization vector used for encryption
 * @param authTag - The authentication tag from encryption
 * @returns The decrypted file buffer
 */
export const decryptFile = (
  encryptedData: Buffer, 
  iv: string, 
  authTag: string
): Buffer => {
  // Create decipher using the encryption key and IV
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    Buffer.from(ENCRYPTION_KEY).slice(0, 32), 
    Buffer.from(iv, 'hex')
  );
  
  // Set the authentication tag
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  // Decrypt the data
  return Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);
};
