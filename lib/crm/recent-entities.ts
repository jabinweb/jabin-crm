/** Client-side recent entities for quick navigation. */
const STORAGE_KEY = 'crm:recent-entities';
const MAX = 8;

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
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('crm:recent-updated'));
  } catch {
    /* ignore */
  }
}
