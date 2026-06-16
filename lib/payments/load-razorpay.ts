declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
    };
  }
}

export const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const LOAD_TIMEOUT_MS = 20_000;

let loadPromise: Promise<void> | null = null;

function waitForRazorpay(timeoutMs = LOAD_TIMEOUT_MS): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (window.Razorpay) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error('Razorpay checkout timed out'));
        return;
      }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

function injectScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-dynamic';
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      waitForRazorpay()
        .then(resolve)
        .catch(reject);
    };

    script.onerror = () => {
      script.remove();
      reject(new Error('Razorpay script network error'));
    };

    document.head.appendChild(script);
  });
}

/** Load Razorpay checkout.js — prefers next/script tag from pricing layout, falls back to dynamic inject. */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay can only load in the browser'));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    // Wait for next/script (pricing layout) or a prior inject
    try {
      await waitForRazorpay(8_000);
      return;
    } catch {
      // not loaded yet — inject below
    }

    const existing =
      document.getElementById('razorpay-checkout-js') ||
      document.getElementById('razorpay-checkout-dynamic') ||
      document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);

    if (existing && !window.Razorpay) {
      // Stale/blocked tag from a failed attempt — remove and retry once
      existing.remove();
    }

    await injectScript();
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

export function getRazorpayKeyId(): string | undefined {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || undefined;
}
