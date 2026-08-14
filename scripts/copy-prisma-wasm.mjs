import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const wasmSourceDir = join(process.cwd(), ".next/server/chunks/static/wasm");
const wasmTargets = [
  join(process.cwd(), ".open-next/server-functions/default/bundle/static/wasm"),
  join(
    process.cwd(),
    ".open-next/server-functions/default/.next/server/chunks/static/wasm",
  ),
];

if (!existsSync(wasmSourceDir)) {
  console.warn(`Prisma WASM source not found: ${wasmSourceDir}`);
  process.exit(0);
}

const wasmFiles = readdirSync(wasmSourceDir).filter((file) =>
  file.endsWith(".wasm"),
);

if (wasmFiles.length === 0) {
  console.warn(`No WASM files found in ${wasmSourceDir}`);
  process.exit(0);
}

for (const targetDir of wasmTargets) {
  mkdirSync(targetDir, { recursive: true });
  for (const file of wasmFiles) {
    cpSync(join(wasmSourceDir, file), join(targetDir, file));
    console.log(`Copied ${file} -> ${targetDir}`);
  }
}
