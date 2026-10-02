/**
 * LiveKit (video rooms) — server only. Ported from Selah's lib/meeting-room
 * (config, livekit-token, livekit-admin) and trimmed to what team meetings use.
 *
 * Env (all three required to enable built-in video; see .env.example):
 *   LIVEKIT_URL         wss://<project>.livekit.cloud  or  wss://livekit.your-domain.com
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 * When they are missing every helper degrades: tokens are refused with a clear
 * message, room admin calls are no-ops, and the UI offers external links instead.
 */
import { AccessToken, RoomServiceClient, TrackSource, type VideoGrant } from 'livekit-server-sdk';

export function getLiveKitServerUrl(): string | null {
  return process.env.LIVEKIT_URL?.trim() || process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || null;
}

export function isLiveKitConfigured(): boolean {
  return Boolean(
    getLiveKitServerUrl() &&
      process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim()
  );
}

export async function mintLiveKitAccessToken(opts: {
  identity: string;
  name?: string | null;
  roomName: string;
  /** Organizer / admins: may mute, remove and close the room. */
  roomAdmin?: boolean;
  attributes?: Record<string, string>;
}): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
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

function roomClient(): RoomServiceClient | null {
  if (!isLiveKitConfigured()) return null;
  const url = getLiveKitServerUrl()!;
  const httpUrl = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  return new RoomServiceClient(
    httpUrl,
    process.env.LIVEKIT_API_KEY!.trim(),
    process.env.LIVEKIT_API_SECRET!.trim()
  );
}

function swallowMissing(err: unknown) {
  // Room / participant already gone is not an error for callers
  const msg = err instanceof Error ? err.message : String(err);
  if (/not.?found|does not exist/i.test(msg)) return;
  console.error('[livekit] admin call failed:', err);
}

/** Identities (user ids) currently connected to a room; null when unknown (not configured / error). */
export async function listRoomIdentities(roomName: string): Promise<string[] | null> {
  const svc = roomClient();
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
  const svc = roomClient();
  if (!svc) return;
  try {
    await svc.deleteRoom(roomName);
  } catch (err) {
    swallowMissing(err);
  }
}
