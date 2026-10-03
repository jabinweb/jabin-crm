/**
 * @jest-environment node
 */
const findUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: { platformSetting: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { isLiveKitConfigured, mintLiveKitAccessToken } from '@/lib/meetings/livekit';
import { clearLiveKitConfigCache } from '@/lib/meetings/livekit-config';
import { encrypt } from '@/lib/encryption';

const ENV_KEYS = ['LIVEKIT_URL', 'NEXT_PUBLIC_LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const;

function decodePayload(jwt: string) {
  const part = jwt.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

describe('LiveKit token minting', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue(null);
    clearLiveKitConfigCache();
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('is off until URL, key and secret are all set', async () => {
    clearLiveKitConfigCache();
    expect(await isLiveKitConfigured()).toBe(false);
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    clearLiveKitConfigCache();
    expect(await isLiveKitConfigured()).toBe(false);
    process.env.LIVEKIT_API_SECRET = 'secret';
    clearLiveKitConfigCache();
    expect(await isLiveKitConfigured()).toBe(true);
  });

  it('refuses to mint without credentials', async () => {
    await expect(mintLiveKitAccessToken({ identity: 'u1', roomName: 'r1' })).rejects.toThrow(/LIVEKIT_API_KEY/);
  });

  it('binds the token to one identity and one room', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'devkey';
    process.env.LIVEKIT_API_SECRET = 'a-very-long-development-secret-value-123';
    const token = await mintLiveKitAccessToken({ identity: 'user_1', name: 'Priya', roomName: 'opslane-room-1' });
    const payload = decodePayload(token);
    expect(payload.sub).toBe('user_1');
    expect(payload.iss).toBe('devkey');
    expect(payload.name).toBe('Priya');
    expect(payload.video).toMatchObject({ room: 'opslane-room-1', roomJoin: true, roomAdmin: false });
    expect(payload.exp - payload.nbf).toBeLessThanOrEqual(6 * 60 * 60 + 5);
  });

  it('grants room admin only when asked', async () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'devkey';
    process.env.LIVEKIT_API_SECRET = 'a-very-long-development-secret-value-123';
    const token = await mintLiveKitAccessToken({ identity: 'org', roomName: 'r', roomAdmin: true });
    expect(decodePayload(token).video.roomAdmin).toBe(true);
  });
});

describe('LiveKit config source', () => {
  beforeEach(() => {
    findUnique.mockReset();
    clearLiveKitConfigCache();
    process.env.LIVEKIT_URL = 'wss://env.example.com';
    process.env.LIVEKIT_API_KEY = 'envkey';
    process.env.LIVEKIT_API_SECRET = 'env-secret-value-long-enough-123';
  });
  afterEach(() => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
  });

  it('prefers a complete set saved by a super admin (secret decrypted)', async () => {
    findUnique.mockResolvedValue({
      livekitUrl: 'wss://db.example.com',
      livekitApiKey: 'dbkey',
      livekitApiSecret: JSON.stringify(encrypt('db-secret-value-long-enough-123')),
    });
    const token = await mintLiveKitAccessToken({ identity: 'u', roomName: 'r' });
    expect(decodePayload(token).iss).toBe('dbkey');
  });

  it('falls back to env when the saved set is incomplete or the column is missing', async () => {
    findUnique.mockResolvedValue({ livekitUrl: 'wss://db.example.com', livekitApiKey: 'dbkey', livekitApiSecret: null });
    expect(decodePayload(await mintLiveKitAccessToken({ identity: 'u', roomName: 'r' })).iss).toBe('envkey');
    clearLiveKitConfigCache();
    findUnique.mockRejectedValue(new Error('column does not exist'));
    expect(await isLiveKitConfigured()).toBe(true);
  });
});
