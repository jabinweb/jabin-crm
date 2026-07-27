/** Client-safe field-ops settings + geo helpers (no Prisma). */

export type FieldOpsSettings = {
  enforceVisitLimits: boolean;
  requirePhotoEvidence: boolean;
  geoFence: {
    enabled: boolean;
    lat: number | null;
    lng: number | null;
    radiusMeters: number;
    /** When true, reject punches outside the fence */
    hardBlock: boolean;
  };
};

export const DEFAULT_FIELD_OPS_SETTINGS: FieldOpsSettings = {
  enforceVisitLimits: false,
  requirePhotoEvidence: false,
  geoFence: {
    enabled: false,
    lat: null,
    lng: null,
    radiusMeters: 200,
    hardBlock: false,
  },
};

export function parseFieldOpsSettings(raw: unknown): FieldOpsSettings {
  const base: FieldOpsSettings = {
    ...DEFAULT_FIELD_OPS_SETTINGS,
    geoFence: { ...DEFAULT_FIELD_OPS_SETTINGS.geoFence },
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  if (typeof o.enforceVisitLimits === 'boolean') {
    base.enforceVisitLimits = o.enforceVisitLimits;
  }
  if (typeof o.requirePhotoEvidence === 'boolean') {
    base.requirePhotoEvidence = o.requirePhotoEvidence;
  }
  if (o.geoFence && typeof o.geoFence === 'object' && !Array.isArray(o.geoFence)) {
    const g = o.geoFence as Record<string, unknown>;
    base.geoFence = {
      enabled: typeof g.enabled === 'boolean' ? g.enabled : base.geoFence.enabled,
      lat: typeof g.lat === 'number' ? g.lat : base.geoFence.lat,
      lng: typeof g.lng === 'number' ? g.lng : base.geoFence.lng,
      radiusMeters:
        typeof g.radiusMeters === 'number' && g.radiusMeters > 0
          ? g.radiusMeters
          : base.geoFence.radiusMeters,
      hardBlock: typeof g.hardBlock === 'boolean' ? g.hardBlock : base.geoFence.hardBlock,
    };
  }
  return base;
}

/** Haversine distance in meters. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function evaluateGeoFence(
  settings: FieldOpsSettings,
  lat: number,
  lng: number
): { outside: boolean; distanceMeters: number | null } {
  const fence = settings.geoFence;
  if (!fence.enabled || fence.lat == null || fence.lng == null) {
    return { outside: false, distanceMeters: null };
  }
  const dist = distanceMeters(fence.lat, fence.lng, lat, lng);
  return { outside: dist > fence.radiusMeters, distanceMeters: dist };
}
