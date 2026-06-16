import crypto from 'crypto'

const DEFAULT_KEY = '0'.repeat(64) // Fallback for development
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || DEFAULT_KEY

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.warn('Warning: ENCRYPTION_KEY should be a 64-character hex string')
}

const ALGORITHM = 'aes-256-gcm'

function keyBytes(): Uint8Array {
  return new Uint8Array(Buffer.from(ENCRYPTION_KEY, 'hex'))
}

export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = new Uint8Array(crypto.randomBytes(12))
  const cipher = crypto.createCipheriv(ALGORITHM, keyBytes(), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return {
    encrypted,
    iv: Buffer.from(iv).toString('hex'),
    tag: cipher.getAuthTag().toString('hex')
  }
}

/**
 * Decrypts data. Supports both (encrypted, iv, tag) and JSON string format.
 */
export function decrypt(encryptedOrJson: string, iv?: string, tag?: string): string {
  try {
    let data = { encrypted: encryptedOrJson, iv: iv || '', tag: tag || '' };
    
    // If only one argument is provided, assume it's a JSON string
    if (!iv && !tag) {
      try {
        data = JSON.parse(encryptedOrJson);
      } catch {
        // Not JSON, maybe it's just raw? No, we require iv and tag for GCM.
        throw new Error('Encryption data must be JSON or include IV and Tag');
      }
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      keyBytes(),
      new Uint8Array(Buffer.from(data.iv, 'hex'))
    )
    decipher.setAuthTag(new Uint8Array(Buffer.from(data.tag, 'hex')))
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

export function encryptSensitiveData(data: any): any {
  if (!data) return data

  const encryptField = (text: string) => {
    const encData = encrypt(text);
    return JSON.stringify(encData); // Store as JSON string for easy retrieval
  }

  // Handle sensitive fields
  if (data.payments?.razorpay?.keyId) {
    data.payments.razorpay._keyId = encryptField(data.payments.razorpay.keyId)
    delete data.payments.razorpay.keyId
  }
  if (data.payments?.razorpay?.webhookSecret) {
    data.payments.razorpay._webhookSecret = encryptField(data.payments.razorpay.webhookSecret)
    delete data.payments.razorpay.webhookSecret
  }

  return data
}
