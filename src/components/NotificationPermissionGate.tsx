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

type GateState =
  | "loading"
  | "hidden"
  | "need-permission"
  | "denied"
  | "no-vapid";

type BannerState = {
  message: string;
  loading?: boolean;
};

export function NotificationPermissionGate() {
  const pathname = usePathname();
  const [state, setState] = useState<GateState>("loading");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const isAdminLogin = pathname === "/admin/login";
  const role = pathname?.startsWith("/admin") ? "owner" : "customer";

  const handleSubscribeResult = useCallback((result: EnsurePushResult) => {
    if (result.ok) {
      setBanner(null);
      return;
    }

    if (result.reason === "denied") {
      setState("denied");
      setBanner(null);
      return;
    }

    if (result.reason === "no-vapid") {
      setState("no-vapid");
      setBanner(null);
      return;
    }

    if (result.reason === "unsupported") {
      setState("hidden");
      setBanner(null);
      return;
    }

    setBanner({
      message: result.message ?? "לא הצלחנו להפעיל התראות",
      loading: false,
    });
  }, []);

  const subscribeInBackground = useCallback(async () => {
    setBanner({ message: "מגדירים התראות...", loading: true });

    const result = await ensurePushSubscription({
      role,
      requestPermission: false,
    });

    handleSubscribeResult(result);
  }, [handleSubscribeResult, role]);

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

      setState("hidden");
      void subscribeInBackground();
      return;
    }

    setState("need-permission");
  }, [isAdminLogin, subscribeInBackground]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  async function enableNotifications() {
    setBusy(true);
    setBanner(null);

    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission === "granted") {
        setState("hidden");
        void subscribeInBackground();
        return;
      }

      if (permission === "denied") {
        setState("denied");
        return;
      }

      setState("need-permission");
    } finally {
      setBusy(false);
    }
  }

  const blockingOverlay =
    state !== "loading" && state !== "hidden" ? (
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
        </div>
      </div>
    ) : null;

  const errorBanner = banner ? (
    <div
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[90] rounded-2xl border border-border-medium bg-bg-card p-4 shadow-nav"
      role="status"
    >
      <p className="text-sm text-text-secondary">{banner.message}</p>
      {!banner.loading && (
        <Button
          className="mt-3 w-full"
          variant="secondary"
          onClick={() => void subscribeInBackground()}
        >
          נסו שוב
        </Button>
      )}
    </div>
  ) : null;

  return (
    <>
      {blockingOverlay}
      {errorBanner}
    </>
  );
}
