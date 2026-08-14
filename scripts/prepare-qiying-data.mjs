import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] || "C:/Users/z6798/Downloads/qiying-full.json";
const outDir = resolve(root, "public/qiying");

const raw = JSON.parse(readFileSync(input, "utf8"));
if (!Array.isArray(raw.catalog) || !raw.details) {
  console.error("unexpected shape; expected { manifest, catalog, details, mode_images, mode_videos }");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const w = (name, obj) => {
  const json = JSON.stringify(obj);
  const gz = gzipSync(json, { level: 9 });
  writeFileSync(resolve(outDir, name), gz);
  console.log(`${name}: ${(json.length / 1048576).toFixed(2)}MB -> ${(gz.length / 1048576).toFixed(2)}MB gz`);
};

w("catalog.json.gz", raw.catalog);
const buckets = Object.keys(raw.details).map(Number).sort((a, b) => a - b);
for (const b of buckets) {
  w(`details-${String(b).padStart(3, "0")}.json.gz`, raw.details[b]);
}
if (Array.isArray(raw.mode_images)) w("mode_images.json.gz", raw.mode_images);
if (Array.isArray(raw.mode_videos)) w("mode_videos.json.gz", raw.mode_videos);
writeFileSync(
  resolve(outDir, "manifest.json"),
  JSON.stringify({
    generated: new Date().toISOString(),
    source: "qiying.cfnav.me media-data/v2 (user-authenticated sync)",
    schema: raw.manifest?.schema || 2,
    buckets,
    catalog_count: raw.catalog.length,
    mode_images_count: raw.mode_images?.length || 0,
    mode_videos_count: raw.mode_videos?.length || 0,
  }),
);
console.log("done ->", outDir);