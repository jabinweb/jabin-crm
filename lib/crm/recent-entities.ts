/** Client-side recent entities for quick navigation. */
const STORAGE_KEY = 'crm:recent-entities';
const MAX = 8;

/**
 * Per-workspace key: the URL is `/[company]/...`, so the first path segment is
 * the workspace slug. Keeps one workspace's recents out of another's sidebar.
 */
function storageKey(): string {
  const slug = window.location.pathname.split('/').filter(Boolean)[0];
  return slug ? `${STORAGE_KEY}:${slug}` : STORAGE_KEY;
}

export type RecentEntity = {
  id: string;
  type: 'ticket' | 'customer' | 'lead' | 'deal';
  label: string;
  href: string;
  at: number;
};

export function getRecentEntities(): RecentEntity[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntity[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentEntity(entry: Omit<RecentEntity, 'at'>): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getRecentEntities().filter(
      (e) => !(e.id === entry.id && e.type === entry.type)
    );
    const next = [{ ...entry, at: Date.now() }, ...prev].slice(0, MAX);
    localStorage.setItem(storageKey(), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('crm:recent-updated'));
  } catch {
    /* ignore */
  }
}
