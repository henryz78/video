const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...jsonHeaders, ...(init.headers || {}) },
  });
}

function decodeHtml(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function readCookies(headers) {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie") || ""];
  return values
    .flatMap((value) => ["XSRF-TOKEN", "hstream_session"].map((name) => value.match(new RegExp(`(?:^|,\\s*)${name}=([^;,]+)`))?.[0]?.replace(/^,\s*/, "")))
    .filter(Boolean)
    .join("; ");
}

async function gdlsp(requestUrl) {
  const upstream = new URL("https://www.gdlsp.com/api/json.php");
  const allowed = ["pg", "limit", "pagesize", "num", "ac", "wd", "t", "ids"];
  for (const key of allowed) {
    for (const value of requestUrl.searchParams.getAll(key)) upstream.searchParams.append(key, value);
  }
  if (!upstream.searchParams.has("ac")) upstream.searchParams.set("ac", "detail");
  if (!upstream.searchParams.has("pg")) upstream.searchParams.set("pg", "1");
  upstream.searchParams.set("limit", upstream.searchParams.get("limit") || "24");
  const response = await fetch(upstream, {
    headers: { "user-agent": "CFNav-Independent/2.0 (personal non-commercial project)" },
  });
  const data = await response.json();
  return json({ ...data, provider: "gdlsp" }, {
    status: response.status,
    headers: { "cache-control": requestUrl.searchParams.has("wd") ? "public, max-age=60" : "public, max-age=180" },
  });
}

function parseHstreamCards(html) {
  const cards = [];
  const starts = [...html.matchAll(/<div wire:key="episode-(\d+)">/g)];
  for (let index = 0; index < starts.length; index += 1) {
    const block = html.slice(starts[index].index, starts[index + 1]?.index || html.length);
    const slug = block.match(/href="https:\/\/hstream\.moe\/hentai\/([^"/]+)"/)?.[1];
    const image = block.match(/<img\s+src="([^"]+)"\s+alt="([^"]+)"/) || block.match(/<img[\s\S]*?src="([^"]+)"[\s\S]*?alt="([^"]+)"/);
    if (!slug || !image) continue;
    const badge = block.match(/ml-auto[^>]*>[\s\S]*?([^<>\n][^<>]*?)\s*<\/div>/)?.[1];
    cards.push({
      vod_id: slug,
      vod_name: decodeHtml(image[2]),
      vod_pic: new URL(image[1], "https://hstream.moe").href,
      vod_remarks: decodeHtml(badge || "HD"),
      type_name: "观番",
      vod_area: "hstream.moe",
      needs_detail: true,
      provider: "hstream",
    });
  }
  return cards;
}

async function hstreamList(requestUrl) {
  const upstream = new URL("https://hstream.moe/search");
  upstream.searchParams.set("order", "recently-uploaded");
  upstream.searchParams.set("page", requestUrl.searchParams.get("pg") || "1");
  const search = requestUrl.searchParams.get("wd")?.trim();
  if (search) upstream.searchParams.set("search", search);
  const response = await fetch(upstream, { headers: { accept: "text/html" } });
  if (!response.ok) return json({ message: `hstream list ${response.status}` }, { status: 502 });
  const html = await response.text();
  const list = parseHstreamCards(html).slice(0, 24);
  return json({ code: 1, page: Number(upstream.searchParams.get("page")), pagecount: 80, limit: 24, total: 1761, list, provider: "hstream" }, {
    headers: { "cache-control": search ? "public, max-age=60" : "public, max-age=180" },
  });
}

async function hstreamDetail(id) {
  if (!/^[a-z0-9-]+$/i.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const detailUrl = `https://hstream.moe/hentai/${id}`;
  const pageResponse = await fetch(detailUrl, { headers: { accept: "text/html" } });
  if (!pageResponse.ok) return json({ message: `hstream detail ${pageResponse.status}` }, { status: 502 });
  const html = await pageResponse.text();
  const token = html.match(/<meta name="csrf-token" content="([^"]+)/)?.[1] || html.match(/name="_token" value="([^"]+)/)?.[1];
  const episodeId = html.match(/id="e_id" type="hidden" value="(\d+)"/)?.[1];
  if (!token || !episodeId) return json({ message: "hstream player metadata unavailable" }, { status: 502 });
  const playerResponse = await fetch("https://hstream.moe/player/api", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-csrf-token": token,
      "x-requested-with": "XMLHttpRequest",
      cookie: readCookies(pageResponse.headers),
      referer: detailUrl,
    },
    body: JSON.stringify({ episode_id: episodeId }),
  });
  if (!playerResponse.ok) return json({ message: `hstream player ${playerResponse.status}` }, { status: 502 });
  const player = await playerResponse.json();
  const domains = [...new Set([...(player.stream_domains || []), ...(player.asia_stream_domains || [])])];
  const streams = domains.map((domain, index) => `720p 线路 ${index + 1}$${domain}/${player.stream_url}/x264.720p.mp4`).join("#");
  const description = decodeHtml(html.match(/<meta name="description" content="([^"]*)"/)?.[1] || "");
  return json({
    vod_id: id,
    vod_name: player.title || decodeHtml(html.match(/<title>([^<]+)/)?.[1] || id),
    vod_pic: new URL(player.poster || "/images/cropped-HS-1-192x192.webp", "https://hstream.moe").href,
    vod_content: description,
    vod_remarks: "720p",
    vod_play_url: streams,
    type_name: "观番",
    vod_area: "hstream.moe",
    provider: "hstream",
  }, { headers: { "cache-control": "public, max-age=300" } });
}

function normalizeLeak(item) {
  const username = item.profile?.username || "Leak Gallery";
  const fileUrl = item.file_path ? new URL(item.file_path, "https://cdn.leakgallery.com/").href : "";
  const thumbnailUrl = item.thumbnail_path ? new URL(item.thumbnail_path, "https://cdn.leakgallery.com/").href : fileUrl;
  return {
    vod_id: String(item.id),
    vod_name: item.title || `${username} #${item.id}`,
    vod_pic: thumbnailUrl,
    vod_remarks: item.is_video ? "VIDEO" : "IMAGE",
    vod_play_url: item.is_video ? fileUrl : "",
    media_kind: item.is_video ? "video" : "image",
    media_url: fileUrl,
    type_name: "图集",
    vod_area: "leakgallery.com",
    vod_content: item.added ? `更新：${item.added}` : "",
    provider: "leakgallery",
  };
}

async function leakGalleryList(requestUrl) {
  const search = requestUrl.searchParams.get("wd")?.trim();
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  let raw = [];
  if (search) {
    const profilesResponse = await fetch(`https://api.leakgallery.com/search?q=${encodeURIComponent(search)}`);
    const profiles = profilesResponse.ok ? await profilesResponse.json() : [];
    const results = await Promise.all((Array.isArray(profiles) ? profiles : []).slice(0, 6).map(async (profile) => {
      const response = await fetch(`https://api.leakgallery.com/profile/${encodeURIComponent(profile.username)}?type=All&sort=MostRecent&fake=true`);
      const data = response.ok ? await response.json() : {};
      return (Array.isArray(data.medias) ? data.medias : Array.isArray(data.media) ? data.media : []).map((item) => ({
        ...item,
        profile: item.profile || data.profile,
        title: item.title || `${data.profile?.username || profile.username} #${item.id}`,
      }));
    }));
    raw = results.flat();
  } else {
    const periods = ["Last-Hour", "Last-Day", "Last-Week", "Last-Month", "Most-Liked"];
    const period = periods[(page - 1) % periods.length];
    const response = await fetch(`https://api.leakgallery.com/popular/media/${period}?fake=true`);
    if (!response.ok) return json({ message: `leakgallery list ${response.status}` }, { status: 502 });
    raw = await response.json();
  }
  const list = (Array.isArray(raw) ? raw : []).slice(0, 24).map(normalizeLeak);
  return json({ code: 1, page, pagecount: 5, limit: 24, total: list.length, list, provider: "leakgallery" }, {
    headers: { "cache-control": search ? "public, max-age=60" : "public, max-age=180" },
  });
}

async function leakGalleryDetail(id) {
  if (!/^\d+$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const response = await fetch(`https://api.leakgallery.com/media/${id}`);
  if (!response.ok) return json({ message: `leakgallery detail ${response.status}` }, { status: 502 });
  return json(normalizeLeak(await response.json()), { headers: { "cache-control": "public, max-age=300" } });
}

function normalizeEporner(item) {
  const thumbnail = item.default_thumb?.src || item.thumbs?.[0]?.src || "";
  return {
    vod_id: String(item.id),
    vod_name: item.title || `Eporner ${item.id}`,
    vod_pic: thumbnail,
    vod_remarks: item.length_min || (item.length_sec ? `${Math.round(item.length_sec / 60)} 分钟` : "VIDEO"),
    vod_blurb: item.keywords || "",
    vod_content: item.keywords || "",
    vod_year: item.added?.slice(0, 4) || "",
    vod_area: "eporner.com",
    type_name: "EPORNER",
    embed_url: item.embed || `https://www.eporner.com/embed/${encodeURIComponent(item.id)}/`,
    media_kind: "embed",
    needs_detail: true,
    provider: "eporner",
  };
}

async function epornerList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const query = requestUrl.searchParams.get("wd")?.trim() || requestUrl.searchParams.get("preset")?.trim() || "all";
  const upstream = new URL("https://www.eporner.com/api/v2/video/search/");
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("per_page", "24");
  upstream.searchParams.set("page", String(page));
  upstream.searchParams.set("thumbsize", "medium");
  upstream.searchParams.set("order", requestUrl.searchParams.get("order") || "latest");
  upstream.searchParams.set("gay", "0");
  upstream.searchParams.set("lq", "1");
  upstream.searchParams.set("format", "json");
  const response = await fetch(upstream, { headers: { accept: "application/json" } });
  if (!response.ok) return json({ message: `eporner list ${response.status}` }, { status: 502 });
  const data = await response.json();
  const list = (Array.isArray(data.videos) ? data.videos : []).map(normalizeEporner);
  return json({
    code: 1,
    page: data.page || page,
    pagecount: data.total_pages || 1,
    limit: data.per_page || 24,
    total: data.total_count || list.length,
    list,
    provider: "eporner",
  }, { headers: { "cache-control": query === "all" ? "public, max-age=180" : "public, max-age=60" } });
}

async function epornerDetail(id) {
  if (!/^[a-z0-9_-]+$/i.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const upstream = new URL("https://www.eporner.com/api/v2/video/id/");
  upstream.searchParams.set("id", id);
  upstream.searchParams.set("thumbsize", "medium");
  upstream.searchParams.set("format", "json");
  const response = await fetch(upstream, { headers: { accept: "application/json" } });
  if (!response.ok) return json({ message: `eporner detail ${response.status}` }, { status: 502 });
  return json(normalizeEporner(await response.json()), { headers: { "cache-control": "public, max-age=300" } });
}

const MADOUAI_ORIGIN = "https://www.madouai.xyz";

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  return [hours || null, String(minutes).padStart(hours ? 2 : 1, "0"), String(secs).padStart(2, "0")]
    .filter((part) => part !== null)
    .join(":");
}

function madouAiAsset(value, kind) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.replace(/^\//, "");
  if (kind === "image") {
    if (path.startsWith("api/v1/image/proxy?")) return `${MADOUAI_ORIGIN}/${path}`;
    return `${MADOUAI_ORIGIN}/api/v1/image/proxy?path=${encodeURIComponent(path)}`;
  }
  if (path.startsWith("api/v1/m3u8/proxy?")) return `${MADOUAI_ORIGIN}/${path}`;
  return `${MADOUAI_ORIGIN}/api/v1/m3u8/proxy?path=${encodeURIComponent(path)}`;
}

function normalizeMadouAi(item) {
  const published = item.publishedAt || item.updatedAt || "";
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return {
    vod_id: String(item.id),
    vod_name: item.title || `麻豆AI ${item.id}`,
    vod_pic: madouAiAsset(item.coverUrl, "image"),
    vod_remarks: formatDuration(item.durationSec) || "VIDEO",
    vod_blurb: [item.authorName && `作者：${item.authorName}`, item.viewCount && `${item.viewCount} 次播放`].filter(Boolean).join(" · "),
    vod_content: item.description || tags.join(" · "),
    vod_year: published.slice(0, 4),
    vod_area: item.sourcePlatform || "madouai.xyz",
    type_name: item.categoryName || "麻豆AI",
    vod_play_url: madouAiAsset(item.videoUrl, "video"),
    media_kind: "video",
    needs_detail: true,
    provider: "madouai",
  };
}

async function madouAiFetch(pathname, params = {}) {
  const upstream = new URL(pathname, MADOUAI_ORIGIN);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") upstream.searchParams.set(key, String(value));
  });
  const response = await fetch(upstream, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`madouai ${response.status}`);
  const payload = await response.json();
  if (payload.code !== 200) throw new Error(payload.message || "madouai API error");
  return payload.data;
}

async function madouAiList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd")?.trim() || "";
  const categoryId = requestUrl.searchParams.get("categoryId") || "";
  const data = keyword
    ? await madouAiFetch("/api/v1/videos/search", { page, size: 24, q: keyword })
    : await madouAiFetch("/api/v1/videos", { page, size: 24, categoryId });
  const list = (Array.isArray(data.items) ? data.items : []).map(normalizeMadouAi);
  return json({
    code: 1,
    page: Number(data.page || page),
    pagecount: Number(data.totalPages || 1),
    limit: Number(data.size || 24),
    total: Number(data.total || list.length),
    list,
    provider: "madouai",
  }, { headers: { "cache-control": keyword ? "public, max-age=60" : "public, max-age=180" } });
}

async function madouAiDetail(id, requestUrl) {
  if (!/^\d+$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const item = normalizeMadouAi(await madouAiFetch(`/api/v1/videos/${id}`));
  // madouai's /api/v1/m3u8/proxy and key endpoints reflect a DUPLICATED
  // Access-Control-Allow-Origin header (e.g. "http://localhost:5173, http://localhost:5173")
  // which browsers reject; route manifest + key through the same-origin proxy
  // (clean CORS headers), keep ts segments direct (dcsfik.com sends a single "*").
  const proxy = new URL("/provider-api/madouai", requestUrl.origin);
  proxy.searchParams.set("action", "media");
  proxy.searchParams.set("url", item.vod_play_url);
  return json({ ...item, vod_play_url: proxy.href, needs_detail: false }, { headers: { "cache-control": "public, max-age=180" } });
}

const MADOUAI_MEDIA_HOSTS = new Set(["www.madouai.xyz"]);

async function madouAiMedia(requestUrl) {
  const raw = requestUrl.searchParams.get("url") || "";
  let source;
  try {
    source = new URL(raw);
  } catch {
    return json({ message: "invalid media url" }, { status: 400 });
  }
  if (source.protocol !== "https:" || !MADOUAI_MEDIA_HOSTS.has(source.hostname)) return json({ message: "invalid media host" }, { status: 400 });
  const upstream = await fetch(source, { signal: AbortSignal.timeout(15_000) });
  if (!upstream.ok) return json({ message: `madouai media ${upstream.status}` }, { status: 502 });
  if (/\.m3u8(?:$|\?)/i.test(source.pathname) || source.pathname.endsWith("/m3u8/proxy")) {
    const text = (await upstream.text()).replace(/URI="([^"]+)"/g, (_, uri) => {
      const absolute = new URL(uri, source).href;
      const proxy = new URL("/provider-api/madouai", requestUrl.origin);
      proxy.searchParams.set("action", "media");
      proxy.searchParams.set("url", absolute);
      return `URI="${proxy.href}"`;
    });
    return new Response(text, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}

const PMVHAVEN_ORIGIN = "https://pmvhaven.com";

async function pmvHavenPage(pathname, params = {}) {
  const upstream = new URL(pathname, PMVHAVEN_ORIGIN);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") upstream.searchParams.set(key, String(value));
  });
  const response = await fetch(upstream, {
    headers: { accept: "text/html", "user-agent": "CFNav-Independent/2.0 (personal non-commercial project)" },
  });
  if (!response.ok) throw new Error(`pmvhaven page ${response.status}`);
  const html = await response.text();
  const payloadText = html.match(/<script type="application\/json" data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!payloadText) throw new Error("pmvhaven page payload unavailable");
  return hydrateNuxtPayload(JSON.parse(payloadText));
}

function normalizePmvHaven(item) {
  const tags = item.top5Tags || item.tags || [];
  const mediaUrl = item.videoUrl || item.hlsMasterPlaylistUrl || "";
  return {
    vod_id: String(item._id || item.id || ""),
    vod_name: item.title || `PMVHaven ${item._id || item.id}`,
    vod_pic: item.thumbnailUrl || item.thumbnailSizes?.lg?.url || item.thumbnailSizes?.md?.url || "",
    vod_remarks: item.duration || formatDuration(item.durationSeconds) || "VIDEO",
    vod_blurb: [
      (item.uploaderUsername || item.uploader) && `发布者：${item.uploaderUsername || item.uploader}`,
      Number.isFinite(Number(item.views)) && `${Number(item.views)} 次播放`,
      Number.isFinite(Number(item.likes)) && `${Number(item.likes)} 喜欢`,
    ].filter(Boolean).join(" · "),
    vod_content: item.description || tags.join(" · "),
    vod_year: String(item.uploadDate || item.releaseDate || "").slice(0, 4),
    vod_area: "pmvhaven.com",
    type_name: tags[0] || "PMV",
    vod_play_url: mediaUrl,
    media_kind: "video",
    needs_detail: true,
    provider: "pmvhaven",
  };
}

function hydrateNuxtPayload(flattened) {
  const hydrated = new Array(flattened.length);
  const special = new Map([[-1, undefined], [-2, Number.NaN], [-3, Number.POSITIVE_INFINITY], [-4, Number.NEGATIVE_INFINITY], [-5, -0]]);
  const hydrate = (index) => {
    if (typeof index !== "number") return index;
    if (index < 0) return special.get(index);
    if (index in hydrated) return hydrated[index];
    const value = flattened[index];
    if (Array.isArray(value)) {
      if (typeof value[0] === "string" && ["ShallowReactive", "Reactive", "Ref", "ShallowRef"].includes(value[0])) hydrated[index] = hydrate(value[1]);
      else if (value[0] === "Date") hydrated[index] = value[1];
      else hydrated[index] = value.map(hydrate);
      return hydrated[index];
    }
    if (value && typeof value === "object") {
      const result = {};
      hydrated[index] = result;
      for (const [key, item] of Object.entries(value)) result[key] = hydrate(item);
      return result;
    }
    hydrated[index] = value;
    return value;
  };
  return hydrate(0);
}

async function pmvHavenSearch(keyword, page) {
  const payload = await pmvHavenPage("/search", { q: keyword, page: page > 1 ? page : "" });
  const data = payload?.state?.["$ssearch-data"] || {};
  const videos = Array.isArray(data.videos) ? data.videos : Array.isArray(payload?.state?.["$ssearch-accumulated-videos"]) ? payload.state["$ssearch-accumulated-videos"] : [];
  return {
    videos,
    page: Number(payload?.state?.["$ssearch-current-page"] || page),
    totalPages: Number(payload?.state?.["$ssearch-total-pages"] || data.totalPages || 1),
    total: Number(data.total || data.totalVideos || data.pagination?.total || data.pagination?.totalVideos || videos.length),
  };
}

async function pmvHavenList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd")?.trim() || "";
  if (keyword) {
    const data = await pmvHavenSearch(keyword, page);
    const list = data.videos.slice(0, 24).map(normalizePmvHaven);
    return json({ code: 1, page: data.page, pagecount: data.totalPages, limit: 24, total: data.total || list.length, list, provider: "pmvhaven" }, {
      headers: { "cache-control": "public, max-age=60" },
    });
  }
  if (page === 1 && !requestUrl.searchParams.get("tag") && !requestUrl.searchParams.get("sort")) {
    const payload = await pmvHavenPage("/");
    const data = payload?.data?.["homepage-videos-ssr"] || {};
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const list = videos.slice(0, 24).map(normalizePmvHaven);
    const pagination = data.pagination || {};
    return json({
      code: 1,
      page: 1,
      pagecount: Math.max(1, Math.ceil(Number(pagination.total || pagination.totalVideos || 65006) / 24)),
      limit: 24,
      total: Number(pagination.total || pagination.totalVideos || 65006),
      list,
      provider: "pmvhaven",
    }, { headers: { "cache-control": "public, max-age=60" } });
  }
  const upstream = new URL("/api/videos", PMVHAVEN_ORIGIN);
  upstream.searchParams.set("page", String(page));
  upstream.searchParams.set("limit", "24");
  upstream.searchParams.set("sort", requestUrl.searchParams.get("sort") || "latest");
  const tag = requestUrl.searchParams.get("tag")?.trim();
  if (tag) upstream.searchParams.set("tag", tag);
  const response = await fetch(upstream, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`pmvhaven list ${response.status}`);
  const data = await response.json();
  const videos = Array.isArray(data.videos) ? data.videos : Array.isArray(data.data) ? data.data : [];
  const list = videos.map(normalizePmvHaven);
  const pagination = data.pagination || {};
  return json({
    code: 1,
    page: Number(pagination.page || page),
    pagecount: Number(pagination.totalPages || 1),
    limit: Number(pagination.limit || 24),
    total: Number(pagination.total || pagination.totalVideos || data.filteredCount || list.length),
    list,
    provider: "pmvhaven",
  }, { headers: { "cache-control": "public, max-age=120" } });
}

async function pmvHavenDetail(id) {
  if (!/^[a-f0-9]{24}$/i.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const response = await fetch(`${PMVHAVEN_ORIGIN}/api/videos/${id}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`pmvhaven detail ${response.status}`);
  const payload = await response.json();
  const item = normalizePmvHaven(payload.data || payload.video || payload);
  return json({ ...item, needs_detail: false }, { headers: { "cache-control": "public, max-age=180" } });
}

let redgifsToken = "";
let redgifsTokenExpires = 0;

async function redgifsAuth() {
  if (redgifsToken && Date.now() < redgifsTokenExpires) return redgifsToken;
  const response = await fetch("https://api.redgifs.com/v2/auth/temporary", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`redgifs auth ${response.status}`);
  const data = await response.json();
  if (!data.token) throw new Error("redgifs temporary token unavailable");
  redgifsToken = data.token;
  redgifsTokenExpires = Date.now() + 45 * 60 * 1000;
  return redgifsToken;
}

async function redgifsFetch(url) {
  let token = await redgifsAuth();
  let response = await fetch(url, {
    headers: { accept: "application/json", authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    redgifsToken = "";
    redgifsTokenExpires = 0;
    token = await redgifsAuth();
    response = await fetch(url, {
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
    });
  }
  return response;
}

function normalizeRedgifs(item) {
  const duration = Number(item.duration || 0);
  const mediaUrl = item.urls?.hd || item.urls?.sd || "";
  return {
    vod_id: String(item.id || ""),
    vod_name: item.description?.trim() || `${item.userName || "RedGifs"} · ${item.id}`,
    vod_pic: item.urls?.poster || item.urls?.thumbnail || "",
    vod_remarks: duration ? `${Math.round(duration)} 秒${item.hasAudio ? " · 有声" : ""}` : "HD VIDEO",
    vod_blurb: [item.userName && `作者：${item.userName}`, item.views && `${item.views} 次观看`, item.likes && `${item.likes} 喜欢`].filter(Boolean).join(" · "),
    vod_content: Array.isArray(item.tags) && item.tags.length ? item.tags.join(" · ") : "",
    vod_year: item.createDate ? new Date(item.createDate * 1000).getFullYear().toString() : "",
    vod_area: "redgifs.com",
    type_name: "PMV / SHORT",
    vod_play_url: mediaUrl,
    media_kind: "video",
    needs_detail: true,
    provider: "redgifs",
  };
}

async function redgifsList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const query = requestUrl.searchParams.get("wd")?.trim() || requestUrl.searchParams.get("preset")?.trim() || "pmv";
  const upstream = new URL("https://api.redgifs.com/v2/gifs/search");
  upstream.searchParams.set("search_text", query);
  upstream.searchParams.set("count", "24");
  upstream.searchParams.set("page", String(page));
  upstream.searchParams.set("order", requestUrl.searchParams.get("order") || "trending");
  const response = await redgifsFetch(upstream);
  if (!response.ok) return json({ message: `redgifs list ${response.status}` }, { status: 502 });
  const data = await response.json();
  const list = (Array.isArray(data.gifs) ? data.gifs : [])
    .filter((item) => item?.published !== false && (item.urls?.hd || item.urls?.sd))
    .map(normalizeRedgifs);
  return json({
    code: 1,
    page,
    pagecount: Number(data.pages || data.pageCount || (data.hasMore ? page + 1 : page)),
    limit: 24,
    total: Number(data.total || list.length),
    list,
    provider: "redgifs",
  }, { headers: { "cache-control": query === "pmv" ? "public, max-age=180" : "public, max-age=60" } });
}

async function redgifsDetail(id) {
  if (!/^[a-z0-9-]+$/i.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const response = await redgifsFetch(`https://api.redgifs.com/v2/gifs/${encodeURIComponent(id)}`);
  if (!response.ok) return json({ message: `redgifs detail ${response.status}` }, { status: 502 });
  const data = await response.json();
  if (!data.gif) return json({ message: "redgifs item unavailable" }, { status: 404 });
  return json(normalizeRedgifs(data.gif), { headers: { "cache-control": "public, max-age=300" } });
}

const TNAFLIX_ORIGIN = "https://www.tnaflix.com";
const TNAFLIX_HEADERS = {
  accept: "text/html,application/xhtml+xml",
  "user-agent": "CFNav-Independent/2.0 (personal non-commercial project)",
};

async function tnaflixPage(url) {
  const response = await fetch(url, { headers: TNAFLIX_HEADERS });
  if (!response.ok) throw new Error(`tnaflix page ${response.status}`);
  return response.text();
}

function tnaflixAsset(value = "") {
  if (!value || value.includes("video_cover_placeholder")) return "";
  try {
    const asset = new URL(value.replace(/&amp;/g, "&"), TNAFLIX_ORIGIN);
    return asset.protocol === "https:" ? asset.href : "";
  } catch {
    return "";
  }
}

function parseTnaflixCards(html) {
  const cards = [];
  const starts = [...html.matchAll(/<div\s+data-vid="(\d+)"\s+data-num="\d+"[^>]*>/g)];
  for (let index = 0; index < starts.length; index += 1) {
    const block = html.slice(starts[index].index, starts[index + 1]?.index || html.length);
    const videoId = starts[index][1];
    const href = block.match(/<a[^>]+href="([^"]+\/video\d+)"[^>]+class="video-title[^\"]*"/)?.[1]
      || block.match(/<a[^>]+class="[^"]*video-thumb[^"]*"[^>]+href="([^"]+\/video\d+)"/)?.[1]
      || block.match(/<a[^>]+href="([^"]+\/video\d+)"[^>]+class="[^"]*video-thumb[^"]*"/)?.[1];
    if (!href) continue;
    let itemUrl;
    try {
      itemUrl = new URL(href.replace(/&amp;/g, "&"), TNAFLIX_ORIGIN);
    } catch {
      continue;
    }
    if (itemUrl.origin !== TNAFLIX_ORIGIN || !new RegExp(`/video${videoId}$`).test(itemUrl.pathname)) continue;
    const title = decodeHtml(block.match(/<a[^>]+class="video-title[^\"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1]
      || block.match(/<img[^>]+alt="([^"]+)"/)?.[1]
      || `TNAFlix ${videoId}`);
    const imageTag = block.match(/<img[^>]+>/)?.[0] || "";
    const poster = tnaflixAsset(imageTag.match(/data-src="([^"]+)"/)?.[1] || imageTag.match(/src="([^"]+)"/)?.[1] || "");
    const duration = decodeHtml(block.match(/class="thumb-icon video-duration">([\s\S]*?)<\/div>/)?.[1] || "");
    const quality = decodeHtml(block.match(/class="thumb-icon max-quality">([\s\S]*?)<\/div>/)?.[1] || "");
    const uploader = decodeHtml(block.match(/class="[^"]*badge-(?:unverified|verified)[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1] || "");
    const views = decodeHtml(block.match(/<i class="icon-eye"><\/i>\s*([^<]+)/)?.[1] || "");
    const rating = decodeHtml(block.match(/<i class="icon-thumb-up"><\/i>\s*([^<]+)/)?.[1] || "");
    const category = decodeURIComponent(itemUrl.pathname.split("/").filter(Boolean)[0] || "TNAFlix").replace(/-/g, " ");
    cards.push({
      vod_id: itemUrl.pathname,
      vod_name: title,
      vod_pic: poster,
      vod_remarks: [duration, quality].filter(Boolean).join(" · ") || "VIDEO",
      vod_blurb: [uploader && `发布者：${uploader}`, views && `${views} 次观看`, rating && `${rating} 好评`].filter(Boolean).join(" · "),
      vod_content: [uploader, views, rating].filter(Boolean).join(" · "),
      vod_area: "tnaflix.com",
      type_name: category,
      media_kind: "video",
      needs_detail: true,
      provider: "tnaflix",
    });
  }
  return cards;
}

