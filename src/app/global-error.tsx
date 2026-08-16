"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>משהו השתבש</h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>
            טעינת האפליקציה נכשלה. נסו שוב.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#f5c518",
              color: "#000",
              border: 0,
              borderRadius: 999,
              padding: "12px 24px",
              fontWeight: 600,
            }}
          >
            נסו שוב
          </button>
        </div>
      </body>
    </html>
  );
}
