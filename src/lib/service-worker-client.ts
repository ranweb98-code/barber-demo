const SW_TIMEOUT_MS = 15000;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null;

function isDevWithoutSw(): boolean {
  return process.env.NODE_ENV === "development";
}

export function registerServiceWorkerEarly(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  if (isDevWithoutSw()) {
    return Promise.resolve(null);
  }

  if (!registrationPromise) {
    registrationPromise = (async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration("/");
        if (existing) return existing;
        return await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (error) {
        console.error("[service-worker-client] register failed:", error);
        registrationPromise = null;
        return null;
      }
    })();
  }

  return registrationPromise;
}

function skipWaitingWorker(registration: ServiceWorkerRegistration) {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
}

export async function waitForServiceWorker(
  timeoutMs = SW_TIMEOUT_MS
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  if (isDevWithoutSw()) {
    return null;
  }

  try {
    const registration =
      (await navigator.serviceWorker.getRegistration("/")) ??
      (await registerServiceWorkerEarly());

    if (!registration) return null;

    skipWaitingWorker(registration);

    if (registration.active) {
      return registration;
    }

    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);

    return ready?.active ? ready : null;
  } catch (error) {
    console.error("[service-worker-client] waitForServiceWorker failed:", error);
    return null;
  }
}

export async function prepareServiceWorkerForPush(
  timeoutMs = SW_TIMEOUT_MS
): Promise<ServiceWorkerRegistration | null> {
  await registerServiceWorkerEarly();
  return waitForServiceWorker(timeoutMs);
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const registration = await waitForServiceWorker(8000);
    if (!registration?.active) return false;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
