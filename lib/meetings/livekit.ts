/**
 * LiveKit (video rooms) — server only. Ported from Selah's lib/meeting-room
 * (config, livekit-token, livekit-admin) and trimmed to what team meetings use.
 *
 * Credentials (all three required to enable built-in video) come from
 * Admin → Settings (PlatformSetting), else env — see ./livekit-config.ts:
 *   LIVEKIT_URL         wss://<project>.livekit.cloud  or  wss://livekit.your-domain.com
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 * When they are missing every helper degrades: tokens are refused with a clear
 * message, room admin calls are no-ops, and the UI offers external links instead.
 */
import { AccessToken, RoomServiceClient, TrackSource, type VideoGrant } from 'livekit-server-sdk';
import { getLiveKitConfig } from './livekit-config';

export async function getLiveKitServerUrl(): Promise<string | null> {
  return (await getLiveKitConfig()).url;
}

export async function isLiveKitConfigured(): Promise<boolean> {
  const cfg = await getLiveKitConfig();
  return Boolean(cfg.url && cfg.apiKey && cfg.apiSecret);
}

export async function mintLiveKitAccessToken(opts: {
  identity: string;
  name?: string | null;
  roomName: string;
  /** Organizer / admins: may mute, remove and close the room. */
  roomAdmin?: boolean;
  attributes?: Record<string, string>;
}): Promise<string> {
  const { apiKey, apiSecret } = await getLiveKitConfig();
  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required');
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name?.trim() || undefined,
    attributes: opts.attributes,
    ttl: '6h',
  });

  const grant: VideoGrant = {
    room: opts.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    // In-call chat uses data messages
    canPublishData: true,
    canUpdateOwnMetadata: true,
    roomAdmin: opts.roomAdmin ?? false,
    canPublishSources: [
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
  };
  at.addGrant(grant);
  return at.toJwt();
}

async function roomClient(): Promise<RoomServiceClient | null> {
  const { url, apiKey, apiSecret } = await getLiveKitConfig();
  if (!url || !apiKey || !apiSecret) return null;
  const httpUrl = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  const client = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  // A server behind a path (e.g. wss://events.jabin.org/livekit) needs its API under that path
  // too; the SDK always calls /twirp from the domain root and doesn't expose `prefix` here.
  const basePath = new URL(httpUrl).pathname.replace(/\/+$/, '');
  const rpc = (client as unknown as { rpc?: { prefix?: string } }).rpc;
  if (basePath && rpc) rpc.prefix = `${basePath}/twirp`;
  return client;
}

function swallowMissing(err: unknown) {
  // Room / participant already gone is not an error for callers
  const msg = err instanceof Error ? err.message : String(err);
  if (/not.?found|does not exist/i.test(msg)) return;
  console.error('[livekit] admin call failed:', err);
}

/** Identities (user ids) currently connected to a room; null when unknown (not configured / error). */
export async function listRoomIdentities(roomName: string): Promise<string[] | null> {
  const svc = await roomClient();
  if (!svc) return null;
  try {
    const list = await svc.listParticipants(roomName);
    return list.map((p) => p.identity);
  } catch (err) {
    swallowMissing(err);
    return null;
  }
}

/** Disconnect everyone ("End for everyone"). */
export async function closeRoom(roomName: string) {
  const svc = await roomClient();
  if (!svc) return;
  try {
    await svc.deleteRoom(roomName);
  } catch (err) {
    swallowMissing(err);
  }
}
