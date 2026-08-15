import fs from "fs";

const swPath = process.argv[2] || "public/sw.js";
let sw = fs.readFileSync(swPath, "utf8");

const before = (sw.match(/\{'revision'/g) ?? []).length;

sw = sw.replace(
  /\{'revision':(?:null|'[^']*'),'url':'([^']+)'\}/g,
  (full, url) => {
    const fixed = url.replace(/\\/g, "/").replace(/\/+/g, "/");
    if (fixed.startsWith("/api/") || fixed.includes("hero.jpg")) {
      return "";
    }
    if (fixed === url) return full;
    return full.replace(url, fixed);
  }
);

sw = sw.replace(/,\s*,/g, ",");
sw = sw.replace(/\[\s*,/g, "[");
sw = sw.replace(/,\s*\]/g, "]");

fs.writeFileSync(swPath, sw);

const after = (sw.match(/\{'revision'/g) ?? []).length;
const backslash = (sw.match(/'url':'[^']*\\[^']*'/g) ?? []).length;
console.log(
  `[fix-sw-manifest] ${swPath}: ${before} -> ${after} entries, ${backslash} backslash urls left`
);

if (backslash > 0) {
  process.exitCode = 1;
}
