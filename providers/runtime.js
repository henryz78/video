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

async function madouAiDetail(id) {
  if (!/^\d+$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const item = normalizeMadouAi(await madouAiFetch(`/api/v1/videos/${id}`));
  return json({ ...item, needs_detail: false }, { headers: { "cache-control": "public, max-age=180" } });
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
const QIYING_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CFNav-Independent/2.0",
};

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

function qiyingExtractDetail(html, id) {
  const title = qiyingDecodeHtmlEntities(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || html.match(/<title>([^<]*)<\/title>/)?.[1] || `91吃瓜 ${id}`).replace(/\s+-\s*91吃瓜网\s*$/, "");
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
    images.push(url);
  }
  const fallbackImages = [...new Set(html.match(/https:\/\/pic\.[a-z0-9.-]+\.cn\/upload_01\/xiao\/[^"'<>\\\s]+\.(?:jpe?g|png|webp)/g) || [])];
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
  const poster = images[0] || html.match(/https:\/\/pic\.[a-z0-9.-]+\.cn\/upload_01\/xiao\/[^"'<>\\\s]+\.(?:jpe?g|png|webp)/)?.[0] || "";

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
    vod_play_url: primary?.url || "",
    media_kind: detail.videos.length ? "video" : "gallery",
    needs_detail: false,
    provider: "qiying",
  }, { headers: { "cache-control": "no-store" } });
}

async function qiyingPlay(id) {
  if (!/^\d{4,}$/.test(id || "")) return json({ message: "invalid id" }, { status: 400 });
  const html = await qiyingPage(`/archives/${id}/`);
  const detail = qiyingExtractDetail(html, id);
  const primary = detail.videos[0];
  if (!primary) return json({ message: "此帖子没有公开视频" }, { status: 404 });
  return json({ vod_id: id, video: primary.url, poster: detail.poster || detail.images[0] || "", provider: "qiying" }, {
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
    vod_play_url: new URL(path, "https://cdn.adultiptv.net/").href,
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
    vod_play_url: new URL(`${path}.m3u8`, "https://cdn.adultiptv.net/").href,
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

function allowedOxaxMediaUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && OXAX_MEDIA_HOSTS.has(parsed.hostname) ? parsed : null;
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
  const channel = adultTvCatalog().find((item) => item.vod_id === id && item.live_provider === "oxax");
  if (!channel) return json({ message: "channel unavailable" }, { status: 404 });
  const type = requestUrl.searchParams.get("type") || "manifest";
  if (!new Set(["manifest", "segment"]).has(type)) return json({ message: "invalid media type" }, { status: 400 });
  let source = allowedOxaxMediaUrl(requestUrl.searchParams.get("url") || "");
  if (!source && type === "manifest") {
    const resolved = await resolveOxaxStream(id);
    source = allowedOxaxMediaUrl(resolved.stream);
  }
  if (!source) return json({ message: "invalid media source" }, { status: 400 });

  const upstream = await fetch(source, {
    headers: {
      accept: type === "manifest" ? "application/vnd.apple.mpegurl, application/x-mpegURL, */*" : "*/*",
      referer: `http://oxax.tv/${id}.html`,
      "user-agent": "Mozilla/5.0 CFNav-Independent/2.0",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!upstream.ok) return json({ message: `oxax media ${upstream.status}` }, { status: 502 });
  if (type === "manifest") {
    const rewritten = rewriteOxaxManifest(await upstream.text(), source, requestUrl, id);
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
    stream = new URL(item.live_path, "https://cdn.adultiptv.net/").href;
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
  return json({ code: 1, page, pagecount: Math.max(1, Math.ceil(filtered.length / limit)), limit, total: filtered.length, list, provider: "adulttv" }, {
    headers: { "cache-control": search ? "public, max-age=60" : "public, max-age=180" },
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
    if (provider === "madouai") return await (action === "detail" ? madouAiDetail(requestUrl.searchParams.get("id")) : madouAiList(requestUrl));
    if (provider === "pmvhaven") return await (action === "detail" ? pmvHavenDetail(requestUrl.searchParams.get("id")) : pmvHavenList(requestUrl));
    if (provider === "redgifs") return await (action === "detail" ? redgifsDetail(requestUrl.searchParams.get("id")) : redgifsList(requestUrl));
    if (provider === "tnaflix") return await (action === "detail" ? tnaflixDetail(requestUrl.searchParams.get("id")) : tnaflixList(requestUrl));
    if (provider === "kan91") return await (action === "image" ? kan91Image(requestUrl) : action === "detail" ? kan91Detail(requestUrl.searchParams.get("id")) : kan91List(requestUrl));
    if (provider === "qiying") return await (action === "play" ? qiyingPlay(requestUrl.searchParams.get("id")) : action === "detail" ? qiyingDetail(requestUrl.searchParams.get("id")) : qiyingDetail(requestUrl.searchParams.get("id")));
    if (provider === "iptvorg") return await iptvOrgList(requestUrl);
    if (provider === "adulttv") return await (action === "media" ? adultTvMedia(requestUrl) : action === "detail" ? adultTvDetail(requestUrl.searchParams.get("id")) : adultTvList(requestUrl));
    return json({ message: "unknown provider" }, { status: 404 });
  } catch (error) {
    return json({ message: error?.message || "upstream request failed", provider }, { status: 502 });
  }
}
