export const PUSH_ENDPOINT_KEY = "pushEndpoint";

export type PushRole = "customer" | "owner";

export type EnsurePushResult =
  | { ok: true; endpoint: string }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "denied"
        | "default"
        | "no-vapid"
        | "sw-unavailable"
        | "subscribe-failed"
        | "save-failed";
      message?: string;
    };

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;

  const displayStandalone = window.matchMedia(
    "(display-mode: standalone)"
  ).matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return displayStandalone || iosStandalone;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function storeEndpoint(endpoint: string) {
  try {
    localStorage.setItem(PUSH_ENDPOINT_KEY, endpoint);
  } catch {
    // ignore quota / private mode
  }
}

export function getStoredPushEndpoint(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PUSH_ENDPOINT_KEY);
  } catch {
    return null;
  }
}

async function resolveRole(preferred: PushRole): Promise<PushRole> {
  if (preferred === "owner") return "owner";

  try {
    const res = await fetch("/api/admin/session", { cache: "no-store" });
    if (!res.ok) return "customer";
    const data = (await res.json()) as { authenticated?: boolean };
    if (data.authenticated) return "owner";
  } catch {
    // ignore
  }

  return "customer";
}

async function getVapidPublicKey(): Promise<string | null> {
  const fromBuild = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (fromBuild) return fromBuild;

  try {
    const res = await fetch("/api/push/config", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { vapidPublicKey?: string };
    return data.vapidPublicKey ?? null;
  } catch {
    return null;
  }
}

export async function ensurePushSubscription(options: {
  role: PushRole;
  phone?: string;
  email?: string;
  updateOnly?: boolean;
}): Promise<EnsurePushResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unsupported" };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  if (!("Notification" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission === "denied") {
    return { ok: false, reason: "denied" };
  }
  if (permission !== "granted") {
    return { ok: false, reason: "default" };
  }

  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) {
    return { ok: false, reason: "no-vapid" };
  }

  const role = await resolveRole(options.role);

  try {
    // Ensure SW is registered before waiting for ready (avoids hang if Gate runs first)
    if (process.env.NODE_ENV !== "development") {
      const existing = await navigator.serviceWorker.getRegistration("/");
      if (!existing) {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }
    }

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey
        ) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "subscribe-failed" };
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        role,
        phone: options.phone,
        email: options.email,
        updateOnly: options.updateOnly,
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        reason: "save-failed",
        message: data?.error,
      };
    }

    storeEndpoint(json.endpoint);
    return { ok: true, endpoint: json.endpoint };
  } catch (error) {
    console.error("[push-client] ensurePushSubscription failed:", error);
    return { ok: false, reason: "subscribe-failed" };
  }
}
