import { formatPhoneForStorage } from "@/lib/customers";
import { prisma } from "@/lib/prisma";

async function syncCustomerPhone(
  customerId: number,
  phone: string,
  excludeCustomerId?: number
) {
  const trimmed = formatPhoneForStorage(phone);
  const duplicate = await prisma.customer.findFirst({
    where: {
      phone: trimmed,
      ...(excludeCustomerId ? { NOT: { id: excludeCustomerId } } : {}),
    },
  });

  if (duplicate) {
    return { error: "מספר טלפון כבר בשימוש על ידי לקוח אחר" as const };
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { phone: trimmed },
  });

  await prisma.appointment.updateMany({
    where: { customerId },
    data: { customerPhone: trimmed },
  });

  return { ok: true as const };
}

export { syncCustomerPhone };
