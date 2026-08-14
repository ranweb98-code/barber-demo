import { prisma } from "@/lib/prisma";

/** Normalize for lookup (972… international format). */
export function normalizePhone(phone: string): string {
  const formatted = formatPhoneForStorage(phone);
  if (!/^[\d]+$/.test(formatted)) {
    return phone.replace(/[\s\-()+]/g, "").replace(/^0/, "972");
  }
  return formatted.replace(/^0/, "972");
}

/**
 * Canonical Israeli local format for storage/display (leading 0).
 * Skips transformation when the value is not phone-like (e.g. search text).
 */
export function formatPhoneForStorage(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;

  if (!/^[\d\s\-()+]+$/.test(trimmed)) {
    return trimmed;
  }

  let digits = trimmed.replace(/[\s\-()+]/g, "");

  if (digits.startsWith("972")) {
    digits = `0${digits.slice(3)}`;
  } else if (!digits.startsWith("0") && digits.length === 9 && digits.startsWith("5")) {
    digits = `0${digits}`;
  }

  return digits;
}

export function formatCustomerName(firstName: string, lastName: string): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || firstName;
}

export function storeFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  return { firstName: fullName.trim(), lastName: "" };
}

type UpsertBookingInput = {
  name: string;
  phone: string;
  email?: string;
};

export async function upsertCustomerFromBooking(input: UpsertBookingInput) {
  const phone = formatPhoneForStorage(input.phone);
  const normalized = normalizePhone(phone);
  const { firstName, lastName } = storeFullName(input.name);
  const email = input.email?.trim() ?? "";

  const existing = await prisma.customer.findFirst({
    where: {
      OR: [{ phone }, { phone: normalized }, { phone: input.phone.trim() }],
    },
  });

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        phone,
        ...(email ? { email } : {}),
      },
    });
  }

  return prisma.customer.create({
    data: {
      firstName,
      lastName,
      phone,
      email,
    },
  });
}

export async function backfillCustomersFromAppointments() {
  const appointments = await prisma.appointment.findMany({
    where: { customerId: null },
    orderBy: { createdAt: "asc" },
  });

  let linked = 0;

  for (const appt of appointments) {
    const customer = await upsertCustomerFromBooking({
      name: appt.customerName,
      phone: appt.customerPhone,
      email: appt.customerEmail || undefined,
    });

    await prisma.appointment.update({
      where: { id: appt.id },
      data: { customerId: customer.id },
    });
    linked++;
  }

  return { linked };
}

export async function searchCustomers(query: string) {
  const q = query.trim();
  if (!q) {
    return prisma.customer.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        _count: { select: { appointments: true } },
      },
    });
  }

  const normalized = normalizePhone(q);
  const formatted = formatPhoneForStorage(q);

  return prisma.customer.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        ...(formatted !== q ? [{ phone: { contains: formatted } }] : []),
        ...(normalized !== q && normalized !== formatted
          ? [{ phone: { contains: normalized } }]
          : []),
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      _count: { select: { appointments: true } },
    },
  });
}
