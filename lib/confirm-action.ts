'use client';

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive styling for delete / irreversible actions */
  variant?: 'default' | 'destructive';
  /**
   * When set, the user must type this exact string (trimmed) before Confirm is enabled.
   * Use for irreversible deletes (e.g. company slug).
   */
  confirmText?: string;
  /** Placeholder / hint under the input when confirmText is set */
  confirmTextLabel?: string;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type Listener = (pending: PendingConfirm | null) => void;

let pending: PendingConfirm | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => {
    listener(pending);
  });
}

/** Subscribe the host dialog to pending confirm requests. */
export function subscribeConfirmAction(listener: Listener): () => void {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}

export function resolveConfirmAction(value: boolean) {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(value);
}

/**
 * Platform-wide confirm via shadcn AlertDialog (replaces window.confirm).
 * Requires `<ConfirmActionHost />` mounted (root layout).
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (pending) {
      pending.resolve(false);
    }
    pending = { ...options, resolve };
    emit();
  });
}
