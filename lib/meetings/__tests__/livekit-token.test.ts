/**
 * @jest-environment node
 */
import { isLiveKitConfigured, mintLiveKitAccessToken } from '@/lib/meetings/livekit';

const ENV_KEYS = ['LIVEKIT_URL', 'NEXT_PUBLIC_LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const;

function decodePayload(jwt: string) {
  const part = jwt.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

describe('LiveKit token minting', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
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

  it('is off until URL, key and secret are all set', () => {
    expect(isLiveKitConfigured()).toBe(false);
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    expect(isLiveKitConfigured()).toBe(false);
    process.env.LIVEKIT_API_SECRET = 'secret';
    expect(isLiveKitConfigured()).toBe(true);
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