function tnaflixPageCount(html, page) {
  const linkedPages = [...html.matchAll(/(?:\/featured\/|[?&]page=)(\d+)/g)].map((match) => Number(match[1]));
  return Math.max(page, ...linkedPages.filter(Number.isFinite));
}

async function tnaflixList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd")?.trim() || "";
  const upstream = keyword
    ? new URL("/search", TNAFLIX_ORIGIN)
    : new URL(page > 1 ? `/featured/${page}` : "/", TNAFLIX_ORIGIN);
  if (keyword) {
    upstream.searchParams.set("what", keyword);
    if (page > 1) upstream.searchParams.set("page", String(page));
  }
  const html = await tnaflixPage(upstream);
  const list = parseTnaflixCards(html).slice(0, 24);
  const pagecount = tnaflixPageCount(html, page);
  return json({
    code: 1,
    page,
    pagecount,
    limit: 24,
    total: pagecount * 24,
    list,
    provider: "tnaflix",
  }, { headers: { "cache-control": keyword ? "public, max-age=60" : "public, max-age=180" } });
}

function isoDuration(value = "") {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return value;
  return formatDuration((Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3]));
}

async function tnaflixDetail(id) {
  if (typeof id !== "string" || id.length > 500 || !/^\/[a-z0-9%_()\-./]+\/video\d+$/i.test(id)) {
    return json({ message: "invalid id" }, { status: 400 });
  }
  const upstream = new URL(id, TNAFLIX_ORIGIN);
  if (upstream.origin !== TNAFLIX_ORIGIN || !/\/video\d+$/.test(upstream.pathname)) {
    return json({ message: "invalid id" }, { status: 400 });
  }
  const html = await tnaflixPage(upstream);
  let metadata = {};
  for (const script of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(script[1]);
      if (parsed?.["@type"] === "VideoObject") {
        metadata = parsed;
        break;
      }
    } catch {
      // Ignore unrelated malformed metadata blocks and continue with page fallbacks.
    }
  }
  const streamUrls = [...html.matchAll(/https?:\/\/[^"'<>\\\s]+\.mp4\?[^"'<>\\\s]+/g)]
    .map((match) => match[0].replace(/&amp;/g, "&"))
    .filter((url) => !/\/trailer\//i.test(url));
  const uniqueStreams = [...new Set(streamUrls)].map((url) => ({
    url,
    quality: Number(url.match(/-(\d+)p\.mp4/i)?.[1] || 0),
  })).filter((stream) => stream.quality).sort((a, b) => b.quality - a.quality);
  if (!uniqueStreams.length) return json({ message: "tnaflix public media unavailable" }, { status: 502 });
  const videoId = upstream.pathname.match(/video(\d+)$/)?.[1] || "";
  const title = decodeHtml(metadata.name || html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || `TNAFlix ${videoId}`);
  const description = decodeHtml(metadata.description || html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] || "");
  const duration = isoDuration(metadata.duration || "");
  const category = decodeURIComponent(upstream.pathname.split("/").filter(Boolean)[0] || "TNAFlix").replace(/-/g, " ");
  return json({
    vod_id: upstream.pathname,
    vod_name: title,
    vod_pic: tnaflixAsset(metadata.thumbnailUrl || html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || ""),
    vod_remarks: [duration, `${uniqueStreams[0].quality}p`].filter(Boolean).join(" · "),
    vod_blurb: description,
    vod_content: description,
    vod_year: String(metadata.uploadDate || "").slice(0, 4),
    vod_area: "tnaflix.com",
    type_name: category,
    vod_play_url: uniqueStreams.map((stream) => `${stream.quality}p$${stream.url}`).join("#"),
    media_kind: "video",
    needs_detail: false,
    provider: "tnaflix",
  }, { headers: { "cache-control": "public, max-age=120" } });
}

const KAN91_ORIGIN = "https://91porna.com";
const KAN91_HEADERS = {
  accept: "text/html,application/xhtml+xml",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CFNav-Independent/2.0",
};
const KAN91_IMG_KEY = new TextEncoder().encode("f5d965df75336270");
const KAN91_IMG_IV = new TextEncoder().encode("97b60394abc2fbe1");

function unpackPacked(src) {
  const match = src.match(/function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\),0,\{\}\)/);
  if (!match) return null;
  const payload = match[1];
  const base = Number(match[2]);
  const count = Number(match[3]);
  const dict = match[4].split("|");
  const key = (n) => (n < base ? "" : key(Math.floor(n / base))) + ((n = n % base) > 35 ? String.fromCharCode(n + 29) : n.toString(36));
  const keyMap = {};
  for (let index = 0; index < count; index += 1) keyMap[key(index)] = dict[index] || key(index);
  return payload.replace(/\b([A-Za-z0-9]+)\b/g, (word) => keyMap[word] || word);
}

async function kan91Page(pathname, params = {}, extraHeaders = {}) {
  const upstream = new URL(pathname, KAN91_ORIGIN);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") upstream.searchParams.set(key, String(value));
  });
  const response = await fetch(upstream, { headers: { ...KAN91_HEADERS, ...extraHeaders } });
  if (!response.ok) throw new Error(`kan91 page ${response.status}`);
  return response.text();
}

function kan91ImageProxy(source) {
  if (!source) return "";
  return `/provider-api/kan91?action=image&url=${encodeURIComponent(source)}`;
}

function parseKan91Cards(html) {
  const cards = [];
  const seen = new Set();
  const pattern = /video_key=(\d+)[^"]*"[\s\S]{0,600}?data-src="(https:\/\/pic\.xmbvxj\.cn\/[^"]+)"[\s\S]{0,600}?alt="([^"]*)"/g;
  for (const match of html.matchAll(pattern)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    cards.push({
      vod_id: id,
      vod_name: decodeHtml(match[3]) || `91视频 ${id}`,
      vod_pic: kan91ImageProxy(match[2]),
      vod_remarks: "VIDEO",
      type_name: "91视频",
      vod_area: "91porna.com",
      media_kind: "video",
      needs_detail: true,
      provider: "kan91",
    });
  }
  return cards;
}

function kan91PageCount(html, page) {
  const next = html.match(/<link rel="next" href="[^"]*page=(\d+)"/);
  return Math.max(page, ...(next ? [Number(next[1])] : []));
}

async function kan91List(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd")?.trim() || "";
  const category = requestUrl.searchParams.get("preset")?.trim() || "play";
  const html = keyword
    ? await kan91Page("/comic/index/search", { keyword })
    : await kan91Page("/comic/index/video", { category, page: page > 1 ? String(page) : "" });
  const list = parseKan91Cards(html).slice(0, 24);
  const pagecount = keyword ? 1 : kan91PageCount(html, page);
  return json({
    code: 1,
    page,
    pagecount,
    limit: 24,
    total: pagecount * 24,
    list,
    provider: "kan91",
  }, { headers: { "cache-control": keyword ? "public, max-age=60" : "public, max-age=120" } });
}

function kan91NormalizeAsset(value = "") {
  const cleaned = value.replace(/\\+$/, "");
  try {
    const parsed = new URL(cleaned);
    parsed.pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, "/");
    return parsed.href;
  } catch {
    return cleaned;
  }
}

