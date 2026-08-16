"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Share, Smartphone } from "lucide-react";
import { Button } from "./Button";
import { BUSINESS_NAME } from "@/lib/utils";

const DISMISS_KEY = "pwa-install-prompt-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isMobileBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || !isMobileBrowser() || wasDismissed()) return;

    const timer = window.setTimeout(() => setVisible(true), 600);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  function dismiss() {
    markDismissed();
    setVisible(false);
  }

  async function installAndroid() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      className="install-prompt-overlay fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-prompt-title"
    >
      <div className="install-prompt-card w-full max-w-sm rounded-3xl bg-[#fffaf8] px-6 pb-6 pt-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-black shadow-md">
          <Image
            src="/icons/icon-192.png"
            alt={BUSINESS_NAME}
            width={80}
            height={80}
            className="h-full w-full object-cover"
            priority
          />
        </div>

        <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#f8d7d7] text-[#c45c5c]">
          <Smartphone className="h-5 w-5" aria-hidden />
        </div>

        <h2
          id="install-prompt-title"
          className="font-display text-[1.65rem] leading-tight text-[#1a1a1a]"
        >
          הוסיפו את{" "}
          <span className="brand-name inline-block text-[1.85rem] text-black">
            {BUSINESS_NAME}
          </span>{" "}
          למסך הבית
        </h2>

        <p className="mt-4 text-sm leading-relaxed text-[#444]">
          כך תקבלו גישה מהירה ותזכורות על תורים. הקישו על{" "}
          <Share className="mx-0.5 inline h-4 w-4 align-text-bottom text-[#555]" />{" "}
          Share למטה, ובחרו &quot;הוסף למסך הבית&quot;{" "}
          <span className="font-semibold">+</span>. אחרי שתפתחו מהאייקון – נבקש
          לאפשר התראות.
        </p>

        <div className="mt-5 rounded-2xl bg-[#ececec] px-4 py-3 text-sm leading-relaxed text-[#333]">
          אחרי שהוספתם – סגרו את הדפדפן ופתחו את האפליקציה מהאייקון במסך הבית.
        </div>

        {deferredPrompt && (
          <Button className="mt-5 w-full" onClick={() => void installAndroid()}>
            התקינו עכשיו
          </Button>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 text-sm text-[#666] underline-offset-2 hover:text-[#333] hover:underline"
        >
          המשיכו בדפדפן בינתיים
        </button>
      </div>
    </div>
  );
}
