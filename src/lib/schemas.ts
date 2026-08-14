import { z } from "zod";
import { formatPhoneForStorage } from "@/lib/customers";

export const appointmentCreateSchema = z.object({
  serviceId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().min(2, "שם חייב להכיל לפחות 2 תווים"),
  customerPhone: z
    .string()
    .min(9, "מספר טלפון לא תקין")
    .regex(/^[\d\-+()\s]+$/, "מספר טלפון לא תקין")
    .transform(formatPhoneForStorage),
  customerEmail: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? "")
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      "כתובת אימייל לא תקינה"
    ),
  notes: z.string().optional(),
  inspoIds: z.array(z.number().int()).optional().default([]),
  pushEndpoint: z.string().url().optional().nullable(),
});

export const appointmentUpdateSchema = z
  .object({
    status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    serviceId: z.number().int().positive().optional(),
    serviceDuration: z.number().int().positive().max(480).optional(),
    notes: z.string().nullable().optional(),
    customerPhone: z
      .string()
      .min(9, "מספר טלפון לא תקין")
      .regex(/^[\d\-+()\s]+$/, "מספר טלפון לא תקין")
      .transform(formatPhoneForStorage)
      .optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.date !== undefined ||
      data.time !== undefined ||
      data.serviceId !== undefined ||
      data.serviceDuration !== undefined ||
      data.notes !== undefined ||
      data.customerPhone !== undefined,
    { message: "לא נשלחו שדות לעדכון" }
  );

export const blockedTimeSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().optional(),
});

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.coerce.number().int().positive(),
});

export const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMin: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const inspoSchema = z.object({
  src: z.string().url(),
  label: z.string().min(1),
  tags: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const loginSchema = z.object({
  password: z.string().min(1),
  remember: z.boolean().optional().default(true),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "יש להזין את הסיסמה הנוכחית"),
  newPassword: z.string().min(6, "הסיסמה החדשה חייבת להכיל לפחות 6 תווים"),
  confirmPassword: z.string().min(1, "יש לאשר את הסיסמה החדשה"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "הסיסמאות החדשות אינן תואמות",
  path: ["confirmPassword"],
});

export const settingsPatchSchema = z.object({
  settings: z.record(z.string(), z.string()).optional(),
  workingHours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        isOpen: z.boolean(),
        startTime: z.string(),
        endTime: z.string(),
      })
    )
    .optional(),
  blockedDates: z
    .array(
      z.object({
        date: z.string(),
        reason: z.string().optional(),
      })
    )
    .optional(),
  removeBlockedDate: z.string().optional(),
});

export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;

export const customerCreateSchema = z.object({
  fullName: z.string().min(2, "שם מלא חובה"),
  phone: z
    .string()
    .min(9, "מספר טלפון לא תקין")
    .regex(/^[\d\-+()\s]+$/, "מספר טלפון לא תקין")
    .transform(formatPhoneForStorage),
  email: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? "")
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      "כתובת אימייל לא תקינה"
    ),
  notes: z.string().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const customerImportRowSchema = z.object({
  fullName: z.string().min(1),
  phone: z
    .string()
    .min(9)
    .regex(/^[\d\-+()\s]+$/, "מספר טלפון לא תקין")
    .transform(formatPhoneForStorage),
  email: z.string().optional().default(""),
  notes: z.string().optional(),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
