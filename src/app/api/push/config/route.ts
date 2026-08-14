import { NextResponse } from "next/server";

export async function GET() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return NextResponse.json(
      { error: "Push notifications are not configured" },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { vapidPublicKey },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
