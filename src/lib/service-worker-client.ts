const SW_TIMEOUT_MS = 60000;

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

function waitForActiveRegistration(
  timeoutMs: number
): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

function waitForWorkerActivation(
  registration: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<ServiceWorkerRegistration | null> {
  if (registration.active) {
    return Promise.resolve(registration);
  }

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    const finish = (value: ServiceWorkerRegistration | null) => {
      resolve(value);
    };

    const check = () => {
      if (registration.active) {
        finish(registration);
        return true;
      }

      skipWaitingWorker(registration);

      if (Date.now() >= deadline) {
        finish(null);
        return true;
      }

      return false;
    };

    const worker = registration.installing ?? registration.waiting;
    if (worker) {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated" || registration.active) {
          finish(registration);
        }
      });
    }

    if (check()) return;

    const poll = setInterval(() => {
      if (check()) clearInterval(poll);
    }, 250);
  });
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

  const started = Date.now();
  const remaining = () => Math.max(0, timeoutMs - (Date.now() - started));

  try {
    let registration =
      (await navigator.serviceWorker.getRegistration("/")) ??
      (await registerServiceWorkerEarly());

    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (error) {
        console.error("[service-worker-client] register retry failed:", error);
      }
    }

    if (!registration) {
      return waitForActiveRegistration(remaining());
    }

    skipWaitingWorker(registration);

    const activated = await waitForWorkerActivation(registration, remaining());
    if (activated?.active) {
      return activated;
    }

    const ready = await waitForActiveRegistration(remaining());
    if (ready?.active) {
      return ready;
    }

    return registration.active ? registration : null;
  } catch (error) {
    console.error("[service-worker-client] waitForServiceWorker failed:", error);
    return null;
  }
}

/** Register and wait until the worker is active — required before iOS push permission. */
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
    const registration = await waitForServiceWorker(10000);
    if (!registration?.active) return false;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
