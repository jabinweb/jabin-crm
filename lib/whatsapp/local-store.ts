/**
 * Browser IndexedDB cache for WhatsApp messages (WhatsApp Web–style local store).
 * Survives refresh; server remains source of truth and merges on sync.
 */

const DB_NAME = 'opslane-whatsapp';
const DB_VERSION = 1;
const STORE = 'messages';

export type CachedWaMessage = {
  id: string;
  userId: string;
  createdAt: string;
  direction: string;
  status: string;
  message: string;
  channel?: string;
  chatJid?: string;
  isGroup?: boolean;
  senderName?: string | null;
  fromPhone?: string | null;
  toPhone?: string | null;
  metadata?: unknown;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('userChat', ['userId', 'chatJid'], { unique: false });
        store.createIndex('userCreated', ['userId', 'createdAt'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open WhatsApp cache'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export async function cacheWhatsAppMessages(
  userId: string,
  messages: CachedWaMessage[]
): Promise<void> {
  if (!messages.length) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const msg of messages) {
      store.put({
        ...msg,
        userId,
        chatJid: msg.chatJid || msg.fromPhone || msg.toPhone || '',
      });
    }
    await txDone(tx);
    db.close();
  } catch {
    /* private mode / quota — ignore */
  }
}

export async function readCachedWhatsAppMessages(
  userId: string,
  opts?: { chatJid?: string; limit?: number }
): Promise<CachedWaMessage[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const index = store.index('userId');
    const rows: CachedWaMessage[] = await new Promise((resolve, reject) => {
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result || []) as CachedWaMessage[]);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    db.close();

    let list = rows;
    if (opts?.chatJid) {
      const want = opts.chatJid.replace(/^whatsapp:/i, '');
      list = list.filter((m) => (m.chatJid || '').replace(/^whatsapp:/i, '') === want);
    }
    list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const limit = opts?.limit ?? 500;
    return list.slice(0, limit);
  } catch {
    return [];
  }
}

export async function mergeCachedWithServer(
  userId: string,
  serverMessages: CachedWaMessage[]
): Promise<CachedWaMessage[]> {
  await cacheWhatsAppMessages(userId, serverMessages);
  const cached = await readCachedWhatsAppMessages(userId, { limit: 2000 });
  const byId = new Map<string, CachedWaMessage>();
  for (const m of cached) byId.set(m.id, m);
  for (const m of serverMessages) byId.set(m.id, { ...m, userId });
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