async function kan91ResolvePlay(html, id) {
  const script = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*?)'\.split\('\|'\),0,\{\}\)\)/);
  if (!script) throw new Error("kan91 detail_play metadata unavailable");
  const unwrapped = unpackPacked(script[0]);
  const img = unwrapped.match(/detail_play\?img=([^"&]+)/)?.[1];
  const ads = unwrapped.match(/&ads=([^"&]+)/)?.[1];
  const signature = unwrapped.match(/encodeURIComponent\("([0-9a-f]+)"\)/)?.[1];
  if (!img || !signature) throw new Error("kan91 detail_play params unavailable");
  const playUrl = new URL("/index/detail_play", KAN91_ORIGIN);
  playUrl.searchParams.set("img", decodeURIComponent(img));
  if (ads) playUrl.searchParams.set("ads", decodeURIComponent(ads));
  playUrl.searchParams.set("u", signature);
  playUrl.searchParams.set("t", String(Math.floor(Date.now() / 1000 / 2100)));
  const response = await fetch(playUrl, {
    headers: {
      ...KAN91_HEADERS,
      accept: "application/javascript, */*;q=0.1",
      referer: `${KAN91_ORIGIN}/comic/index/detail?video_key=${id}`,
    },
  });
  if (!response.ok) throw new Error(`kan91 detail_play ${response.status}`);
  const payload = unpackPacked(await response.text());
  if (!payload) throw new Error("kan91 detail_play payload unavailable");
  const video = payload.match(/https:\/\/yd-hls\.utxxds\.cn\/[^'"\\]+/)?.[0];
  const poster = payload.match(/https:\/\/pic\.xmbvxj\.cn\/[^'"\\]+/)?.[0];
  if (!video) throw new Error("kan91 stream unavailable");
  return { video: video.replace(/\\+$/, ""), poster: kan91NormalizeAsset(poster || "") };
}

function kan91VideoObject(html) {
  for (const script of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(script[1]);
      const graph = Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [parsed];
      const video = graph.find((node) => node?.["@type"] === "VideoObject");
      if (video) return video;
    } catch {
      // Ignore unrelated malformed metadata blocks and continue with page fallbacks.
    }
  }
  return {};
}

async function kan91Detail(id) {
  if (!/^\d+$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const html = await kan91Page("/comic/index/detail", { video_key: id });
  const metadata = kan91VideoObject(html);
  const play = await kan91ResolvePlay(html, id);
  const author = typeof metadata.author === "object" ? metadata.author.name : "";
  const plays = metadata.interactionStatistic?.find?.((item) => item.interactionType?.["@type"] === "WatchAction")?.userInteractionCount;
  const tags = Array.isArray(metadata.keywords) ? metadata.keywords : [];
  const title = decodeHtml(metadata.name || html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || `91视频 ${id}`);
  const description = decodeHtml(metadata.description || html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] || "");
  const duration = isoDuration(metadata.duration || "");
  return json({
    vod_id: id,
    vod_name: title,
    vod_pic: kan91ImageProxy(play.poster || ""),
    vod_remarks: [duration, "VIDEO"].filter(Boolean).join(" · "),
    vod_blurb: [author && `作者：${author}`, plays && `${plays} 次播放`, metadata.uploadDate && `更新：${metadata.uploadDate.slice(0, 10)}`].filter(Boolean).join(" · "),
    vod_content: description || tags.join(" · "),
    vod_year: String(metadata.uploadDate || "").slice(0, 4),
    vod_area: "91porna.com",
    type_name: tags[0] || "91视频",
    vod_play_url: play.video,
    media_kind: "video",
    needs_detail: false,
    provider: "kan91",
  }, { headers: { "cache-control": "no-store" } });
}

async function kan91Image(requestUrl) {
  let source;
  try {
    source = new URL(requestUrl.searchParams.get("url") || "");
  } catch {
    return json({ message: "invalid image source" }, { status: 400 });
  }
  if (source.hostname !== "pic.xmbvxj.cn" || !["https:", "http:"].includes(source.protocol)) {
    return json({ message: "invalid image source" }, { status: 400 });
  }
  const response = await fetch(source, { headers: { ...KAN91_HEADERS, accept: "image/*" } });
  if (!response.ok) return json({ message: `kan91 image ${response.status}` }, { status: 502 });
  const cipher = await response.arrayBuffer();
  const key = await crypto.subtle.importKey("raw", KAN91_IMG_KEY, { name: "AES-CBC" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv: KAN91_IMG_IV }, key, cipher);
  const head = new Uint8Array(plain.slice(0, 3));
  const contentType = head[0] === 0xff && head[1] === 0xd8 ? "image/jpeg"
    : head[0] === 0x47 && head[1] === 0x49 ? "image/gif"
    : head[0] === 0x89 && head[1] === 0x50 ? "image/png"
    : "application/octet-stream";
  return new Response(plain, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

const QIYING_ORIGIN = "https://agency.nsguiiwz.cc";
const QIYING_MIRRORS = ["https://being.nsguiiwz.cc", "https://act.nsguiiwz.cc"];
const QIYING_IMG_CDN = "https://imgpublic.ycomesc.live";
const QIYING_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CFNav-Independent/2.0",
};

const MR_ORIGIN = "https://mrds.com";
const MR_MIRRORS = ["https://www.mrds66.com", "https://www.mrds.com"];

const JM_ORIGIN = "https://18mh.net";
const JM_MIRRORS = ["https://32b.azucyfo.com"];

function qiyingImageUrl(url = "") {
  if (!url) return "";
  return url.replace(/^https?:\/\/pic\.[a-z0-9.-]+\.cn/, QIYING_IMG_CDN);
}

async function qiyingPage(pathname, mirrors = [QIYING_ORIGIN, ...QIYING_MIRRORS]) {
  let lastError;
  for (const origin of mirrors) {
    try {
      const response = await fetch(new URL(pathname, origin), {
        headers: QIYING_HEADERS,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        lastError = new Error(`qiying page ${response.status}`);
        continue;
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("qiying page unavailable");
}

function qiyingDecodeHtmlEntities(value = "") {
  return decodeHtml(value);
}

function qiyingExtractDetail(html, id, siteName = "91吃瓜网") {
  const title = qiyingDecodeHtmlEntities(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || html.match(/<title>([^<]*)<\/title>/)?.[1] || `${siteName} ${id}`).replace(new RegExp(`\\s+-\\s*${siteName}\\s*$`), "");
  const description = qiyingDecodeHtmlEntities(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] || "");
  const author = qiyingDecodeHtmlEntities(html.match(/<meta itemprop="name" content="([^"]+)"/)?.[1] || "");
  const datePublished = html.match(/<meta itemprop="datePublished" content="([^"]+)"/)?.[1] || "";
  const categories = [...new Set(html.match(/data-video_type_name="([^"]+)"/g)?.map((m) => m.match(/data-video_type_name="([^"]+)"/)[1]) || [])];

  const images = [];
  const seenImages = new Set();
  for (const match of html.matchAll(/(?:data-xkrkllgl|data-src|data-original|src)="(https:\/\/[^"]+\.(?:jpe?g|png|webp))"/g)) {
    const url = match[1].replace(/&amp;/g, "&");
    if (seenImages.has(url)) continue;
    if (/hc237\/|uploads\/default\/other|\/gif$|zw\.png|banner\.png|avatar|\.gif/i.test(url)) continue;
    seenImages.add(url);
    images.push(qiyingImageUrl(url));
  }
  const fallbackImages = [...new Set((html.match(/https:\/\/pic\.[a-z0-9.-]+\.cn\/upload_01\/xiao\/[^"'<>\\\s]+\.(?:jpe?g|png|webp)/g) || []).map((u) => qiyingImageUrl(u)))];
  if (!images.length) images.push(...fallbackImages);

  const videos = [];
  for (const match of html.matchAll(/<div class="dplayer"[\s\S]{0,9000}?data-config='([\s\S]*?)'/g)) {
    try {
      const config = JSON.parse(match[1]);
      if (typeof config?.video?.url === "string" && /\.m3u8(?:\?|$)/i.test(config.video.url)) {
        videos.push({ url: config.video.url.replace(/\\\//g, "/").replace(/&amp;/g, "&"), type: config.video.type || "hls" });
      }
    } catch {
      // Malformed player config blocks are ignored; page fallbacks below still apply.
    }
  }
  const poster = images[0] || qiyingImageUrl(html.match(/https:\/\/pic\.[a-z0-9.-]+\.cn\/upload_01\/xiao\/[^"'<>\\\s]+\.(?:jpe?g|png|webp)/)?.[0] || "");

  return {
    title,
    description,
    author,
    datePublished,
    categories,
    images,
    videos,
    poster,
  };
}

async function qiyingDetail(id) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const html = await qiyingPage(`/archives/${id}/`);
  const detail = qiyingExtractDetail(html, id);
  const primary = detail.videos[0];
  return json({
    vod_id: id,
    vod_name: detail.title,
    vod_pic: detail.poster,
    vod_remarks: detail.videos.length ? `${detail.images.length} 图 · ${detail.videos.length} 视频` : `${detail.images.length} 图`,
    vod_blurb: [detail.author && `作者：${detail.author}`, detail.datePublished && `发布于：${detail.datePublished.slice(0, 10)}`].filter(Boolean).join(" · "),
    vod_content: detail.description || "",
    type_name: detail.categories[0] || "91吃瓜",
    vod_area: "91吃瓜网",
    media_gallery: detail.images,
    videos: detail.videos.map((video) => ({ url: video.url, type: video.type })),
    vod_play_url: primary?.url || "",
    media_kind: detail.videos.length ? "video" : "gallery",
    needs_detail: false,
    provider: "qiying",
  }, { headers: { "cache-control": "no-store" } });
}

async function qiyingPlay(id, index) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const selected = Number.isInteger(Number(index)) && Number(index) > 0 ? Number(index) : 0;
  let html;
  try {
    html = await qiyingPage(`/archives/${id}/`);
  } catch {
    return json({ message: "帖子已从主站删除，仅图集可用" }, { status: 404 });
  }
  const detail = qiyingExtractDetail(html, id);
  const video = detail.videos[selected];
  if (!video) return json({ message: selected ? `此帖子没有第 ${selected + 1} 个公开视频` : "此帖子没有公开视频" }, { status: 404 });
  return json({ vod_id: id, video: video.url, poster: detail.poster || detail.images[0] || "", provider: "qiying" }, {
    headers: { "cache-control": "no-store" },
  });
}

function qiyingParseCards(html) {
  const items = [];
  for (const part of html.split(/<article itemscope itemtype="http:\/\/schema.org\/BlogPosting"/).slice(1)) {
    const block = part.slice(0, part.indexOf("</article>"));
    if (block.indexOf('class="post-card"') < 0) continue;
    const titleBlock = block.match(/<h2 class="post-card-title"[^>]*>([\s\S]*?)<\/h2>/);
    if (!titleBlock) continue;
    const id = block.match(/content="[^"]*\/archives\/(\d+)\//)?.[1] || block.match(/href="[^"]*\/archives\/(\d+)\//)?.[1];
    if (!id) continue;
    const hot = /class="wraps">\s*热搜/.test(titleBlock[1]);
    const title = qiyingDecodeHtmlEntities(titleBlock[1].replace(/<div class="wrap">[\s\S]*?<\/div>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const cover = qiyingImageUrl(block.match(/loadBannerDirect\('([^']+)'/)?.[1] || "");
    const author = qiyingDecodeHtmlEntities(block.match(/<span itemprop="author"[^>]*>\s*([^<]*?)\s*<\/span>/)?.[1] || "").trim().replace(/•\s*$/, "").trim();
    const date = block.match(/itemprop="datePublished" content="([^"]+)"/)?.[1] || "";
    const infoBlock = block.match(/<div class="post-card-info">([\s\S]*?)<\/div>/)?.[1] || "";
    const categories = [...infoBlock.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1].split(/[,，]\s*/)).flat().filter(Boolean);
    items.push({ p: id, t: title, r: cover, a: author, u: date, k: categories, hot });
  }
  return items;
}

async function qiyingCats(html) {
  const source = html || await qiyingPage("/");
  const cats = [];
  const seen = new Set();
  for (const match of source.matchAll(/<a[^>]*href="(\/category\/[a-z0-9-]+\/)"[^>]*>([^<]{1,40})<\/a>/g)) {
    const slug = match[1].replace(/^\/category\//, "").replace(/\/$/, "");
    const name = qiyingDecodeHtmlEntities(match[2].trim());
    if (!name || seen.has(slug)) continue;
    seen.add(slug);
    cats.push({ slug, name });
  }
  return cats;
}

async function qiyingList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("page")) || 1);
  const category = requestUrl.searchParams.get("category") || "";
  const q = (requestUrl.searchParams.get("q") || "").trim();
  let pathname;
  if (q) pathname = `/search/${encodeURIComponent(q)}/`;
  else if (category) pathname = page <= 1 ? `/category/${category}/` : `/category/${category}/${page}/`;
  else pathname = page <= 1 ? "/" : `/page/${page}/`;
  const html = await qiyingPage(pathname);
  const items = qiyingParseCards(html);
  const pager = html.match(/page-info">\s*(\d+)\s*\/\s*(\d+)/);
  const current = Number(pager?.[1]) || 1;
  const total = q ? Math.max(1, Math.ceil(items.length / 30)) : Number(pager?.[2]) || Math.max(current, page);
  return json({
    items,
    page: current,
    totalPages: total,
    note: q ? "search" : category ? "category" : "latest",
    provider: "qiying",
  }, { headers: { "cache-control": "public, max-age=60" } });
}

function mrPage(pathname) {
  return qiyingPage(pathname, [MR_ORIGIN, ...MR_MIRRORS]);
}

async function mrDetail(id) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const html = await mrPage(`/archives/${id}/`);
  const detail = qiyingExtractDetail(html, id, "每日大赛");
  const primary = detail.videos[0];
  return json({
    vod_id: id,
    vod_name: detail.title,
    vod_pic: detail.poster,
    vod_remarks: detail.videos.length ? `${detail.images.length} 图 · ${detail.videos.length} 视频` : `${detail.images.length} 图`,
    vod_blurb: [detail.author && `作者：${detail.author}`, detail.datePublished && `发布于：${detail.datePublished.slice(0, 10)}`].filter(Boolean).join(" · "),
    vod_content: detail.description || "",
    type_name: detail.categories[0] || "每日大赛",
    vod_area: "每日大赛",
    media_gallery: detail.images,
    videos: detail.videos.map((video) => ({ url: video.url, type: video.type })),
    vod_play_url: primary?.url || "",
    media_kind: detail.videos.length ? "video" : "gallery",
    needs_detail: false,
    provider: "mr",
  }, { headers: { "cache-control": "no-store" } });
}

async function mrPlay(id, index) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const selected = Number.isInteger(Number(index)) && Number(index) > 0 ? Number(index) : 0;
  let html;
  try {
    html = await mrPage(`/archives/${id}/`);
  } catch {
    return json({ message: "帖子已从主站删除，仅图集可用" }, { status: 404 });
  }
  const detail = qiyingExtractDetail(html, id, "每日大赛");
  const video = detail.videos[selected];
  if (!video) return json({ message: selected ? `此帖子没有第 ${selected + 1} 个公开视频` : "此帖子没有公开视频" }, { status: 404 });
  return json({ vod_id: id, video: video.url, poster: detail.poster || detail.images[0] || "", provider: "mr" }, {
    headers: { "cache-control": "no-store" },
  });
}

async function mrList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("page")) || 1);
  const category = requestUrl.searchParams.get("category") || "";
  const q = (requestUrl.searchParams.get("q") || "").trim();
  let pathname;
  if (q) pathname = `/search/${encodeURIComponent(q)}/`;
  else if (category) pathname = page <= 1 ? `/category/${category}/` : `/category/${category}/${page}/`;
  else pathname = page <= 1 ? "/" : `/page/${page}/`;
  const html = await mrPage(pathname);
  const items = qiyingParseCards(html);
  const pager = html.match(/page-info">\s*(\d+)\s*\/\s*(\d+)/);
  const current = Number(pager?.[1]) || 1;
  const total = q ? Math.max(1, Math.ceil(items.length / 30)) : Number(pager?.[2]) || Math.max(current, page);
  return json({
    items,
    page: current,
    totalPages: total,
    note: q ? "search" : category ? "category" : "latest",
    provider: "mr",
  }, { headers: { "cache-control": "public, max-age=60" } });
}

const JM_CATEGORIES = [
  ["", "全部禁漫"], ["rb", "日本H漫"], ["hg", "韩国H漫"], ["jq", "剧情"], ["xy", "校园"],
  ["aq", "爱情"], ["bl", "BL"], ["qh", "奇幻"], ["tj", "调教"], ["ll", "乱伦"],
  ["dp", "短篇"], ["db", "单本"], ["tr", "同人"],
];
const JM_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 CFNav-Independent/2.0",
};

function jmImageUrl(url = "") {
  if (!url) return "";
  return url.replace(/^https?:\/\/pic\.[a-z0-9.-]+\.cn/, QIYING_IMG_CDN).split("?")[0];
}

async function jmPage(pathname, mirrors = [JM_ORIGIN, ...JM_MIRRORS]) {
  let lastError;
  for (const origin of mirrors) {
    try {
      const response = await fetch(new URL(pathname, origin), {
        headers: JM_HEADERS,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        lastError = new Error(`jm page ${response.status}`);
        continue;
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("jm page unavailable");
}

function jmDecode(value = "") {
  return decodeHtml(value).replace(/&amp;/g, "&");
}

function jmParseCards(html) {
  const items = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]+href="(\/comic\/detail\/(\d+))"[^>]*>([\s\S]{0,4000}?)(?:<\/a>|<a\s)/g)) {
    const id = match[2];
    const block = match[3];
    const title = jmDecode((block.match(/alt="([^"]*)"/) || [])[1] || "");
    const cover = jmImageUrl((block.match(/data-src="([^"]+)"/) || [])[1] || "");
    const done = /完结|已完结/.test(block) ? "完结" : "";
    const serial = /连载|更新中/.test(block) ? "连载" : "";
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    items.push({ p: id, t: title, r: cover, k: [done || serial || "漫画"], hot: false, jm: true });
  }
  return items;
}

async function jmDetail(id) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const html = await jmPage(`/comic/detail/${id}/`);
  const title = jmDecode((html.match(/<title>([^<]*)<\/title>/)?.[1] || "").replace(/\s*\|.*$/, "") || `禁漫 ${id}`);
  const desc = jmDecode((html.match(/<meta name="description" content="([^"]*)"/)?.[1] || ""));
  const author = jmDecode((html.match(/作者[：:]\s*([^<\n]{1,50})/) || [])[1]?.replace(/\s+/g, " ").trim() || "");
  const info = html.match(/data-comic-info="([^"]+)"/);
  let categories = [];
  let tags = [];
  if (info) {
    try {
      const parsed = JSON.parse(decodeURIComponent(info[1]));
      categories = parsed.comic_type_name ? [parsed.comic_type_name] : [];
      tags = (parsed.comic_tag_name || "").split(",").map((t) => t.trim()).filter(Boolean);
    } catch { /* ignore */ }
  }
  const chapters = [];
  const seenChapters = new Set();
  for (const match of html.matchAll(/<a[^>]*class=['"][^'"]*detail-page__catalog-item[^'"]*['"][^>]*href="(\/comic\/chapter\/(\d+)\/(\d+))"[^>]*>([\s\S]{0,2000}?)(?:<\/a>|<a\s)/g)) {
    const chapterId = match[3];
    if (match[2] !== id || seenChapters.has(chapterId)) continue;
    seenChapters.add(chapterId);
    const badge = (match[4].match(/chapter-badge[^>]*>([^<]*)/) || [])[1] || "";
    const titleText = (match[4].match(/chapter-title[^>]*>([^<]*)/) || [])[1] || "";
    const name = jmDecode(`${badge.trim()}${titleText.trim() ? " " + titleText.trim() : ""}`.trim()) || `第${chapterId}话`;
    chapters.push({ id: chapterId, name });
  }
  const cover = jmImageUrl((html.match(/data-src="(https:\/\/pic\.[^"]+)/) || [])[1] || "");
  return json({
    vod_id: id,
    vod_name: title,
    vod_pic: cover,
    vod_remarks: chapters.length ? `${chapters.length} 话` : "漫画",
    vod_blurb: [author && `作者：${author}`, categories[0] && `类型：${categories[0]}`].filter(Boolean).join(" · "),
    vod_content: desc,
    type_name: categories[0] || "漫画",
    vod_area: "禁漫天堂",
    chapters,
    media_kind: "comic",
    needs_detail: false,
    provider: "jm",
  }, { headers: { "cache-control": "no-store" } });
}

async function jmChapter(id, chapterId) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  let html;
  try {
    html = await jmPage(`/comic/chapter/${id}/${chapterId}/`);
  } catch {
    return json({ message: "章节不存在或已删除" }, { status: 404 });
  }
  const title = jmDecode((html.match(/<title>([^<]*)<\/title>/)?.[1] || `第${chapterId}话`).replace(/\s*\|.*$/, ""));
  const images = [...new Set((html.match(/data-src="(https:\/\/[^"]+)"/g) || []).map((m) => m.replace(/data-src="|"/g, "")))].filter((u) => /pic\.|\.(jpe?g|png|webp|gif)/i.test(u)).map(jmImageUrl);
  if (!images.length) return json({ message: "此章节没有可读图片" }, { status: 404 });
  return json({
    vod_id: id,
    chapter_id: chapterId,
    vod_name: title,
    images,
    total: images.length,
    provider: "jm",
  }, { headers: { "cache-control": "no-store" } });
}

async function jmList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("page")) || 1);
  const category = requestUrl.searchParams.get("category") || "";
  const q = (requestUrl.searchParams.get("q") || "").trim();
  const scope = requestUrl.searchParams.get("scope") || "all";
  let pathname;
  if (q) {
    pathname = `/comic/search/${encodeURIComponent(q)}/`;
  } else if (scope === "rank") {
    pathname = "/comic/rank/";
  } else if (scope === "hot") {
    pathname = "/comic/hot/";
  } else if (scope === "newest") {
    pathname = "/comic/newest/";
  } else if (scope === "freshest") {
    pathname = "/comic/freshest/";
  } else if (category) {
    pathname = page <= 1 ? `/comic/all/${category}/` : `/comic/all/${category}/${page}/`;
  } else {
    pathname = page <= 1 ? "/comic/all/" : `/comic/all/page/${page}/`;
  }
  const html = await jmPage(pathname);
  const items = jmParseCards(html);
  let total = 1;
  const totalMatch = html.match(/dx-filter-total[^>]*>（(\d+)）/);
  if (totalMatch) total = Number(totalMatch[1]) || 1;
  const pagerMatch = html.match(/class="pager"[^>]*data-link="([^"]+)"/);
  const perPage = items.length || 48;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return json({
    items,
    page,
    totalPages,
    note: q ? "search" : scope === "rank" ? "rank" : scope === "hot" ? "hot" : scope === "newest" ? "newest" : scope === "freshest" ? "freshest" : category ? "category" : "latest",
    provider: "jm",
  }, { headers: { "cache-control": "public, max-age=60" } });
}

const MADOU_ORIGIN = "https://madou.club";
const MADOU_DASH = "https://dash.madou.club";
const MADOU_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) CFNav-Independent/2.0",
};
const MADOU_CATEGORY_SLUGS = {
  麻豆传媒: "麻豆传媒", 麻豆番外篇: "麻豆番外篇", 麻豆花絮: "麻豆花絮",
  HongKongDoll: "hongkongdoll", PsychopornTW: "psychoporntw", "91制片厂": "91制片厂",
  果冻传媒: "果冻传媒", 蜜桃影像: "蜜桃影像", 天美传媒: "天美传媒",
  皇家华人: "皇家华人", 兔子先生: "兔子先生", 星空无限传媒: "星空无限传媒",
  爱豆: "爱豆", 麻豆导演系列: "麻豆导演系列", 大象传媒: "大象传媒",
  猫爪影像: "猫爪影像", 精东影业: "精东影业", 杏吧: "杏吧",
  乐播传媒: "乐播传媒", 草莓: "草莓", 抖阴: "抖阴",
  SA国际传媒: "sa国际传媒", 起点传媒性视界传媒: "起点传媒-性视界传媒", 大鸟十八: "大鸟十八",
  小鹏奇啪行: "小鹏奇啪行", 女优淫娃培训营: "女优淫娃培训营", 淫欲游戏王: "淫欲游戏王",
  女神羞羞研究所: "女神羞羞研究所", 突袭女优家: "突袭女优家", 情趣K歌房: "情趣k歌房",
  KISS糖果屋: "kiss糖果屋",
};
const MADOU_BADGES = { likes: "点赞排行", week: "7天热门", month: "30天热门" };

async function madouPage(pathname, params = {}) {
  const url = new URL(pathname, MADOU_ORIGIN);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  const cacheKey = url.href;
  const cached = madouPageCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.html;
  const response = await fetch(url, { headers: MADOU_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`madou page ${response.status}`);
  const html = await response.text();
  if (madouPageCache.size > 40) madouPageCache.clear();
  madouPageCache.set(cacheKey, { html, expires: Date.now() + 90_000 });
  return html;
}
const madouPageCache = new Map();

function madouParseCards(html) {
  const cards = [];
  for (const article of html.matchAll(/<article class="excerpt[^"]*">([\s\S]*?)<\/article>/g)) {
    const block = article[1];
    const title = decodeHtml(block.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1] || block.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1] || "");
    const path = block.match(/<a[^>]*class="thumbnail"[^>]*href="([^"]+)"/)?.[1] || "";
    const cover = block.match(/data-src="([^"]+)"/)?.[1] || "";
    const pid = block.match(/post-like[^>]*data-pid="(\d+)"/)?.[1] || "";
    const likes = block.match(/post-like[^>]*[\s\S]{0,200}?<span>(\d+)<\/span>/)?.[1] || "";
    const views = block.match(/post-view">观看\(([^)]+)\)/)?.[1] || "";
    const category = decodeHtml(block.match(/rel="category tag">([^<]+)</)?.[1] || "");
    if (!title && !path) continue;
    const cleanPath = path.startsWith(MADOU_ORIGIN) ? path.slice(MADOU_ORIGIN.length) : path;
    cards.push({
      vod_id: cleanPath || pid,
      vod_name: title || "未命名",
      vod_pic: cover,
      vod_remarks: [category, views && `观看 ${views}`, likes && `赞 ${likes}`].filter(Boolean).join(" · ") || "可播放",
      vod_blurb: category || "",
      type_name: category || "麻豆社",
      vod_area: "madou.club",
      media_kind: "video",
      needs_detail: true,
      path: cleanPath,
    });
  }
  return cards;
}

function madouPageCount(html, page) {
  const nextRel = html.match(/<link rel="next" href="[^"]*\/page\/(\d+)\//);
  const nextLink = html.match(/href="[^"]*\/page\/(\d+)\/[^"]*"[^>]*>下一页|class="next[^"]*"[^>]*href="[^"]*\/page\/(\d+)\//);
  const next = nextRel?.[1] || nextLink?.[2] || (html.includes("/page/" + (page + 1)) ? String(page + 1) : "");
  return Math.max(page, ...(next ? [Number(next)] : []));
}

async function madouList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd")?.trim() || "";
  const preset = requestUrl.searchParams.get("preset")?.trim() || "";
  let html;
  if (keyword) {
    html = await madouPage("/", { s: keyword });
  } else if (preset === "likes") {
    html = await madouPage("/likes");
  } else if (preset === "week") {
    html = await madouPage("/week");
  } else if (preset === "month") {
    html = await madouPage("/month");
  } else if (preset && MADOU_CATEGORY_SLUGS[preset]) {
    html = await madouPage(`/category/${encodeURIComponent(MADOU_CATEGORY_SLUGS[preset])}/`, page > 1 ? { page } : {});
  } else {
    html = await madouPage("/", page > 1 ? { page } : {});
  }
  const list = madouParseCards(html).slice(0, 24);
  const pagecount = keyword ? 1 : madouPageCount(html, page);
  return json({
    code: 1,
    page,
    pagecount,
    limit: 24,
    total: pagecount * 24,
    list,
    provider: "madou",
  }, { headers: { "cache-control": keyword ? "public, max-age=60" : "public, max-age=120" } });
}

async function madouDetail(id) {
  let path = "";
  if (typeof id === "string" && id.startsWith("/")) {
    path = id;
  } else if (typeof id === "string" && /^[\w%._-]+$/.test(id) && !/^\d+$/.test(id)) {
    path = decodeURIComponent(id);
    if (!path.startsWith("/")) path = "/" + path;
  }
  let html;
  if (path) {
    html = await madouPage(path);
  } else {
    html = await madouPage("/");
  }
  const title = decodeHtml(html.match(/<h1 class="article-title">([\s\S]*?)<\/h1>/)?.[1] || html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || "");
  const shareIframe = html.match(/<iframe[^>]+src=["']?(https:\/\/dash\.madou\.club\/share\/[0-9a-f]+)/)?.[1];
  const shareId = shareIframe?.match(/share\/([0-9a-f]+)/)?.[1] || "";
  const pid = html.match(/action-like[^>]*data-pid="(\d+)"/)?.[1] || "";
  const likes = html.match(/action-like[^>]*[\s\S]{0,200}?赞\(<span>(\d+)<\/span>/)?.[1] || "";
  const views = html.match(/观看\(([^)]+)\)/)?.[1] || "";
  const categories = [...new Set([...html.matchAll(/rel="category tag">([^<]+)</g)].map((m) => decodeHtml(m[1])))];
  const tags = [...new Set([...html.matchAll(/<div class="article-tags">[\s\S]*?<\/div>/g)].map((m) => [...m[0].matchAll(/rel="tag">([^<]+)</g)].map((t) => decodeHtml(t[1]))).flat())];
  const poster = html.match(/shareimage\s*:\s*'([^']+)'/)?.[1] || "";
  const shareUrl = shareIframe || "";
  const play = shareId ? await madouResolvePlay(shareId) : null;
  return json({
    vod_id: pid || id || shareId,
    vod_name: title || "未命名",
    vod_pic: poster,
    vod_remarks: [categories[0], views && `观看 ${views}`, likes && `赞 ${likes}`].filter(Boolean).join(" · ") || "VIDEO",
    vod_blurb: [views && `观看(${views})`, likes && `点赞 ${likes}`].filter(Boolean).join(" · "),
    vod_content: tags.join(" · "),
    type_name: categories[0] || "麻豆社",
    vod_area: "madou.club",
    vod_play_url: play?.video || "",
    media_kind: "video",
    share_id: shareId,
    needs_detail: false,
    provider: "madou",
  }, { headers: { "cache-control": "no-store" } });
}

async function madouResolvePlay(shareId) {
  const response = await fetch(`${MADOU_DASH}/share/${shareId}`, { headers: MADOU_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`madou dash ${response.status}`);
  const html = await response.text();
  const m3u8 = html.match(/var m3u8 = '([^']+)'/)?.[1];
  const token = html.match(/var token = "([^"]+)"/)?.[1];
  const poster = html.match(/pic: '([^']+)'/)?.[1] || "";
  if (!m3u8) throw new Error("madou share unavailable");
  const playUrl = new URL(m3u8, MADOU_DASH);
  if (token) playUrl.searchParams.set("token", token);
  return { video: playUrl.href, poster: poster ? new URL(poster, MADOU_DASH).href : "" };
}

async function madouPlay(id) {
  if (!/^[0-9a-f]{20,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const play = await madouResolvePlay(id);
  return json({ vod_id: id, video: play.video, poster: play.poster, provider: "madou" }, {
    headers: { "cache-control": "no-store" },
  });
}

let iptvCatalogCache;
let iptvCatalogExpires = 0;

async function iptvCatalog() {
  if (iptvCatalogCache && Date.now() < iptvCatalogExpires) return iptvCatalogCache;
  const [streamsResponse, channelsResponse, logosResponse] = await Promise.all([
    fetch("https://iptv-org.github.io/api/streams.json"),
    fetch("https://iptv-org.github.io/api/channels.json"),
    fetch("https://iptv-org.github.io/api/logos.json"),
  ]);
  if (!streamsResponse.ok || !channelsResponse.ok || !logosResponse.ok) {
    throw new Error("iptv-org catalog unavailable");
  }
  const [streams, channels, logos] = await Promise.all([
    streamsResponse.json(), channelsResponse.json(), logosResponse.json(),
  ]);
  const channelMap = new Map(channels.map((channel) => [channel.id, channel]));
  const logoMap = new Map();
  logos.forEach((logo) => {
    if (logo.channel && logo.url && logo.in_use && !logoMap.has(logo.channel)) logoMap.set(logo.channel, logo.url);
  });
  const seen = new Set();
  iptvCatalogCache = streams.filter((stream) => {
    const channel = channelMap.get(stream.channel);
    if (!channel || channel.country !== "CN" || channel.is_nsfw || seen.has(stream.channel)) return false;
    if (!/^https:\/\//i.test(stream.url || "") || !/\.m3u8(?:$|\?)/i.test(stream.url || "")) return false;
    if (stream.referrer || stream.user_agent) return false;
    seen.add(stream.channel);
    return true;
  }).map((stream) => {
    const channel = channelMap.get(stream.channel);
    return {
      vod_id: stream.channel,
      vod_name: channel.name,
      vod_pic: logoMap.get(stream.channel) || "",
      vod_remarks: stream.quality || "LIVE",
      vod_play_url: stream.url,
      vod_content: [channel.network, ...(channel.alt_names || [])].filter(Boolean).join(" · "),
      vod_area: "中国电视",
      type_name: (channel.categories || ["live"])[0],
      media_kind: "video",
      provider: "iptvorg",
    };
  });
  iptvCatalogExpires = Date.now() + 30 * 60 * 1000;
  return iptvCatalogCache;
}

async function iptvOrgList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const search = requestUrl.searchParams.get("wd")?.trim().toLowerCase() || "";
  const all = await iptvCatalog();
  const filtered = search ? all.filter((item) => `${item.vod_name} ${item.vod_content} ${item.vod_id}`.toLowerCase().includes(search)) : all;
  const limit = 24;
  const list = filtered.slice((page - 1) * limit, page * limit);
  return json({ code: 1, page, pagecount: Math.max(1, Math.ceil(filtered.length / limit)), limit, total: filtered.length, list, provider: "iptvorg" }, {
    headers: { "cache-control": search ? "public, max-age=60" : "public, max-age=300" },
  });
}

const OXAX_CHANNELS = [
  ["oh-ah", "ОХ-АХ HD", 1, ["brand", "hd"]],
  ["superone-hd", "Superone HD", 2, ["brand", "hd"]],
  ["sl-hot1", "CineMan XXX HD", 3, ["brand", "hd", "porno"]],
  ["sl-hot2", "CineMan XXX2 HD", 4, ["brand", "hd", "porno"]],
  ["brazzers-tv-europe", "Brazzers TV Europe", 5, ["brand", "porno"]],
  ["brazzers-tv", "Brazzers TV", 6, ["brand", "porno"]],
  ["red-lips", "Red Lips", 7, ["brand", "erotic"]],
  ["kino-xxx", "KinoXXX", 8, ["brand", "porno"]],
  ["xy-max-hd", "XY Max HD", 9, ["brand", "hd"]],
  ["xy-plus-hd", "XY Plus HD", 10, ["brand", "hd"]],
  ["xy-mix-hd", "XY Mix HD", 11, ["brand", "hd"]],
  ["barely-legal", "Barely legal", 12, ["brand", "porno"]],
  ["playboy-tv", "Playboy TV", 13, ["brand", "erotic"]],
  ["vivid-red", "Vivid Red HD", 14, ["brand", "hd", "porno"]],
  ["hot-pleasure", "Exxxotica HD", 15, ["brand", "hd", "porno"]],
  ["babes-tv", "Babes TV", 16, ["brand", "porno"]],
  ["russkaya-noch", "Русская ночь", 17, ["brand", "porno"]],
  ["pink-o", "Pink O TV", 18, ["brand", "erotic"]],
  ["erox-hd", "Erox HD", 19, ["brand", "hd", "erotic"]],
  ["eroxxx-hd", "Eroxxx HD", 20, ["brand", "hd", "erotic", "porno"]],
  ["hustler-hd", "Hustler HD", 21, ["brand", "hd", "porno"]],
  ["private-tv", "Private TV", 22, ["brand", "porno"]],
  ["redlight-hd", "Redlight HD", 23, ["brand", "hd", "porno"]],
  ["penthouse-gold", "Penthouse Gold HD", 24, ["brand", "hd", "porno"]],
  ["penthouse-2", "Penthouse Quickies", 25, ["brand", "porno"]],
  ["o-la-la", "O-la-la", 26, ["brand", "erotic"]],
  ["blue-hustler", "Blue Hustler", 27, ["brand", "porno"]],
  ["shalun", "Шалун", 28, ["brand", "porno"]],
  ["dorcel-tv", "Dorcel TV", 29, ["brand", "porno"]],
  ["extasyhd", "Extasy HD", 30, ["brand", "hd"]],
  ["xxl", "XXL", 31, ["brand", "porno"]],
  ["fap-tv-2", "FAP TV 2", 32, ["brand", "porno"]],
  ["fap-tv-3", "FAP TV 3", 33, ["brand", "porno"]],
  ["fap-tv-4", "FAP TV 4", 34, ["brand", "porno"]],
  ["fap-tv-parody", "FAP TV Parody", 35, ["brand", "porno"]],
  ["fap-tv-compilation", "FAP TV Compilation", 36, ["brand", "porno"]],
  ["fap-tv-anal", "FAP TV Anal", 37, ["brand", "porno"]],
  ["fap-tv-teens", "FAP TV Teens", 38, ["brand", "porno"]],
  ["fap-tv-lesbian", "FAP TV Lesbian", 39, ["brand", "porno"]],
  ["fap-tv-bbw", "FAP TV BBW", 40, ["brand", "porno"]],
  ["fap-tv-trans", "FAP TV Trans", 41, ["brand", "porno"]],
];

const MYCAM_CHANNELS = [
  ["aitv-mycamtv-milf", "MyCamTV MILF", "mycamtv/milf.m3u8"],
  ["aitv-mycamtv-mature", "MyCamTV Mature", "mycamtv/mature.m3u8"],
  ["aitv-mycamtv-arab-girls", "MyCamTV Arab Girls", "mycamtv/arab-girls.m3u8"],
  ["aitv-mycamtv-ebony-girls", "MyCamTV Ebony Girls", "mycamtv/ebony-girls.m3u8"],
  ["aitv-mycamtv-asian-girls", "MyCamTV Asian Girls", "mycamtv/asian-girls.m3u8"],
  ["aitv-mycamtv-brunette-girls", "MyCamTV Brunette Girls", "mycamtv/brunette-girls.m3u8"],
  ["aitv-mycamtv-latina-girls", "MyCamTV Latina Girls", "mycamtv/latina-girls.m3u8"],
  ["aitv-mycamtv-white-girls", "MyCamTV White Girls", "mycamtv/white-girls.m3u8"],
  ["aitv-mycamtv-blonde-girls", "MyCamTV Blonde Girls", "mycamtv/blonde-girls.m3u8"],
  ["aitv-mycamtv-anal", "MyCamTV Anal", "mycamtv/anal.m3u8"],
  ["aitv-mycamtv-big-ass-girls", "MyCamTV Big Ass Girls", "mycamtv/big-ass-girls.m3u8"],
  ["aitv-mycamtv-girls-squirt", "MyCamTV Girls Squirt", "mycamtv/girls-squirt.m3u8"],
  ["aitv-mycamtv-skinny-girls", "MyCamTV Skinny Girls", "mycamtv/skinny-girls.m3u8"],
  ["aitv-mycamtv-medium-girls", "MyCamTV Medium Girls", "mycamtv/medium-girls.m3u8"],
  ["aitv-mycamtv-blowjob", "MyCamTV Blowjob", "mycamtv/blowjob.m3u8"],
];

const ADULTIPTV_CHANNELS = [
  ["aitv-adultiptv-net-live-cams", "AdultIPTV.net Live Cams", "livecams"],
  ["aitv-adultiptv-net-milf", "AdultIPTV.net MILF", "milf"],
  ["aitv-adultiptv-net-big-dick", "AdultIPTV.net Big Dick", "bigdick"],
  ["aitv-adultiptv-net-big-tits", "AdultIPTV.net Big Tits", "bigtits"],
  ["aitv-adultiptv-net-fetish", "AdultIPTV.net Fetish", "fetish"],
  ["aitv-adultiptv-net-pornstar", "AdultIPTV.net Pornstar", "pornstar"],
  ["aitv-adultiptv-net-big-ass", "AdultIPTV.net Big Ass", "bigass"],
  ["aitv-adultiptv-net-interracial", "AdultIPTV.net Interracial", "interracial"],
  ["aitv-adultiptv-net-latina", "AdultIPTV.net Latina", "latina"],
  ["aitv-adultiptv-net-pov", "AdultIPTV.net POV", "pov"],
  ["aitv-adultiptv-net-blowjob", "AdultIPTV.net Blowjob", "blowjob"],
  ["aitv-adultiptv-net-hardcore", "AdultIPTV.net Hardcore", "hardcore"],
  ["aitv-adultiptv-net-cuckold", "AdultIPTV.net Cuckold", "cuckold"],
  ["aitv-adultiptv-net-threesome", "AdultIPTV.net Threesome", "threesome"],
  ["aitv-adultiptv-net-russian", "AdultIPTV.net Russian", "russian"],
  ["aitv-adultiptv-net-lesbian", "AdultIPTV.net Lesbian", "lesbian"],
  ["aitv-adultiptv-net-rough", "AdultIPTV.net Rough", "rough"],
  ["aitv-adultiptv-net-gangbang", "AdultIPTV.net Gangbang", "gangbang"],
  ["aitv-adultiptv-net-anal", "AdultIPTV.net Anal", "anal"],
  ["aitv-adultiptv-net-compilation", "AdultIPTV.net Compilation", "compilation"],
  ["aitv-adultiptv-net-brunette", "AdultIPTV.net Brunette", "brunette"],
  ["aitv-adultiptv-net-blonde", "AdultIPTV.net Blonde", "blonde"],
  ["aitv-adultiptv-net-gay", "AdultIPTV.net Gay", "gay"],
  ["aitv-adultiptv-net-asian", "AdultIPTV.net Asian", "asian"],
];

function adultTvCatalog() {
  const oxax = OXAX_CHANNELS.map(([slug, title, channelId, tags]) => ({
    vod_id: slug,
    vod_name: title,
    vod_pic: "",
    vod_remarks: tags.includes("hd") ? "LIVE · HD" : "LIVE",
    vod_content: tags.map((tag) => ({ brand: "品牌", hd: "HD", erotic: "情色", porno: "成人" }[tag])).filter(Boolean).join(" · "),
    vod_area: "oxax.tv",
    type_name: "品牌TV",
    media_kind: "video",
    needs_detail: true,
    live_provider: "oxax",
    live_channel_id: channelId,
    provider: "adulttv",
  }));
  const mycam = MYCAM_CHANNELS.map(([slug, title, path]) => ({
    vod_id: slug,
    vod_name: title,
    vod_pic: "",
    vod_remarks: "LIVE · CAM",
    vod_content: "主题 · Cam · 成人",
    vod_area: "AdultIPTV",
    type_name: "主题源",
    media_kind: "video",
    needs_detail: false,
    vod_play_url: oxaxProxyUrl(new URL("http://local"), slug, "", "manifest").replace("http://local", ""),
    live_provider: "adultiptv",
    live_path: path,
    provider: "adulttv",
  }));
  const themes = ADULTIPTV_CHANNELS.map(([slug, title, path]) => ({
    vod_id: slug,
    vod_name: title,
    vod_pic: "",
    vod_remarks: "LIVE",
    vod_content: "主题 · 成人",
    vod_area: "cdn.adultiptv.net",
    type_name: "主题源",
    media_kind: "video",
    needs_detail: false,
    vod_play_url: oxaxProxyUrl(new URL("http://local"), slug, "", "manifest").replace("http://local", ""),
    live_provider: "adultiptv",
    live_path: `${path}.m3u8`,
    provider: "adulttv",
  }));
  return [...oxax, ...mycam, ...themes];
}

export function parseOxaxStreamPage(html) {
  const directCandidates = [
    ...html.matchAll(/https?:\\?\/\\?\/(?:s\.oxax\.tv|r\.pokaz\.me)\\?\/[A-Za-z0-9_?&=.%+\-\\/]+/g),
  ].map((match) => match[0].replace(/\\\//g, "/").replace(/&amp;/g, "&"));
  const direct = directCandidates.find((value) => /\.m3u8(?:$|\?)/i.test(value));
  if (direct) return direct;

  const kodk = html.match(/\bkodk\s*=\s*["']([^"']+)["']/i)?.[1];
  const kos = html.match(/\bkos\s*=\s*["']([^"']+)["']/i)?.[1];
  const playerArgument = html.match(/new\s+Playerjs\s*\(\s*["']([^"']+)["']/i)?.[1];
  if (!kodk || !kos || !playerArgument) throw new Error("oxax stream metadata unavailable");

  const marker = "FNTU2Rz";
  const encoded = playerArgument.slice(2);
  let playerConfig = null;
  let attempts = 0;
  const visit = (value) => {
    if (playerConfig || attempts > 20_000) return;
    const markerIndex = value.indexOf(marker);
    if (markerIndex < 0) {
      attempts += 1;
      try {
        const parsed = JSON.parse(atob(value));
        if (
          typeof parsed?.file === "string" &&
          /https:\/\/s\.oxax\.tv\/\{v1\}[^{}\s"']+\{v2\}[^{}\s"']+/i.test(parsed.file)
        ) playerConfig = parsed.file;
      } catch {
        // A wrong marker length produces invalid Base64 or JSON; try another.
      }
      return;
    }
    for (let length = marker.length; length <= Math.min(24, value.length - markerIndex); length += 1) {
      visit(value.slice(0, markerIndex) + value.slice(markerIndex + length));
      if (playerConfig) return;
    }
  };
  visit(encoded);
  if (!playerConfig) throw new Error("oxax player metadata unavailable");

  const template = playerConfig.match(/https:\/\/s\.oxax\.tv\/\{v1\}([^{}\s"']+)\{v2\}([^{}\s"']+)/i);
  if (!template) throw new Error("oxax player template unavailable");
  const stream = `https://s.oxax.tv/${kodk}${template[1]}${kos}${template[2]}`;
  const parsed = new URL(stream);
  if (parsed.hostname !== "s.oxax.tv" || !/\.m3u8$/i.test(parsed.pathname)) throw new Error("invalid oxax stream url");
  return parsed.href;
}

async function resolveOxaxStream(channelSlug) {
  // oxax serves its public pages over HTTP; its current HTTPS certificate is
  // issued for another host. The reference player uses the same HTTP source.
  const pageResponse = await fetch(`http://oxax.tv/${channelSlug}.html`, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!pageResponse.ok) throw new Error(`oxax page ${pageResponse.status}`);
  const html = await pageResponse.text();
  return {
    stream: parseOxaxStreamPage(html),
    title: decodeHtml(html.match(/<title>([^<]+)/i)?.[1] || ""),
  };
}

const OXAX_MEDIA_HOSTS = new Set(["s.oxax.tv", "r.pokaz.me"]);

function allowedAdultTvMediaUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && (OXAX_MEDIA_HOSTS.has(parsed.hostname) || parsed.hostname === "cdn.adultiptv.net") ? parsed : null;
  } catch {
    return null;
  }
}

function oxaxProxyUrl(requestUrl, id, source, type = "segment") {
  const proxy = new URL("/provider-api/adulttv", requestUrl.origin);
  proxy.searchParams.set("action", "media");
  proxy.searchParams.set("type", type);
  proxy.searchParams.set("id", id);
  proxy.searchParams.set("url", source);
  return proxy.href;
}

async function adultTvMedia(requestUrl) {
  const id = requestUrl.searchParams.get("id") || "";
  if (!/^[a-z0-9-]+$/i.test(id)) return json({ message: "invalid id" }, { status: 400 });
  const channel = adultTvCatalog().find((item) => item.vod_id === id);
  if (!channel) return json({ message: "channel unavailable" }, { status: 404 });
  const type = requestUrl.searchParams.get("type") || "manifest";
  if (!new Set(["manifest", "segment"]).has(type)) return json({ message: "invalid media type" }, { status: 400 });
  let source = allowedAdultTvMediaUrl(requestUrl.searchParams.get("url") || "");
  if (!source && type === "manifest") {
    if (channel.live_provider === "oxax") {
      const resolved = await resolveOxaxStream(id);
      source = allowedAdultTvMediaUrl(resolved.stream);
    } else {
      source = new URL(channel.live_path, "https://cdn.adultiptv.net/").href;
    }
  }
  if (!source) return json({ message: "invalid media source" }, { status: 400 });

  if (type === "manifest" && channel.live_provider === "oxax") {
    // s.oxax.tv rejects Cloudflare datacenter IPs (404) but serves residential
    // browsers directly (ACAO echoes Origin). Let the browser fetch the
    // signed session stream itself via a redirect instead of proxying.
    return Response.redirect(source, 302);
  }

  const upstream = await fetch(source, {
    headers: {
      accept: type === "manifest" ? "application/vnd.apple.mpegurl, application/x-mpegURL, */*" : "*/*",
      referer: channel.live_provider === "oxax" ? `http://oxax.tv/${id}.html` : "https://cdn.adultiptv.net/",
      "user-agent": "Mozilla/5.0 CFNav-Independent/2.0",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!upstream.ok) return json({ message: `adulttv media ${upstream.status}` }, { status: 502 });
  if (type === "manifest") {
    // AdultIPTV CDN only serves real TS segments at the ROOT path (mycamtv/
    // subpath segment requests fall back to a playlist and stall hls.js);
    // rewrite every segment line to https://cdn.adultiptv.net/{basename}.
    const rewritten = (await upstream.text()).split(/\r?\n/).map((line) => {
      if (!line || line.startsWith("#")) return line;
      return `https://cdn.adultiptv.net/${line.split("/").pop()}`;
    }).join("\n");
    return new Response(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "video/mp2t",
      "cache-control": "public, max-age=30",
      "access-control-allow-origin": "*",
    },
  });
}

async function adultTvDetail(id) {
  if (!/^[a-z0-9-]+$/i.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const item = adultTvCatalog().find((entry) => entry.vod_id === id);
  if (!item) return json({ message: "channel unavailable" }, { status: 404 });
  let stream = "";
  let title = item.vod_name;
  if (item.live_provider === "adultiptv") {
    stream = oxaxProxyUrl(new URL("http://local"), item.vod_id, "", "manifest").replace("http://local", "");
  } else {
    try {
      const resolved = await resolveOxaxStream(item.vod_id);
      stream = oxaxProxyUrl(new URL("http://local"), item.vod_id, resolved.stream, "manifest").replace("http://local", "");
      title = resolved.title || title;
    } catch {
      return json({ message: "oxax 品牌频道当前无法独立解析" }, { status: 503 });
    }
  }
  return json({
    ...item,
    vod_name: title,
    vod_play_url: stream,
    needs_detail: false,
  }, { headers: { "cache-control": item.live_provider === "oxax" ? "no-store" : "public, max-age=60" } });
}

async function adultTvList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const search = requestUrl.searchParams.get("wd")?.trim().toLowerCase() || "";
  const all = adultTvCatalog();
  const filtered = search ? all.filter((item) => `${item.vod_name} ${item.vod_content} ${item.vod_id}`.toLowerCase().includes(search)) : all;
  const limit = 24;
  const list = filtered.slice((page - 1) * limit, page * limit);
  const pagecount = Math.max(1, Math.ceil(filtered.length / limit));
  return json({ code: 1, page, pagecount, totalPages: pagecount, limit, total: filtered.length, list, provider: "adulttv" }, {
    headers: { "cache-control": search ? "public, max-age=60" : "public, max-age=180" },
  });
}

const MISSAV_ORIGIN = "https://missav.media";
const MISSAV_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CFNav-Independent/2.0",
};
const MISSAV_SECTION_KEYS = ["new", "release", "today-hot", "weekly-hot", "monthly-hot", "chinese-subtitle", "uncensored-leak", "fc2", "heyzo", "siro"];

async function missavPage(pathname, params = {}) {
  const url = new URL(pathname, MISSAV_ORIGIN);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: MISSAV_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`missav page ${response.status}`);
  return response.text();
}

function missavAsset(code, kind) {
  return `https://fourhoi.mrstcdn.store/${code}/${kind}`;
}

function parseMissavCards(html) {
  const cards = [];
  const seen = new Set();
  const pattern = /data-src="https:\/\/fourhoi\.mrstcdn\.store\/([a-z0-9-]+)\/cover-t\.jpg"[\s\S]{0,900}?alt="([^"]*)"/g;
  for (const match of html.matchAll(pattern)) {
    const code = match[1];
    if (seen.has(code)) continue;
    seen.add(code);
    const block = html.slice(match.index, match.index + 3000);
    const duration = block.match(/class="[^"]*missav_media-text-xs[^"]*"[^>]*>\s*([^<]{1,15}?)</)?.[1] || "";
    cards.push({
      vod_id: code,
      vod_name: decodeHtml(match[2]) || code.toUpperCase(),
      vod_pic: missavAsset(code, "cover-t.jpg"),
      vod_remarks: duration || "VIDEO",
      vod_blurb: code.toUpperCase(),
      vod_content: code.toUpperCase(),
      vod_area: "missav.media",
      type_name: "JAV",
      media_kind: "video",
      needs_detail: true,
      provider: "miss",
    });
  }
  return cards;
}

function missavPageCount(html, page) {
  const linkedPages = [...html.matchAll(/[?&]page=(\d+)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  return Math.max(page, ...linkedPages);
}

async function missavList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd")?.trim() || "";
  const preset = requestUrl.searchParams.get("preset")?.trim() || "";
  let pathname;
  if (keyword) {
    pathname = `/search/${encodeURIComponent(keyword)}`;
  } else if (MISSAV_SECTION_KEYS.includes(preset)) {
    pathname = `/cn/${preset}`;
  } else if (preset && (preset.startsWith("genre:") || preset.startsWith("actress:") || preset.startsWith("maker:"))) {
    const [kind, ...rest] = preset.split(":");
    const slug = rest.join(":");
    if (!slug) return json({ message: "invalid preset" }, { status: 400 });
    pathname = `/cn/${kind === "genre" ? "genres" : kind === "actress" ? "actresses" : "makers"}/${slug}`;
  } else {
    pathname = "/cn/new";
  }
  const html = await missavPage(pathname, page > 1 ? { page } : {});
  const list = parseMissavCards(html).slice(0, 24);
  const pagecount = keyword ? Math.max(page, Math.ceil(list.length / 12) || 1) : missavPageCount(html, page);
  return json({
    code: 1,
    page,
    pagecount,
    limit: 24,
    total: pagecount * 12,
    list,
    provider: "miss",
  }, { headers: { "cache-control": keyword ? "public, max-age=60" : "public, max-age=120" } });
}

async function missavDetail(id) {
  if (!/^[a-z0-9-]+$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const html = await missavPage(`/cn/${id}`);
  const title = decodeHtml(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || `${id.toUpperCase()}`);
  const description = decodeHtml(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] || "");
  const cover = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || missavAsset(id, "cover-n.jpg");
  const durationSeconds = Number(html.match(/<meta name="duration" content="(\d+)"/)?.[1] || 0);
  const releaseDate = html.match(/<time datetime="([^"]+)"/)?.[1]?.slice(0, 10) || "";
  const uuid = html.match(/surrit\.mrstcdn\.store\\?\/([0-9a-f-]{36})/)?.[1] || "";
  const m3u8Url = uuid ? `https://surrit.mrstcdn.store/${uuid}/playlist.m3u8` : "";
  const actresses = [...new Set([...html.matchAll(/href="https:\/\/missav\.media\/dm\d+\/cn\/actresses\/([^"]+)"/g)].map((m) => decodeHtml(decodeURIComponent(m[1]))))].filter(Boolean).slice(0, 8);
  const genreNames = [...new Set([...html.matchAll(/\/dm\d+\/cn\/genres\/([^"]+)"/g)].map((m) => decodeHtml(decodeURIComponent(m[1]))))].slice(0, 16);
  const maker = decodeHtml(html.match(/<span>发行商:<\/span>\s*<a[^>]*>([^<]+)/)?.[1] || "");
  const director = decodeHtml(html.match(/<span>导演:<\/span>\s*<a[^>]*>([^<]+)/)?.[1] || "");
  const code = html.match(/<span>番号:<\/span>\s*<span[^>]*>([^<]+)/)?.[1]?.trim() || id.toUpperCase();
  return json({
    vod_id: id,
    vod_name: title,
    vod_pic: cover,
    vod_remarks: [durationSeconds ? formatDuration(durationSeconds) : "", genreNames[0] || "JAV"].filter(Boolean).join(" · ") || "VIDEO",
    vod_blurb: [code, maker, director, releaseDate].filter(Boolean).join(" · "),
    vod_content: description || genreNames.join(" · "),
    vod_year: releaseDate.slice(0, 4),
    vod_area: "missav.media",
    type_name: genreNames[0] || "JAV",
    vod_play_url: m3u8Url,
    media_kind: "video",
    needs_detail: false,
    provider: "miss",
    metadata: { code, maker, director, releaseDate, actresses: actresses.slice(0, 8), genres: genreNames.slice(0, 16) },
  }, { headers: { "cache-control": "public, max-age=180" } });
}

/* ---------------- tx / 看糖心Vlog (tangxinvlog.pro) ---------------- */
const TANGXIN_ORIGIN = "https://tangxinvlog.pro";
const TANGXIN_MEDIA = "https://t.5gcdn.xyz";
const TANGXIN_HEADERS = {
  referer: "https://tangxinvlog.pro/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
};

async function tangxinPage(pathname) {
  const response = await fetch(new URL(pathname, TANGXIN_ORIGIN), { headers: TANGXIN_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`tangxinvlog page ${response.status}`);
  return response.text();
}

function tangxinMediaUrl(path) {
  return `/provider-api/tx?action=media&path=${encodeURIComponent(path)}`;
}

function parseTangxinCards(html) {
  const cards = [];
  const seen = new Set();
  const pattern = /<a class="video-card" href="\/videos\/([0-9a-f]+)\/">/g;
  for (const match of html.matchAll(pattern)) {
    const slug = match[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const block = html.slice(match.index, match.index + 2600);
    const img = block.match(/<img src="https:\/\/t\.5gcdn\.xyz\/videos\/(\d+)\/cover\.jpg" alt="([^"]*)"/);
    if (!img) continue;
    const cdnId = img[1];
    const title = decodeHtml(img[2]) || slug;
    const quality = block.match(/<span class="quality">([^<]*)<\/span>/)?.[1] || "";
    const duration = block.match(/<span class="duration">([^<]*)<\/span>/)?.[1] || "";
    const artist = block.match(/<div class="meta">\s*<span>([^<]*)<\/span>/)?.[1]?.trim() || "";
    cards.push({
      vod_id: slug,
      vod_name: title,
      vod_pic: tangxinMediaUrl(`videos/${cdnId}/cover.jpg`),
      vod_remarks: duration || quality || "VIDEO",
      vod_blurb: [quality, artist].filter(Boolean).join(" · "),
      vod_content: artist,
      vod_area: "tangxinvlog.pro",
      type_name: quality || "糖心Vlog",
      media_kind: "video",
      needs_detail: true,
      provider: "tx",
    });
  }
  return cards;
}

function tangxinPageCount(html, page) {
  const current = html.match(/<span class="current">\s*\d+\s*\/\s*(\d+)\s*<\/span>/);
  return current ? Math.max(page, Number(current[1])) : page;
}

async function tangxinList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const preset = requestUrl.searchParams.get("preset")?.trim() || "";
  let pathname;
  if (preset === "videos") pathname = page > 1 ? `/videos/${page}/` : "/videos/";
  else if (preset.startsWith("artist:")) {
    const name = decodeURIComponent(preset.slice("artist:".length));
    if (!name) return json({ message: "invalid preset" }, { status: 400 });
    pathname = `/artists/${encodeURIComponent(name)}/`;
  } else pathname = "/";
  const html = await tangxinPage(pathname);
  const all = parseTangxinCards(html);
  const list = preset === "videos" ? all : all.slice((page - 1) * 24, page * 24);
  const pagecount = preset === "videos" ? tangxinPageCount(html, page) : Math.max(1, Math.ceil(all.length / 24));
  return json({
    code: 1,
    page,
    pagecount,
    limit: 24,
    total: pagecount * 24,
    list,
    provider: "tx",
  }, { headers: { "cache-control": "public, max-age=120" } });
}

async function tangxinArtists() {
  const html = await tangxinPage("/artists/");
  const artists = [];
  const pattern = /<a class="artist-card" href="\/artists\/([^"]+)\/">/g;
  for (const match of html.matchAll(pattern)) {
    const name = decodeURIComponent(match[1].replace(/\/$/, ""));
    const block = html.slice(match.index, match.index + 1200);
    const avatar = block.match(/<img src="([^"]+)"/)?.[1] || "";
    const stats = [...block.matchAll(/<div class="stat">([^<]*)<\/div>/g)].map((m) => decodeHtml(m[1]));
    artists.push({
      vod_id: `artist:${name}`,
      vod_name: name,
      vod_pic: avatar ? tangxinMediaUrl(`avatars/${encodeURIComponent(name)}.jpg`) : "",
      vod_remarks: stats[0] || "",
      vod_blurb: stats[1] || "",
      vod_content: "",
      vod_area: "tangxinvlog.pro",
      type_name: "糖心博主",
      media_kind: "artist",
      needs_detail: false,
      provider: "tx",
    });
  }
  return json({ code: 1, page: 1, pagecount: 1, limit: 100, total: artists.length, list: artists, provider: "tx" }, { headers: { "cache-control": "public, max-age=300" } });
}

async function tangxinDetail(id) {
  if (!/^[0-9a-f]+$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const html = await tangxinPage(`/videos/${id}/`);
  const title = decodeHtml(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1]?.trim() || "");
  const m3u8 = html.match(/data-src="https:\/\/t\.5gcdn\.xyz\/videos\/(\d+)\/index\.m3u8"/);
  if (!m3u8) return json({ message: "video unavailable" }, { status: 404 });
  const cdnId = m3u8[1];
  const row = html.match(/<div class="row">([\s\S]*?)<\/div>/)?.[1] || "";
  const artist = decodeHtml(row.match(/href="\/artists\/[^"]+"[^>]*>([^<]*)<\/a>/)?.[1]?.trim() || "");
  const dates = [...row.matchAll(/<span>(\d{4}-\d{2}-\d{2})<\/span>/g)].map((m) => m[1]);
  const durations = [...row.matchAll(/<span>(\d{1,3}:\d{2})<\/span>/g)].map((m) => m[1]);
  const date = dates[0] || "";
  const duration = durations[0] || "";
  const tags = [...html.matchAll(/<span class="tag">([^<]*)<\/span>/g)].map((m) => decodeHtml(m[1])).filter(Boolean);
  const description = decodeHtml(html.match(/<div class="video-desc">([\s\S]*?)<\/div>/)?.[1]?.trim() || "");
  const related = parseTangxinCards(html).slice(0, 12);
  return json({
    vod_id: id,
    vod_name: title,
    vod_pic: tangxinMediaUrl(`videos/${cdnId}/cover.jpg`),
    vod_remarks: duration || "VIDEO",
    vod_blurb: [artist, date, duration].filter(Boolean).join(" · ") || "糖心Vlog",
    vod_content: description || tags.join(" · "),
    vod_area: "tangxinvlog.pro",
    type_name: tags[0] || "糖心Vlog",
    vod_year: date.slice(0, 4),
    vod_play_url: tangxinMediaUrl(`videos/${cdnId}/index.m3u8`),
    media_kind: "video",
    needs_detail: false,
    provider: "tx",
    metadata: { artist, date, duration, tags, related },
  }, { headers: { "cache-control": "public, max-age=180" } });
}

async function tangxinMedia(requestUrl) {
  const path = requestUrl.searchParams.get("path") || "";
  let target = null;
  if (/^videos\/\d+\/[a-z0-9._-]+$/i.test(path)) target = `${TANGXIN_MEDIA}/${path}`;
  else if (/^avatars\/[^/]+\.jpg$/i.test(path)) target = `${TANGXIN_ORIGIN}/${path}`;
  if (!target) return json({ message: "invalid media path" }, { status: 400 });
  const isPlaylist = /\.m3u8$/i.test(path);
  const upstream = await fetch(target, { headers: TANGXIN_HEADERS, signal: AbortSignal.timeout(isPlaylist ? 15_000 : 30_000) });
  if (!upstream.ok) return json({ message: `tangxin media ${upstream.status}` }, { status: 502 });
  if (isPlaylist) {
    const text = await upstream.text();
    const cdnId = path.match(/^videos\/(\d+)\//)[1];
    const keyUrl = tangxinMediaUrl(`videos/${cdnId}/enc.key`);
    const rewritten = text.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#EXT-X-KEY:")) return trimmed.replace(/URI="[^"]*"/, `URI="${keyUrl}"`);
      if (trimmed.startsWith("#")) return line;
      return tangxinMediaUrl(`videos/${cdnId}/${trimmed}`);
    }).join("\n");
    return new Response(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "public, max-age=120",
        "access-control-allow-origin": "*",
      },
    });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": /(cover\.jpg|avatars)/.test(path) ? "public, max-age=86400" : "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

/* ---------------- rou / 看肉视频 (rou.video) ---------------- */
const ROU_ORIGIN = "https://rou.video";
const ROU_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
};
const ROU_SECTIONS = [
  ["latestVideos", "最新上传"],
  ["dailyHotCNAV", "今日热门 · 国产 AV"],
  ["dailyHotSelfie", "今日热门 · 自拍"],
  ["dailyHot91", "今日热门 · 探花/91"],
  ["dailyOnlyFans", "今日热门 · OnlyFans"],
  ["dailyJV", "今日热门 · JVID"],
  ["hotCNAV", "热门 · 国产 AV"],
  ["hotSelfie", "热门 · 自拍"],
  ["hot91", "热门 · 探花/91"],
];
const ROU_GROUP_TITLES = { gcAV: "国产 AV", madouAV: "麻豆 AV", v91: "探花/91", onlyfans: "OnlyFans" };

async function rouPage(pathname) {
  const response = await fetch(new URL(pathname, ROU_ORIGIN), { headers: ROU_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`rou.video page ${response.status}`);
  return response.text();
}

function rouParseNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("rou.video page missing __NEXT_DATA__");
  return JSON.parse(match[1]).props.pageProps;
}

async function rouPageData(pathname) {
  return rouParseNextData(await rouPage(pathname));
}

function rouDecodeEv(ev) {
  if (!ev || typeof ev.d !== "string" || typeof ev.k !== "number") return null;
  const bytes = Uint8Array.from(Buffer.from(ev.d, "base64"));
  for (let i = 0; i < bytes.length; i++) bytes[i] = (bytes[i] - ev.k) & 0xff;
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

function rouAssetUrl(url) {
  return `/provider-api/rou?action=media&url=${encodeURIComponent(url)}`;
}

function rouFormatCount(value) {
  const n = Number(value) || 0;
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  return n ? String(n) : "";
}

function rouNormalize(video) {
  const tags = video.tagsZh || video.tags || [];
  const duration = video.duration ? formatDuration(Math.round(video.duration)) : "";
  const views = rouFormatCount(video.viewCount);
  const likes = rouFormatCount(video.likeCount);
  return {
    vod_id: video.id,
    vod_name: video.nameZh || video.name || video.nameOriginal || video.id,
    vod_pic: video.coverImageUrl || "",
    vod_remarks: [duration, views && `▶ ${views}`, likes && `♥ ${likes}`].filter(Boolean).join(" · ") || "VIDEO",
    vod_blurb: tags.slice(0, 3).join(" / "),
    vod_content: video.description || "",
    vod_area: "rou.video",
    type_name: tags[0] || "看肉",
    media_kind: "video",
    needs_detail: true,
    provider: "rou",
    metadata: {
      nameOriginal: video.nameOriginal || video.name,
      tags,
      viewCount: video.viewCount || 0,
      likeCount: video.likeCount || 0,
      createdAt: video.createdAt || "",
    },
  };
}

function rouVideosResponse(videos, page, totalPage, note = "") {
  return json({
    code: 1,
    page,
    pagecount: Math.max(1, totalPage || 1),
    limit: 26,
    total: totalPage ? totalPage * 26 : videos.length,
    list: videos.map(rouNormalize),
    provider: "rou",
    note,
  }, { headers: { "cache-control": "public, max-age=120" } });
}

async function rouList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const wd = (requestUrl.searchParams.get("wd") || "").trim();
  const preset = requestUrl.searchParams.get("preset")?.trim() || "";
  if (wd) {
    const props = await rouPageData(`/search?q=${encodeURIComponent(wd)}&page=${page}`);
    return rouVideosResponse(props.videos || [], page, props.totalPage || 1, `搜索“${wd}”`);
  }
  if (preset.startsWith("tag:")) {
    const tag = decodeURIComponent(preset.slice("tag:".length));
    if (!tag) return json({ message: "invalid preset" }, { status: 400 });
    const props = await rouPageData(`/t/${encodeURIComponent(tag)}?order=createdAt&page=${page}`);
    return rouVideosResponse(props.videos || [], page, props.totalPage || 1, tag);
  }
  if (preset === "cat") {
    const props = await rouPageData("/cat");
    const groups = ["gcAV", "madouAV", "v91", "onlyfans"].filter((key) => Array.isArray(props[key])).map((key) => ({
      key,
      title: ROU_GROUP_TITLES[key] || key,
      tags: props[key].map((tag) => ({ id: tag.id, count: tag.count || 0, parent: tag.parent || "" })),
    }));
    return json({ code: 1, page: 1, pagecount: 1, limit: 1, total: 0, list: [], provider: "rou", groups }, { headers: { "cache-control": "public, max-age=600" } });
  }
  const props = await rouPageData("/home");
  const sections = ROU_SECTIONS.map(([key, title]) => ({
    key,
    title,
    videos: (props[key] || []).map(rouNormalize),
  }));
  return json({
    code: 1,
    page: 1,
    pagecount: 1,
    limit: 26,
    total: sections[0]?.videos.length || 0,
    list: sections[0]?.videos || [],
    sections,
    provider: "rou",
  }, { headers: { "cache-control": "public, max-age=180" } });
}

async function rouDetail(id) {
  if (!/^[a-z0-9]{10,40}$/i.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const props = await rouPageData(`/v/${id}`);
  const video = props.video;
  const stream = rouDecodeEv(props.ev);
  if (!video || !stream?.videoUrl) return json({ message: "video unavailable" }, { status: 404 });
  const normalized = rouNormalize(video);
  const related = (props.relatedVideos || []).slice(0, 8).map(rouNormalize);
  return json({
    ...normalized,
    vod_play_url: rouAssetUrl(stream.videoUrl),
    vod_remarks: [normalized.vod_remarks, stream.videoUrl.match(/-(\d+)\//)?.[1] ? `${stream.videoUrl.match(/-(\d+)\//)[1]}P` : ""].filter(Boolean).join(" · ") || "VIDEO",
    needs_detail: false,
    metadata: {
      ...normalized.metadata,
      thumbnail: stream.thumbVTTUrl ? rouAssetUrl(stream.thumbVTTUrl) : "",
      quality: props.defaultQuality || 720,
      related,
    },
  }, { headers: { "cache-control": "public, max-age=180" } });
}

async function rouMedia(requestUrl) {
  const raw = requestUrl.searchParams.get("url") || "";
  let target;
  try { target = new URL(raw); } catch { return json({ message: "invalid media url" }, { status: 400 }); }
  if (!/^v\.rn\d+\.xyz$/i.test(target.hostname) || !target.pathname.startsWith("/hls/")) {
    return json({ message: "invalid media host" }, { status: 400 });
  }
  const isPlaylist = /index\.jpg$|\.m3u8$/i.test(target.pathname);
  const upstream = await fetch(target, { headers: ROU_HEADERS, signal: AbortSignal.timeout(isPlaylist ? 15_000 : 30_000) });
  if (!upstream.ok) return json({ message: `rou media ${upstream.status}` }, { status: 502 });
  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = text.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      return rouAssetUrl(new URL(trimmed, target).toString());
    }).join("\n");
    return new Response(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "public, max-age=60",
        "access-control-allow-origin": "*",
      },
    });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

/* ---------------- hj / 看海角 (www.haijiao.com) ---------------- */
const HJ_ORIGIN = "https://www.haijiao.com";
const HJ_HEADERS = {
  accept: "application/json, text/plain, */*",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
};
const HJ_B64_CHARS = "ABCD*EFGHIJKLMNOPQRSTUVWX#YZabcdefghijklmnopqrstuvwxyz1234567890";
async function hjKeyTransform(keyHex, rText) {
  const key = Buffer.from(keyHex, "hex");
  const r = Buffer.from(rText, "utf8");
  const out = Buffer.alloc(key.length);
  for (let i = 0; i < key.length; i++) out[i] = key[i] ^ r[i % r.length];
  return out;
}

function hjB64Decode(value) {
  return JSON.parse(Buffer.from(Buffer.from(Buffer.from(value, "base64").toString("utf8"), "base64").toString("utf8"), "base64").toString("utf8"));
}

async function hjApi(pathname) {
  const response = await fetch(new URL(pathname, HJ_ORIGIN), { headers: HJ_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`haijiao api ${response.status}`);
  const body = await response.json();
  if (body && typeof body.data === "string") return hjB64Decode(body.data);
  return body && typeof body.data === "object" && body.data !== null ? body.data : body;
}

function hjImgDecode(text) {
  const cleaned = String(text || "").replace(/[^A-Za-z0-9*#]/g, "");
  let output = "";
  let index = 0;
  while (index < cleaned.length) {
    const o = HJ_B64_CHARS.indexOf(cleaned.charAt(index++));
    const r = HJ_B64_CHARS.indexOf(cleaned.charAt(index++));
    const s = HJ_B64_CHARS.indexOf(cleaned.charAt(index++));
    const c = HJ_B64_CHARS.indexOf(cleaned.charAt(index++));
    output += String.fromCharCode((o << 2) | (r >> 4));
    const i = ((15 & r) << 4) | (s >> 2);
    const n = ((3 & s) << 6) | c;
    if (s !== 64) output += String.fromCharCode(i);
    if (c !== 64) output += String.fromCharCode(n);
  }
  let utf8 = "";
  let pos = 0;
  while (pos < output.length) {
    const code = output.charCodeAt(pos);
    if (code < 128) { utf8 += String.fromCharCode(code); pos += 1; }
    else if (code > 191 && code < 224) { utf8 += String.fromCharCode(((31 & code) << 6) | (63 & output.charCodeAt(pos + 1))); pos += 2; }
    else { utf8 += String.fromCharCode(((15 & code) << 12) | ((63 & output.charCodeAt(pos + 1)) << 6) | (63 & output.charCodeAt(pos + 2))); pos += 3; }
  }
  return utf8;
}

function hjMediaUrl(url) {
  return `/provider-api/hj?action=media&u=${encodeURIComponent(url)}`;
}

function hjImgUrl(url) {
  return url ? `/provider-api/hj?action=img&u=${encodeURIComponent(url)}` : "";
}

function hjNormalize(item) {
  const firstPic = (item.attachments || []).find((att) => att.category === "images");
  const tag = item.node?.name || "";
  const kind = item.hasVideo ? "视频" : item.hasPic ? "图文" : "帖子";
  return {
    p: String(item.topicId),
    t: item.title || `海角 ${item.topicId}`,
    r: hjImgUrl(firstPic?.remoteUrl || ""),
    a: item.user?.nickname || "",
    u: item.createTime || "",
    k: [tag, kind].filter(Boolean),
    hot: Boolean(item.is_hot),
    money: item.money_type,
  };
}

function hjStripHtml(html) {
  return decodeHtml(html).slice(0, 600);
}

async function hjList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("page")) || 1);
  const category = requestUrl.searchParams.get("category") || "";
  const q = (requestUrl.searchParams.get("q") || "").trim();
  let decoded;
  if (q) decoded = await hjApi(`/api/topic/searchV2?q=${encodeURIComponent(q)}&page=${page}&limit=20`);
  else if (category) decoded = await hjApi(`/api/topic/node/topics?type=1&nodeId=${encodeURIComponent(category)}&page=${page}`);
  else decoded = await hjApi(`/api/topic/hot/topics?page=${page}`);
  const results = Array.isArray(decoded.results) ? decoded.results : [];
  const total = Number(decoded.page?.total) || 0;
  return json({
    items: results.map(hjNormalize),
    page,
    totalPages: Math.max(1, Math.ceil(total / 20)),
    note: q ? "search" : category ? "category" : "hot",
    provider: "hj",
  }, { headers: { "cache-control": "public, max-age=60" } });
}

async function hjCats() {
  const decoded = await hjApi("/api/topic/nodes_by_ver/v2?ver=");
  const list = Array.isArray(decoded.list) ? decoded.list : [];
  return json(list.map((node) => ({ slug: String(node.nodeId), name: node.name || String(node.nodeId) })), {
    headers: { "cache-control": "public, max-age=600" },
  });
}

async function hjDetail(id) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const decoded = await hjApi(`/api/topic/${id}`);
  const attachments = Array.isArray(decoded.attachments) ? decoded.attachments : [];
  const images = attachments.filter((att) => att.category === "images").map((att) => hjImgUrl(att.remoteUrl));
  const videos = attachments.filter((att) => att.category === "video").map((att, index) => ({
    i: index,
    url: att.remoteUrl || "",
    type: "m3u8",
    name: att.title || "视频",
    cover: hjImgUrl(att.coverUrl || ""),
    seconds: att.video_time_length || 0,
  }));
  const sale = decoded.sale || null;
  const minutes = videos[0]?.seconds ? Math.round(videos[0].seconds / 60) : 0;
  const remarks = videos.length
    ? `${minutes ? `视频 · ${minutes} 分钟` : "视频"}`
    : images.length ? `${images.length} 图` : "";
  return json({
    vod_id: id,
    vod_name: decoded.title || `海角 ${id}`,
    vod_pic: images[0] || "",
    vod_remarks: remarks,
    vod_blurb: [decoded.user?.nickname && `作者：${decoded.user.nickname}`, decoded.createTime && `发布于：${String(decoded.createTime).slice(0, 10)}`].filter(Boolean).join(" · "),
    vod_content: hjStripHtml(decoded.content || decoded.liteContent || ""),
    type_name: decoded.node?.name || "海角",
    vod_area: "海角社区",
    media_gallery: images,
    videos,
    vod_play_url: videos[0]?.url ? hjMediaUrl(videos[0].url) : "",
    media_kind: videos.length ? "video" : images.length ? "gallery" : "text",
    needs_detail: false,
    metadata: {
      viewCount: decoded.viewCount,
      commentCount: decoded.commentCount,
      likeCount: decoded.likeCount,
      sale,
      node: decoded.node?.name || "",
      tags: Array.isArray(decoded.tags) ? decoded.tags : [],
    },
    provider: "hj",
  }, { headers: { "cache-control": "no-store" } });
}

async function hjPlay(id, index) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const decoded = await hjApi(`/api/topic/${id}`);
  const videos = (Array.isArray(decoded.attachments) ? decoded.attachments : []).filter((att) => att.category === "video");
  const selected = Number.isInteger(Number(index)) && Number(index) > 0 ? Number(index) : 0;
  const video = videos[selected];
  if (!video?.remoteUrl) return json({ message: "此帖子没有公开视频" }, { status: 404 });
  return json({ vod_id: id, video: hjMediaUrl(video.remoteUrl), provider: "hj" }, {
    headers: { "cache-control": "no-store" },
  });
}

async function hjImg(requestUrl) {
  const raw = requestUrl.searchParams.get("u") || "";
  if (!/^https:\/\/pic\.hj\d*\.top\//.test(raw) && !/^https:\/\/pic\.[a-z0-9.-]+\/hjstore\//.test(raw) && !raw.includes("hjstore/")) {
    return json({ message: "invalid image url" }, { status: 400 });
  }
  const upstream = await fetch(raw, { headers: HJ_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!upstream.ok) return json({ message: `hj img ${upstream.status}` }, { status: 502 });
  const text = await upstream.text();
  const dataUrl = hjImgDecode(text);
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/s);
  if (!match) return json({ message: "hj img decode failed" }, { status: 502 });
  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "content-type": match[1],
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  });
}

async function hjKey(requestUrl) {
  const raw = requestUrl.searchParams.get("u") || "";
  const jpg = requestUrl.searchParams.get("j") || "";
  if (!raw.includes("hjstore/video/")) return json({ message: "invalid key url" }, { status: 400 });
  const [keyResponse, jpgResponse] = await Promise.all([
    fetch(raw, { headers: HJ_HEADERS, signal: AbortSignal.timeout(20_000) }),
    jpg ? fetch(jpg, { headers: HJ_HEADERS, signal: AbortSignal.timeout(20_000) }) : Promise.resolve(null),
  ]);
  if (!keyResponse.ok) return json({ message: `hj key ${keyResponse.status}` }, { status: 502 });
  const keyText = Buffer.from(await keyResponse.arrayBuffer()).toString("hex");
  let rText = "";
  if (jpgResponse && jpgResponse.ok) {
    const body = await jpgResponse.text();
    try { rText = Buffer.from(body.trim(), "base64").toString("utf8"); } catch { rText = ""; }
  }
  const realKey = await hjKeyTransform(keyText, rText);
  return new Response(realKey, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

async function hjPlaylist(requestUrl) {
  const raw = requestUrl.searchParams.get("u") || "";
  if (!raw.includes("hjstore/video/")) return json({ message: "invalid playlist url" }, { status: 400 });
  const preview = await fetch(raw, { headers: HJ_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!preview.ok) return json({ message: `hj playlist ${preview.status}` }, { status: 502 });
  let sourceUrl = raw;
  let text = await preview.text();
  if (text.includes("#EXTM3U")) {
    const stem = hjTsStem(text);
    if (stem) {
      const guessed = raw.slice(0, raw.lastIndexOf("/") + 1) + stem + ".m3u8";
      try {
        const full = await fetch(guessed, { headers: HJ_HEADERS, signal: AbortSignal.timeout(20_000) });
        if (full.ok) {
          const fullText = await full.text();
          if (fullText.includes("#EXTM3U")) {
            sourceUrl = guessed;
            text = fullText;
          }
        }
      } catch {}
    }
  }
  const base = new URL(sourceUrl);
  const jpgUrl = raw.replace(/\.m3u8(?:$|\?)/, ".jpg");
  const rewritten = text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    const keyMatch = trimmed.match(/^#EXT-X-KEY:.*URI="([^"]+)"/);
    if (keyMatch) {
      const keyUrl = new URL(keyMatch[1], base).toString();
      return trimmed.replace(keyMatch[1], `/provider-api/hj?action=key&u=${encodeURIComponent(keyUrl)}&j=${encodeURIComponent(jpgUrl)}`);
    }
    if (trimmed.startsWith("#")) return line;
    return new URL(trimmed, base).toString();
  }).join("\n");
  return new Response(rewritten, {
    headers: {
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}

function hjTsStem(playlistText) {
  const names = playlistText.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => /\.ts(\?|$)/i.test(line))
    .map((line) => line.split("?")[0].split("/").pop().replace(/\.ts$/i, ""))
    .filter(Boolean);
  if (!names.length) return "";
  let lcp = names[0];
  for (let i = 1; i < names.length; i++) {
    let j = 0;
    while (j < lcp.length && j < names[i].length && lcp.charAt(j) === names[i].charAt(j)) j++;
    lcp = lcp.slice(0, j);
    if (!lcp) return "";
  }
  return lcp;
}

/* ---------------- 98堂 / dmn12.vip (research adapter, route kept pending) ---------------- */
const KAN98_ORIGIN = "https://dmn12.vip";
const KAN98_MIRRORS = ["https://sehuatang.net", "https://sehuatang.org"];
const KAN98_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};
const KAN98_CATEGORIES = {
  41: "国产自拍",
  109: "中文字幕",
  42: "日韩无码",
  43: "日韩有码",
  44: "欧美风情",
  45: "卡通动漫",
  46: "剧情三级",
};

function kan98CookieHeader(raw = "") {
  return String(raw).split(/,(?=[^;,=\s]+=[^;,]+)/).map((part) => part.split(";")[0].trim()).filter(Boolean).join("; ");
}

function kan98ImageProxy(source) {
  if (!source) return "";
  const url = new URL(source, KAN98_ORIGIN);
  if (url.hostname !== "jo.djsnm.app") return "";
  return `/provider-api/kan98?action=image&url=${encodeURIComponent(url.href)}`;
}

async function kan98Page(pathname, init = {}) {
  let lastError;
  for (const origin of [KAN98_ORIGIN, ...KAN98_MIRRORS]) {
    try {
      const url = new URL(pathname, origin);
      const response = await fetch(url, {
        ...init,
        headers: { ...KAN98_HEADERS, ...(init.headers || {}) },
        signal: init.signal || AbortSignal.timeout(20_000),
      });
      let text = await response.text();
      // dmn12/sehuatang 的公开年龄页由 safeid 生成 host-only `_safe` cookie。
      // 用户已明确允许进入年龄页；这里仅复现该公开流程，不读取用户浏览器 Cookie。
      let safeId = text.match(/var\s+safeid\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      if (!safeId && (!response.ok || /(?:just a moment|enable javascript and cookies to continue|cf-mitigated)/i.test(text.slice(0, 5000)))) {
        const gate = await fetch(new URL("/", origin), {
          headers: KAN98_HEADERS,
          signal: init.signal || AbortSignal.timeout(20_000),
        });
        const gateText = await gate.text();
        safeId = gateText.match(/var\s+safeid\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      }
      if (safeId) {
        let retry = await fetch(url, {
          ...init,
          headers: { ...KAN98_HEADERS, ...(init.headers || {}), cookie: [init.headers?.cookie, `_safe=${safeId}`].filter(Boolean).join("; ") },
          redirect: "manual",
          signal: init.signal || AbortSignal.timeout(20_000),
        });
        if ([301, 302, 303, 307, 308].includes(retry.status)) {
          const location = retry.headers.get("location");
          if (location) {
            retry = await fetch(new URL(location, url), {
              ...init,
              method: "GET",
              body: undefined,
              headers: { ...KAN98_HEADERS, cookie: [init.headers?.cookie, `_safe=${safeId}`].filter(Boolean).join("; ") },
              signal: init.signal || AbortSignal.timeout(20_000),
            });
          }
        }
        text = await retry.text();
        if (retry.ok && !/(?:just a moment|enable javascript and cookies to continue|cf-mitigated|var\s+safeid\s*=)/i.test(text.slice(0, 5000))) {
          return { text, url: retry.url || url.href, cookie: [init.headers?.cookie, kan98CookieHeader(retry.headers.get("set-cookie")), safeId ? `_safe=${safeId}` : ""].filter(Boolean).join("; ") };
        }
      }
      if (!response.ok || /(?:just a moment|enable javascript and cookies to continue|cf-mitigated|var\s+safeid\s*=)/i.test(text.slice(0, 5000))) {
        lastError = new Error(`kan98 upstream ${response.status || 502} (${origin})`);
        continue;
      }
      return { text, url: response.url || url.href, cookie: [init.headers?.cookie, kan98CookieHeader(response.headers.get("set-cookie"))].filter(Boolean).join("; ") };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("kan98 upstream unavailable");
}

function kan98Attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "";
}

function kan98ThreadId(href = "") {
  const normalized = String(href).replace(/&amp;/gi, "&");
  return normalized.match(/thread-(\d+)(?:-|\.html)/i)?.[1]
    || normalized.match(/[?&]tid=(\d+)/i)?.[1]
    || "";
}

function kan98CardFromBlock(block, categoryId) {
  const threadTag = block.match(/<a\b[^>]+href=["'][^"']*(?:thread-\d+|tid=\d+)[^"']*["'][^>]*>/i)?.[0] || "";
  const threadHref = kan98Attr(threadTag, "href").replace(/&amp;/gi, "&");
  const id = kan98ThreadId(threadHref);
  if (!id) return null;
  const title = kan98Attr(threadTag, "title")
    || decodeHtml(block.match(/<h3[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "");
  if (!title) return null;
  const image = block.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1] || "";
  const duration = decodeHtml(block.match(/class=["'][^"']*v-time[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] || "");
  const views = block.match(/(?:查看|播放)[:：]?\s*([\d,]+)/i)?.[1]?.replace(/,/g, "") || "";
  const date = block.match(/<span[^>]+title=["'](\d{4}-\d{2}-\d{2})["']/i)?.[1] || "";
  return {
    vod_id: id,
    vod_name: decodeHtml(title),
    vod_pic: kan98ImageProxy(image),
    vod_remarks: duration || "VIDEO",
    vod_blurb: [views && `${views} 次观看`, date && `更新：${date}`].filter(Boolean).join(" · "),
    vod_year: date.slice(0, 4),
    type_name: KAN98_CATEGORIES[categoryId] || "98堂",
    vod_area: "dmn12.vip",
    needs_detail: true,
    metadata: { thread_url: new URL(threadHref, KAN98_ORIGIN).href, category_id: String(categoryId || "") },
    provider: "kan98",
  };
}

function kan98Cards(html, categoryId) {
  const list = [];
  const waterfall = html.match(/<ul\b[^>]*id=["']waterfall["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || html;
  for (const match of waterfall.matchAll(/<li\b[\s\S]*?<\/li>/gi)) {
    const card = kan98CardFromBlock(match[0], categoryId);
    if (card) list.push(card);
  }
  return list;
}

function kan98SearchCards(html) {
  const list = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b[^>]+href=["']([^"']*(?:thread-\d+|mod=viewthread[^"']*tid=\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].replace(/&amp;/gi, "&");
    const id = kan98ThreadId(href);
    if (!id || seen.has(id)) continue;
    const tag = match[0];
    const title = kan98Attr(tag, "title") || decodeHtml(match[2]);
    if (!title || /^(?:最后发表|只看该作者|下一页|上一页)$/i.test(title)) continue;
    seen.add(id);
    list.push({
      vod_id: id,
      vod_name: title,
      vod_pic: "",
      vod_remarks: "VIDEO",
      type_name: "98堂搜索",
      vod_area: "dmn12.vip",
      needs_detail: true,
      metadata: { thread_url: new URL(href, KAN98_ORIGIN).href },
      provider: "kan98",
    });
  }
  return list;
}

function kan98PageCount(html) {
  const explicit = Number(html.match(/共\s*([\d,]+)\s*页/i)?.[1]?.replace(/,/g, "") || 0);
  const linked = [...html.matchAll(/(?:[?&]page=|\/page\/)(\d+)/gi)].map((m) => Number(m[1])).filter(Number.isFinite);
  return Math.max(1, explicit, ...linked);
}

async function kan98SearchPage(keyword, page) {
  const body = new URLSearchParams({
    mod: "forum",
    srchtxt: keyword,
    srchtype: "title",
    srhfid: "0",
    searchsubmit: "yes",
  });
  const result = await kan98Page("/search.php?searchsubmit=yes", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", referer: `${KAN98_ORIGIN}/` },
    body,
  });
  if (page <= 1) return result.text;
  const searchMd5 = result.text.match(/[?&]searchmd5=([^&"'<>\s]+)/i)?.[1]
    || result.text.match(/(?:name|id)=["']searchmd5["'][^>]*value=["']([^"']+)/i)?.[1]
    || result.text.match(/searchmd5["'=]+([a-z0-9]+)/i)?.[1]
    || "0";
  const url = `/search.php?mod=forum&searchid=0&searchmd5=${encodeURIComponent(searchMd5)}&orderby=lastpost&ascdesc=desc&searchsubmit=yes&kw=${encodeURIComponent(keyword)}&page=${page}`;
  return (await kan98Page(url, result.cookie ? { headers: { cookie: result.cookie } } : {})).text;
}

async function kan98List(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const limit = Math.min(48, Math.max(1, Number(requestUrl.searchParams.get("limit") || 24)));
  const keyword = requestUrl.searchParams.get("wd")?.trim() || "";
  const preset = requestUrl.searchParams.get("preset") || "41";
  const categoryId = KAN98_CATEGORIES[preset] ? preset : "41";
  const html = keyword
    ? await kan98SearchPage(keyword, page)
    : (await kan98Page(`/forum-${categoryId}-${page}.html`)).text;
  const list = keyword ? kan98SearchCards(html) : kan98Cards(html, categoryId);
  const response = {
    code: 1,
    page,
    pagecount: kan98PageCount(html),
    limit,
    total: list.length,
    list: list.slice(0, limit),
    provider: "kan98",
  };
  return json(response, { headers: { "cache-control": "no-store" } });
}

async function kan98Image(requestUrl) {
  let target;
  try { target = new URL(requestUrl.searchParams.get("url") || ""); } catch { return json({ message: "invalid kan98 image" }, { status: 400 }); }
  if (target.hostname !== "jo.djsnm.app" || !/\.(?:jpe?g|png|webp)$/i.test(target.pathname)) {
    return json({ message: "invalid kan98 image host" }, { status: 400 });
  }
  const response = await fetch(target, {
    headers: { ...KAN98_HEADERS, referer: `${KAN98_ORIGIN}/` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return json({ message: `kan98 image ${response.status}` }, { status: 502 });
  return new Response(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") || "image/jpeg",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}

async function kan98Play(tid, pid, vid) {
  if (!tid || !pid || !vid) return "";
  const callback = `cfnav${Date.now()}`;
  const url = new URL("/play.php", KAN98_ORIGIN);
  url.searchParams.set("callback", callback);
  url.searchParams.set("tid", tid);
  url.searchParams.set("pid", pid);
  url.searchParams.set("vid", vid);
  url.searchParams.set("rand", Math.random().toFixed(16));
  url.searchParams.set("_", String(Date.now()));
  const { text } = await kan98Page(url.pathname + url.search, {
    headers: { accept: "application/javascript, text/javascript, */*", referer: `${KAN98_ORIGIN}/thread-${tid}-1-1.html` },
  });
  const payloadText = text.match(/\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/)?.[1] || text;
  let payload;
  try { payload = JSON.parse(payloadText); } catch { return ""; }
  return payload?.k && typeof payload?.data?.flvurl === "string" ? payload.data.flvurl : "";
}

async function kan98Detail(id) {
  const html = (await kan98Page(`/thread-${encodeURIComponent(id)}-1-1.html`)).text;
  const loadingTag = html.match(/<span\b[^>]*id=["']v-loading["'][^>]*>/i)?.[0] || "";
  const tid = kan98Attr(loadingTag, "data-tid") || id;
  const pid = kan98Attr(loadingTag, "data-pid");
  const vid = kan98Attr(loadingTag, "data-vid");
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || `98堂 ${id}`).replace(/\s+-\s+98堂.*$/i, "");
  const cover = kan98ImageProxy(html.match(/<img\b[^>]*src=["'](https?:\/\/[^"']+\.(?:jpe?g|png|webp))["']/i)?.[1] || "");
  const play = await kan98Play(tid, pid, vid);
  if (!play) throw new Error("98堂播放地址生成失败");
  return json({
    vod_id: id,
    vod_name: title,
    vod_pic: cover,
    vod_remarks: "VIDEO",
    vod_content: "dmn12.vip 实时论坛帖子 / 源站 CDN 直连播放",
    type_name: "98堂",
    vod_area: "dmn12.vip",
    vod_play_url: play,
    media_kind: "video",
    needs_detail: false,
    metadata: { tid, pid, vid, source_url: `${KAN98_ORIGIN}/thread-${id}-1-1.html` },
    provider: "kan98",
  }, { headers: { "cache-control": "no-store" } });
}

/* ---------------- 爱看 / 香蕉视频 (kanxo, h5.xxoo473.org 公开 API + Richy VIP 解锁) ---------------- */
const KANXO_API = "https://h5.xxoo473.org/api";
const KANXO_REFERER = "https://h5.xxoo473.org/";
const KANXO_HEADERS = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1" };

async function kanxoFetch(path, init = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(KANXO_API + path, {
        ...init,
        headers: { ...KANXO_HEADERS, referer: KANXO_REFERER, ...(init.headers || {}) },
      });
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!response.ok) {
        if (response.status === 403 && attempt < 2) { await new Promise((r) => setTimeout(r, 1500)); continue; }
        throw new Error(json.errmsg || json.message || `kanxo upstream ${response.status}`);
      }
      return json;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastError || new Error("kanxo upstream unavailable");
}

function kanxoCard(v = {}) {
  const price = Number(v.view_price || 0);
  const vip = Number(v.vip_price || 0);
  const isVip = price >= 1000000 || vip >= 1000000;
  const single = !isVip && (price > 0 || vip > 0);
  return {
    vod_id: String(v.vodid || ""),
    vod_name: v.title || "未命名",
    vod_pic: v.coverpic || "",
    vod_remarks: isVip ? "VIP" : single ? "付费" : "可播放",
    vod_play_url: v.preview_url || "",
    vod_blurb: v.intro || "",
    vod_year: v.yearname || "",
    type_name: v.catename || "",
    duration: v.duration || "",
    score: v.scorenum || "",
    views: v.upnum || "",
    definition: v.definition || "",
    view_price: price,
    vip_price: vip,
    preview_url: v.preview_url || "",
    needs_detail: true,
    provider: "kanxo",
  };
}

function kanxoEscalateFromPreview(previewText, previewUrl) {
  if (!/^\s*#EXTM3U/i.test(previewText)) return "";
  const match = previewText.match(/URI="([^"]+)"/);
  if (!match) return "";
  let keyAbs;
  try { keyAbs = new URL(match[1], previewUrl).href; } catch { return ""; }
  const parsed = new URL(keyAbs);
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return "";
  return `${parsed.protocol}//${parsed.host}/${parts[0]}/${parts[1]}/index.m3u8`;
}

async function kanxoResolvePlay(id) {
  const show = await kanxoFetch(`/vod/show/${encodeURIComponent(id)}`);
  const vod = show.data?.vodrow || {};
  const previewUrl = vod.preview_url || "";
  const previewFallback = vod.httpurl_preview || "";
  let reqplay = null;
  try {
    const rp = await kanxoFetch(`/vod/reqplay/${encodeURIComponent(id)}`);
    if (rp.retcode === 0 && (rp.data?.httpurl || rp.data?.play_url || rp.data?.url || rp.data?.httpurl_play)) {
      reqplay = rp.data.httpurl || rp.data.play_url || rp.data.url || rp.data.httpurl_play || "";
    }
  } catch { /* fall through to preview escalation */ }
  if (reqplay) return { video: reqplay, mode: "reqplay" };
  for (const candidate of [previewUrl, previewFallback]) {
    if (!candidate) continue;
    try {
      const r = await fetch(candidate, { headers: KANXO_HEADERS });
      if (!r.ok) continue;
      const text = await r.text();
      const master = kanxoEscalateFromPreview(text, candidate);
      if (master) {
        const mr = await fetch(master, { headers: KANXO_HEADERS });
        if (mr.ok && /EXTM3U/i.test(await mr.text())) return { video: master, mode: "escalated" };
      }
    } catch { /* try next */ }
  }
  return { video: previewUrl || previewFallback || "", mode: "preview" };
}

// reqplay 同源代理：浏览器跨域直调 h5 reqplay 无 ACAO 会被拒，改走 Pages 函数后端抓取（CF 边缘可访问 h5）
async function kanxoReqplay(id) {
  const j = await kanxoFetch(`/vod/reqplay/${encodeURIComponent(id)}`);
  return json({
    retcode: j.retcode,
    errmsg: j.errmsg || "",
    httpurl: j.data?.httpurl || "",
    play_url: j.data?.play_url || "",
    url: j.data?.url || "",
    httpurl_play: j.data?.httpurl_play || "",
    provider: "kanxo",
  }, { headers: { "cache-control": "public, max-age=60" } });
}

async function kanxoDetail(id) {
  const j = await kanxoFetch(`/vod/show/${encodeURIComponent(id)}`);
  const d = j.data || {};
  const card = kanxoCard(d.vodrow || {});
  card.vod_blurb = d.vodrow?.content || d.vodrow?.description || d.vodrow?.intro || "";
  card.vod_area = (d.categories || []).map((c) => c.catename).filter(Boolean).join(" / ") || "";
  card.tags = (d.categories || []).map((c) => c.catename).filter(Boolean);
  card.similar = (d.similarrows || []).map(kanxoCard).map((x) => ({ vod_id: x.vod_id, vod_name: x.vod_name, vod_pic: x.vod_pic, vod_remarks: x.vod_remarks, vod_play_url: x.vod_play_url }));
  // 播放解锁改为前端执行（住宅 IP 直连媒体 CDN，绕开 CF 出口对媒体 CDN 的 403）。
  // 这里只保证 preview_url 传递；vod_play_url 由前端 kanxoResolveMediaFront 反推完整 master。
  card.needs_detail = false;
  card.httpurl_preview = d.vodrow?.httpurl_preview || "";
  return json({ ...card, provider: "kanxo" });
}

async function kanxoList(requestUrl) {
  const params = requestUrl.searchParams;
  const page = Number(params.get("pg") || params.get("page") || 1);
  const category = params.get("preset") || params.get("category") || "";
  const keyword = params.get("wd") || params.get("q") || "";
  const order = params.get("order") || "0";
  let j;
  if (keyword) {
    j = await kanxoFetch(`/search?wd=${encodeURIComponent(keyword)}&page=${page}`);
  } else {
    const cateid = category || "0";
    j = await kanxoFetch(`/v2/vod/listing-${cateid}-0-0-0-0-0-0-0-${order}-${page}`);
  }
  const d = j.data || {};
  const rows = d.vodrows || [];
  const cats = (d.categories || []).map((c) => ({ slug: String(c.cateid), name: c.catename }));
  const orders = (d.orders || []).map((o) => ({ slug: String(o.keyid), name: o.value }));
  return json({
    list: rows.map(kanxoCard),
    totalPages: (d.pageinfo && d.pageinfo.totalpage) || 1,
    cats,
    orders,
    provider: "kanxo",
  });
}

/* ---------------- Pornhub 公开目录 (ph, www.pornhub.com + *.phncdn.com, 实验来源) ---------------- */
const PH_ORIGIN = "https://www.pornhub.com";
const PH_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};
const PH_MEDIA_HEADERS = {
  ...PH_HEADERS,
  referer: "https://www.pornhub.com/view_video.php",
};
const PH_MEDIA_HOST = /^(iv-h|hv-h|ei|ev-h|ev|pix-fl|pix-cdn77)\.phncdn\.com$/i;

async function phPage(pathname) {
  const response = await fetch(new URL(pathname, PH_ORIGIN), { headers: PH_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`pornhub page ${response.status}`);
  return response.text();
}

function phCard(html) {
  const vkey = html.match(/data-video-vkey="([^"]+)"/)?.[1] || "";
  const title = decodeHtml(html.match(/<a[^>]+href="\/view_video\.php\?viewkey=[^"]*"[^>]*title="([^"]*)"/)?.[1] || vkey);
  const cover = phCoverUrl(html.match(/<img[^>]+src="(https:\/\/(?:[a-z0-9-]+\.)?phncdn\.com\/[^"]+)"/)?.[1] || "");
  const duration = html.match(/<var class="duration">([^<]+)<\/var>/)?.[1] || "";
  return {
    vod_id: vkey,
    vod_name: title,
    vod_pic: cover,
    vod_remarks: duration || "VIDEO",
    vod_area: "PORNHUB",
    type_name: "PORNHUB",
    media_kind: "video",
    needs_detail: true,
    provider: "ph",
  };
}

async function phList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd") || requestUrl.searchParams.get("q") || "";
  const preset = requestUrl.searchParams.get("preset") || requestUrl.searchParams.get("category") || "";
  let path;
  if (keyword) path = `/video/search?search=${encodeURIComponent(keyword)}&page=${page}`;
  else if (/^c:\d+$/.test(preset)) path = `/video?c=${preset.slice(2)}&page=${page}`;
  else if (/^slug:/.test(preset)) path = `/categories/${encodeURIComponent(preset.slice(5))}?page=${page}`;
  else path = `/video?page=${page}`;
  const html = await phPage(path);
  const items = (html.match(/<li[^>]*class="[^"]*pcVideoListItem[^"]*"[^>]*>[\s\S]*?<\/li>/g) || [])
    .map(phCard)
    .filter((card) => card.vod_id);
  const pages = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1])).filter((n) => n > 0);
  return json({ list: items, totalPages: Math.max(1, ...pages), provider: "ph" }, { headers: { "cache-control": "public, max-age=300" } });
}

function phMediaUrl(url) {
  return `/provider-api/ph?action=media&url=${encodeURIComponent(url)}`;
}

function phCoverUrl(url) {
  if (!url) return "";
  return /^https:\/\/pix-cdn77\.phncdn\.com\//i.test(url) ? phMediaUrl(url) : url;
}

function phResolveRef(reference, base) {
  const resolved = new URL(reference, base);
  if (!resolved.search && base.search) resolved.search = base.search;
  return resolved.toString();
}

function phExtractMediaDefinitions(html) {
  const start = html.indexOf('"mediaDefinitions"');
  if (start === -1) return [];
  const bracketStart = html.indexOf("[", start);
  if (bracketStart === -1) return [];
  let depth = 0, inString = false, escaped = false;
  for (let i = bracketStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return JSON.parse(html.slice(bracketStart, i + 1)); }
  }
  return [];
}

async function phDetail(id) {
  const html = await phPage(`/view_video.php?viewkey=${encodeURIComponent(id)}`);
  const title = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || id);
  const duration = Number(html.match(/"video_duration":(\d+)/)?.[1] || 0);
  const cover = phCoverUrl(html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || "");
  const hls = phExtractMediaDefinitions(html)
    .filter((d) => d.format === "hls" && d.videoUrl)
    .sort((a, b) => (Number(b.quality) || 0) - (Number(a.quality) || 0));
  const card = {
    vod_id: id,
    vod_name: title,
    vod_pic: cover,
    vod_remarks: duration ? formatDuration(duration) : "VIDEO",
    vod_area: "PORNHUB",
    type_name: "PORNHUB",
    media_kind: "video",
    provider: "ph",
  };
  if (hls.length) {
    card.vod_play_url = phMediaUrl(hls[0].videoUrl);
    card.streams = hls.map((d) => ({ label: `${d.quality}P`, url: phMediaUrl(d.videoUrl) }));
    card.play_notice = `公开 ${hls[0].quality}P HLS · 未加密`;
  } else {
    card.play_notice = "此条目无公开 HLS 播放地址";
  }
  return json(card);
}

async function phMedia(requestUrl) {
  const raw = requestUrl.searchParams.get("url") || "";
  let target;
  try { target = new URL(raw); } catch { return json({ message: "invalid media url" }, { status: 400 }); }
  if (!PH_MEDIA_HOST.test(target.hostname)) return json({ message: "invalid media host" }, { status: 400 });
  const isPlaylist = /\.m3u8$/i.test(target.pathname);
  const upstream = await fetch(target, { headers: PH_MEDIA_HEADERS, signal: AbortSignal.timeout(isPlaylist ? 15_000 : 30_000) });
  if (!upstream.ok) return json({ message: `ph media ${upstream.status}` }, { status: 502 });
  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = text.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      return phMediaUrl(phResolveRef(trimmed, target));
    }).join("\n");
    return new Response(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "public, max-age=60",
        "access-control-allow-origin": "*",
      },
    });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

const SF_ORIGIN = "https://www.sifangtv.cc";
const SF_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const SF_TABS = [
  ["", "最新"], ["20", "推荐"], ["21", "国产"], ["22", "日本"], ["23", "女优"], ["24", "中文"],
  ["25", "网红"], ["26", "动漫"], ["27", "欧美"], ["28", "国模"], ["29", "长腿"], ["30", "邻家"],
  ["31", "韩国"], ["32", "香港"],
];

async function sfPage(path) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    try {
      const response = await sfFetch(`${SF_ORIGIN}${path}`);
      if (!response.ok) throw new Error(`sifangtv.cc ${response.status}`);
      return response.body;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("sifangtv.cc unreachable");
}

let sfProxyModules = null;
async function sfGetProxy() {
  if (!sfProxyModules && typeof process !== "undefined" && (process.env.HTTPS_PROXY || process.env.HTTP_PROXY)) {
    try {
      sfProxyModules = {
        net: await import(/* @vite-ignore */ "node:net"),
        tls: await import(/* @vite-ignore */ "node:tls"),
        proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
      };
    } catch {
      sfProxyModules = null;
    }
  }
  return sfProxyModules;
}

function sfProxyRequest(urlString, mods, timeout) {
  const url = new URL(urlString);
  const targetPort = url.port || 443;
  const proxyUrl = new URL(mods.proxy);
  const proxyPort = Number(proxyUrl.port) || 80;
  return new Promise((resolve, reject) => {
    const socket = mods.net.connect({ host: proxyUrl.hostname, port: proxyPort });
    let settled = false;
    const fail = (error) => { if (!settled) { settled = true; reject(error); } };
    socket.setTimeout(timeout, () => { socket.destroy(); fail(new Error("sf proxy connect timeout")); });
    socket.on("error", fail);
    socket.on("connect", () => {
      socket.write(`CONNECT ${url.hostname}:${targetPort} HTTP/1.1\r\nHost: ${url.hostname}:${targetPort}\r\nProxy-Connection: keep-alive\r\n\r\n`);
    });
    let head = "";
    socket.on("data", (chunk) => {
      head += chunk.toString("latin1");
      const idx = head.indexOf("\r\n\r\n");
      if (idx === -1) return;
      const statusMatch = head.slice(0, idx).match(/^HTTP\/1\.[01] (\d+)/);
      if (!statusMatch || Number(statusMatch[1]) !== 200) {
        socket.destroy();
        fail(new Error("sf proxy CONNECT failed"));
        return;
      }
      if (settled) return;
      socket.removeAllListeners("data");
      const stream = mods.tls.connect({ socket, servername: url.hostname }, () => {
        if (settled) return;
        settled = true;
        stream.write(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.hostname}\r\nuser-agent: ${SF_UA}\r\naccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\naccept-encoding: identity\r\nconnection: close\r\n\r\n`);
        const resp = { status: 0 };
        let body = Buffer.alloc(0);
        let headerDone = false;
        stream.on("data", (data) => {
          if (!headerDone) {
            const rbuf = Buffer.concat([body, data]);
            const sep = rbuf.indexOf("\r\n\r\n");
            if (sep === -1) { body = rbuf; return; }
            const headText = rbuf.slice(0, sep).toString("latin1");
            const lines = headText.split("\r\n");
            const statusLine = lines[0].match(/^HTTP\/1\.[01] (\d+)/);
            resp.status = statusLine ? Number(statusLine[1]) : 0;
            headerDone = true;
            body = rbuf.slice(sep + 4);
          } else {
            body = Buffer.concat([body, data]);
          }
        });
        stream.on("end", () => {
          resolve({ ok: resp.status >= 200 && resp.status < 300, status: resp.status, body: body.toString("utf8") });
        });
        stream.on("error", fail);
        stream.setTimeout(timeout, () => { stream.destroy(); fail(new Error("sf proxy read timeout")); });
      });
      stream.on("error", fail);
    });
  });
}

async function sfFetch(urlString, { timeout = 25000 } = {}) {
  const proxyModules = await sfGetProxy();
  if (!proxyModules) {
    const response = await fetch(urlString, {
      headers: { "user-agent": SF_UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(timeout),
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }
  return sfProxyRequest(urlString, proxyModules, timeout);
}

function sfAsset(value = "") {
  if (!value) return "";
  if (/^https?:/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `${SF_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

function sfCards(html) {
  const cards = [];
  const seen = new Set();
  for (const block of html.split("/index.php/vod/play/id/").slice(1)) {
    const id = block.match(/^(\d+)/)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = decodeHtml(block.match(/alt="([^"]*)"/)?.[1] || `私房TV ${id}`);
    const cover = sfAsset(block.match(/data-src="([^"]+)"/)?.[1] || "");
    if (!cover) continue;
    const hd = /<span[^>]*>HD<\/span>/.test(block);
    cards.push({
      vod_id: id,
      vod_name: title,
      vod_pic: cover,
      vod_remarks: hd ? "HD" : "可播放",
      vod_area: "sifangtv.cc",
      type_name: "私房",
      media_kind: "video",
      needs_detail: true,
      provider: "sf",
    });
  }
  return cards;
}

async function sfList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd") || "";
  const preset = requestUrl.searchParams.get("preset") || requestUrl.searchParams.get("category") || "";
  let html;
  let pages = 1;
  if (keyword) {
    const encoded = encodeURIComponent(keyword);
    html = await sfPage(page === 1 ? `/index.php/vod/search/wd/${encoded}.html` : `/index.php/vod/search/wd/${encoded}/page/${page}.html`);
  } else if (!preset || preset === "home" || preset === "latest") {
    html = await sfPage("/");
  } else {
    const cat = SF_TABS.some(([key]) => key === preset) ? preset : "20";
    html = await sfPage(page === 1 ? `/index.php/vod/type/id/${cat}.html` : `/index.php/vod/type/id/${cat}/page/${page}.html`);
    pages = Math.max(1, ...[...html.matchAll(/\/type\/id\/\d+\/page\/(\d+)\.html/g)].map((m) => Number(m[1])));
  }
  const items = sfCards(html);
  return json({ list: items, page, pages, provider: "sf" }, { headers: { "cache-control": "public, max-age=120" } });
}

async function sfDetail(requestUrl) {
  const id = requestUrl.searchParams.get("id") || "";
  if (!id) return json({ message: "missing id" }, { status: 400 });
  const html = await sfPage(`/index.php/vod/play/id/${id}/sid/1/nid/1.html`);
  const card = {
    vod_id: id,
    vod_name: decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || id),
    vod_remarks: "HD",
    vod_area: "sifangtv.cc",
    type_name: "私房",
    media_kind: "video",
    provider: "sf",
  };
  const playerBlock = html.match(/var player_aaaa=(\{[\s\S]*?\})(?=<\/script>|;)/)?.[1];
  if (playerBlock) {
    try {
      const parsed = JSON.parse(playerBlock.replace(/\\\//g, "/").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
      const url = parsed.url || "";
      card.vod_play_url = url;
      card.streams = url ? [{ label: parsed.from || "线路1", url }] : [];
      card.play_notice = "公开 m3u8 · 直连";
      if (parsed.vod_data) {
        const vodClass = parsed.vod_data.vod_class;
        if (vodClass) card.vod_label = String(vodClass);
        const actor = parsed.vod_data.vod_actor;
        if (actor) card.vod_actor = String(actor);
      }
    } catch {
      card.play_notice = "播放地址解析失败";
    }
  } else {
    card.play_notice = "此条目无公开播放地址";
  }
  const related = sfCards(html).filter((item) => item.vod_id !== id).slice(0, 12);
  if (related.length) card.related = related;
  return json(card);
}

const JS9_ORIGIN = "https://jiuse.tv";
const JS9_TABS = [
  ["latest", "最新"], ["hd", "高清"], ["recent-favorite", "最近加精"], ["hot-list", "当前最热"],
  ["recent-rating", "最近得分"], ["nonpaid", "非付费"], ["ori", "91原创"], ["long-list", "10分钟+"],
  ["longer-list", "20分钟+"], ["month-discuss", "本月讨论"], ["top-favorite", "本月收藏"],
  ["most-favorite", "收藏最多"], ["top-list", "本月最热"], ["top-last", "上月最热"],
];

async function js9Page(path) {
  const response = await fetch(`${JS9_ORIGIN}${path}`, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`jiuse.tv ${response.status}`);
  return await response.text();
}

function js9Cover(url) {
  if (!url) return "";
  return url.replace(/^\/\//, "https://").replace(/^http:\/\//i, "https://");
}

function js9Cards(html) {
  const cards = [];
  for (const block of html.split('<div class="video-elem">').slice(1)) {
    const href = block.match(/class="display[^"]*" href="([^"]+)"/)?.[1];
    if (!href) continue;
    const match = href.match(/\/(video|vod|videos)\/view\/([^/"]+)/);
    if (!match) continue;
    const kind = match[1];
    const id = match[2];
    const slug = kind === "videos" ? (href.match(/\/([^/"]+)\/$/)?.[1] || "") : "";
    const cover = js9Cover(block.match(/background-image:\s*url\('([^']+)'\)/)?.[1] || "");
    const layer = block.match(/<small class="layer">([^<]*)<\/small>/)?.[1] || "";
    const title = decodeHtml(block.match(/class="title[^"]*" href="[^"]+">([\s\S]*?)<\/a>/)?.[1] || "");
    if (!title) continue;
    const author = decodeHtml(block.match(/作者:\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1] || "");
    const muted = [...block.matchAll(/<div class="text-muted">([\s\S]*?)<\/div>/g)].map((m) => decodeHtml(m[1]));
    const stats = muted.pop() || "";
    cards.push({
      vod_id: id,
      vod_kind: kind,
      vod_slug: slug,
      vod_name: title,
      vod_pic: cover,
      vod_remarks: layer || "VIDEO",
      vod_area: author || "—",
      vod_blurb: stats,
      type_name: kind === "video" ? "91自拍" : kind === "vod" ? "精选" : "视频",
      media_kind: "video",
      provider: "js9",
      needs_detail: true,
    });
  }
  return cards;
}

async function js9Home() {
  const [videoHtml, vodHtml, videosHtml] = await Promise.all([js9Page("/"), js9Page("/vod"), js9Page("/videos")]);
  const list = [...js9Cards(videoHtml).slice(0, 17), ...js9Cards(vodHtml).slice(0, 12), ...js9Cards(videosHtml).slice(0, 12)];
  return { list };
}

async function js9List(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = requestUrl.searchParams.get("wd") || "";
  const preset = requestUrl.searchParams.get("preset") || requestUrl.searchParams.get("category") || "";
  if (keyword) {
    const html = await js9Page(`/video/search?q=${encodeURIComponent(keyword)}`);
    return json({ list: js9Cards(html), page: 1, pages: 1, provider: "js9" }, { headers: { "cache-control": "public, max-age=60" } });
  }
  if (!preset || preset === "home" || !JS9_TABS.some(([key]) => key === preset)) {
    const home = await js9Home();
    return json({ ...home, page: 1, pages: 1, provider: "js9" }, { headers: { "cache-control": "public, max-age=180" } });
  }
  const path = page === 1 ? `/video/${preset}` : `/video/category/${preset}/${page}`;
  const html = await js9Page(path);
  const items = js9Cards(html);
  const pages = Math.max(1, ...[...html.matchAll(new RegExp(`/video/category/${preset}/(\\d+)`, "g"))].map((m) => Number(m[1])));
  return json({ list: items, page, pages, provider: "js9" }, { headers: { "cache-control": "public, max-age=180" } });
}

async function js9Detail(requestUrl) {
  const id = requestUrl.searchParams.get("id") || "";
  const kind = requestUrl.searchParams.get("kind") || "video";
  const slug = requestUrl.searchParams.get("slug") || "";
  if (!id) return json({ message: "missing id" }, { status: 400 });
  const path = kind === "video" ? `/video/view/${id}` : kind === "vod" ? `/vod/view/${id}` : `/videos/view/${id}/${slug || "1"}`;
  const html = await js9Page(path);
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || id).replace(/[-\s]*(?:91视频\|91自拍\|国产自拍|蝌蚪窝\|成人电影\|91PORNY\|九色)[^\n]*$/i, "");
  const cover = js9Cover(html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || html.match(/data-poster="([^"]+)"/)?.[1] || "");
  const playUrl = js9Cover(decodeHtml((html.match(/data-src="([^"]+)"/) || [])[1] || ""));
  const card = {
    vod_id: id,
    vod_kind: kind,
    vod_name: title,
    vod_pic: cover,
    vod_remarks: "VIDEO",
    vod_area: "看九色",
    type_name: kind === "video" ? "91自拍" : kind === "vod" ? "精选" : "视频",
    media_kind: "video",
    provider: "js9",
  };
  if (kind === "video" && playUrl) {
    const lines = [playUrl];
    const seen = new Set([playUrl]);
    const others = await Promise.all(["line2", "line3"].map(async (server) => {
      try {
        const lineHtml = await js9Page(`/video/view/${id}?server=${server}`);
        const lineSrc = js9Cover(decodeHtml((lineHtml.match(/data-src="([^"]+)"/) || [])[1] || ""));
        if (lineSrc && !seen.has(lineSrc)) { seen.add(lineSrc); return lineSrc; }
      } catch { /* line unavailable */ }
      return null;
    }));
    lines.push(...others.filter(Boolean));
    card.vod_play_url = lines[0];
    card.streams = lines.map((url, index) => ({ label: `线路${index + 1}`, url }));
    card.play_notice = "公开 m3u8 · 多线路直连";
  } else if (playUrl) {
    card.vod_play_url = playUrl;
    card.streams = [{ label: kind === "videos" ? "直连" : "线路1", url: playUrl }];
    card.play_notice = kind === "videos" ? "公开 MP4 直连" : "公开 m3u8 · 直连";
  } else {
    card.play_notice = "此条目无公开播放地址";
  }
  return json(card);
}

const JAV_ORIGIN = "https://javhd.com";
const JAV_HEADERS = {
  accept: "application/json, text/plain, */*",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "x-requested-with": "XMLHttpRequest",
};
const JAV_DETAIL_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};

function javAsset(value = "") {
  if (!value) return "";
  const cleaned = value.replace(/&amp;/g, "&");
  if (/^https?:/i.test(cleaned)) return cleaned;
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  return `${JAV_ORIGIN}${cleaned.startsWith("/") ? "" : "/"}${cleaned}`;
}

function javMediaUrl(url) {
  return `/provider-api/jav?action=media&url=${encodeURIComponent(url)}`;
}

function javCardFromObject(item = {}) {
  const id = String(item.id || "");
  if (!/^\d+$/.test(id)) return null;
  const free = item.isFreeCreatorVideo === true || item.isFreeCreatorVideo === 1;
  const label = free ? "premiumFree" : "premium";
  return {
    vod_id: id,
    vod_player_id: id,
    vod_name: decodeHtml(item.title || `JAV ${id}`),
    vod_pic: javAsset(item.thumbs?.["728x413"] || item.thumbs?.["468x264"] || item.thumbs?.["374x233"] || ""),
    vod_remarks: item.length || label,
    vod_blurb: [item.clicks && `${item.clicks} 次观看`, item.rating?.good_per != null && `${item.rating.good_per}%`].filter(Boolean).join(" · "),
    vod_label: label,
    vod_preview: javAsset(item.video || ""),
    vod_url: javAsset(item.studioUrl || `/zh/id/${id}`),
    vod_area: "javhd.com",
    type_name: free ? "免费" : "premium",
    media_kind: "video",
    needs_detail: true,
    provider: "jav",
  };
}

function javParseCards(jsonText) {
  const cards = [];
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    return cards;
  }
  if (Array.isArray(payload.template)) return payload.template.map(javCardFromObject).filter(Boolean);
  if (payload.status !== 1 || typeof payload.template !== "string") return cards;
  const count = payload.results_count;
  const seen = new Set();
  for (const block of payload.template.split("<thumb-component").slice(1)) {
    const link = block.match(/link-content="([^"]+)"/)?.[1] || "";
    const id = block.match(/video-id="(\d+)"/)?.[1] || link.match(/\/zh\/id\/(\d+)/)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = decodeHtml(block.match(/title="([^"]*)"/)?.[1] || `JAV ${id}`);
    const cover = javAsset(block.match(/url-thumb="([^"]+)"/)?.[1] || "");
    const preview = javAsset(block.match(/video-preview="([^"]+)"/)?.[1] || "");
    const label = block.match(/has-label="([^"]*)"/)?.[1] || "";
    const time = block.match(/time="([^"]*)"/)?.[1] || "";
    const views = decodeHtml(block.match(/views="([^"]*)"/)?.[1] || "");
    const likes = block.match(/likes="([^"]*)"/)?.[1] || "";
    cards.push({
      vod_id: id,
      vod_player_id: id,
      vod_name: title,
      vod_pic: cover,
      vod_remarks: time || (label ? label : "VIDEO"),
      vod_blurb: [views && `${views.trim()} 次观看`, likes && `${likes} 喜欢`].filter(Boolean).join(" · "),
      vod_label: label,
      vod_preview: preview,
      vod_url: link,
      vod_area: "javhd.com",
      type_name: label === "premiumFree" ? "免费" : label || "JAV",
      media_kind: "video",
      needs_detail: true,
      provider: "jav",
    });
  }
  return cards;
}

function javParseHtmlCards(html) {
  const cards = [];
  const seen = new Set();
  const anchors = [...html.matchAll(/<a\b[^>]*class=["'][^"']*thumb__link[^"']*["'][^>]*>/gi)];
  for (let i = 0; i < anchors.length; i += 1) {
    const tag = anchors[i][0];
    const block = html.slice(anchors[i].index, anchors[i + 1]?.index || html.length);
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1] || "";
    const id = tag.match(/(?:data-(?:rstat|stat)-id|\/zh\/id\/)(\d+)/i)?.[1] || href.match(/\/zh\/id\/(\d+)/i)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = decodeHtml(tag.match(/title=["']([^"']*)["']/i)?.[1] || `JAV ${id}`);
    const style = tag.match(/--backgroundThumb:\s*url\(([^)]+)\)/i)?.[1] || "";
    const time = block.match(/thumb__label--time[^>]*>([^<]*)</i)?.[1]?.trim() || "";
    const premium = /thumb__label-icon--premium/i.test(block);
    cards.push({
      vod_id: id,
      vod_player_id: id,
      vod_name: title,
      vod_pic: javAsset(style),
      vod_remarks: time || (premium ? "premium" : "VIDEO"),
      vod_label: premium ? "premium" : "",
      vod_url: javAsset(href),
      vod_area: "javhd.com",
      type_name: premium ? "premium" : "免费",
      media_kind: "video",
      needs_detail: true,
      provider: "jav",
    });
  }
  return cards;
}

function javPageCount(jsonText, page) {
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    return page;
  }
  const total = Number(payload.results_count || 0);
  const per = Number(payload.per_page || 36);
  if (total > 0 && per > 0) return Math.max(page, Math.ceil(total / per));
  return page;
}

async function javFetch(path, detail = false, init = {}) {
  const upstream = new URL(path, JAV_ORIGIN);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(upstream, {
        ...init,
        headers: { ...(detail ? JAV_DETAIL_HEADERS : JAV_HEADERS), ...(init.headers || {}) },
        signal: init.signal || AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`javhd ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

async function javList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = (requestUrl.searchParams.get("wd") || "").trim();
  const preset = (requestUrl.searchParams.get("preset") || "home").trim();
  let text;
  let list;
  let pages;
  if (keyword) {
    text = await javFetch(`/zh/search?q=${encodeURIComponent(keyword)}${page > 1 ? `&page=${page}` : ""}`);
    list = javParseCards(text);
    pages = javPageCount(text, page);
  } else if (preset === "home" && page === 1) {
    text = await javFetch("/zh/api/content_block?block=custom&pgid=532619287&isCasting=1&count=21&offset=0&castingPosition=8", false, {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest", accept: "application/json, text/plain, */*" },
    });
    list = javParseCards(text);
    pages = 1;
  } else {
    const path = preset === "popular" ? "/zh/japanese-porn-videos/popular"
      : preset === "top" ? "/zh/japanese-porn-videos/top?content=jav"
        : page > 1 ? `/zh/japanese-porn-videos/justadded/all/${page}` : "/zh/japanese-porn-videos";
    text = await javFetch(path);
    list = javParseCards(text);
    pages = javPageCount(text, page);
  }
  return json({ list, page, pages, total: list.length, provider: "jav" }, {
    headers: { "cache-control": keyword ? "public, max-age=60" : "public, max-age=180" },
  });
}

function javPlayerId(html) {
  const match = html.match(/content-path="([^"]*player_api[^"]*)"/);
  if (!match) return "";
  return match[1].match(/videoId=(\d+)/)?.[1] || "";
}

async function javDetail(requestUrl) {
  const id = requestUrl.searchParams.get("id") || "";
  const link = requestUrl.searchParams.get("link") || "";
  if (!id) return json({ message: "missing id" }, { status: 400 });
  const path = link ? link.replace(/^https?:\/\/javhd\.com/i, "").split("?")[0] : "";
  const html = await javFetch(path || `/zh/studio/room/1pondo-big-tits/video/${id}`, true);
  const title = decodeHtml(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || id);
  const cover = javAsset(html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || "");
  const pid = javPlayerId(html) || id;
  const play = await javPlay(new URL(`/provider-api/jav?action=play&pid=${pid}`, "https://local.invalid"));
  const playBody = JSON.parse(await play.text());
  return json({
    vod_id: id,
    vod_player_id: pid,
    vod_name: title,
    vod_pic: cover,
    vod_remarks: "VIDEO",
    vod_area: "javhd.com",
    type_name: "JAV",
    media_kind: "video",
    needs_detail: false,
    vod_play_url: playBody.vod_play_url,
    streams: playBody.streams,
    poster: playBody.poster,
    play_notice: playBody.play_notice,
    provider: "jav",
  }, { headers: { "cache-control": "public, max-age=60" } });
}

async function javPlay(requestUrl) {
  const pid = requestUrl.searchParams.get("pid") || requestUrl.searchParams.get("id") || "";
  if (!pid || !/^\d+$/.test(pid)) return json({ message: "invalid player id" }, { status: 400 });
  const response = await fetch(`${JAV_ORIGIN}/zh/player_api?videoId=${pid}&is_trailer=0`, {
    headers: { ...JAV_HEADERS, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return json({ message: `javhd player_api ${response.status}` }, { status: 502 });
  const data = await response.json();
  const sources = Array.isArray(data.sources) ? data.sources : [];
  if (!sources.length) return json({ message: "javhd no public stream" }, { status: 502 });
  const label = (source) => `${source.label || `${source.res || ""}p`}p`;
  return json({
    vod_id: pid,
    vod_play_url: javMediaUrl(sources[0].src),
    streams: sources.map((source, index) => ({
      label: `${source.label || source.res || "高清"}${index === 0 ? " · 直连" : ""}`,
      url: javMediaUrl(source.src),
      quality: Number(source.res) || 0,
    })),
    poster: javAsset(data.poster || ""),
    play_notice: "javhd 匿名签名直链 · 完整版 4 码率",
    provider: "jav",
  }, { headers: { "cache-control": "no-store" } });
}

async function javMedia(requestUrl, request) {
  let target;
  try { target = new URL(requestUrl.searchParams.get("url") || ""); } catch { return json({ message: "invalid jav media" }, { status: 400 }); }
  if (!/^(?:c3|c4)\.cdnjhd\.com$/i.test(target.hostname) || !/\/content-01\/contents\//i.test(target.pathname)) {
    return json({ message: "invalid jav media host" }, { status: 400 });
  }
  const headers = { ...JAV_DETAIL_HEADERS };
  const range = request?.headers?.get?.("range");
  if (range) headers.range = range;
  const upstream = await fetch(target, { headers, signal: AbortSignal.timeout(30_000) });
  const out = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  out.set("access-control-allow-origin", "*");
  out.set("cache-control", "public, max-age=300");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

const AVJB_ORIGIN = "https://avjb.com";
const AVJB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function avjbPage(path) {
  const upstream = new URL(path, AVJB_ORIGIN);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(upstream, {
        headers: { "user-agent": AVJB_UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`avjb ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

function avjbCover(url = "") {
  if (!url) return "";
  if (/^https?:/i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${AVJB_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

function avjbCards(html) {
  const cards = [];
  for (const block of html.split('class="item').slice(1)) {
    const href = block.match(/href="(https:\/\/avjb\.com\/video\/\d+[^"]*)"/)?.[1];
    if (!href) continue;
    const id = href.match(/\/video\/(\d+)\//)?.[1];
    if (!id) continue;
    const title = decodeHtml(block.match(/title="([^"]*)"/)?.[1] || "");
    const cover = avjbCover(block.match(/data-original="([^"]+)"/)?.[1] || block.match(/data-webp="([^"]+)"/)?.[1] || "");
    const preview = block.match(/data-preview="([^"]+)"/)?.[1] || "";
    const duration = block.match(/<div class="duration">([^<]*)<\/div>/)?.[1] || "";
    const hd = /is-hd/.test(block.split('<div class="img">')[0] || block);
    const vip = /is-vip/.test(block);
    const rating = block.match(/<div class="rating[^"]*">([\s\S]*?)(\d+%)\s*<\/div>/)?.[2] || "";
    if (!title) continue;
    cards.push({
      vod_id: id,
      vod_name: title,
      vod_pic: cover,
      vod_preview: preview ? avjbCover(preview) : "",
      vod_remarks: duration || (vip ? "VIP" : "VIDEO"),
      vod_url: href,
      vod_area: "avjb.com",
      type_name: vip ? "VIP" : "AVJB",
      vod_label: [hd && "HD", vip && "VIP"].filter(Boolean).join(" ") || "",
      vod_blurb: [rating && `好评 ${rating}`, hd && "HD"].filter(Boolean).join(" · "),
      media_kind: "video",
      needs_detail: true,
      provider: "avjb",
    });
  }
  return cards;
}

async function avjbCategories() {
  const html = await avjbPage("/categories/");
  const cats = [];
  const seen = new Set();
  for (const block of html.split('href="https://avjb.com/categories/').slice(1)) {
    const slug = block.slice(0, block.indexOf('"')).replace(/\/+$/, "");
    if (!/^[a-z0-9-]+$/i.test(slug) || seen.has(slug)) continue;
    const title = block.match(/title="([^"]*)"/)?.[1];
    if (!title) continue;
    seen.add(slug);
    cats.push({ id: slug, name: decodeHtml(title).replace(/-\s*爱微社区\s*$/, "").trim() });
  }
  return cats;
}

async function avjbList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const keyword = (requestUrl.searchParams.get("wd") || "").trim();
  const preset = requestUrl.searchParams.get("preset") || requestUrl.searchParams.get("category") || "";
  if (keyword) {
    const html = await avjbPage(`/search/?q=${encodeURIComponent(keyword)}`);
    return json({ list: avjbCards(html), page: 1, pages: 1, provider: "avjb" }, { headers: { "cache-control": "public, max-age=60" } });
  }
  let html;
  const catSlug = preset.startsWith("cat:") ? preset.slice(4) : "";
  if (preset === "cat") {
    const cats = await avjbCategories();
    return json({ list: cats.map((cat) => ({ vod_id: `c${cat.id}`, vod_name: cat.name, vod_remarks: "分类", vod_url: `/categories/${cat.id}/`, vod_area: "avjb.com", type_name: "分类", media_kind: "gallery", needs_detail: false, provider: "avjb" })), page: 1, pages: 1, provider: "avjb" }, { headers: { "cache-control": "public, max-age=600" } });
  } else if (catSlug) {
    html = page > 1
      ? await avjbPage(`/categories/${catSlug}/?mode=async&function=get_block&block_id=list_videos_common_videos_list&sort_by=post_date&from=${page}`)
      : await avjbPage(`/categories/${catSlug}/`);
    const items = avjbCards(html);
    const maxFrom = Math.max(1, ...[...html.matchAll(/from:(\d+)/g)].map((m) => Number(m[1])));
    return json({ list: items, page, pages: maxFrom + 1, provider: "avjb" }, { headers: { "cache-control": "public, max-age=180" } });
  } else if (preset === "new" || preset === "latest") {
    html = await avjbPage(page > 1 ? `/new/${page}/` : "/new/");
  } else if (preset === "vip" || preset === "premium") {
    html = await avjbPage(page > 1 ? `/premium/?mode=async&function=get_block&block_id=list_videos_common_videos_list&sort_by=post_date&from=${page}` : "/premium/");
  } else if (preset === "albums") {
    html = await avjbPage("/albums/");
    const list = [];
    for (const block of html.split('class="item').slice(1)) {
      const href = block.match(/href="(https:\/\/avjb\.com\/albums\/\d+[^"]*)"/)?.[1];
      if (!href) continue;
      const id = href.match(/\/albums\/(\d+)\//)?.[1];
      const title = decodeHtml(block.match(/title="([^"]*)"/)?.[1] || "");
      const cover = avjbCover(block.match(/data-original="([^"]+)"/)?.[1] || "");
      const count = block.match(/<div class="duration">([^<]*)<\/div>/)?.[1] || "";
      if (!title) continue;
      list.push({ vod_id: `a${id}`, vod_name: title, vod_pic: cover, vod_remarks: count || "相册", vod_url: href, vod_area: "avjb.com", type_name: "相册", media_kind: "image", media_url: cover, needs_detail: false, provider: "avjb" });
    }
    return json({ list, page: 1, pages: 1, provider: "avjb" }, { headers: { "cache-control": "public, max-age=300" } });
  } else {
    html = await avjbPage("/");
  }
  const list = avjbCards(html);
  const unique = [];
  const seen = new Set();
  for (const card of list) {
    if (seen.has(card.vod_id)) continue;
    seen.add(card.vod_id);
    unique.push(card);
  }
  if (!preset || preset === "home") return json({ list: unique.slice(0, 24), page: 1, pages: 1, provider: "avjb" }, { headers: { "cache-control": "public, max-age=180" } });
  if (preset === "new" || preset === "latest") {
    const pages = Math.max(1, ...[...html.matchAll(/\/new\/(\d+)\//g)].map((m) => Number(m[1])));
    return json({ list: unique, page, pages, provider: "avjb" }, { headers: { "cache-control": "public, max-age=180" } });
  }
  return json({ list, page: 1, pages: 1, provider: "avjb" }, { headers: { "cache-control": "public, max-age=180" } });
}

async function avjbDetail(requestUrl) {
  const id = requestUrl.searchParams.get("id") || "";
  const link = requestUrl.searchParams.get("link") || "";
  if (!id) return json({ message: "missing id" }, { status: 400 });
  const path = link ? link.replace(/^https?:\/\/avjb\.com/i, "").split("?")[0] : "";
  const html = await avjbPage(path || `/video/${id}/`);
  const title = decodeHtml(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/-\s*爱微社区\s*$/, "") || id);
  const cover = avjbCover(html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || "");
  const durationSec = Number(html.match(/<meta property="video:duration" content="(\d+)"/)?.[1] || 0);
  const durationText = durationSec > 0 ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")}` : "";
  const date = html.match(/<meta property="og:video:release_date" content="([^"]+)"/)?.[1] || "";
  const views = html.match(/<meta property="ya:ovs:views_total" content="(\d+)"/)?.[1] || "";
  const quality = html.match(/<meta property="ya:ovs:quality" content="([^"]+)"/)?.[1] || "";
  const tags = (html.match(/<meta property="video:tag" content="([^"]+)"/)?.[1] || "").split(/,\s*/).filter(Boolean);
  const cats = [];
  for (const m of html.matchAll(/href="(https:\/\/avjb\.com\/categories\/[a-f0-9]+)/g)) cats.push(m[1].split("/").pop());
  const card = {
    vod_id: id,
    vod_name: title,
    vod_pic: cover,
    vod_remarks: durationText || "VIDEO",
    vod_area: "avjb.com",
    vod_year: date?.slice(0, 4) || "",
    type_name: quality ? quality.toUpperCase() : "AVJB",
    vod_blurb: [views && `${views} 次观看`, tags.join(" · ")].filter(Boolean).join("  "),
    media_kind: "video",
    provider: "avjb",
  };
  if (durationSec > 0) {
    const play = avjbBuildPlaylist(id, durationSec);
    card.vod_play_url = play.url;
    card.streams = [{ label: "裸 CDN 完整片", url: play.url }];
    card.play_notice = `公开完整片 · ${play.count} 段 × 2s（list.avstatic.com 直连）`;
  } else {
    card.play_notice = "此条目无公开播放地址";
  }
  return json(card, { headers: { "cache-control": "public, max-age=60" } });
}

function avjbBuildPlaylist(id, durationSec) {
  const bucket = Math.floor(Number(id) / 1000) * 1000;
  const count = Math.max(1, Math.ceil(durationSec / 2));
  let body = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n";
  for (let i = 0; i < count; i++) {
    body += "#EXTINF:2.000000,\n";
    body += `https://list.avstatic.com/cdn/videos/${bucket}/${id}/${String(i).padStart(4, "0")}.jpg\n`;
  }
  body += "#EXT-X-ENDLIST\n";
  return { url: `data:application/vnd.apple.mpegurl;base64,${btoa(body)}`, count };
}

function btoa(value) {
  if (typeof Buffer !== "undefined") return Buffer.from(value, "utf8").toString("base64");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < value.length; i += 3) {
    const c1 = value.charCodeAt(i), c2 = i + 1 < value.length ? value.charCodeAt(i + 1) : NaN, c3 = i + 2 < value.length ? value.charCodeAt(i + 2) : NaN;
    const b1 = c1 >> 2, b2 = ((c1 & 3) << 4) | ((c2 >> 4) || 0), b3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | ((c3 >> 6) || 0), b4 = isNaN(c3) ? 64 : (c3 & 63);
    out += chars[b1] + chars[b2] + (b3 === 64 ? "=" : chars[b3]) + (b4 === 64 ? "=" : chars[b4]);
  }
  return out;
}

/* ---------------- dsd / 看懂色帝 (dsd900.com, MacCMS 10) ---------------- */
const DSD_ORIGIN = "https://www.dsd900.com";
const DSD_HEADERS = {
  referer: "https://www.dsd900.com/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
};

async function dsdPage(pathname, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(new URL(pathname, DSD_ORIGIN), { headers: DSD_HEADERS, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`dsd page ${response.status}`);
      return response.text();
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw last;
}

function dsdMediaUrl(path, kind = "image") {
  return `/provider-api/dsd?action=media&kind=${kind}&path=${encodeURIComponent(path.replace(/^https?:\/\/[^/]+/i, ""))}`;
}

function dsdParseCards(html) {
  const cards = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a href="(\/index\.php\/vod\/play\/id\/(\d+)[^"]*)" class="video-item">([\s\S]*?)<\/a>/g)) {
    const id = match[2];
    if (seen.has(id)) continue;
    seen.add(id);
    const block = match[3];
    const pic = block.match(/data-src="([^"]+)"/)?.[1] || "";
    const title = decodeHtml(block.match(/class="video-desc[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]?.trim() || "") || id;
    const duration = block.match(/video-item-tag-duration[^>]*>([^<]*)</)?.[1]?.trim() || "";
    const hits = block.match(/video-item-tag-hits[^>]*>([^<]*)</)?.[1]?.trim() || "";
    const isVip = /video-item-tag-is-vip/.test(block);
    cards.push({
      vod_id: id,
      vod_name: title,
      vod_pic: pic ? dsdMediaUrl(pic) : "",
      vod_remarks: duration || (isVip ? "VIP" : "VIDEO"),
      vod_blurb: [isVip ? "会员" : "免费", hits, duration].filter(Boolean).join(" · "),
      vod_content: hits,
      vod_area: "dsd900.com",
      type_name: isVip ? "会员" : "免费",
      media_kind: "video",
      needs_detail: true,
      provider: "dsd",
    });
  }
  return cards;
}

function dsdParseRelated(html) {
  const cards = [];
  const seen = new Set();
  for (const match of html.matchAll(/<li class="madou1">([\s\S]*?)<\/li>/g)) {
    const block = match[1];
    const href = block.match(/href="(\/index\.php\/vod\/play\/id\/(\d+)[^"]*)"/)?.[1] || "";
    const id = href.match(/id\/(\d+)\//)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const pic = block.match(/data-src="([^"]+)"/)?.[1] || "";
    const title = decodeHtml(block.match(/<h2>([\s\S]*?)<\/h2>/)?.[1]?.trim() || "") || id;
    const duration = block.match(/class="duration">([^<]*)</)?.[1]?.trim() || "";
    const counts = block.match(/class="counts"[^>]*>([^<]*)</)?.[1]?.trim() || "";
    const isVip = /class="tag vip"/.test(block);
    cards.push({
      vod_id: id,
      vod_name: title,
      vod_pic: pic ? dsdMediaUrl(pic) : "",
      vod_remarks: duration || (isVip ? "VIP" : "VIDEO"),
      vod_blurb: [isVip ? "会员" : "免费", counts].filter(Boolean).join(" · "),
      vod_area: "dsd900.com",
      type_name: isVip ? "会员" : "免费",
      media_kind: "video",
      needs_detail: true,
      provider: "dsd",
    });
  }
  return cards;
}

async function dsdList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg") || 1));
  const preset = requestUrl.searchParams.get("preset")?.trim() || "";
  const wd = requestUrl.searchParams.get("wd")?.trim() || "";
  let html;
  let pages = page;
  if (preset === "cat") {
    const cats = await dsdCats();
    return json({ code: 1, page: 1, pagecount: 1, limit: cats.length, total: cats.length, list: cats.map((cat) => ({ vod_id: `cat:${cat.id}`, vod_name: cat.name, vod_remarks: "分类", vod_url: `/index.php/vod/type/id/${cat.id}.html`, vod_area: "dsd900.com", type_name: "分类", media_kind: "gallery", needs_detail: false, provider: "dsd" })), provider: "dsd" }, { headers: { "cache-control": "public, max-age=600" } });
  }
  if (wd) {
    html = await dsdPage(`/index.php/vod/search/wd/${encodeURIComponent(wd)}.html`);
    pages = 1;
  } else if (preset.startsWith("cat:")) {
    const cid = preset.slice(4);
    html = await dsdPage(`/index.php/vod/type/id/${cid}${page > 1 ? `/page/${page}` : ""}.html`);
    pages = Math.max(page, ...[...html.matchAll(/type\/id\/\d+\/page\/(\d+)\.html/g)].map((m) => Number(m[1])));
  } else {
    html = await dsdPage(page === 1 ? "/" : `/index.php/vod/type/id/1/page/${page}.html`);
    pages = Math.max(page, ...[...html.matchAll(/type\/id\/1\/page\/(\d+)\.html/g)].map((m) => Number(m[1])));
  }
  const list = dsdParseCards(html);
  return json({ code: 1, page, pagecount: pages, limit: list.length || 24, total: pages * 24, list, provider: "dsd" }, { headers: { "cache-control": "public, max-age=120" } });
}

async function dsdCats() {
  const html = await dsdPage("/");
  const cats = [];
  const seen = new Set();
  for (const match of html.matchAll(/href="(\/index\.php\/vod\/type\/id\/(\d+)\.html)"[^>]*>\s*([^<]+)</g)) {
    const cid = match[2];
    const name = decodeHtml(match[3].trim());
    if (seen.has(cid)) continue;
    seen.add(cid);
    cats.push({ id: cid, name, type_name: "分类" });
  }
  if (cats.length === 0) {
    cats.push({ id: "1", name: "独家精选", type_name: "分类" }, { id: "2", name: "中文字幕", type_name: "分类" }, { id: "4", name: "无码破解", type_name: "分类" });
  }
  return cats;
}

async function dsdDetail(requestUrl) {
  const id = requestUrl.searchParams.get("id") || "";
  if (!/^\d+$/.test(id)) return json({ message: "invalid id" }, { status: 400 });
  const html = await dsdPage(`/index.php/vod/play/id/${id}/sid/1/nid/1.html`);
  const title = decodeHtml(html.match(/<h2 class="ellipsis">([\s\S]*?)<\/h2>/)?.[1]?.trim() || html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s*-\s*.*$/, "") || id);
  const desc = decodeHtml(html.match(/<div class="desc">([\s\S]*?)<\/div>/)?.[1]?.trim() || "");
  const tags = [...html.matchAll(/href="\/index\.php\/vod\/search\/tag\/[^"]*"[^>]*>([^<]*)<\/a>/g)].map((m) => decodeHtml(m[1].trim())).filter(Boolean);
  const hits = decodeHtml((html.match(/class="view-times"[^>]*>[\s\S]{0,400}?([^<]*次)/) || [])[1]?.trim() || (html.match(/<span class="view-times[^"]*">([^<]*)</) || [])[1]?.trim() || "");
  const player = html.match(/player_aaaa=(\{[\s\S]*?\})\s*<\/script>/)?.[1] || html.match(/player_aaaa=(\{[\s\S]*?\});/)?.[1] || "";
  let rawUrl = "", poster = "";
  if (player) {
    try {
      const data = JSON.parse(player);
      rawUrl = data.url || "";
      poster = data.poster || "";
    } catch (error) {
      const m = html.match(/"url":"([^"]+)"/) || html.match(/"url":"((?:\\u002f|\/)[^"]*m3u8)/);
      if (m) rawUrl = m[1].replace(/\\u002f/g, "/");
      poster = html.match(/"poster":"([^"]+)"/)?.[1]?.replace(/\\u002f/g, "/") || "";
    }
  }
  // VIP-gated videos hide player_aaaa, but the m3u8 is derivable from the poster
  // path (dir + 1000k/index.m3u8) and the vplayer signature endpoint serves all.
  if (!rawUrl && !poster) poster = html.match(/class="video-before-ad[^"]*"[^>]*style="background-image:\s*url\(([^)]+)\)/)?.[1]?.trim() || "";
  if (!rawUrl && poster && /\.jpg$/i.test(poster)) {
    const dir = poster.slice(0, poster.lastIndexOf("/") + 1);
    rawUrl = `${dir}1000k/index.m3u8`;
  }
  const card = {
    vod_id: id,
    vod_name: title,
    vod_pic: poster ? dsdMediaUrl(poster) : "",
    vod_remarks: "VIDEO",
    vod_blurb: [desc, hits].filter(Boolean).join("  "),
    vod_content: [desc, tags.join(" · ")].filter(Boolean).join("\n"),
    vod_area: "dsd900.com",
    type_name: tags[0] || "懂色帝",
    media_kind: "video",
    needs_detail: false,
    provider: "dsd",
    metadata: { tags, desc, related: dsdParseRelated(html).slice(0, 12) },
  };
  if (rawUrl && /\.m3u8/i.test(rawUrl)) {
    card.vod_play_url = dsdMediaUrl(rawUrl, "hls");
    card.fallback_embed_url = `${DSD_ORIGIN}/addons/vplayer/?url=${encodeURIComponent(rawUrl)}&jump=`;
    card.play_notice = "完整片 · AES-128 HLS（jsfuck 签名 + 同源代理）";
  } else {
    card.play_notice = "此条目无公开播放地址";
  }
  return json(card, { headers: { "cache-control": "public, max-age=120" } });
}

function dsdDecodeJsfuck(html) {
  const i = html.indexOf("\uFF9F\u03C9\uFF9F\uFF89");
  if (i === -1) return null;
  const j = html.indexOf("</script>", i);
  const jsfuck = html.slice(i, j);
  let captured = "";
  const mockVideo = { on: () => {}, addClass: () => {}, currentTime: () => 0, play: () => {}, duration: () => 0 };
  const fakeWin = {};
  fakeWin.location = { host: "www.dsd900.com", hostname: "www.dsd900.com", href: "https://www.dsd900.com/", protocol: "https:", search: "" };
  fakeWin.document = {
    getElementById: () => null,
    cookie: "",
    createElement: () => ({ style: {}, getContext: () => null }),
    querySelector: () => null,
    body: { appendChild: () => {} },
  };
  fakeWin.navigator = { userAgent: "Mozilla/5.0 Chrome" };
  fakeWin.setTimeout = setTimeout;
  fakeWin.setInterval = setInterval;
  fakeWin.console = { log: () => {} };
  fakeWin.atob = (s) => (typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("binary"));
  fakeWin.btoa = (s) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64"));
  const globals = globalThis;
  const saved = {};
  for (const key of ["window", "document", "navigator", "location", "top", "self", "parent", "initVideo", "videojs"]) {
    try {
      saved[key] = globals[key];
      globals[key] = key === "initVideo" ? (param) => { captured = param ? param.url || "" : ""; return mockVideo; } : key === "videojs" ? () => mockVideo : key === "document" ? fakeWin.document : key === "navigator" ? fakeWin.navigator : key === "location" ? fakeWin.location : key === "top" || key === "self" || key === "parent" ? fakeWin : fakeWin;
    } catch (error) {
      // read-only global (e.g. navigator in newer Node); wrap with defineProperty
      try {
        Object.defineProperty(globals, key, { value: key === "navigator" ? fakeWin.navigator : fakeWin, configurable: true, writable: true });
        saved[key] = undefined;
      } catch (e2) {
        saved[key] = undefined;
      }
    }
  }
  try {
    // indirect eval: runs in global (non-strict) scope — required because the
    // jsfuck payload uses implicit-global assignments that throw in strict mode
    // eslint-disable-next-line no-eval
    (0, eval)(jsfuck);
  } catch (error) {
    // script may touch top.location etc; captured may still be filled
  }
  for (const key of Object.keys(saved)) {
    try {
      if (saved[key] !== undefined) globals[key] = saved[key];
    } catch (error) {
      // ignore restore failures for read-only globals
    }
  }
  if (captured) return captured;
  const m = jsfuck.match(/sign=[0-9a-f]{64,}/);
  if (m) return m[0];
  return null;
}

async function dsdMedia(requestUrl) {
  const path = requestUrl.searchParams.get("path") || "";
  const kind = requestUrl.searchParams.get("kind") || "image";
  if (!path) return json({ message: "invalid media path" }, { status: 400 });
  const target = new URL(path, DSD_ORIGIN).toString();
  const isPlaylist = /\.m3u8/i.test(path);
  if (isPlaylist) {
    const vpUrl = `/addons/vplayer/?url=${encodeURIComponent(path)}&jump=`;
    const vpHtml = await dsdPage(vpUrl);
    const signed = dsdDecodeJsfuck(vpHtml);
    if (!signed) return json({ message: "dsd sign decode failed", debug: requestUrl.searchParams.get("debug") ? { vpLen: vpHtml.length, hasMarker: vpHtml.indexOf("\uFF9F\u03C9\uFF9F\uFF89") > -1, vpStart: vpHtml.slice(0, 120) } : undefined }, { status: 502 });
    const absolute = /^https?:/i.test(signed) ? signed : new URL(signed, DSD_ORIGIN).toString();
    const upstream = await fetch(absolute, { headers: DSD_HEADERS, signal: AbortSignal.timeout(20_000) });
    if (!upstream.ok) return json({ message: `dsd m3u8 ${upstream.status}` }, { status: 502 });
    const text = await upstream.text();
    const dir = absolute.slice(0, absolute.lastIndexOf("/") + 1);
    const rewritten = text.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#EXT-X-KEY:")) return trimmed.replace(/URI="[^"]*"/, `URI="${dsdMediaUrl(dir + "logo.jpeg", "media")}"`);
      if (trimmed.startsWith("#")) return line;
      return dsdMediaUrl(dir + trimmed, "media");
    }).join("\n");
    return new Response(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "public, max-age=120",
        "access-control-allow-origin": "*",
      },
    });
  }
  const upstream = await fetch(target, { headers: DSD_HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!upstream.ok) return json({ message: `dsd media ${upstream.status}` }, { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": kind === "image" ? "public, max-age=86400" : "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

const HXC_API_BASES = ["https://a64d.vd9h4.com", "https://a59e.f3de7.com"];
const HXC_AES_KEY_TEXT = "B77A9FF7F323B5404902102257503C2F";
const HXC_IMG_KEY_TEXT = "46cc793c53dc451b";
const HXC_SUB_TYPE_IDS = { "4": [5, 6, 7, 8, 9, 10], "11": [21, 32, 19, 22, 20, 18], "17": [24, 25, 26, 27, 28], "23": [30] };

async function hxcKey(text, algorithm) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(text), algorithm, false, ["encrypt", "decrypt"]);
}

export async function hxcEncrypt(text) {
  const key = await hxcKey(HXC_AES_KEY_TEXT, { name: "AES-CBC" });
  const data = await crypto.subtle.encrypt({ name: "AES-CBC", iv: new TextEncoder().encode(HXC_AES_KEY_TEXT).slice(0, 16) }, key, new TextEncoder().encode(text));
  return Buffer.from(data).toString("base64");
}

export async function hxcDecrypt(base64) {
  const key = await hxcKey(HXC_AES_KEY_TEXT, { name: "AES-CBC" });
  const data = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new TextEncoder().encode(HXC_AES_KEY_TEXT).slice(0, 16) }, key, Buffer.from(base64, "base64"));
  return Buffer.from(data).toString("utf8");
}

function hxcGfMul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i += 1) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function hxcGfPow(x, e) {
  let r = 1;
  let base = x;
  while (e) {
    if (e & 1) r = hxcGfMul(r, base);
    base = hxcGfMul(base, base);
    e >>= 1;
  }
  return r;
}

function hxcRotl8(v, n) {
  return ((v << n) | (v >> (8 - n))) & 0xff;
}

export const HXC_SBOX_INV = (() => {
  const sbox = new Uint8Array(256);
  for (let x = 0; x < 256; x += 1) {
    const inv = x === 0 ? 0 : hxcGfPow(x, 254);
    sbox[x] = inv ^ hxcRotl8(inv, 1) ^ hxcRotl8(inv, 2) ^ hxcRotl8(inv, 3) ^ hxcRotl8(inv, 4) ^ 0x63;
  }
  const sboxInv = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) sboxInv[sbox[i]] = i;
  return sboxInv;
})();

export function hxcAes128Expand(key) {
  const fwd = new Uint8Array(256);
  for (let j = 0; j < 256; j += 1) fwd[HXC_SBOX_INV[j]] = j;
  const w = new Uint8Array(176);
  w.set(key);
  for (let i = 4; i < 44; i += 1) {
    let t = [w[(i - 1) * 4], w[(i - 1) * 4 + 1], w[(i - 1) * 4 + 2], w[(i - 1) * 4 + 3]];
    if (i % 4 === 0) {
      t = [t[1], t[2], t[3], t[0]];
      for (let j = 0; j < 4; j += 1) t[j] = fwd[t[j]];
      t[0] ^= hxcRcon(i / 4);
    }
    for (let j = 0; j < 4; j += 1) w[i * 4 + j] = w[(i - 4) * 4 + j] ^ t[j];
  }
  return w;
}

function hxcRcon(i) {
  let v = 1;
  for (let k = 1; k < i; k += 1) v = (v << 1) ^ ((v & 0x80) ? 0x11b : 0);
  return v & 0xff;
}

export function hxcAes128DecryptBlock(cipher, w) {
  const sboxInv = HXC_SBOX_INV;
  const state = Uint8Array.from(cipher);
  const addKey = (r) => { for (let i = 0; i < 16; i += 1) state[i] ^= w[r * 16 + i]; };
  const invShift = () => {
    const s = Uint8Array.from(state);
    for (let r = 0; r < 4; r += 1) {
      const shift = (4 - r) % 4;
      for (let c = 0; c < 4; c += 1) state[c * 4 + r] = s[((c + shift) % 4) * 4 + r];
    }
  };
  const invMix = () => {
    for (let c = 0; c < 4; c += 1) {
      const a0 = state[c * 4 + 0], a1 = state[c * 4 + 1], a2 = state[c * 4 + 2], a3 = state[c * 4 + 3];
      state[c * 4 + 0] = hxcGfMul(0x0e, a0) ^ hxcGfMul(0x0b, a1) ^ hxcGfMul(0x0d, a2) ^ hxcGfMul(0x09, a3);
      state[c * 4 + 1] = hxcGfMul(0x09, a0) ^ hxcGfMul(0x0e, a1) ^ hxcGfMul(0x0b, a2) ^ hxcGfMul(0x0d, a3);
      state[c * 4 + 2] = hxcGfMul(0x0d, a0) ^ hxcGfMul(0x09, a1) ^ hxcGfMul(0x0e, a2) ^ hxcGfMul(0x0b, a3);
      state[c * 4 + 3] = hxcGfMul(0x0b, a0) ^ hxcGfMul(0x0d, a1) ^ hxcGfMul(0x09, a2) ^ hxcGfMul(0x0e, a3);
    }
  };
  addKey(10);
  for (let r = 9; r >= 1; r -= 1) {
    invShift();
    for (let i = 0; i < 16; i += 1) state[i] = sboxInv[state[i]];
    addKey(r);
    invMix();
  }
  invShift();
  for (let i = 0; i < 16; i += 1) state[i] = sboxInv[state[i]];
  addKey(0);
  return state;
}

export async function hxcImageDecodeECB(bytes, keyText = HXC_IMG_KEY_TEXT) {
  const w = hxcAes128Expand(Buffer.from(keyText, "utf8"));
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i += 16) {
    out.set(hxcAes128DecryptBlock(bytes.subarray(i, i + 16), w), i);
  }
  return out;
}

export async function hxcApi(path, payload) {  let lastError;
  for (const base of HXC_API_BASES) {
    try {
      const ents = String(Math.floor(Date.now() / 1000) - 28800);
      const response = await fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36", Did: "1", source: "1", isShortChain: "" },
        body: JSON.stringify({ endata: await hxcEncrypt(JSON.stringify(payload)), ents: await hxcEncrypt(ents) }),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await response.json();
      if (body.endata) {
        try { return JSON.parse(await hxcDecrypt(body.endata)); } catch { return body; }
      }
      return body;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("hxc api unreachable");
}

function hxcImgUrl(path) {
  return `/provider-api/hxc?action=img&u=${encodeURIComponent(path)}`;
}

function hxcParseSeconds(value) {
  if (!value && value !== 0) return null;
  if (typeof value === "number") return value;
  let match = String(value).match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hxcDetailFields(info) {
  const seconds = hxcParseSeconds(info.length);
  const tags = Array.isArray(info.tags) ? info.tags.join(" / ") : info.tagName || "";
  const year = info.addTime ? Number(String(info.addTime).slice(0, 4)) : null;
  return {
    vod_id: info.id,
    vod_name: info.name,
    vod_pic: hxcImgUrl(info.coverImgUrl),
    vod_remarks: seconds ? formatDuration(seconds) : "",
    vod_year: year || "",
    type_name: info.typeName || "",
    vod_area: info.typeName || "",
    vod_blurb: (info.description || tags).slice(0, 400),
    vod_content: info.description || "",
  };
}

async function hxcGetUrl(info) {
  let url = "";
  try {
    const pre = await hxcApi("/videos/getPreUrl", { videoId: info.id });
    if (pre.code === 0 && pre.data?.url) {
      const length = hxcParseSeconds(info.length);
      const parsed = new URL(pre.data.url);
      parsed.searchParams.delete("start");
      parsed.searchParams.delete("end");
      if (length && length > 0) {
        parsed.searchParams.set("start", "0");
        parsed.searchParams.set("end", String(length));
      }
      url = parsed.toString();
    }
  } catch {}
  return url;
}

async function hxcList(requestUrl) {
  const page = Math.max(1, Number(requestUrl.searchParams.get("pg")) || 1);
  const wd = (requestUrl.searchParams.get("wd") || "").trim();
  const preset = (requestUrl.searchParams.get("preset") || "").trim();
  const length = Math.min(48, Math.max(12, Number(requestUrl.searchParams.get("limit")) || 24));
  const typeIds = preset ? [Number(preset)] : [4, 11, 17, 23];
  const payload = {
    page,
    length,
    offset: 0,
    typeIds,
    orderType: preset ? 7 : 1,
    payType: preset === "29" ? [1, 3, 4] : [3, 4],
    tagIds: [],
    subTagIds: [],
    subTypeIds: HXC_SUB_TYPE_IDS[preset] || [],
  };
  if (wd) payload.videoName = wd;
  const result = await hxcApi("/videos/getList", payload);
  if (result.code !== 0 || !Array.isArray(result.data?.list)) {
    throw new Error(result.msg || "hxc list failed");
  }
  return json({
    list: result.data.list.map((item) => {
      const seconds = hxcParseSeconds(item.length);
      const year = item.addTime ? Number(String(item.addTime).slice(0, 4)) : null;
      return {
        vod_id: item.id,
        vod_name: item.name,
        vod_pic: hxcImgUrl(item.coverImgUrl),
        vod_remarks: seconds ? formatDuration(seconds) : "",
        vod_year: year || null,
        type_name: item.typeName || "",
        needs_detail: true,
      };
    }),
    page,
    total: result.data.count,
  }, { headers: { "cache-control": wd ? "public, max-age=60" : "public, max-age=180" } });
}

async function hxcDetail(requestUrl) {
  const id = Number(requestUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return json({ message: "missing id" }, { status: 400 });
  const result = await hxcApi("/videos/getInfo", { videoId: id });
  if (result.code !== 0 || !result.data?.info) {
    throw new Error(result.msg || "hxc detail failed");
  }
  const info = result.data.info;
  const detail = hxcDetailFields(info);
  const url = await hxcGetUrl(info);
  if (!url) {
    return json({ ...detail, vod_play_url: "", vod_blurb: (detail.vod_blurb + " 该视频暂未提供可播放线路（可能尚未完成转码）").trim() });
  }
  return json({ ...detail, vod_play_url: url, streams: [{ label: "全量线路", url }] });
}

async function hxcImage(requestUrl) {
  const path = requestUrl.searchParams.get("u");
  if (!path) return json({ message: "missing u" }, { status: 400 });
  const response = await fetch(path, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return json({ message: `hxc image ${response.status}` }, { status: 502 });
  const text = await response.text();
  const plain = await hxcImageDecodeECB(Buffer.from(text.trim(), "base64"));
  const prefix = plain.slice(0, 12).toString("latin1");
  const dataUrlMatch = prefix.startsWith("data:image/") ? plain.toString("utf8").match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/s) : null;
  const [contentType, bytes] = dataUrlMatch
    ? [dataUrlMatch[1], Buffer.from(dataUrlMatch[2], "base64")]
    : ["image/jpeg", plain];
  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  });
}

export async function handleProviderRequest(request) {
  const requestUrl = request instanceof URL ? request : new URL(request.url);
  const match = requestUrl.pathname.match(/^\/provider-api\/([a-z0-9-]+)/i);
  const provider = match?.[1];
  const action = requestUrl.searchParams.get("action") || "list";
  try {
    if (provider === "gdlsp") return await gdlsp(requestUrl);
    if (provider === "hstream") return await (action === "detail" ? hstreamDetail(requestUrl.searchParams.get("id")) : hstreamList(requestUrl));
    if (provider === "leakgallery") return await (action === "detail" ? leakGalleryDetail(requestUrl.searchParams.get("id")) : leakGalleryList(requestUrl));
    if (provider === "eporner") return await (action === "detail" ? epornerDetail(requestUrl.searchParams.get("id")) : epornerList(requestUrl));
    if (provider === "madouai") return await (action === "media" ? madouAiMedia(requestUrl) : action === "detail" ? madouAiDetail(requestUrl.searchParams.get("id"), requestUrl) : madouAiList(requestUrl));
    if (provider === "pmvhaven") return await (action === "detail" ? pmvHavenDetail(requestUrl.searchParams.get("id")) : pmvHavenList(requestUrl));
    if (provider === "redgifs") return await (action === "detail" ? redgifsDetail(requestUrl.searchParams.get("id")) : redgifsList(requestUrl));
    if (provider === "tnaflix") return await (action === "detail" ? tnaflixDetail(requestUrl.searchParams.get("id")) : tnaflixList(requestUrl));
    if (provider === "kan91") return await (action === "image" ? kan91Image(requestUrl) : action === "detail" ? kan91Detail(requestUrl.searchParams.get("id")) : kan91List(requestUrl));
    if (provider === "qiying") {
      if (action === "play") return await qiyingPlay(requestUrl.searchParams.get("id"), Number(requestUrl.searchParams.get("idx")));
      if (action === "cats") return json(await qiyingCats(), { headers: { "cache-control": "public, max-age=600" } });
      if (action === "list" || action === "search") return await qiyingList(requestUrl);
      return await qiyingDetail(requestUrl.searchParams.get("id"));
    }
    if (provider === "mr") {
      if (action === "play") return await mrPlay(requestUrl.searchParams.get("id"), Number(requestUrl.searchParams.get("idx")));
      if (action === "cats") return json(await qiyingCats(await mrPage("/")), { headers: { "cache-control": "public, max-age=600" } });
      if (action === "list" || action === "search") return await mrList(requestUrl);
      return await mrDetail(requestUrl.searchParams.get("id"));
    }
    if (provider === "jm") {
      if (action === "chapter") return await jmChapter(requestUrl.searchParams.get("id"), requestUrl.searchParams.get("chapter"));
      if (action === "detail") return await jmDetail(requestUrl.searchParams.get("id"));
      return await jmList(requestUrl);
    }
    if (provider === "madou") return await (action === "play" ? madouPlay(requestUrl.searchParams.get("id")) : action === "detail" ? madouDetail(requestUrl.searchParams.get("id")) : madouList(requestUrl));
    if (provider === "miss") return await (action === "detail" ? missavDetail(requestUrl.searchParams.get("id")) : missavList(requestUrl));
    if (provider === "tx") return await (action === "media" ? tangxinMedia(requestUrl) : action === "artists" ? tangxinArtists() : action === "detail" ? tangxinDetail(requestUrl.searchParams.get("id")) : tangxinList(requestUrl));
    if (provider === "rou") return await (action === "media" ? rouMedia(requestUrl) : action === "detail" ? rouDetail(requestUrl.searchParams.get("id")) : rouList(requestUrl));
    if (provider === "hj") {
      if (action === "img") return await hjImg(requestUrl);
      if (action === "media") return await hjPlaylist(requestUrl);
      if (action === "key") return await hjKey(requestUrl);
      if (action === "cats") return await hjCats();
      if (action === "play") return await hjPlay(requestUrl.searchParams.get("id"), Number(requestUrl.searchParams.get("idx")));
      if (action === "list" || action === "search") return await hjList(requestUrl);
      return await hjDetail(requestUrl.searchParams.get("id"));
    }
    if (provider === "iptvorg") return await iptvOrgList(requestUrl);
    if (provider === "adulttv") return await (action === "media" ? adultTvMedia(requestUrl) : action === "detail" ? adultTvDetail(requestUrl.searchParams.get("id")) : adultTvList(requestUrl));
if (provider === "kan98") return await (action === "image" ? kan98Image(requestUrl) : action === "detail" ? kan98Detail(requestUrl.searchParams.get("id")) : kan98List(requestUrl));
    if (provider === "kanxo") return await (action === "reqplay" ? kanxoReqplay(requestUrl.searchParams.get("id")) : action === "detail" ? kanxoDetail(requestUrl.searchParams.get("id")) : kanxoList(requestUrl));
    if (provider === "ph") return await (action === "media" ? phMedia(requestUrl) : action === "detail" ? phDetail(requestUrl.searchParams.get("id")) : phList(requestUrl));
    if (provider === "js9") return await (action === "detail" ? js9Detail(requestUrl) : js9List(requestUrl));
    if (provider === "jav") return await (action === "media" ? javMedia(requestUrl, request) : action === "play" ? javPlay(requestUrl) : action === "detail" ? javDetail(requestUrl) : javList(requestUrl));
    if (provider === "avjb") return await (action === "detail" ? avjbDetail(requestUrl) : avjbList(requestUrl));
    if (provider === "dsd") return await (action === "media" ? dsdMedia(requestUrl) : action === "cats" ? json(await dsdCats(), { headers: { "cache-control": "public, max-age=600" } }) : action === "detail" ? dsdDetail(requestUrl) : dsdList(requestUrl));
    if (provider === "hxc") return await (action === "img" ? hxcImage(requestUrl) : action === "detail" ? hxcDetail(requestUrl) : hxcList(requestUrl));
    if (provider === "sf") return await (action === "detail" ? sfDetail(requestUrl) : sfList(requestUrl));
    return json({ message: "unknown provider" }, { status: 404 });
  } catch (error) {
    return json({ message: error?.message || "upstream request failed", provider }, { status: 502 });
  }
}
