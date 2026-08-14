import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const handlerPath = join(
  process.cwd(),
  ".open-next/server-functions/default/handler.mjs",
);

const wasmImportPath =
  "./src/generated/prisma/internal/query_compiler_fast_bg.wasm?module";

const loaderNeedle =
  '.v=(a3,b4,c3,d3)=>new Promise(function(a4,b5){try{var{readFile:d4}=require("fs"),{join:e7}=require("path");d4(e7("","static/wasm/"+c3+".wasm"),function(c4,d5){if(c4)return b5(c4);a4({arrayBuffer:()=>d5})})}catch(a5){b5(a5)}}).then(a4=>a4.arrayBuffer()).then(a4=>WebAssembly.instantiate(a4,d3)).then(b5=>Object.assign(a3,b5.instance.exports))';

const patchedLoader = `.v=(a3,b4,c3,d3)=>import("${wasmImportPath}").then(m=>{const wasmModule=m.default??m;const instance=new WebAssembly.Instance(wasmModule,d3);return Object.assign(a3,instance.exports)})`;

const prismaWasmNeedle =
  "getQueryCompilerWasmModule:async()=>{let{default:a4}=await c2.e(4267).then(c2.bind(c2,54267));return a4}";

const patchedPrismaWasm = `getQueryCompilerWasmModule:async()=>{let{default:a4}=await import("${wasmImportPath}");return a4}`;

const previousLoaderPatches = [
  `.v=(a3,b4,c3,d3)=>globalThis.__openNextLoadWasm(a3,d3)`,
  `.v=(a3,b4,c3,d3)=>import("${wasmImportPath}").then(m=>WebAssembly.instantiate(m.default,d3)).then(b5=>Object.assign(a3,b5.instance.exports))`,
  `.v=(a3,b4,c3,d3)=>import("${wasmImportPath}").then(async m=>{const wasmModule=m.default??m;const result=await WebAssembly.instantiate(wasmModule,d3);return Object.assign(a3,result.instance.exports)})`,
  patchedLoader,
];

if (!existsSync(handlerPath)) {
  console.warn(`Handler not found: ${handlerPath}`);
  process.exit(0);
}

const wasmSource = join(
  process.cwd(),
  ".open-next/server-functions/default/src/generated/prisma/internal/query_compiler_fast_bg.wasm",
);

if (!existsSync(wasmSource)) {
  console.warn(`Prisma WASM not found: ${wasmSource}`);
  process.exit(1);
}

let contents = readFileSync(handlerPath, "utf8");
let changed = false;

if (contents.includes(prismaWasmNeedle)) {
  contents = contents.replace(prismaWasmNeedle, patchedPrismaWasm);
  changed = true;
  console.log("Patched Prisma getQueryCompilerWasmModule import");
} else if (contents.includes(patchedPrismaWasm)) {
  console.log("Prisma getQueryCompilerWasmModule already patched");
} else {
  console.warn("Prisma getQueryCompilerWasmModule pattern not found");
}

if (contents.includes(patchedLoader)) {
  console.log("Webpack WASM loader already patched");
} else if (contents.includes(loaderNeedle)) {
  contents = contents.replace(loaderNeedle, patchedLoader);
  changed = true;
  console.log("Patched webpack WASM loader");
} else {
  for (const previousPatch of previousLoaderPatches) {
    if (contents.includes(previousPatch)) {
      contents = contents.replace(previousPatch, patchedLoader);
      changed = true;
      console.log("Updated webpack WASM loader patch");
      break;
    }
  }
}

contents = contents.replace(
  /\nglobalThis\.__openNextLoadWasm[\s\S]*?\n};\n?$/,
  "\n",
);

if (!changed && !contents.includes(patchedPrismaWasm)) {
  process.exit(1);
}

writeFileSync(handlerPath, contents);
