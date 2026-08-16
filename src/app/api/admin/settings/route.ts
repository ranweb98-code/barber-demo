import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settingsPatchSchema } from "@/lib/schemas";
import { themeCookieOptions } from "@/lib/theme";

async function requireAdmin() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const [settings, workingHours, blockedDates] = await Promise.all([
    prisma.setting.findMany(),
    prisma.workingHours.findMany({ orderBy: { dayOfWeek: "asc" } }),
    prisma.blockedDate.findMany({ orderBy: { date: "asc" } }),
  ]);

  return NextResponse.json({
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    workingHours,
    blockedDates,
  });
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = settingsPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { settings, workingHours, blockedDates, removeBlockedDate } =
      parsed.data;

    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        await prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
      }
    }

    if (workingHours) {
      for (const wh of workingHours) {
        await prisma.workingHours.upsert({
          where: { dayOfWeek: wh.dayOfWeek },
          create: wh,
          update: {
            isOpen: wh.isOpen,
            startTime: wh.startTime,
            endTime: wh.endTime,
          },
        });
      }
    }

    if (blockedDates) {
      for (const bd of blockedDates) {
        await prisma.blockedDate.upsert({
          where: { date: bd.date },
          create: { date: bd.date, reason: bd.reason },
          update: { reason: bd.reason },
        });
      }
    }

    if (removeBlockedDate) {
      await prisma.blockedDate.delete({
        where: { date: removeBlockedDate },
      });
    }

    const response = NextResponse.json({ success: true });
    const nextTheme = settings?.theme;
    if (nextTheme === "light" || nextTheme === "dark") {
      const cookie = themeCookieOptions(nextTheme);
      response.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        maxAge: cookie.maxAge,
        sameSite: cookie.sameSite,
      });
    }
    return response;
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הגדרות" }, { status: 500 });
  }
}
