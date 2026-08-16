"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-2xl text-text-primary">משהו השתבש</h1>
      <p className="max-w-sm text-sm text-text-secondary">
        טעינת העמוד נכשלה. אפשר לנסות שוב או לחזור לדף הבית.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button className="w-full" onClick={() => reset()}>
          נסו שוב
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          חזרה לבית
        </Button>
      </div>
    </div>
  );
}
