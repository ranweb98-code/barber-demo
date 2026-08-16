"use client";

import { useEffect } from "react";
import { registerServiceWorkerEarly } from "@/lib/service-worker-client";

/** Single early SW registration — push-only worker, no Serwist. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    void registerServiceWorkerEarly().catch(console.error);
  }, []);

  return null;
}
