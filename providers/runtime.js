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

function rewriteOxaxManifest(manifest, sourceUrl, requestUrl, id) {
  return manifest.split(/\r?\n/).map((line) => {
    if (!line) return line;
    if (!line.startsWith("#")) {
      const resolved = new URL(line, sourceUrl);
      return oxaxProxyUrl(requestUrl, id, resolved.href, /\.m3u8$/i.test(resolved.pathname) ? "manifest" : "segment");
    }
    return line.replace(/URI="([^"]+)"/g, (_, uri) => (
      `URI="${oxaxProxyUrl(requestUrl, id, new URL(uri, sourceUrl).href)}"`
    ));
  }).join("\n");
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
    let rewritten;
    if (channel.live_provider === "oxax") {
      rewritten = rewriteOxaxManifest(await upstream.text(), source, requestUrl, id);
    } else {
      // AdultIPTV CDN only serves real TS segments at the ROOT path (mycamtv/
      // subpath segment requests fall back to a playlist and stall hls.js);
      // rewrite every segment line to https://cdn.adultiptv.net/{basename}.
      rewritten = (await upstream.text()).split(/\r?\n/).map((line) => {
        if (!line || line.startsWith("#")) return line;
        return `https://cdn.adultiptv.net/${line.split("/").pop()}`;
      }).join("\n");
    }
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
const HJ_WASM_BASE64 = "AGFzbQEAAAABPApgA39/fwF/YAN/fn8BfmAAAGABfwF/YAR/f39/AX9gBH9+f38Bf2AEf39/fwBgAAF/YAF/AGACf38BfwKTAQUDZW52CV9hYm9ydF9qcwACA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF9jbG9zZQADFndhc2lfc25hcHNob3RfcHJldmlldzEIZmRfd3JpdGUABBZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxB2ZkX3NlZWsABQMeHQIGAgcHBwIHCAgHAgMIAwcHAwMDAwABAQMACAkDBAUBcAEEBAUGAQGCAoICBhIDfwFBgIAEC38BQQALfwFBAAsHqwIPBm1lbW9yeQIAEV9fd2FzbV9jYWxsX2N0b3JzAAUKanF1ZXJ5X2tleQAGGV9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUBAAZmZmx1c2gAEQhzdHJlcnJvcgAhBm1hbGxvYwAdBGZyZWUAHxVlbXNjcmlwdGVuX3N0YWNrX2luaXQABxllbXNjcmlwdGVuX3N0YWNrX2dldF9mcmVlAAgZZW1zY3JpcHRlbl9zdGFja19nZXRfYmFzZQAJGGVtc2NyaXB0ZW5fc3RhY2tfZ2V0X2VuZAAKGV9lbXNjcmlwdGVuX3N0YWNrX3Jlc3RvcmUAEhdfZW1zY3JpcHRlbl9zdGFja19hbGxvYwATHGVtc2NyaXB0ZW5fc3RhY2tfZ2V0X2N1cnJlbnQAFAkJAQBBAQsDGRocCptLHQQAEAcLogEBBX8jgICAgABBIGshBCAEIAA2AhwgBCABNgIYIAQgAjYCFCAEIAM2AhAgBEEANgIMAkADQCAEKAIMIAQoAhhIQQFxRQ0BIAQoAhwgBCgCDGohBUH/ARogBS0AACEGIAQoAhQgBCgCDCAEKAIQb2ohB0H/ARogBiAHLQAAcyEIIAQoAhwgBCgCDGogCDoAACAEIAQoAgxBAWo2AgwMAAsLDwsgAEGAgISAACSCgICAAEGAgICAAEEPakFwcSSBgICAAAsPACOAgICAACOBgICAAGsLCAAjgoCAgAALCAAjgYCAgAALCQAQgICAgAAACwgAQfyShIAACwIACwIACxQAQYCThIAAEI2AgIAAQYSThIAACw4AQYCThIAAEI6AgIAAC4wCAQJ/AkAgAA0AQQAhAQJAQQAoAoiThIAARQ0AQQAoAoiThIAAEJGAgIAAIQELAkBBACgC+JKEgABFDQBBACgC+JKEgAAQkYCAgAAgAXIhAQsCQBCPgICAACgCACIARQ0AA0ACQCAAKAIUIAAoAhxGDQAgABCRgICAACABciEBCyAAKAI4IgANAAsLEJCAgIAAIAEPCwJAIAAoAhQgACgCHEYNACAAQQBBACAAKAIkEYCAgIAAgICAgAAaIAAoAhQNAEF/DwsCQCAAKAIEIgEgACgCCCICRg0AIAAgASACa6xBASAAKAIoEYGAgIAAgICAgAAaCyAAQQA2AhwgAEIANwMQIABCADcCBEEACwoAIAAkgICAgAALGgECfyOAgICAACAAa0FwcSIBJICAgIAAIAELCAAjgICAgAALBwA/AEEQdAtkAgF+AX8CQAJAIACtQgd8Qvj///8fg0EAKALgkYSAACIArXwiAUL/////D1YNABCVgICAACABpyICTw0BIAIQgYCAgAANAQsQjICAgABBMDYCAEF/DwtBACACNgLgkYSAACAACxkAAkAgAA0AQQAPCxCMgICAACAANgIAQX8LBAAgAAsZACAAKAI8EJiAgIAAEIKAgIAAEJeAgIAAC48DAQd/I4CAgIAAQSBrIgMkgICAgAAgAyAAKAIcIgQ2AhAgACgCFCEFIAMgAjYCHCADIAE2AhggAyAFIARrIgE2AhQgASACaiEGAkACQAJAAkACQCAAKAI8IANBEGpBCHIgA0EQaiAFIARGIgQbIgVBAUECIAQbIgcgA0EMahCDgICAABCXgICAAEUNACAFIQEMAQsDQCAGIAMoAgwiBEYNAgJAIARBf0oNACAFIQEMBAsgBUEIQQAgBCAFKAIEIghLIgkbaiIBIAEoAgAgBCAIQQAgCRtrIghqNgIAIAVBDEEEIAkbaiIFIAUoAgAgCGs2AgAgBiAEayEGIAEhBSAAKAI8IAEgByAJayIHIANBDGoQg4CAgAAQl4CAgABFDQALCyAGQX9HDQELIAAgACgCLCIENgIcIAAgBDYCFCAAIAQgACgCMGo2AhAgAiEEDAELQQAhBCAAQQA2AhwgAEIANwMQIAAgACgCAEEgcjYCACAHQQJGDQAgAiABKAIEayEECyADQSBqJICAgIAAIAQLSwEBfyOAgICAAEEQayIDJICAgIAAIAAgASACQf8BcSADQQhqEISAgIAAEJeAgIAAIQIgAykDCCEBIANBEGokgICAgABCfyABIAIbCxEAIAAoAjwgASACEJuAgIAAC/gmAQx/I4CAgIAAQRBrIgEkgICAgAACQAJAAkACQAJAIABB9AFLDQACQEEAKAKUk4SAACICQRAgAEELakH4A3EgAEELSRsiA0EDdiIEdiIAQQNxRQ0AAkACQCAAQX9zQQFxIARqIgVBA3QiA0G8k4SAAGoiBiADKALEk4SAACIEKAIIIgBHDQBBACACQX4gBXdxNgKUk4SAAAwBCyAAQQAoAqSThIAASQ0EIAAoAgwgBEcNBCAAIAY2AgwgBiAANgIICyAEQQhqIQAgBCADQQNyNgIEIAQgA2oiBCAEKAIEQQFyNgIEDAULIANBACgCnJOEgAAiB00NAQJAIABFDQACQAJAIAAgBHRBAiAEdCIAQQAgAGtycWgiCEEDdCIEQbyThIAAaiIFIAQoAsSThIAAIgAoAggiBkcNAEEAIAJBfiAId3EiAjYClJOEgAAMAQsgBkEAKAKkk4SAAEkNBCAGKAIMIABHDQQgBiAFNgIMIAUgBjYCCAsgACADQQNyNgIEIAAgA2oiBSAEIANrIgNBAXI2AgQgACAEaiADNgIAAkAgB0UNACAHQXhxQbyThIAAaiEGQQAoAqiThIAAIQQCQAJAIAJBASAHQQN2dCIIcQ0AQQAgAiAIcjYClJOEgAAgBiEIDAELIAYoAggiCEEAKAKkk4SAAEkNBQsgBiAENgIIIAggBDYCDCAEIAY2AgwgBCAINgIICyAAQQhqIQBBACAFNgKok4SAAEEAIAM2ApyThIAADAULQQAoApiThIAAIglFDQEgCWhBAnQoAsSVhIAAIgYoAgRBeHEgA2shBCAGIQUCQANAAkAgBigCECIADQAgBigCFCIARQ0CCyAAKAIEQXhxIANrIgYgBCAGIARJIgYbIQQgACAFIAYbIQUgACEGDAALCyAFQQAoAqSThIAAIgpJDQIgBSgCGCELAkACQCAFKAIMIgAgBUYNACAFKAIIIgYgCkkNBCAGKAIMIAVHDQQgACgCCCAFRw0EIAYgADYCDCAAIAY2AggMAQsCQAJAAkAgBSgCFCIGRQ0AIAVBFGohCAwBCyAFKAIQIgZFDQEgBUEQaiEICwNAIAghDCAGIgBBFGohCCAAKAIUIgYNACAAQRBqIQggACgCECIGDQALIAwgCkkNBCAMQQA2AgAMAQtBACEACwJAIAtFDQACQAJAIAUgBSgCHCIIQQJ0IgYoAsSVhIAARw0AIAZBxJWEgABqIAA2AgAgAA0BQQAgCUF+IAh3cTYCmJOEgAAMAgsgCyAKSQ0EAkACQCALKAIQIAVHDQAgCyAANgIQDAELIAsgADYCFAsgAEUNAQsgACAKSQ0DIAAgCzYCGAJAIAUoAhAiBkUNACAGIApJDQQgACAGNgIQIAYgADYCGAsgBSgCFCIGRQ0AIAYgCkkNAyAAIAY2AhQgBiAANgIYCwJAAkAgBEEPSw0AIAUgBCADaiIAQQNyNgIEIAUgAGoiACAAKAIEQQFyNgIEDAELIAUgA0EDcjYCBCAFIANqIgMgBEEBcjYCBCADIARqIAQ2AgACQCAHRQ0AIAdBeHFBvJOEgABqIQZBACgCqJOEgAAhAAJAAkBBASAHQQN2dCIIIAJxDQBBACAIIAJyNgKUk4SAACAGIQgMAQsgBigCCCIIIApJDQULIAYgADYCCCAIIAA2AgwgACAGNgIMIAAgCDYCCAtBACADNgKok4SAAEEAIAQ2ApyThIAACyAFQQhqIQAMBAtBfyEDIABBv39LDQAgAEELaiIEQXhxIQNBACgCmJOEgAAiC0UNAEEfIQcCQCAAQfT//wdLDQAgA0EmIARBCHZnIgBrdkEBcSAAQQF0a0E+aiEHC0EAIANrIQQCQAJAAkACQCAHQQJ0KALElYSAACIGDQBBACEAQQAhCAwBC0EAIQAgA0EAQRkgB0EBdmsgB0EfRht0IQVBACEIA0ACQCAGKAIEQXhxIANrIgIgBE8NACACIQQgBiEIIAINAEEAIQQgBiEIIAYhAAwDCyAAIAYoAhQiAiACIAYgBUEddkEEcWooAhAiDEYbIAAgAhshACAFQQF0IQUgDCEGIAwNAAsLAkAgACAIcg0AQQAhCEECIAd0IgBBACAAa3IgC3EiAEUNAyAAaEECdCgCxJWEgAAhAAsgAEUNAQsDQCAAKAIEQXhxIANrIgIgBEkhBQJAIAAoAhAiBg0AIAAoAhQhBgsgAiAEIAUbIQQgACAIIAUbIQggBiEAIAYNAAsLIAhFDQAgBEEAKAKck4SAACADa08NACAIQQAoAqSThIAAIgxJDQEgCCgCGCEHAkACQCAIKAIMIgAgCEYNACAIKAIIIgYgDEkNAyAGKAIMIAhHDQMgACgCCCAIRw0DIAYgADYCDCAAIAY2AggMAQsCQAJAAkAgCCgCFCIGRQ0AIAhBFGohBQwBCyAIKAIQIgZFDQEgCEEQaiEFCwNAIAUhAiAGIgBBFGohBSAAKAIUIgYNACAAQRBqIQUgACgCECIGDQALIAIgDEkNAyACQQA2AgAMAQtBACEACwJAIAdFDQACQAJAIAggCCgCHCIFQQJ0IgYoAsSVhIAARw0AIAZBxJWEgABqIAA2AgAgAA0BQQAgC0F+IAV3cSILNgKYk4SAAAwCCyAHIAxJDQMCQAJAIAcoAhAgCEcNACAHIAA2AhAMAQsgByAANgIUCyAARQ0BCyAAIAxJDQIgACAHNgIYAkAgCCgCECIGRQ0AIAYgDEkNAyAAIAY2AhAgBiAANgIYCyAIKAIUIgZFDQAgBiAMSQ0CIAAgBjYCFCAGIAA2AhgLAkACQCAEQQ9LDQAgCCAEIANqIgBBA3I2AgQgCCAAaiIAIAAoAgRBAXI2AgQMAQsgCCADQQNyNgIEIAggA2oiBSAEQQFyNgIEIAUgBGogBDYCAAJAIARB/wFLDQAgBEH4AXFBvJOEgABqIQACQAJAQQAoApSThIAAIgNBASAEQQN2dCIEcQ0AQQAgAyAEcjYClJOEgAAgACEEDAELIAAoAggiBCAMSQ0ECyAAIAU2AgggBCAFNgIMIAUgADYCDCAFIAQ2AggMAQtBHyEAAkAgBEH///8HSw0AIARBJiAEQQh2ZyIAa3ZBAXEgAEEBdHJBPnMhAAsgBSAANgIcIAVCADcCECAAQQJ0QcSVhIAAaiEDAkACQAJAIAtBASAAdCIGcQ0AQQAgCyAGcjYCmJOEgAAgAyAFNgIAIAUgAzYCGAwBCyAEQQBBGSAAQQF2ayAAQR9GG3QhACADKAIAIQYDQCAGIgMoAgRBeHEgBEYNAiAAQR12IQYgAEEBdCEAIAMgBkEEcWoiAigCECIGDQALIAJBEGoiACAMSQ0EIAAgBTYCACAFIAM2AhgLIAUgBTYCDCAFIAU2AggMAQsgAyAMSQ0CIAMoAggiACAMSQ0CIAAgBTYCDCADIAU2AgggBUEANgIYIAUgAzYCDCAFIAA2AggLIAhBCGohAAwDCwJAQQAoApyThIAAIgAgA0kNAEEAKAKok4SAACEEAkACQCAAIANrIgZBEEkNACAEIANqIgUgBkEBcjYCBCAEIABqIAY2AgAgBCADQQNyNgIEDAELIAQgAEEDcjYCBCAEIABqIgAgACgCBEEBcjYCBEEAIQZBACEFC0EAIAY2ApyThIAAQQAgBTYCqJOEgAAgBEEIaiEADAMLAkBBACgCoJOEgAAiBSADTQ0AQQAgBSADayIENgKgk4SAAEEAQQAoAqyThIAAIgAgA2oiBjYCrJOEgAAgBiAEQQFyNgIEIAAgA0EDcjYCBCAAQQhqIQAMAwsCQAJAQQAoAuyWhIAARQ0AQQAoAvSWhIAAIQQMAQtBAEJ/NwL4loSAAEEAQoCggICAgAQ3AvCWhIAAQQAgAUEMakFwcUHYqtWqBXM2AuyWhIAAQQBBADYCgJeEgABBAEEANgLQloSAAEGAICEEC0EAIQAgBCADQS9qIgdqIgJBACAEayIMcSIIIANNDQJBACEAAkBBACgCzJaEgAAiBEUNAEEAKALEloSAACIGIAhqIgsgBk0NAyALIARLDQMLAkACQAJAQQAtANCWhIAAQQRxDQACQAJAAkACQAJAQQAoAqyThIAAIgRFDQBB1JaEgAAhAANAAkAgBCAAKAIAIgZJDQAgBCAGIAAoAgRqSQ0DCyAAKAIIIgANAAsLQQAQloCAgAAiBUF/Rg0DIAghAgJAQQAoAvCWhIAAIgBBf2oiBCAFcUUNACAIIAVrIAQgBWpBACAAa3FqIQILIAIgA00NAwJAQQAoAsyWhIAAIgBFDQBBACgCxJaEgAAiBCACaiIGIARNDQQgBiAASw0ECyACEJaAgIAAIgAgBUcNAQwFCyACIAVrIAxxIgIQloCAgAAiBSAAKAIAIAAoAgRqRg0BIAUhAAsgAEF/Rg0BAkAgAiADQTBqSQ0AIAAhBQwECyAHIAJrQQAoAvSWhIAAIgRqQQAgBGtxIgQQloCAgABBf0YNASAEIAJqIQIgACEFDAMLIAVBf0cNAgtBAEEAKALQloSAAEEEcjYC0JaEgAALIAgQloCAgAAhBUEAEJaAgIAAIQAgBUF/Rg0BIABBf0YNASAFIABPDQEgACAFayICIANBKGpNDQELQQBBACgCxJaEgAAgAmoiADYCxJaEgAACQCAAQQAoAsiWhIAATQ0AQQAgADYCyJaEgAALAkACQAJAAkBBACgCrJOEgAAiBEUNAEHUloSAACEAA0AgBSAAKAIAIgYgACgCBCIIakYNAiAAKAIIIgANAAwDCwsCQAJAQQAoAqSThIAAIgBFDQAgBSAATw0BC0EAIAU2AqSThIAAC0EAIQBBACACNgLYloSAAEEAIAU2AtSWhIAAQQBBfzYCtJOEgABBAEEAKALsloSAADYCuJOEgABBAEEANgLgloSAAANAIABBA3QiBCAEQbyThIAAaiIGNgLEk4SAACAEIAY2AsiThIAAIABBAWoiAEEgRw0AC0EAIAJBWGoiAEF4IAVrQQdxIgRrIgY2AqCThIAAQQAgBSAEaiIENgKsk4SAACAEIAZBAXI2AgQgBSAAakEoNgIEQQBBACgC/JaEgAA2ArCThIAADAILIAQgBU8NACAEIAZJDQAgACgCDEEIcQ0AIAAgCCACajYCBEEAIARBeCAEa0EHcSIAaiIGNgKsk4SAAEEAQQAoAqCThIAAIAJqIgUgAGsiADYCoJOEgAAgBiAAQQFyNgIEIAQgBWpBKDYCBEEAQQAoAvyWhIAANgKwk4SAAAwBCwJAIAVBACgCpJOEgABPDQBBACAFNgKkk4SAAAsgBSACaiEGQdSWhIAAIQACQAJAA0AgACgCACIIIAZGDQEgACgCCCIADQAMAgsLIAAtAAxBCHFFDQQLQdSWhIAAIQACQANAAkAgBCAAKAIAIgZJDQAgBCAGIAAoAgRqIgZJDQILIAAoAgghAAwACwtBACACQVhqIgBBeCAFa0EHcSIIayIMNgKgk4SAAEEAIAUgCGoiCDYCrJOEgAAgCCAMQQFyNgIEIAUgAGpBKDYCBEEAQQAoAvyWhIAANgKwk4SAACAEIAZBJyAGa0EHcWpBUWoiACAAIARBEGpJGyIIQRs2AgQgCEEAKQLcloSAADcCECAIQQApAtSWhIAANwIIQQAgCEEIajYC3JaEgABBACACNgLYloSAAEEAIAU2AtSWhIAAQQBBADYC4JaEgAAgCEEYaiEAA0AgAEEHNgIEIABBCGohBSAAQQRqIQAgBSAGSQ0ACyAIIARGDQAgCCAIKAIEQX5xNgIEIAQgCCAEayIFQQFyNgIEIAggBTYCAAJAAkAgBUH/AUsNACAFQfgBcUG8k4SAAGohAAJAAkBBACgClJOEgAAiBkEBIAVBA3Z0IgVxDQBBACAGIAVyNgKUk4SAACAAIQYMAQsgACgCCCIGQQAoAqSThIAASQ0FCyAAIAQ2AgggBiAENgIMQQwhBUEIIQgMAQtBHyEAAkAgBUH///8HSw0AIAVBJiAFQQh2ZyIAa3ZBAXEgAEEBdHJBPnMhAAsgBCAANgIcIARCADcCECAAQQJ0QcSVhIAAaiEGAkACQAJAQQAoApiThIAAIghBASAAdCICcQ0AQQAgCCACcjYCmJOEgAAgBiAENgIAIAQgBjYCGAwBCyAFQQBBGSAAQQF2ayAAQR9GG3QhACAGKAIAIQgDQCAIIgYoAgRBeHEgBUYNAiAAQR12IQggAEEBdCEAIAYgCEEEcWoiAigCECIIDQALIAJBEGoiAEEAKAKkk4SAAEkNBSAAIAQ2AgAgBCAGNgIYC0EIIQVBDCEIIAQhBiAEIQAMAQsgBkEAKAKkk4SAACIFSQ0DIAYoAggiACAFSQ0DIAAgBDYCDCAGIAQ2AgggBCAANgIIQQAhAEEYIQVBDCEICyAEIAhqIAY2AgAgBCAFaiAANgIAC0EAKAKgk4SAACIAIANNDQBBACAAIANrIgQ2AqCThIAAQQBBACgCrJOEgAAiACADaiIGNgKsk4SAACAGIARBAXI2AgQgACADQQNyNgIEIABBCGohAAwDCxCMgICAAEEwNgIAQQAhAAwCCxCLgICAAAALIAAgBTYCACAAIAAoAgQgAmo2AgQgBSAIIAMQnoCAgAAhAAsgAUEQaiSAgICAACAAC4oKAQd/IABBeCAAa0EHcWoiAyACQQNyNgIEIAFBeCABa0EHcWoiBCADIAJqIgVrIQACQAJAAkAgBEEAKAKsk4SAAEcNAEEAIAU2AqyThIAAQQBBACgCoJOEgAAgAGoiAjYCoJOEgAAgBSACQQFyNgIEDAELAkAgBEEAKAKok4SAAEcNAEEAIAU2AqiThIAAQQBBACgCnJOEgAAgAGoiAjYCnJOEgAAgBSACQQFyNgIEIAUgAmogAjYCAAwBCwJAIAQoAgQiBkEDcUEBRw0AIAQoAgwhAgJAAkAgBkH/AUsNAAJAIAQoAggiASAGQfgBcUG8k4SAAGoiB0YNACABQQAoAqSThIAASQ0FIAEoAgwgBEcNBQsCQCACIAFHDQBBAEEAKAKUk4SAAEF+IAZBA3Z3cTYClJOEgAAMAgsCQCACIAdGDQAgAkEAKAKkk4SAAEkNBSACKAIIIARHDQULIAEgAjYCDCACIAE2AggMAQsgBCgCGCEIAkACQCACIARGDQAgBCgCCCIBQQAoAqSThIAASQ0FIAEoAgwgBEcNBSACKAIIIARHDQUgASACNgIMIAIgATYCCAwBCwJAAkACQCAEKAIUIgFFDQAgBEEUaiEHDAELIAQoAhAiAUUNASAEQRBqIQcLA0AgByEJIAEiAkEUaiEHIAIoAhQiAQ0AIAJBEGohByACKAIQIgENAAsgCUEAKAKkk4SAAEkNBSAJQQA2AgAMAQtBACECCyAIRQ0AAkACQCAEIAQoAhwiB0ECdCIBKALElYSAAEcNACABQcSVhIAAaiACNgIAIAINAUEAQQAoApiThIAAQX4gB3dxNgKYk4SAAAwCCyAIQQAoAqSThIAASQ0EAkACQCAIKAIQIARHDQAgCCACNgIQDAELIAggAjYCFAsgAkUNAQsgAkEAKAKkk4SAACIHSQ0DIAIgCDYCGAJAIAQoAhAiAUUNACABIAdJDQQgAiABNgIQIAEgAjYCGAsgBCgCFCIBRQ0AIAEgB0kNAyACIAE2AhQgASACNgIYCyAGQXhxIgIgAGohACAEIAJqIgQoAgQhBgsgBCAGQX5xNgIEIAUgAEEBcjYCBCAFIABqIAA2AgACQCAAQf8BSw0AIABB+AFxQbyThIAAaiECAkACQEEAKAKUk4SAACIBQQEgAEEDdnQiAHENAEEAIAEgAHI2ApSThIAAIAIhAAwBCyACKAIIIgBBACgCpJOEgABJDQMLIAIgBTYCCCAAIAU2AgwgBSACNgIMIAUgADYCCAwBC0EfIQICQCAAQf///wdLDQAgAEEmIABBCHZnIgJrdkEBcSACQQF0ckE+cyECCyAFIAI2AhwgBUIANwIQIAJBAnRBxJWEgABqIQECQAJAAkBBACgCmJOEgAAiB0EBIAJ0IgRxDQBBACAHIARyNgKYk4SAACABIAU2AgAgBSABNgIYDAELIABBAEEZIAJBAXZrIAJBH0YbdCECIAEoAgAhBwNAIAciASgCBEF4cSAARg0CIAJBHXYhByACQQF0IQIgASAHQQRxaiIEKAIQIgcNAAsgBEEQaiICQQAoAqSThIAASQ0DIAIgBTYCACAFIAE2AhgLIAUgBTYCDCAFIAU2AggMAQsgAUEAKAKkk4SAACIASQ0BIAEoAggiAiAASQ0BIAIgBTYCDCABIAU2AgggBUEANgIYIAUgATYCDCAFIAI2AggLIANBCGoPCxCLgICAAAALxA8BCn8CQAJAIABFDQAgAEF4aiIBQQAoAqSThIAAIgJJDQEgAEF8aigCACIDQQNxQQFGDQEgASADQXhxIgBqIQQCQCADQQFxDQAgA0ECcUUNASABIAEoAgAiBWsiASACSQ0CIAUgAGohAAJAIAFBACgCqJOEgABGDQAgASgCDCEDAkAgBUH/AUsNAAJAIAEoAggiBiAFQfgBcUG8k4SAAGoiB0YNACAGIAJJDQUgBigCDCABRw0FCwJAIAMgBkcNAEEAQQAoApSThIAAQX4gBUEDdndxNgKUk4SAAAwDCwJAIAMgB0YNACADIAJJDQUgAygCCCABRw0FCyAGIAM2AgwgAyAGNgIIDAILIAEoAhghCAJAAkAgAyABRg0AIAEoAggiBSACSQ0FIAUoAgwgAUcNBSADKAIIIAFHDQUgBSADNgIMIAMgBTYCCAwBCwJAAkACQCABKAIUIgVFDQAgAUEUaiEGDAELIAEoAhAiBUUNASABQRBqIQYLA0AgBiEHIAUiA0EUaiEGIAMoAhQiBQ0AIANBEGohBiADKAIQIgUNAAsgByACSQ0FIAdBADYCAAwBC0EAIQMLIAhFDQECQAJAIAEgASgCHCIGQQJ0IgUoAsSVhIAARw0AIAVBxJWEgABqIAM2AgAgAw0BQQBBACgCmJOEgABBfiAGd3E2ApiThIAADAMLIAggAkkNBAJAAkAgCCgCECABRw0AIAggAzYCEAwBCyAIIAM2AhQLIANFDQILIAMgAkkNAyADIAg2AhgCQCABKAIQIgVFDQAgBSACSQ0EIAMgBTYCECAFIAM2AhgLIAEoAhQiBUUNASAFIAJJDQMgAyAFNgIUIAUgAzYCGAwBCyAEKAIEIgNBA3FBA0cNAEEAIAA2ApyThIAAIAQgA0F+cTYCBCABIABBAXI2AgQgBCAANgIADwsgASAETw0BIAQoAgQiB0EBcUUNAQJAAkAgB0ECcQ0AAkAgBEEAKAKsk4SAAEcNAEEAIAE2AqyThIAAQQBBACgCoJOEgAAgAGoiADYCoJOEgAAgASAAQQFyNgIEIAFBACgCqJOEgABHDQNBAEEANgKck4SAAEEAQQA2AqiThIAADwsCQCAEQQAoAqiThIAAIglHDQBBACABNgKok4SAAEEAQQAoApyThIAAIABqIgA2ApyThIAAIAEgAEEBcjYCBCABIABqIAA2AgAPCyAEKAIMIQMCQAJAIAdB/wFLDQACQCAEKAIIIgUgB0H4AXFBvJOEgABqIgZGDQAgBSACSQ0GIAUoAgwgBEcNBgsCQCADIAVHDQBBAEEAKAKUk4SAAEF+IAdBA3Z3cTYClJOEgAAMAgsCQCADIAZGDQAgAyACSQ0GIAMoAgggBEcNBgsgBSADNgIMIAMgBTYCCAwBCyAEKAIYIQoCQAJAIAMgBEYNACAEKAIIIgUgAkkNBiAFKAIMIARHDQYgAygCCCAERw0GIAUgAzYCDCADIAU2AggMAQsCQAJAAkAgBCgCFCIFRQ0AIARBFGohBgwBCyAEKAIQIgVFDQEgBEEQaiEGCwNAIAYhCCAFIgNBFGohBiADKAIUIgUNACADQRBqIQYgAygCECIFDQALIAggAkkNBiAIQQA2AgAMAQtBACEDCyAKRQ0AAkACQCAEIAQoAhwiBkECdCIFKALElYSAAEcNACAFQcSVhIAAaiADNgIAIAMNAUEAQQAoApiThIAAQX4gBndxNgKYk4SAAAwCCyAKIAJJDQUCQAJAIAooAhAgBEcNACAKIAM2AhAMAQsgCiADNgIUCyADRQ0BCyADIAJJDQQgAyAKNgIYAkAgBCgCECIFRQ0AIAUgAkkNBSADIAU2AhAgBSADNgIYCyAEKAIUIgVFDQAgBSACSQ0EIAMgBTYCFCAFIAM2AhgLIAEgB0F4cSAAaiIAQQFyNgIEIAEgAGogADYCACABIAlHDQFBACAANgKck4SAAA8LIAQgB0F+cTYCBCABIABBAXI2AgQgASAAaiAANgIACwJAIABB/wFLDQAgAEH4AXFBvJOEgABqIQMCQAJAQQAoApSThIAAIgVBASAAQQN2dCIAcQ0AQQAgBSAAcjYClJOEgAAgAyEADAELIAMoAggiACACSQ0DCyADIAE2AgggACABNgIMIAEgAzYCDCABIAA2AggPC0EfIQMCQCAAQf///wdLDQAgAEEmIABBCHZnIgNrdkEBcSADQQF0ckE+cyEDCyABIAM2AhwgAUIANwIQIANBAnRBxJWEgABqIQYCQAJAAkACQEEAKAKYk4SAACIFQQEgA3QiBHENAEEAIAUgBHI2ApiThIAAIAYgATYCAEEIIQBBGCEDDAELIABBAEEZIANBAXZrIANBH0YbdCEDIAYoAgAhBgNAIAYiBSgCBEF4cSAARg0CIANBHXYhBiADQQF0IQMgBSAGQQRxaiIEKAIQIgYNAAsgBEEQaiIAIAJJDQQgACABNgIAQQghAEEYIQMgBSEGCyABIQUgASEEDAELIAUgAkkNAiAFKAIIIgYgAkkNAiAGIAE2AgwgBSABNgIIQQAhBEEYIQBBCCEDCyABIANqIAY2AgAgASAFNgIMIAEgAGogBDYCAEEAQQAoArSThIAAQX9qIgFBfyABGzYCtJOEgAALDwsQi4CAgAAAC0UBAX9BtIKEgAAhAgJAIABBmQFLDQACQAJAIAANAEEAIQAMAQsgAEEBdC8BgICEgAAiAEUNAQsgAEHCgoSAAGohAgsgAgsMACAAIAAQoICAgAALC4kTAgBBgIAEC9wRAACgAk4A6wGnBX4FIAF1BhgDhgT6ALkDLAP9BbcBigF6A7wEHgD6BqIAPQNJA9cBAAQIAJMGCAGPAgYCKgZfArcC+gJYA9kEKwfKAr0F4QXNBdwCEAZAAngAfQJnA2EE7ADlAwoF1ADMAz4GTwJ2AZgDrwQAAEQAEAKuAK4DYAD6AXcEIQXrBCsAYAFBAZIAqQajAW4CTgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATBAAAAAAAAAAAKgIAAAAAAAAAAAAAAAAAAAAAAAAAACcEOQRIBAAAAAAAAAAAAAAAAAAAAACSBAAAAAAAAAAAAAAAAAAAAAAAADgFUgVgBVMGAADKAbsGAADSBgAA6QYJBxkHPgdZB2kHfgdVbmtub3duIGVycm9yAFN1Y2Nlc3MASWxsZWdhbCBieXRlIHNlcXVlbmNlAERvbWFpbiBlcnJvcgBSZXN1bHQgbm90IHJlcHJlc2VudGFibGUATm90IGEgdHR5AFBlcm1pc3Npb24gZGVuaWVkAE9wZXJhdGlvbiBub3QgcGVybWl0dGVkAE5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnkATm8gc3VjaCBwcm9jZXNzAEZpbGUgZXhpc3RzAFZhbHVlIHRvbyBsYXJnZSBmb3IgZGVmaW5lZCBkYXRhIHR5cGUATm8gc3BhY2UgbGVmdCBvbiBkZXZpY2UAT3V0IG9mIG1lbW9yeQBSZXNvdXJjZSBidXN5AEludGVycnVwdGVkIHN5c3RlbSBjYWxsAFJlc291cmNlIHRlbXBvcmFyaWx5IHVuYXZhaWxhYmxlAEludmFsaWQgc2VlawBDcm9zcy1kZXZpY2UgbGluawBSZWFkLW9ubHkgZmlsZSBzeXN0ZW0ARGlyZWN0b3J5IG5vdCBlbXB0eQBDb25uZWN0aW9uIHJlc2V0IGJ5IHBlZXIAT3BlcmF0aW9uIHRpbWVkIG91dABDb25uZWN0aW9uIHJlZnVzZWQASG9zdCBpcyBkb3duAEhvc3QgaXMgdW5yZWFjaGFibGUAQWRkcmVzcyBpbiB1c2UAQnJva2VuIHBpcGUASS9PIGVycm9yAE5vIHN1Y2ggZGV2aWNlIG9yIGFkZHJlc3MAQmxvY2sgZGV2aWNlIHJlcXVpcmVkAE5vIHN1Y2ggZGV2aWNlAE5vdCBhIGRpcmVjdG9yeQBJcyBhIGRpcmVjdG9yeQBUZXh0IGZpbGUgYnVzeQBFeGVjIGZvcm1hdCBlcnJvcgBJbnZhbGlkIGFyZ3VtZW50AEFyZ3VtZW50IGxpc3QgdG9vIGxvbmcAU3ltYm9saWMgbGluayBsb29wAEZpbGVuYW1lIHRvbyBsb25nAFRvbyBtYW55IG9wZW4gZmlsZXMgaW4gc3lzdGVtAE5vIGZpbGUgZGVzY3JpcHRvcnMgYXZhaWxhYmxlAEJhZCBmaWxlIGRlc2NyaXB0b3IATm8gY2hpbGQgcHJvY2VzcwBCYWQgYWRkcmVzcwBGaWxlIHRvbyBsYXJnZQBUb28gbWFueSBsaW5rcwBObyBsb2NrcyBhdmFpbGFibGUAUmVzb3VyY2UgZGVhZGxvY2sgd291bGQgb2NjdXIAU3RhdGUgbm90IHJlY292ZXJhYmxlAE93bmVyIGRpZWQAT3BlcmF0aW9uIGNhbmNlbGVkAEZ1bmN0aW9uIG5vdCBpbXBsZW1lbnRlZABObyBtZXNzYWdlIG9mIGRlc2lyZWQgdHlwZQBJZGVudGlmaWVyIHJlbW92ZWQARGV2aWNlIG5vdCBhIHN0cmVhbQBObyBkYXRhIGF2YWlsYWJsZQBEZXZpY2UgdGltZW91dABPdXQgb2Ygc3RyZWFtcyByZXNvdXJjZXMATGluayBoYXMgYmVlbiBzZXZlcmVkAFByb3RvY29sIGVycm9yAEJhZCBtZXNzYWdlAEZpbGUgZGVzY3JpcHRvciBpbiBiYWQgc3RhdGUATm90IGEgc29ja2V0AERlc3RpbmF0aW9uIGFkZHJlc3MgcmVxdWlyZWQATWVzc2FnZSB0b28gbGFyZ2UAUHJvdG9jb2wgd3JvbmcgdHlwZSBmb3Igc29ja2V0AFByb3RvY29sIG5vdCBhdmFpbGFibGUAUHJvdG9jb2wgbm90IHN1cHBvcnRlZABTb2NrZXQgdHlwZSBub3Qgc3VwcG9ydGVkAE5vdCBzdXBwb3J0ZWQAUHJvdG9jb2wgZmFtaWx5IG5vdCBzdXBwb3J0ZWQAQWRkcmVzcyBmYW1pbHkgbm90IHN1cHBvcnRlZCBieSBwcm90b2NvbABBZGRyZXNzIG5vdCBhdmFpbGFibGUATmV0d29yayBpcyBkb3duAE5ldHdvcmsgdW5yZWFjaGFibGUAQ29ubmVjdGlvbiByZXNldCBieSBuZXR3b3JrAENvbm5lY3Rpb24gYWJvcnRlZABObyBidWZmZXIgc3BhY2UgYXZhaWxhYmxlAFNvY2tldCBpcyBjb25uZWN0ZWQAU29ja2V0IG5vdCBjb25uZWN0ZWQAQ2Fubm90IHNlbmQgYWZ0ZXIgc29ja2V0IHNodXRkb3duAE9wZXJhdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzAE9wZXJhdGlvbiBpbiBwcm9ncmVzcwBTdGFsZSBmaWxlIGhhbmRsZQBEYXRhIGNvbnNpc3RlbmN5IGVycm9yAFJlc291cmNlIG5vdCBhdmFpbGFibGUAUmVtb3RlIEkvTyBlcnJvcgBRdW90YSBleGNlZWRlZABObyBtZWRpdW0gZm91bmQAV3JvbmcgbWVkaXVtIHR5cGUATXVsdGlob3AgYXR0ZW1wdGVkAFJlcXVpcmVkIGtleSBub3QgYXZhaWxhYmxlAEtleSBoYXMgZXhwaXJlZABLZXkgaGFzIGJlZW4gcmV2b2tlZABLZXkgd2FzIHJlamVjdGVkIGJ5IHNlcnZpY2UAAEHgkQQLnAGQCwEAAAAAAAUAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAADAAAAlAkBAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAD//////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOgIAQAAlAEPdGFyZ2V0X2ZlYXR1cmVzCCsLYnVsay1tZW1vcnkrD2J1bGstbWVtb3J5LW9wdCsWY2FsbC1pbmRpcmVjdC1vdmVybG9uZysKbXVsdGl2YWx1ZSsPbXV0YWJsZS1nbG9iYWxzKxNub250cmFwcGluZy1mcHRvaW50Kw9yZWZlcmVuY2UtdHlwZXMrCHNpZ24tZXh0";

