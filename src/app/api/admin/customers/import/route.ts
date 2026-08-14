import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { normalizePhone, storeFullName } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import { customerImportRowSchema } from "@/lib/schemas";

async function requireAdmin() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }
  return null;
}

const HEADER_MAP: Record<string, string> = {
  fullname: "fullName",
  "full name": "fullName",
  name: "fullName",
  "שם מלא": "fullName",
  שם: "fullName",
  firstname: "firstName",
  "first name": "firstName",
  "שם פרטי": "firstName",
  lastname: "lastName",
  "last name": "lastName",
  "שם משפחה": "lastName",
  phone: "phone",
  tel: "phone",
  mobile: "phone",
  טלפון: "phone",
  email: "email",
  mail: "email",
  notes: "notes",
  הערות: "notes",
};

type ImportRow = {
  fullName: string;
  phone: string;
  email: string;
  notes?: string;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headerCells = parseCsvLine(lines[0]).map((h) =>
    h.toLowerCase().trim()
  );
  const mappedHeaders = headerCells.map((h) => HEADER_MAP[h] ?? h);

  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};

    mappedHeaders.forEach((key, idx) => {
      if (cells[idx] !== undefined) {
        raw[key] = cells[idx];
      }
    });

    const fullName =
      raw.fullName ||
      [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim();

    if (fullName && raw.phone) {
      rows.push({
        fullName,
        phone: raw.phone,
        email: raw.email ?? "",
        notes: raw.notes,
      });
    }
  }

  return rows;
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const csv = typeof body.csv === "string" ? body.csv : "";
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];

    const rows: ImportRow[] = csv ? parseCsv(csv) : [];

    for (const contact of contacts) {
      const name = contact.name?.[0] ?? contact.firstName ?? "";
      rows.push({
        fullName: String(name).trim(),
        phone: contact.phone?.[0] ?? contact.tel?.[0] ?? "",
        email: contact.email?.[0] ?? "",
        notes: "",
      });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const parsed = customerImportRowSchema.safeParse(row);
      if (!parsed.success) {
        skipped++;
        errors.push(`שורה ${index + 1}: נתונים לא תקינים`);
        continue;
      }

      const data = parsed.data;
      const { firstName, lastName } = storeFullName(data.fullName);
      const phone = data.phone;
      const normalized = normalizePhone(phone);

      const existing = await prisma.customer.findFirst({
        where: {
          OR: [{ phone }, { phone: normalized }],
        },
      });

      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            firstName,
            lastName,
            phone,
            ...(data.email ? { email: data.email.trim() } : {}),
            ...(data.notes ? { notes: data.notes.trim() } : {}),
          },
        });
        updated++;
      } else {
        await prisma.customer.create({
          data: {
            firstName,
            lastName,
            phone,
            email: data.email?.trim() ?? "",
            notes: data.notes?.trim() || null,
          },
        });
        imported++;
      }
    }

    return NextResponse.json({ imported, updated, skipped, errors });
  } catch (error) {
    console.error("Import customers error:", error);
    return NextResponse.json({ error: "שגיאה בייבוא" }, { status: 500 });
  }
}
