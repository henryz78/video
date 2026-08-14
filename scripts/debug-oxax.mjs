import { parseOxaxStreamPage } from "../providers/runtime.js";

const id = process.argv[2] || "oh-ah";
if (/^https?:\/\//i.test(id)) {
  const response = await fetch(id, {
    headers: {
      referer: process.argv[3] || "http://oxax.tv/",
      "user-agent": "Mozilla/5.0 CFNav-Independent/2.0",
    },
    signal: AbortSignal.timeout(25_000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  console.log(JSON.stringify({ status: response.status, bytes: bytes.byteLength, headers: Object.fromEntries(response.headers) }, null, 2));
  process.exit(response.ok ? 0 : 1);
}
const pageUrl = `http://oxax.tv/${id}.html`;
const baseHeaders = {
  accept: "*/*",
  referer: pageUrl,
  "user-agent": "Mozilla/5.0 CFNav-Independent/2.0",
};

async function request(url, headers = baseHeaders) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(25_000) });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      url,
      status: response.status,
      bytes: bytes.byteLength,
      headers: Object.fromEntries(response.headers),
      text: new TextDecoder().decode(bytes.slice(0, 160)),
    };
  } catch (error) {
    return { url, error: error?.cause?.message || error?.message || String(error) };
  }
}

const pageResponse = await fetch(pageUrl, { headers: { accept: "text/html" }, signal: AbortSignal.timeout(25_000) });
if (!pageResponse.ok) throw new Error(`page unavailable: HTTP ${pageResponse.status}`);
const pageHeaders = Object.fromEntries(pageResponse.headers);
const html = await pageResponse.text();
const manifestUrl = parseOxaxStreamPage(html);
const manifest = await request(manifestUrl);
console.log(JSON.stringify({ page: { status: pageResponse.status, headers: pageHeaders }, manifest }, null, 2));
if (manifest.status !== 200 || !manifest.text.startsWith("#EXTM3U")) process.exit(1);

const manifestResponse = await fetch(manifestUrl, { headers: baseHeaders, signal: AbortSignal.timeout(25_000) });
const manifestText = await manifestResponse.text();
const segmentLine = manifestText.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).at(-1);
if (!segmentLine) throw new Error("manifest has no segment");
const segment = new URL(segmentLine, manifestUrl);
const signature = new URL(manifestUrl).search;
const candidates = [
  segment.href,
  `${segment.href}${signature}`,
  segment.href.replace("https://", "http://"),
  `${segment.href.replace("https://", "http://")}${signature}`,
  segment.href.replace("s.oxax.tv", "r.pokaz.me"),
];
const headerSets = [
  baseHeaders,
  { ...baseHeaders, origin: "http://oxax.tv" },
  { ...baseHeaders, referer: manifestUrl },
];
for (const candidate of candidates) {
  for (const headers of headerSets) console.log(JSON.stringify(await request(candidate, headers)));
}
