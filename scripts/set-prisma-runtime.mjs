import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const runtime = process.argv[2];

if (runtime !== "nodejs" && runtime !== "cloudflare") {
  console.error("Usage: node scripts/set-prisma-runtime.mjs <nodejs|cloudflare>");
  process.exit(1);
}

const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf8");
const match = schema.match(/runtime\s*=\s*"(nodejs|cloudflare)"/);

if (!match) {
  console.error("Could not find runtime field in prisma/schema.prisma");
  process.exit(1);
}

if (match[1] === runtime) {
  console.log(`Prisma runtime already set to "${runtime}"`);
  process.exit(0);
}

const updated = schema.replace(
  /runtime\s*=\s*"(nodejs|cloudflare)"/,
  `runtime  = "${runtime}"`
);

writeFileSync(schemaPath, updated);
console.log(`Set Prisma runtime to "${runtime}"`);
