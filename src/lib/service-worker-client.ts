const SW_TIMEOUT_MS = 15000;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null;

export function registerServiceWorkerEarly(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  if (process.env.NODE_ENV === "development") {
    return Promise.resolve(null);
  }

  if (!registrationPromise) {
    registrationPromise = (async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration("/");
        if (existing) return existing;
        return await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
      } catch {
        return null;
      }
    })();
  }

  return registrationPromise;
}

export async function waitForServiceWorker(
  timeoutMs = SW_TIMEOUT_MS
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  if (process.env.NODE_ENV === "development") {
    return null;
  }

  await registerServiceWorkerEarly();

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
