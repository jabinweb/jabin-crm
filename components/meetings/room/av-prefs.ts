/**
 * Remembered mic/camera choices and devices (ported from Selah lib/meeting-room/av-prefs).
 * Per-room state lives in sessionStorage; the last choice and devices in localStorage.
 */
const keyFor = (roomId: string) => `opslane:av-prefs:${roomId}`;
const DEVICE_KEY = 'opslane:av-devices';
const DEFAULT_KEY = 'opslane:av-default';

export type AvPrefs = { audio: boolean; video: boolean };

export type AvDevices = {
  audioInput?: string;
  videoInput?: string;
  audioOutput?: string;
};

export function readAvPrefs(roomId: string, fallback: AvPrefs = { audio: false, video: false }): AvPrefs {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(keyFor(roomId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AvPrefs>;
    return {
      audio: typeof parsed.audio === 'boolean' ? parsed.audio : fallback.audio,
      video: typeof parsed.video === 'boolean' ? parsed.video : fallback.video,
    };
  } catch {
    return fallback;
  }
}

export function writeAvPrefs(roomId: string, prefs: AvPrefs) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(keyFor(roomId), JSON.stringify(prefs));
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(prefs));
  } catch {
    // private mode / quota
  }
}

/** Last mic/cam choice across meetings (the camera check starts from this). */
export function readDefaultAvPrefs(): AvPrefs {
  if (typeof window === 'undefined') return { audio: true, video: true };
  try {
    const raw = localStorage.getItem(DEFAULT_KEY);
    if (!raw) return { audio: true, video: true };
    const parsed = JSON.parse(raw) as Partial<AvPrefs>;
    return { audio: parsed.audio !== false, video: parsed.video !== false };
  } catch {
    return { audio: true, video: true };
  }
}

export function readAvDevices(): AvDevices {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}') as AvDevices;
  } catch {
    return {};
  }
}

export function writeAvDevices(patch: AvDevices) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ ...readAvDevices(), ...patch }));
  } catch {
    // ignore
  }
}
