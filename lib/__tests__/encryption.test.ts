import { describe, test, expect } from '@jest/globals';
import { encrypt, decrypt } from '../encryption';

describe('Encryption Library', () => {
  test('should encrypt and decrypt text correctly', () => {
    const originalText = 'my-secret-password';
    const encrypted = encrypt(originalText);
    
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(originalText);
    
    const decrypted = decrypt(JSON.stringify(encrypted));
    expect(decrypted).toBe(originalText);
  });

  test('should handle empty strings', () => {
    const originalText = '';
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(JSON.stringify(encrypted));
    
    expect(decrypted).toBe(originalText);
  });

  test('should produce different encrypted values for same input', () => {
    const text = 'test-password';
    const encrypted1 = encrypt(text);
    const encrypted2 = encrypt(text);
    
    // Different IV should produce different encrypted values
    expect(encrypted1).not.toBe(encrypted2);
    
    // But both should decrypt to same value
    expect(decrypt(JSON.stringify(encrypted1))).toBe(text);
    expect(decrypt(JSON.stringify(encrypted2))).toBe(text);
  });

  test('should handle special characters', () => {
    const specialText = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`';
    const encrypted = encrypt(specialText);
    const decrypted = decrypt(JSON.stringify(encrypted));
    
    expect(decrypted).toBe(specialText);
  });

  test('should handle unicode characters', () => {
    const unicodeText = '你好世界 🌍 مرحبا';
    const encrypted = encrypt(unicodeText);
    const decrypted = decrypt(JSON.stringify(encrypted));
    
    expect(decrypted).toBe(unicodeText);
  });

  test('should return empty string for invalid encrypted data', () => {
    const invalidData = 'not-valid-encrypted-data';
    const decrypted = decrypt(invalidData);
    
    expect(decrypted).toBe('');
  });
});
