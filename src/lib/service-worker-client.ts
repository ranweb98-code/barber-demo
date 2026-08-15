const SW_TIMEOUT_MS = 30000;

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
  const waiting = registration.waiting;
  if (!waiting) return;

  waiting.postMessage({ type: "SKIP_WAITING" });
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

      const worker = registration.installing ?? registration.waiting;
      if (worker) {
        skipWaitingWorker(registration);
      }

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
    }, 200);
  });
}

function waitForController(timeoutMs: number): Promise<boolean> {
  if (navigator.serviceWorker.controller) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(timer);
        resolve(!!navigator.serviceWorker.controller);
      },
      { once: true }
    );
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
        });
      } catch (error) {
        console.error("[service-worker-client] register retry failed:", error);
      }
    }

    if (!registration) {
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), remaining());
        }),
      ]);
      return ready;
    }

    skipWaitingWorker(registration);

    const activated = await waitForWorkerActivation(registration, remaining());
    if (!activated?.active) {
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), remaining());
        }),
      ]);
      if (!ready?.active) return null;
      registration = ready;
    } else {
      registration = activated;
    }

    if (!navigator.serviceWorker.controller) {
      const gotController = await waitForController(remaining());
      if (!gotController && !registration.active) {
        return null;
      }
    }

    return registration;
  } catch (error) {
    console.error("[service-worker-client] waitForServiceWorker failed:", error);
    return null;
  }
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration?.active) return false;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
