type EventCallback = (data: unknown) => void;

class SSEClient {
  private static instance: SSEClient;
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private attempts = 0;
  private readonly maxAttempts = 8;
  private readonly baseDelayMs = 2000;
  private readonly maxDelayMs = 60_000;

  private constructor() {}

  static getInstance(): SSEClient {
    if (!SSEClient.instance) {
      SSEClient.instance = new SSEClient();
    }
    return SSEClient.instance;
  }

  isConnectedState() {
    return this.isConnected;
  }

  async connect(): Promise<void> {
    if (this.isConnected || this.eventSource) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource('/api/sse');

        this.eventSource.onopen = () => {
          this.isConnected = true;
          this.attempts = 0;
          this.setupHeartbeat();
          resolve();
        };

        this.eventSource.onerror = (error) => {
          this.handleError(error);
          reject(error);
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as { type?: string };
            if (data.type === 'heartbeat') return;
            if (data.type) this.notifyListeners(data.type, data);
          } catch (error) {
            console.error('SSE parse error:', error);
          }
        };
      } catch (error) {
        this.handleError(error);
        reject(error);
      }
    });
  }

  private setupHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) this.scheduleReconnect();
    }, 45_000);
  }

  private handleError(_error: unknown) {
    this.cleanup();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.attempts += 1;
    if (this.attempts > this.maxAttempts) {
      console.warn('[SSE] Stopped reconnecting after repeated 503/errors');
      return;
    }
    const delay = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (this.attempts - 1));
    this.reconnectTimer = setTimeout(() => {
      void this.reconnect();
    }, delay);
  }

  private async reconnect() {
    this.cleanup();
    try {
      await this.connect();
    } catch {
      /* scheduleReconnect already handled via onerror */
    }
  }

  private cleanup() {
    this.isConnected = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  subscribe(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  unsubscribe(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  private notifyListeners(event: string, data: unknown) {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  disconnect() {
    this.cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.listeners.clear();
  }
}

export const sseClient = SSEClient.getInstance();
