import { NextRequest, NextResponse } from "next/server";
import { addHours } from "date-fns";
import { deleteOldAppointments } from "@/lib/cleanup";
import { sendReminderEmail } from "@/lib/email";
import { sendPushToCustomer } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { parseJerusalemDateTime } from "@/lib/timezone";

function isAuthorized(request: NextRequest): boolean {
  if (process.env.ENABLE_CRON !== "true") {
    return false;
  }

  const cronSecret = process.env.CRON_SECRET ?? process.env.AUTH_SECRET;
  const authHeader = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const cfCron = request.headers.get("cf-cron") ?? request.headers.get("cf-scheduled");

  if (vercelCron || cfCron) return true;
  if (authHeader === `Bearer ${cronSecret}`) return true;

  return process.env.NODE_ENV === "development";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  const deletedOld = await deleteOldAppointments();

  const reminderHours = parseInt(
    process.env.REMINDER_HOURS_BEFORE ??
      (await getSetting("reminderHours", "24")),
    10
  );

  const now = new Date();
  const windowStart = addHours(now, reminderHours - 1);
  const windowEnd = addHours(now, reminderHours + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "confirmed",
      reminderSentAt: null,
    },
  });

  let sent = 0;

  for (const appt of appointments) {
    const apptDateTime = parseJerusalemDateTime(appt.date, appt.time);

    if (apptDateTime >= windowStart && apptDateTime <= windowEnd) {
      const tasks: Promise<unknown>[] = [];

      if (appt.customerEmail) {
        tasks.push(
          sendReminderEmail({
            customerEmail: appt.customerEmail,
            customerName: appt.customerName,
            serviceName: appt.serviceName,
            date: appt.date,
            time: appt.time,
            hoursBefore: reminderHours,
          })
        );
      }

      tasks.push(
        sendPushToCustomer(appt.customerPhone, appt.customerEmail, {
          title: "תזכורת לתור",
          body: `${appt.serviceName} מחר/בקרוב · ${appt.date} בשעה ${appt.time}`,
          url: "/",
          tag: `appt-reminder-${appt.id}`,
        })
      );

      await Promise.allSettled(tasks);

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      });

      sent++;
    }
  }

  return NextResponse.json({ sent, checked: appointments.length, deletedOld });
}
