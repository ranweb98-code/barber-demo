"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, BellOff, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/Button";
import {
  ensurePushSubscription,
  hasActivePushSubscription,
  isStandaloneDisplay,
  notificationPermission,
  type EnsurePushResult,
} from "@/lib/push-client";
import { registerServiceWorkerEarly } from "@/lib/service-worker-client";

type GateState =
  | "loading"
  | "hidden"
  | "need-permission"
  | "subscribing"
  | "denied"
  | "no-vapid"
  | "error";

export function NotificationPermissionGate() {
  const pathname = usePathname();
  const [state, setState] = useState<GateState>("loading");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isAdminLogin = pathname === "/admin/login";
  const role = pathname?.startsWith("/admin") ? "owner" : "customer";

  const applyResult = useCallback((result: EnsurePushResult) => {
    if (result.ok) {
      setState("hidden");
      return;
    }

    if (result.reason === "denied") {
      setState("denied");
      return;
    }

    if (result.reason === "no-vapid") {
      setState("no-vapid");
      return;
    }

    if (result.reason === "unsupported") {
      setState("hidden");
      return;
    }

    if (result.reason === "default") {
      setState("need-permission");
      return;
    }

    setErrorMessage(result.message ?? "לא הצלחנו להפעיל התראות");
    setState("error");
  }, []);

  const subscribeAndWait = useCallback(async () => {
    setState("subscribing");
    setErrorMessage("");

    const result = await ensurePushSubscription({
      role,
      requestPermission: false,
    });

    applyResult(result);
  }, [applyResult, role]);

  const evaluate = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (isAdminLogin || !isStandaloneDisplay()) {
      setState("hidden");
      return;
    }

    const permission = notificationPermission();
    if (permission === "unsupported") {
      setState("hidden");
      return;
    }

    if (permission === "denied") {
      setState("denied");
      return;
    }

    if (permission === "granted") {
      const active = await hasActivePushSubscription();
      if (active) {
        setState("hidden");
        return;
      }

      await subscribeAndWait();
      return;
    }

    setState("need-permission");
  }, [isAdminLogin, subscribeAndWait]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAdminLogin || !isStandaloneDisplay()) return;
    void registerServiceWorkerEarly();
  }, [isAdminLogin]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  async function enableNotifications() {
    setBusy(true);
    setErrorMessage("");
    setState("subscribing");

    try {
      const result = await ensurePushSubscription({ role });
      applyResult(result);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "hidden") {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-app/95 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-gate-title"
    >
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-yellow/15 text-accent-yellow">
          {state === "denied" ? (
            <BellOff className="h-8 w-8" />
          ) : (
            <Bell className="h-8 w-8" />
          )}
        </div>

        {state === "subscribing" && (
          <>
            <div className="space-y-2">
              <h2
                id="push-gate-title"
                className="font-display text-2xl text-text-primary"
              >
                מגדירים התראות
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                רק רגע — מחברים את ההתראות לאפליקציה.
              </p>
            </div>
            <Button className="w-full" loading disabled>
              ממתינים...
            </Button>
          </>
        )}

        {state === "need-permission" && (
          <>
            <div className="space-y-2">
              <h2
                id="push-gate-title"
                className="font-display text-2xl text-text-primary"
              >
                הפעלת התראות
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                כדי לקבל עדכונים על תורים יש לאשר התראות באפליקציה.
                בלי הרשאה לא ניתן להמשיך.
              </p>
            </div>
            <Button
              className="w-full"
              loading={busy}
              onClick={() => void enableNotifications()}
            >
              אפשר התראות
            </Button>
          </>
        )}

        {state === "denied" && (
          <>
            <div className="space-y-2">
              <h2
                id="push-gate-title"
                className="font-display text-2xl text-text-primary"
              >
                ההתראות חסומות
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                פתחו את הגדרות המכשיר ← התראות ← אפליקציית Aviel Naim, ואפשרו
                התראות. אחר כך לחצו למטה.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                variant="secondary"
                loading={busy}
                onClick={() => void enableNotifications()}
              >
                <RefreshCw className="h-4 w-4" />
                בדקתי — נסו שוב
              </Button>
              <p className="flex items-center justify-center gap-1 text-xs text-text-muted">
                <Settings className="h-3.5 w-3.5" />
                iPhone: הגדרות ← התראות ← Aviel Naim
              </p>
            </div>
          </>
        )}

        {state === "no-vapid" && (
          <>
            <div className="space-y-2">
              <h2
                id="push-gate-title"
                className="font-display text-2xl text-text-primary"
              >
                חסרים מפתחות התראות
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                לא הצלחנו לטעון את הגדרות ההתראות. נסו שוב בעוד רגע.
              </p>
            </div>
            <Button
              className="w-full"
              variant="secondary"
              loading={busy}
              onClick={() => void evaluate()}
            >
              נסו שוב
            </Button>
          </>
        )}

        {state === "error" && (
          <>
            <div className="space-y-2">
              <h2
                id="push-gate-title"
                className="font-display text-2xl text-text-primary"
              >
                שגיאה בהפעלת התראות
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                {errorMessage || "נסו שוב בעוד רגע"}
              </p>
            </div>
            <Button
              className="w-full"
              loading={busy}
              onClick={() => void enableNotifications()}
            >
              נסו שוב
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