let hjWasmPromise = null;
function hjEnsureWasm() {
  if (!hjWasmPromise) {
    hjWasmPromise = WebAssembly.instantiate(Buffer.from(HJ_WASM_BASE64, "base64"), {
      env: {
        _abort_js: () => { throw new Error("hj wasm abort"); },
        emscripten_resize_heap: () => false,
      },
      wasi_snapshot_preview1: { fd_close: () => 0, fd_write: () => 0, fd_seek: () => 0 },
    }).then(({ instance }) => instance);
  }
  return hjWasmPromise;
}

async function hjKeyTransform(keyHex, rText) {
  const instance = await hjEnsureWasm();
  const memory = instance.exports.memory;
  const key = Buffer.from(keyHex, "hex");
  const r = Buffer.from(rText, "utf8");
  const kp = instance.exports.malloc(key.length);
  const rp = instance.exports.malloc(r.length);
  new Uint8Array(memory.buffer, kp, key.length).set(key);
  new Uint8Array(memory.buffer, rp, r.length).set(r);
  instance.exports.jquery_key(kp, key.length, rp, r.length);
  const out = Buffer.from(new Uint8Array(memory.buffer, kp, key.length));
  instance.exports.free(kp);
  instance.exports.free(rp);
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

export async function handleProviderRequest(request) {  const requestUrl = request instanceof URL ? request : new URL(request.url);
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
    return json({ message: "unknown provider" }, { status: 404 });
  } catch (error) {
    return json({ message: error?.message || "upstream request failed", provider }, { status: 502 });
  }
}
