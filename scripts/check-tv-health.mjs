const baseUrl = new URL(process.env.CFNAV_HEALTH_URL || "http://127.0.0.1:5173");
const batchSize = Math.max(1, Number(process.env.CFNAV_HEALTH_CONCURRENCY || 5));
const timeoutMs = Math.max(1_000, Number(process.env.CFNAV_HEALTH_TIMEOUT_MS || 25_000));
const mediaWaitMs = Math.max(0, Number(process.env.CFNAV_HEALTH_MEDIA_WAIT_MS || 0));
const requestedIds = new Set((process.env.CFNAV_HEALTH_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));

async function fetchWithTimeout(input) {
  return fetch(input, { signal: AbortSignal.timeout(timeoutMs) });
}

async function readJson(response) {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    return { message: body.slice(0, 160) || `HTTP ${response.status}` };
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadOxaxChannels() {
  const channels = [];
  for (let page = 1; page <= 2; page += 1) {
    const url = new URL("/provider-api/adulttv", baseUrl);
    url.searchParams.set("pg", String(page));
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`catalog page ${page}: HTTP ${response.status}`);
    const payload = await response.json();
    channels.push(...payload.list.filter((item) => item.live_provider === "oxax"));
  }
  return requestedIds.size ? channels.filter((channel) => requestedIds.has(channel.vod_id)) : channels;
}

function latestMediaUrl(manifest, manifestUrl) {
  const lines = manifest.split(/\r?\n/).filter((value) => value && !value.startsWith("#"));
  const line = lines.at(-1);
  return line ? new URL(line, manifestUrl) : null;
}

async function inspectChannel(channel) {
  const startedAt = Date.now();
  try {
    const detailUrl = new URL("/provider-api/adulttv", baseUrl);
    detailUrl.searchParams.set("action", "detail");
    detailUrl.searchParams.set("id", channel.vod_id);
    const detailResponse = await fetchWithTimeout(detailUrl);
    const detail = await readJson(detailResponse);
    if (!detailResponse.ok) throw new Error(`detail ${detailResponse.status}: ${detail.message || "unavailable"}`);

    const manifestUrl = new URL(detail.vod_play_url, baseUrl);
    const manifestResponse = await fetchWithTimeout(manifestUrl);
    const manifest = await manifestResponse.text();
    if (!manifestResponse.ok) throw new Error(`manifest ${manifestResponse.status}: ${manifest.slice(0, 120)}`);
    if (!manifest.startsWith("#EXTM3U")) throw new Error("manifest is not HLS");

    const mediaUrl = latestMediaUrl(manifest, manifestUrl);
    if (!mediaUrl) throw new Error("manifest contains no media URI");
    let mediaResponse = await fetchWithTimeout(mediaUrl);
    if (!mediaResponse.ok) {
      const manifestSource = new URL(manifestUrl.searchParams.get("url"));
      const mediaSource = new URL(mediaUrl.searchParams.get("url"));
      for (const [key, value] of manifestSource.searchParams) {
        if (!mediaSource.searchParams.has(key)) mediaSource.searchParams.set(key, value);
      }
      mediaUrl.searchParams.set("url", mediaSource.href);
      mediaResponse = await fetchWithTimeout(mediaUrl);
    }
    if (!mediaResponse.ok && mediaWaitMs) {
      const deadline = Date.now() + mediaWaitMs;
      while (!mediaResponse.ok && Date.now() < deadline) {
        await delay(Math.min(5_000, Math.max(0, deadline - Date.now())));
        mediaResponse = await fetchWithTimeout(mediaUrl);
      }
    }
    if (!mediaResponse.ok) {
      const message = (await mediaResponse.text()).slice(0, 160);
      throw new Error(`media ${mediaResponse.status}: ${message} (${mediaUrl.href})`);
    }
    const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
    if (!bytes.byteLength) throw new Error("media response is empty");

    return {
      id: channel.vod_id,
      name: channel.vod_name,
      ok: true,
      bytes: bytes.byteLength,
      ms: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id: channel.vod_id,
      name: channel.vod_name,
      ok: false,
      error: error?.message || String(error),
      ms: Date.now() - startedAt,
    };
  }
}

const channels = await loadOxaxChannels();
const results = [];
for (let index = 0; index < channels.length; index += batchSize) {
  results.push(...await Promise.all(channels.slice(index, index + batchSize).map(inspectChannel)));
}

console.table(results.map(({ id, ok, bytes, ms, error }) => ({ id, ok, bytes: bytes || 0, ms, error: error || "" })));
const passed = results.filter((result) => result.ok).length;
const failed = results.length - passed;
console.log(`oxax health: ${passed}/${results.length} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
