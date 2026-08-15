import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { getProviderForSite, PROVIDERS } from "../providers/catalog.js";

const QIYING_IMG_CDN = "https://imgpublic.ycomesc.live";
const QIYING_BUCKETS = 96;

async function qiyingGunzip(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`qiying data ${response.status}`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!(bytes[0] === 0x1f && bytes[1] === 0x8b)) return JSON.parse(new TextDecoder().decode(buffer));
  const stream = new Response(buffer).body.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

function qiyingAssetPath(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${QIYING_IMG_CDN}${path}`;
}

const qiyingStore = { catalog: null, details: new Map(), promise: null };
function qiyingLoadCatalog() {
  if (qiyingStore.catalog) return Promise.resolve(qiyingStore.catalog);
  if (qiyingStore.promise) return qiyingStore.promise;
  qiyingStore.promise = qiyingGunzip("/qiying/catalog.json.gz").then((data) => {
    qiyingStore.catalog = data.filter((post) => Boolean(post.t));
    return qiyingStore.catalog;
  }).catch((error) => { qiyingStore.promise = null; throw error; });
  return qiyingStore.promise;
}
function qiyingLoadDetail(pid) {
  const bucket = Number(pid) % QIYING_BUCKETS;
  const cached = qiyingStore.details.get(bucket);
  if (cached) return Promise.resolve(cached);
  const bucketFile = `/qiying/details-${String(bucket).padStart(3, "0")}.json.gz`;
  const promise = qiyingGunzip(bucketFile).then((records) => {
    qiyingStore.details.set(bucket, records);
    return records;
  });
  return promise;
}

// Homepage metadata is transcribed from the user-saved 2026-08-12 reference snapshot.
// NODE 02 is intentionally absent: the user explicitly excluded the game entry.
const SITE_BLUEPRINTS = [
  [1, "one", "KanOne", "影视", "video", "cyan", "#52DDED", "82, 221, 237", "简洁流畅的视频浏览与播放", "cinema", "direct", "1,352", true],
  [3, "ai", "麻豆视频(AI)", "影视", "video", "orange", "#FF985C", "255, 152, 92", "AI 视频分类、搜索与播放", "cinema", "direct", "3,541"],
  [4, "hj", "看海角", "社区", "community", "blue", "#63A8FF", "99, 168, 255", "轻量内容聚合入口", "feed", "direct", "3,059"],
  [5, "91", "看91", "影视", "video", "orange", "#FFAD78", "255, 173, 120", "简洁影院，热门短视频与分类浏览", "cinema", "relay", "2,752"],
  [6, "qms", "秋名山直播", "影视", "video", "violet", "#AA8CFF", "170, 140, 255", "聚合直播频道与低延迟播放", "live", "relay", "2,593"],
  [7, "mr", "看每日大赛", "社区", "community", "lime", "#72D68C", "114, 214, 140", "数据源镜像阅读与本地解密展示", "feed", "relay", "2,312"],
  [8, "xf", "看推特", "图集", "gallery", "cyan", "#48D8C8", "72, 216, 200", "图文与视频浏览器", "feed", "direct", "1,973"],
  [9, "sjs", "司机社（SJS）", "影视", "video", "lime", "#56E2A7", "86, 226, 167", "主题分类、资源检索与帖子阅读", "feed", "direct", "1,528"],
  [10, "qiying", "栖影", "影视", "video", "amber", "#E8D15C", "232, 209, 92", "安静简洁的观影入口", "cinema", "direct", "1,467"],
  [11, "tx", "看糖心Vlog", "影视", "video", "pink", "#FF76A8", "255, 118, 168", "视频内容浏览入口", "cinema", "relay", "1,330"],
  [12, "lg", "看OnlyFans", "图集", "gallery", "blue", "#849BFF", "132, 155, 255", "简洁的图集浏览体验", "gallery", "direct", "1,309"],
  [13, "hxc", "看含羞草", "影视", "video", "amber", "#E8D15C", "232, 209, 92", "高清影视内容，分类浏览", "cinema", "relay", "1,095"],
  [14, "hqw", "好妻网", "影视", "video", "cyan", "#52DDED", "82, 221, 237", "精选视频与短片浏览", "cinema", "direct", "1,076"],
  [15, "book", "有声读物", "动漫", "anime", "pink", "#F178D1", "241, 120, 209", "书籍阅读与中文音声播放", "audio", "direct", "1,013"],
  [16, "dj", "轻看短剧", "影视", "video", "cyan", "#48D8C8", "72, 216, 200", "短剧内容，快速开看", "short", "direct", "874"],
  [17, "swag", "成人社交（SWAG）", "影视", "video", "orange", "#FF985C", "255, 152, 92", "短视频与分类内容浏览", "short", "direct", "871"],
  [18, "mt", "看蜜桃", "影视", "video", "cyan", "#63C7F2", "99, 199, 242", "高清成人影视，每日更新", "cinema", "relay", "747"],
  [19, "pmv", "成人音乐剪辑（PMV）", "影视", "video", "red", "#FF6B63", "255, 107, 99", "音乐剪辑与高清播放", "cinema", "direct", "737"],
  [20, "rou", "看肉视频", "影视", "video", "blue", "#63A8FF", "99, 168, 255", "简洁观影与内容发现", "cinema", "relay", "734"],
  [21, "fj", "观番", "动漫", "anime", "blue", "#849BFF", "132, 155, 255", "简洁的番剧在线观看", "anime", "direct", "662"],
  [22, "kankan", "爱微社区", "社区", "community", "red", "#FF7F8F", "255, 127, 143", "社区内容与热门资源", "feed", "direct", "632"],
  [23, "zb", "看主播", "影视", "video", "pink", "#F178D1", "241, 120, 209", "主播视频目录与连续播放", "live", "direct", "569"],
  [24, "9s", "看九色", "影视", "video", "violet", "#C187FF", "193, 135, 255", "原创高清内容，分类丰富", "cinema", "relay", "566"],
  [25, "jm", "禁漫天堂", "动漫", "anime", "pink", "#FF76A8", "255, 118, 168", "漫画内容浏览入口", "comic", "direct", "564"],
  [26, "mm", "墨影集", "图集", "gallery", "cyan", "#63C7F2", "99, 199, 242", "沉浸式个人影集", "gallery", "direct", "535"],
  [27, "miss", "看Miss", "影视", "video", "violet", "#AA8CFF", "170, 140, 255", "聚合视频内容入口", "cinema", "direct", "529"],
  [28, "dsd", "看懂色帝", "影视", "video", "lime", "#56E2A7", "86, 226, 167", "精选影视内容入口", "cinema", "relay", "462"],
  [29, "movie", "影视聚合", "影视", "video", "violet", "#C187FF", "193, 135, 255", "影视内容聚合与检索", "aggregate", "direct", "455"],
  [30, "xo", "爱看", "社区", "community", "amber", "#F6C453", "246, 196, 83", "精选内容与发现", "cinema", "relay", "437"],
  [31, "jav", "日本成人影像（JAV）", "影视", "video", "red", "#FF6B63", "255, 107, 99", "简洁的视频片库", "cinema", "direct", "433"],
  [32, "ep", "高清成人影片（EPORNER）", "影视", "video", "orange", "#FFAD78", "255, 173, 120", "高清片库，支持多清晰度播放", "cinema", "direct", "419"],
  [33, "tna", "成人视频片库（TNAFlix）", "影视", "video", "lime", "#BDFC48", "189, 252, 72", "多清晰度视频目录与搜索", "cinema", "direct", "408"],
  [34, "madou", "看麻豆", "影视", "video", "cyan", "#8EDFE8", "142, 223, 232", "麻豆影视，分类与排行浏览", "cinema", "relay", "396"],
  [35, "best", "看JavPorn", "影视", "video", "amber", "#F6C453", "246, 196, 83", "精选热门影视内容", "cinema", "direct", "390"],
  [36, "tv", "电视直播（TV）", "影视", "video", "lime", "#91E85B", "145, 232, 91", "直播频道与电视内容", "live", "direct", "388"],
  [37, "ja", "看JavBus", "影视", "video", "lime", "#91E85B", "145, 232, 91", "JavBus 内容浏览入口", "cinema", "relay", "379"],
  [38, "bj", "韩国主播视频（SKBJ）", "影视", "video", "lime", "#72D68C", "114, 214, 140", "画廊与视频内容聚合", "live", "direct", "372"],
  [39, "asmr", "助眠音声（ASMR）", "影视", "video", "red", "#FF7F8F", "255, 127, 143", "沉浸式 ASMR 音视频助眠内容", "audio", "direct", "329"],
].map(([id, slug, name, category, navCategory, accent, color, rgb, description, mode, delivery, clicks, isNew = false]) => ({
  id, slug, name, category, navCategory, accent, color, rgb, description, mode, delivery, clicks, isNew,
}));

function useRoute() {
  const read = () => {
    const match = location.pathname.match(/^\/site\/([^/]+)/);
    return match ? { page: "site", slug: match[1] } : { page: "home" };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onPop = () => setRoute(read());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const go = (path) => {
    history.pushState({}, "", path);
    setRoute(read());
    scrollTo({ top: 0, behavior: "smooth" });
  };
  return [route, go];
}

function Icon({ name }) {
  if (name === "radar") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 12 18 6M12 4v2M20 12h-2M12 20v-2M4 12h2"/></svg>;
  if (name === "trophy") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8 20h8M10 17h4"/></svg>;
  if (name === "film") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="m10 9 5 3-5 3V9ZM4 9h3M4 15h3M17 9h3M17 15h3"/></svg>;
  if (name === "search") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>;
  if (name === "star") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>;
  if (name === "pointer") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 3 10 9-5 1 3 6-2.5 1.2-3-6L6 18 7 3Z"/></svg>;
  if (name === "gallery") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m6 17 4-4 3 3 2-2 3 3"/></svg>;
  if (name === "anime") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h11a2 2 0 0 1 2 2v12H8a3 3 0 0 0-3 2V6a2 2 0 0 1 1-2Z"/><path d="M8 8h7M8 12h5"/></svg>;
  if (name === "community") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2"/><path d="M4 19a5 5 0 0 1 10 0M14 16a4 4 0 0 1 6 3"/></svg>;
  if (name === "sparkle") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3ZM18.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/></svg>;
  if (name === "sun") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
  if (name === "moon") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></svg>;
  if (name === "chevron") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>;
  if (name === "arrow") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m10 8 6 4-6 4V8Z"/></svg>;
}

function Logo({ compact = false }) {
  return <div className={`logo ${compact ? "compact" : ""}`}><img className="logo-image" src="/brand/logo.png" alt="" /><b>不许涩涩机场塔台-允许起飞</b><small>/ 2.0</small></div>;
}

function Header({ go, health }) {
  const [effects, setEffects] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("cf-theme") === "light" ? "light" : "dark");
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    document.documentElement.dataset.effects = effects ? "on" : "off";
  }, [effects]);
  useEffect(() => {
    document.documentElement.dataset.cfnavTheme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("cf-theme", theme);
  }, [theme]);
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <header className="topbar">
    <button className="brand-button" onClick={() => go("/")}><Logo /></button>
    <div className="header-tools">
      <div className="header-state"><span className={`status-dot ${health}`}></span> NETWORK {health === "ok" ? "ONLINE" : health === "error" ? "DEGRADED" : "CHECKING"}</div>
      <time className="header-time">{time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
      <button className={`round-button effects-button ${effects ? "is-on" : ""}`} onClick={() => setEffects(!effects)} aria-label={`${effects ? "关闭" : "开启"}光效`} title={`${effects ? "关闭" : "开启"}光效`} aria-pressed={effects}><Icon name="sparkle" /></button>
      <button className="round-button theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`切换到${theme === "dark" ? "日间" : "夜间"}模式`} title={`切换到${theme === "dark" ? "日间" : "夜间"}模式`} aria-pressed={theme === "light"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <div className="profile"><span>H</span><b>Henry</b><Icon name="chevron" /></div>
    </div>
  </header>;
}

function SiteCard({ site, go, favorites, toggleFavorite, position }) {
  const provider = getProviderForSite(site.slug);
  const connected = Boolean(provider);
  const moveLight = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
  };
  const icon = site.navCategory === "gallery" ? "gallery" : site.navCategory === "anime" ? "anime" : site.navCategory === "community" ? "community" : "play";
  return <article className={`site-card accent-${site.accent} ${connected ? "is-connected" : "is-pending"}`} data-category={site.navCategory} data-delivery={site.delivery} onPointerMove={moveLight} style={{ "--category": site.color, "--glow-rgb": site.rgb, animationDelay: `${Math.min((site.id - 1) * 35, 280)}ms` }}>
    <button className="site-link" type="button" onClick={() => go(`/site/${site.slug}`)} aria-label={`打开 ${site.name}`}>
      <span className="preview-frame is-loaded">
        <img className="site-preview" src={`/previews/${site.slug}.jpg`} alt={`${site.name} 网站首屏预览`} loading={position < 6 ? "eager" : "lazy"} />
        <span className="preview-shade" aria-hidden="true"></span>
        <span className="preview-grid" aria-hidden="true"></span>
      </span>
      <span className="card-top">
        <span className="card-index">NODE {String(site.id).padStart(2, "0")}</span>
        <span className="card-badges">{site.isNew && <span className="new-badge">NEW</span>}<span className="delivery-badge" data-delivery={site.delivery}>{site.delivery === "direct" ? "直连请求" : "中转加速"}</span><span className={`status-badge ${connected ? "online" : "pending"}`}>{connected ? "ONLINE" : "PENDING"}</span></span>
      </span>
      <span className="preview-label"><i></i> 悬浮预览</span>
      <span className="card-content">
        <span className="title-line"><span className="site-icon" aria-hidden="true"><Icon name={icon} /></span><strong className="site-name">{site.name}</strong></span>
        <span className="site-description">{site.description}</span>
        <span className="site-footer"><span className="site-domain">{site.slug}.cfnav.me</span><span className="site-footer-meta"><span className="site-click-count" title="参考快照点击数"><Icon name="pointer" /><span>{site.clicks}</span></span><span className="open-label">OPEN <Icon name="arrow" /></span></span></span>
      </span>
    </button>
    <button className={`favorite-button ${favorites.includes(site.slug) ? "is-favorite" : ""}`} onClick={() => toggleFavorite(site.slug)} aria-label={`${favorites.includes(site.slug) ? "取消收藏" : "收藏"}${site.name}`} title={favorites.includes(site.slug) ? "取消收藏" : "收藏"} aria-pressed={favorites.includes(site.slug)}><Icon name="star" /></button>
  </article>;
}

function Home({ go, health }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState("directory");
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem("cf-favs") || "[]"));
  const searchRef = useRef(null);
  const categories = [["all", "全部"], ["video", "影视"], ["anime", "动漫"], ["gallery", "图集"], ["community", "社区"], ["favorite", "我的收藏"]];
  const shown = useMemo(() => SITE_BLUEPRINTS.filter((site) => {
    const textMatch = `${site.name}${site.description}${site.slug}`.toLowerCase().includes(query.toLowerCase());
    const catMatch = category === "all" || (category === "favorite" ? favorites.includes(site.slug) : site.navCategory === category);
    return textMatch && catMatch;
  }), [query, category, favorites]);
  useEffect(() => {
    const focusSearch = (event) => {
      if (event.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName || "")) {
        event.preventDefault(); searchRef.current?.focus();
      }
    };
    addEventListener("keydown", focusSearch);
    return () => removeEventListener("keydown", focusSearch);
  }, []);
  const toggleFavorite = (slug) => {
    const next = favorites.includes(slug) ? favorites.filter((x) => x !== slug) : [...favorites, slug];
    setFavorites(next); localStorage.setItem("cf-favs", JSON.stringify(next));
  };
  const categoryTitle = categories.find(([key]) => key === category)?.[1] || "全部";
  const readyCount = SITE_BLUEPRINTS.filter((site) => getProviderForSite(site.slug)).length;
  return <div className="home-directory">
    <section className="reference-intro" aria-labelledby="page-title">
      <img className="home-character-mascot" src="/brand/home-character.png" alt="" aria-hidden="true" />
      <div className="intro-number" aria-hidden="true">00 / INDEX</div>
      <div className="intro-copy">
        <p className="reference-eyebrow"><span>ADULT CONTENT DIRECTORY</span><i></i><span>18+</span></p>
        <div className="title-lockup"><h1 id="page-title"><span>不许涩涩</span><span>机场塔台-允许起飞</span></h1><p>无广告<br />聚合导航</p></div>
        <p className="intro-description">成人内容无广告聚合导航站。简约 UI，快速直达精选内容。</p>
      </div>
      <div className="intro-aside" aria-label="导航统计">
        <div className="stat-block"><span>ACTIVE NODES</span><strong>{SITE_BLUEPRINTS.length}</strong><i>INDEXED</i></div>
        <div className="stat-block"><span>READY</span><strong>{readyCount}</strong><i>{health === "ok" ? "ONLINE" : "CHECK"}</i></div>
      </div>
      <div className="hero-scan" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
    </section>
    <nav className="main-view-tabs" aria-label="主页视图">
      <button className={view === "directory" ? "is-active" : ""} onClick={() => setView("directory")}><Icon name="radar" />导航目录</button>
      <button className={view === "leaderboard" ? "is-active" : ""} onClick={() => setView("leaderboard")}><Icon name="trophy" />机长排行榜</button>
      <button className={view === "ranking" ? "is-active" : ""} onClick={() => setView("ranking")}><Icon name="film" />影片榜</button>
      <button className={view === "sources" ? "is-active" : ""} onClick={() => setView("sources")}><Icon name="arrow" />起飞绿色通道</button>
    </nav>
    {view === "directory" ? <>
      <section className="control-panel" aria-label="搜索和筛选">
        <label className="search-box"><span className="search-mark" aria-hidden="true"><Icon name="search" /></span><span className="sr-only">搜索站点</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="输入站点、内容或域名" autoComplete="off" spellCheck="false" /><kbd>/</kbd></label>
        <div className="filter-row"><div className="nav-filters">{categories.map(([key, label]) => {
          const count = key === "all" ? SITE_BLUEPRINTS.length : key === "favorite" ? favorites.length : SITE_BLUEPRINTS.filter((site) => site.navCategory === key).length;
          return <button key={key} className={key === category ? "is-active" : ""} onClick={() => setCategory(key)}>{label}<small>{String(count).padStart(2, "0")}</small></button>;
        })}</div><span className="result-count"><strong>{String(shown.length).padStart(2, "0")}</strong> / <strong>{SITE_BLUEPRINTS.length}</strong> NODES</span></div>
      </section>
      <section className="site-section reference-site-section">
        <div className="section-heading"><div><span>01</span><h2>{query ? `搜索“${query}”` : category === "all" ? "全部站点" : categoryTitle}</h2></div><p><i aria-hidden="true"></i> HOVER TO REVEAL</p></div>
        <div className="delivery-legend" aria-label="媒体线路标注说明"><span className="delivery-badge" data-delivery="direct">直连请求</span><span className="delivery-badge" data-delivery="relay">中转加速</span><small>按主要播放链路标注，线路异常时可能自动切换备用通道</small></div>
        <div className="site-grid">{shown.map((site, index) => <SiteCard key={site.slug} site={site} go={go} favorites={favorites} toggleFavorite={toggleFavorite} position={index} />)}</div>
        {!shown.length && <div className="empty-directory"><small>NO MATCHED NODE</small><h3>没有找到对应站点</h3><button onClick={() => { setQuery(""); setCategory("all"); }}>清除筛选</button></div>}
      </section>
    </> : view === "sources" ? <SourcePanel health={health} /> : <section className="reference-pending-view"><small>{view === "leaderboard" ? "CAPTAIN LEADERBOARD" : "FILM RANKING"}</small><h2>{view === "leaderboard" ? "机长排行榜" : "影片榜"}</h2><p>这个视图依赖参考站的账号与统计数据，独立数据源尚未接入，因此不伪造榜单内容。</p><button onClick={() => setView("directory")}>返回导航目录</button></section>}
  </div>;
}

function SourcePanel({ health }) {
  return <section id="source-panel" className="source-panel">
    <div><span className={`status-dot ${health}`}></span><small>PROVIDER REGISTRY</small><h2>{Object.keys(PROVIDERS).length} 条独立来源</h2><p>全部绕开 cfnav 会话与接口；路由按内容类型选择专用 adapter。</p></div>
    <dl>{Object.values(PROVIDERS).map((provider) => <div key={provider.id}><dt>{provider.name}</dt><dd>{provider.upstream}</dd><small>{provider.capabilities}</small></div>)}<div><dt>替换方式</dt><dd>修改 provider 注册表，不动页面</dd><small>CFNav 依赖：无</small></div></dl>
  </section>;
}

function SitePage({ site, go, health, setHealth }) {
  const provider = getProviderForSite(site.slug);
  if (provider?.id === "qiying") return <QiyingPage site={site} go={go} setHealth={setHealth} />;
  const MISS_TABS = [
    ["", "最近更新"], ["release", "新作上市"], ["today-hot", "今日热门"], ["weekly-hot", "本周热门"],
    ["monthly-hot", "本月热门"], ["chinese-subtitle", "中文字幕"], ["uncensored-leak", "无码流出"],
    ["fc2", "FC2"], ["heyzo", "HEYZO"], ["siro", "SIRO"],
  ];
  const TX_TABS = [["", "最新"], ["videos", "全部作品"], ["artists", "博主"]];
  const ROU_TABS = [["home", "首页"], ["cat", "分类"], ["tag", "标签"]];
  const MADOU_TABS = [
    ["", "最新"], ["麻豆传媒", "麻豆传媒"], ["麻豆番外篇", "番外篇"], ["麻豆花絮", "花絮"],
    ["HongKongDoll", "HongKongDoll"], ["PsychopornTW", "PsychopornTW"], ["91制片厂", "91制片厂"],
    ["果冻传媒", "果冻传媒"], ["蜜桃影像", "蜜桃影像"], ["天美传媒", "天美传媒"],
    ["皇家华人", "皇家华人"], ["兔子先生", "兔子先生"], ["星空无限传媒", "星空无限"],
    ["爱豆", "爱豆"], ["麻豆导演系列", "导演系列"], ["大象传媒", "大象传媒"],
    ["猫爪影像", "猫爪影像"], ["精东影业", "精东影业"], ["杏吧", "杏吧"],
    ["乐播传媒", "乐播传媒"], ["草莓", "草莓"], ["抖阴", "抖阴"],
    ["SA国际传媒", "SA国际"], ["起点传媒性视界传媒", "起点/性视界"], ["大鸟十八", "大鸟十八"],
    ["小鹏奇啪行", "小鹏奇啪行"], ["女优淫娃培训营", "培训营"], ["淫欲游戏王", "淫欲游戏王"],
    ["女神羞羞研究所", "羞羞研究所"], ["突袭女优家", "突袭女优家"], ["情趣K歌房", "情趣K歌房"],
    ["KISS糖果屋", "KISS糖果屋"], ["likes", "点赞排行"],
  ];
  const [items, setItems] = useState([]);
  const [rouData, setRouData] = useState({ sections: null, groups: null });
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState(provider?.id === "madou" ? "" : provider?.preset || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [ageAccepted, setAgeAccepted] = useState(() => (location.hostname === "127.0.0.1" && new URLSearchParams(location.search).has("qa")) || localStorage.getItem("cf-age") === "yes");
  const abortRef = useRef();
  useEffect(() => {
    if (!provider) { setItems([]); setLoading(false); setError(""); return; }
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller;
    if (provider.id === "tx" && category === "artists") {
      setLoading(true); setError("");
      fetch(`/provider-api/tx?action=artists`, { signal: controller.signal }).then((r) => {
        if (!r.ok) throw new Error(`上游返回 ${r.status}`); return r.json();
      }).then((data) => { setItems(Array.isArray(data.list) ? data.list : []); setHealth("ok"); }).catch((e) => {
        if (e.name !== "AbortError") { setError(e.message || "来源暂时不可用"); setHealth("error"); }
      }).finally(() => setLoading(false));
      return () => controller.abort();
    }
    const params = new URLSearchParams({ pg: String(page), limit: "24", ac: "detail" });
    if (submitted) params.set("wd", submitted);
    else if (category) params.set("preset", category);
    else if (provider.preset && provider.id !== "madou") params.set("preset", provider.preset);
    setLoading(true); setError("");
    fetch(`/provider-api/${provider.id}?${params}`, { signal: controller.signal }).then((r) => {
      if (!r.ok) throw new Error(`上游返回 ${r.status}`); return r.json();
    }).then((data) => {
      setItems(Array.isArray(data.list) ? data.list : []);
      if (provider.id === "rou") setRouData({ sections: data.sections || null, groups: data.groups || null });
      setHealth("ok");
    }).catch((e) => {
      if (e.name !== "AbortError") { setError(e.message || "来源暂时不可用"); setHealth("error"); }
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, submitted, category, setHealth, provider?.id, provider?.preset]);
  const submit = (e) => { e.preventDefault(); setPage(1); setSubmitted(query.trim()); };
  useEffect(() => { setPage(1); }, [category, submitted]);
  const openDetail = async (item) => {
    if (!item.needs_detail) return setSelected(item);
    setSelected({ ...item, detail_loading: true });
    try {
      const response = await fetch(`/provider-api/${provider.id}?action=detail&id=${encodeURIComponent(item.vod_id)}`);
      const detail = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(detail.message || `详情返回 ${response.status}`);
      setSelected(detail);
    } catch (detailError) {
      setSelected({ ...item, detail_error: detailError.message });
    }
  };
  const specialRou = provider?.id === "rou" && (category === "home" || category === "cat" || category === "tag");
  if (!provider) return <div className={`site-page accent-${site.accent} mode-${site.mode}`}>
    {!ageAccepted && <div className="age-gate"><div><small>ADULT CONTENT / 18+</small><h2>年满 18 岁方可进入</h2><p>这是一个个人、非商业的学习项目。请确认你已达到所在地区的法定年龄。</p><button onClick={() => { localStorage.setItem("cf-age", "yes"); setAgeAccepted(true); }}>我已年满 18 岁</button><button className="ghost" onClick={() => go("/")}>返回塔台</button></div></div>}
    <nav className="subnav"><button onClick={() => go("/")}><Logo compact /></button><div className="sub-brand"><strong>{site.name}</strong><small>{site.description}</small></div><span className="status-chip error">SOURCE PENDING</span></nav>
    <section className="sub-hero"><small>{site.category.toUpperCase()} / {site.slug}.local</small><h1>{site.name}</h1><p>{site.description}</p><div className="source-note">参考站真实接口核对中 · 暂不返回替代内容</div></section>
    <section className="content-section"><div className="error-state"><h3>这个入口尚未接入</h3><p>为保证与参考项目的内容和使用效果一致，此处不再使用其他站点的数据作为临时替代。</p><button onClick={() => go("/")}>返回导航</button></div></section>
  </div>;
  return <div className={`site-page accent-${site.accent} mode-${site.mode}`}>
    {!ageAccepted && <div className="age-gate"><div><small>ADULT CONTENT / 18+</small><h2>年满 18 岁方可进入</h2><p>这是一个个人、非商业的学习项目。请确认你已达到所在地区的法定年龄。</p><button onClick={() => { localStorage.setItem("cf-age", "yes"); setAgeAccepted(true); }}>我已年满 18 岁</button><button className="ghost" onClick={() => go("/")}>返回塔台</button></div></div>}
    <nav className="subnav"><button onClick={() => go("/")}><Logo compact /></button><div className="sub-brand"><strong>{site.name}</strong><small>{site.description}</small></div><span className={`status-chip ${health}`}>{health === "ok" ? "SOURCE ONLINE" : "SOURCE CHECK"}</span></nav>
    <section className="sub-hero"><small>{site.category.toUpperCase()} / {site.slug}.local</small><h1>{site.name}</h1><p>{site.description}</p><div className="source-note">独立适配器 · {provider.name}{provider.preset ? ` · ${provider.preset}` : ""}</div></section>
    {provider?.id !== "tx" && <form className="content-search" onSubmit={submit}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`搜索 ${site.name} 的内容`} /><button>搜索</button>{submitted && <button type="button" className="clear" onClick={() => { setQuery(""); setSubmitted(""); }}>清除</button>}</form>}
    {provider?.id === "madou" && <div className="qiying-tabs">{MADOU_TABS.map(([key, label]) => <button key={key} className={category === key ? "is-active" : ""} onClick={() => { setCategory(key); }}>{label}</button>)}</div>}
    {provider?.id === "miss" && <div className="qiying-tabs">{MISS_TABS.map(([key, label]) => <button key={key} className={category === key ? "is-active" : ""} onClick={() => { setCategory(key); }}>{label}</button>)}</div>}
    {provider?.id === "tx" && <div className="qiying-tabs">{TX_TABS.map(([key, label]) => <button key={key} className={category === key ? "is-active" : ""} onClick={() => { setCategory(key); }}>{label}</button>)}</div>}
    {provider?.id === "rou" && <div className="qiying-tabs">{ROU_TABS.map(([key, label]) => <button key={key} className={category === key ? "is-active" : ""} onClick={() => { setCategory(key); }}>{label}</button>)}</div>}
    <section className="content-section"><div className="content-heading"><div><small>{submitted ? "SEARCH RESULT" : provider?.id === "rou" ? (category === "cat" ? "CATEGORY INDEX" : category === "tag" ? "TAG INDEX" : category.startsWith("tag:") ? "TAG WORKS" : "LATEST UPDATE") : category === "artists" ? "ARTIST INDEX" : category.startsWith("artist:") ? "ARTIST WORKS" : category === "videos" ? "ALL WORKS" : "LATEST UPDATE"}</small><h2>{submitted ? `“${submitted}”` : provider?.id === "rou" ? (category === "cat" ? "分类" : category === "tag" ? "标签" : category.startsWith("tag:") ? category.slice("tag:".length) : "首页") : category === "artists" ? "全部博主" : category.startsWith("artist:") ? category.slice("artist:".length) : category === "videos" ? "全部作品" : category ? (provider?.id === "madou" ? (MADOU_TABS.find(([k]) => k === category)?.[1] || category) : "LATEST UPDATE") : site.mode === "live" ? "直播频道" : site.mode === "comic" ? "最新图册" : site.mode === "audio" ? "最新音声" : "最新内容"}</h2></div><span>{category === "artists" ? `${items.length} 位` : `PAGE ${page}`}</span></div>
      {loading && <div className="loading-grid">{Array.from({ length: 12 }, (_, i) => <i key={i}></i>)}</div>}
      {error && <div className="error-state"><h3>来源连接失败</h3><p>{error}</p><button onClick={() => setPage((x) => x)}>重新检查</button></div>}
      {!loading && !error && provider?.id === "tx" && category === "artists" && <div className="tx-artist-grid">{items.map((artist) => <button className="tx-artist-card" key={artist.vod_id} onClick={() => setCategory(artist.vod_id)}><div className="tx-artist-avatar">{artist.vod_pic ? <img src={artist.vod_pic} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>AVATAR</span>}</div><strong>{artist.vod_name}</strong>{artist.vod_remarks && <small>{artist.vod_remarks}</small>}{artist.vod_blurb && <p>{artist.vod_blurb}</p>}</button>)}</div>}
      {!loading && !error && !(provider?.id === "tx" && category === "artists") && <ContentGrid items={items} mode={site.mode} onOpen={openDetail} />}
      {!loading && !error && provider?.id === "rou" && category === "home" && rouData.sections && <div className="rou-sections">{rouData.sections.map((section) => <section key={section.key} className="rou-section"><h3>{section.title}<small>{section.videos.length}</small></h3><div className="qiying-grid">{section.videos.map((card) => <button className="qiying-card" key={card.vod_id} onClick={() => openDetail(card)}><div className="qiying-cover"><img src={card.vod_pic} alt="" loading="lazy" referrerPolicy="no-referrer" /><span className="qiying-counts">{card.vod_remarks}</span></div><div className="qiying-meta"><strong>{card.vod_name}</strong><p>{card.vod_blurb || card.vod_area}</p></div></button>)}</div></section>)}</div>}
      {!loading && !error && provider?.id === "rou" && (category === "cat" || category === "tag") && rouData.groups && <div className="rou-groups">{category === "cat" ? rouData.groups.map((group) => <section key={group.key} className="rou-group"><h3>{group.title}<small>{group.tags.length}</small></h3><div className="rou-tag-grid">{group.tags.map((tag) => <button key={tag.id} className="rou-tag-card" onClick={() => setCategory(`tag:${tag.id}`)}><strong>{tag.id}</strong><small>{tag.count}</small></button>)}</div></section>) : <div className="rou-tag-grid rou-tags-flat">{rouData.groups.flatMap((group) => group.tags).sort((a, b) => b.count - a.count).map((tag) => <button key={tag.id} className="rou-tag-card" onClick={() => setCategory(`tag:${tag.id}`)}><strong>{tag.id}</strong><small>{tag.count}</small></button>)}</div>}</div>}
      {!loading && !error && !specialRou && <div className="pager"><button disabled={page === 1} onClick={() => setPage((x) => Math.max(1, x - 1))}>上一页</button><span>{page}</span><button onClick={() => setPage((x) => x + 1)}>下一页</button></div>}
    </section>
    {selected && <DetailModal item={selected} mode={site.mode} provider={provider} onClose={() => setSelected(null)} />}
  </div>;
}

function ContentGrid({ items, mode, onOpen }) {
  return <div className={`content-grid ${mode}`}>{items.map((item, index) => <button className="content-card" onClick={() => onOpen(item)} key={`${item.vod_id}-${index}`}>
    <div className="poster">{item.vod_pic ? <img src={item.vod_pic} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="poster-empty">MEDIA</div>}<span>{mode === "live" ? "LIVE" : item.vod_remarks || "可播放"}</span></div>
    <div className="content-meta"><strong>{item.vod_name || "未命名内容"}</strong><p>{[item.vod_year, item.type_name, item.vod_area].filter(Boolean).join(" · ") || "最新资源"}</p></div>
  </button>)}</div>;
}

function parseStreams(item) {
  const raw = item.vod_play_url || "";
  if ((/^https?:\/\//.test(raw) || raw.startsWith("/")) && !raw.includes("$")) return [{ label: "默认线路", url: raw, group: 0 }];
  const groups = raw.split("$$$");
  const output = [];
  groups.forEach((group, groupIndex) => group.split("#").forEach((entry, index) => {
    const splitAt = entry.indexOf("$");
    if (splitAt > 0) {
      const label = entry.slice(0, splitAt); const url = entry.slice(splitAt + 1);
      if (/^https?:\/\//.test(url) || url.startsWith("/")) output.push({ label: label || `线路 ${index + 1}`, url, group: groupIndex });
    }
  }));
  return output;
}

function DetailModal({ item, mode, provider, onClose }) {
  const streams = parseStreams(item);
  const [active, setActive] = useState(streams[0]);
  const isAudio = mode === "audio";
  const mediaRef = useRef(null);
  useEffect(() => {
    setActive(streams[0]);
  }, [item.vod_play_url]);
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !active) return;
    const isHls = /\.m3u8(?:$|\?)/i.test(active.url);
    const appleNative = isHls && /(iphone|ipod|ipad|mac)/i.test(navigator.userAgent) && media.canPlayType("application/vnd.apple.mpegurl");
    if (!isHls || appleNative) {
      media.src = active.url;
      media.play().catch(() => {});
      return () => { media.removeAttribute("src"); media.load(); };
    }
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: mode === "live" });
      hls.loadSource(active.url); hls.attachMedia(media);
      hls.on(Hls.Events.MANIFEST_PARSED, () => media.play().catch(() => {}));
      return () => hls.destroy();
    }
  }, [active, mode, item.detail_loading]);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><article className="detail-modal"><button className="modal-close" onClick={onClose}>关闭</button>
    <div className="player-shell">{item.detail_loading ? <div className="no-stream">正在解析公开播放线路…</div> : item.detail_error ? <div className="no-stream">{item.detail_error}</div> : item.media_kind === "embed" && item.embed_url ? <iframe src={item.embed_url} title={item.vod_name || "视频播放器"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="origin" style={{ width: "100%", height: "100%", minHeight: "52vh", border: 0, background: "#000" }} /> : item.media_kind === "image" && item.media_url ? <img src={item.media_url} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", maxHeight: "72vh", objectFit: "contain", background: "#000" }} /> : active ? (isAudio ? <audio ref={mediaRef} controls /> : <video ref={mediaRef} controls playsInline poster={item.vod_pic} referrerPolicy="no-referrer" />) : <div className="no-stream">此条目没有公开播放地址</div>}</div>
    <div className="detail-copy"><small>{item.type_name || "CONTENT DETAIL"}</small><h2>{item.vod_name}</h2><p>{item.vod_blurb || item.vod_content?.replace(/<[^>]+>/g, "") || "暂无简介"}</p>{streams.length > 0 && <div className="stream-list">{streams.slice(0, 24).map((stream, i) => <button className={active?.url === stream.url ? "active" : ""} key={`${stream.url}-${i}`} onClick={() => setActive(stream)}>{stream.label}</button>)}</div>}<dl><div><dt>年份</dt><dd>{item.vod_year || "—"}</dd></div><div><dt>地区</dt><dd>{item.vod_area || "—"}</dd></div><div><dt>来源</dt><dd>{provider.name}</dd></div></dl></div>
  </article></div>;
}

function qiyingFormatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function qiyingCategoryTabs(posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const category of post.k || []) counts.set(category, (counts.get(category) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function QiyingPage({ site, go, setHealth }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [ageAccepted, setAgeAccepted] = useState(() => (location.hostname === "127.0.0.1" && new URLSearchParams(location.search).has("qa")) || localStorage.getItem("cf-age") === "yes");
  useEffect(() => {
    let cancelled = false;
    qiyingLoadCatalog().then((data) => {
      if (cancelled) return;
      setPosts(data);
      setLoading(false);
      setHealth("ok");
    }).catch((loadError) => {
      if (cancelled) return;
      setError(loadError.message || "本地目录加载失败");
      setLoading(false);
      setHealth("error");
    });
    return () => { cancelled = true; };
  }, [setHealth]);
  const tabs = useMemo(() => [["", "全部"], ...qiyingCategoryTabs(posts)], [posts]);
  const filtered = useMemo(() => {
    const keyword = submitted.trim().toLowerCase();
    return posts.filter((post) => {
      if (category && !(post.k || []).includes(category)) return false;
      if (!keyword) return true;
      const haystack = `${post.t || ""} ${(post.a || "")} ${(post.g || []).join(" ")}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [posts, category, submitted]);
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const items = filtered.slice((page - 1) * 24, page * 24);
  useEffect(() => { setPage(1); }, [category, submitted]);
  const submit = (event) => { event.preventDefault(); setPage(1); setSubmitted(query.trim()); };
  const openDetail = (post) => {
    setSelected({ ...post, pid: post.p, detail_loading: true });
    qiyingLoadDetail(post.p).then((records) => {
      const detail = records.find((record) => Number(record.p) === Number(post.p));
      setSelected((current) => current && current.p === post.p ? { ...current, detail_loading: false, detail_record: detail || null } : current);
    }).catch((detailError) => {
      setSelected((current) => current && current.p === post.p ? { ...current, detail_loading: false, detail_error: detailError.message } : current);
    });
  };
  return <div className={`site-page accent-${site.accent} mode-${site.mode}`}>
    {!ageAccepted && <div className="age-gate"><div><small>ADULT CONTENT / 18+</small><h2>年满 18 岁方可进入</h2><p>这是一个个人、非商业的学习项目。请确认你已达到所在地区的法定年龄。</p><button onClick={() => { localStorage.setItem("cf-age", "yes"); setAgeAccepted(true); }}>我已年满 18 岁</button><button className="ghost" onClick={() => go("/")}>返回塔台</button></div></div>}
    <nav className="subnav"><button onClick={() => go("/")}><Logo compact /></button><div className="sub-brand"><strong>{site.name}</strong><small>{site.description}</small></div><span className="status-chip ok">SOURCE ONLINE</span></nav>
    <section className="sub-hero"><small>{site.category.toUpperCase()} / {site.slug}.local</small><h1>{site.name}</h1><p>{site.description}</p><div className="source-note">本地镜像目录 · 主站签名播放 · 91吃瓜网</div></section>
    <form className="content-search" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索 ${site.name} 的图文内容`} /><button>搜索</button>{submitted && <button type="button" className="clear" onClick={() => { setQuery(""); setSubmitted(""); }}>清除</button>}</form>
    <div className="qiying-tabs">{tabs.map(([key, label]) => <button key={key} className={category === key ? "is-active" : ""} onClick={() => setCategory(key)}>{label}<small>{key ? tabsCount(posts, key) : posts.length}</small></button>)}</div>
    <section className="content-section">
      <div className="content-heading"><div><small>{submitted ? "SEARCH RESULT" : "LATEST UPDATE"}</small><h2>{submitted ? `“${submitted}”` : category || "最新图文"}</h2></div><span>{filtered.length} 条</span></div>
      {loading && <div className="loading-grid">{Array.from({ length: 12 }, (_, i) => <i key={i}></i>)}</div>}
      {error && <div className="error-state"><h3>本地目录加载失败</h3><p>{error}</p><button onClick={() => setPage((x) => x)}>重新检查</button></div>}
      {!loading && !error && <>
        <div className="qiying-grid">{items.map((post) => <button className="qiying-card" key={post.p} onClick={() => openDetail(post)}>
          <div className="qiying-cover"><img src={qiyingAssetPath(post.r)} alt="" loading="lazy" referrerPolicy="no-referrer" /><span className="qiying-counts">{post.i ? `${post.i} 图` : ""}{post.i && post.v ? " · " : ""}{post.v ? `${post.v} 视频` : ""}</span></div>
          <div className="qiying-meta"><strong>{post.t || "未命名"}</strong><p>{[post.a, qiyingFormatTime(post.u || post.c)].filter(Boolean).join(" · ") || "最新资源"}</p></div>
        </button>)}</div>
        {!items.length && <div className="error-state"><h3>没有匹配内容</h3><p>换个关键词或分类试试。</p><button onClick={() => { setQuery(""); setSubmitted(""); setCategory(""); }}>清除筛选</button></div>}
        <div className="pager"><button disabled={page === 1} onClick={() => setPage((x) => Math.max(1, x - 1))}>上一页</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>下一页</button></div>
      </>}
    </section>
    {selected && <QiyingModal post={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function tabsCount(posts, key) {
  return posts.filter((post) => (post.k || []).includes(key)).length;
}

function QiyingModal({ post, onClose }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState("");
  const [playLoading, setPlayLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(0);
  const mediaRef = useRef(null);
  const record = post.detail_record;
  const images = (record?.i || []).map((item) => qiyingAssetPath(item.p)).filter(Boolean);
  const videos = record?.v || [];
  const currentImage = images[imageIndex];
  useEffect(() => {
    setImageIndex(0);
    setPlaying(false);
    setPlayError("");
    setPlayLoading(false);
    setCurrentVideo(0);
  }, [post.p]);
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !playing || !post.play_url) return;
    const isHls = /\.m3u8(?:$|\?)/i.test(post.play_url);
    const appleNative = isHls && /(iphone|ipod|ipad|mac)/i.test(navigator.userAgent) && media.canPlayType("application/vnd.apple.mpegurl");
    if (!isHls || appleNative) {
      media.src = post.play_url;
      media.play().catch(() => {});
      return () => { media.removeAttribute("src"); media.load(); };
    }
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(post.play_url); hls.attachMedia(media);
      hls.on(Hls.Events.MANIFEST_PARSED, () => media.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setPlayError("播放中断：视频源已过期或不可用，请重新点击播放"); });
      return () => hls.destroy();
    }
    setPlayError("当前浏览器不支持 HLS 播放");
  }, [playing, post.play_url]);
  const startPlay = (index = 0) => {
    setPlayLoading(true); setPlayError("");
    setCurrentVideo(index);
    fetch(`/provider-api/qiying?action=play&id=${encodeURIComponent(post.p)}&idx=${index}`).then((response) => response.json().then((body) => ({ ok: response.ok, body }))).then(({ ok, body }) => {
      if (!ok) throw new Error(body?.message || "播放解析失败");
      setPlayLoading(false);
      setPostPlay(post, body.video);
      setPlaying(true);
    }).catch((playLoadError) => {
      setPlayLoading(false);
      setPlayError(playLoadError.message || "视频源解析失败");
    });
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className="qiying-modal">
    <button className="modal-close" onClick={onClose}>关闭</button>
    <div className="qiying-player-area">
      {post.detail_loading ? <div className="no-stream">正在加载图文详情…</div> : post.detail_error ? <div className="no-stream">{post.detail_error}</div> : playing && post.play_url ? <video ref={mediaRef} controls playsInline autoPlay poster={qiyingAssetPath(record?.v?.[0]?.c || post.r)} referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: "72vh", background: "#000" }} /> : images.length ? <img src={currentImage} alt="" referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: "72vh", objectFit: "contain", background: "#000" }} /> : <div className="no-stream">此帖子没有公开媒体</div>}
      {images.length > 1 && !playing && <div className="qiying-image-nav"><button onClick={() => setImageIndex((x) => (x + images.length - 1) % images.length)}>上一张</button><span>{imageIndex + 1} / {images.length}</span><button onClick={() => setImageIndex((x) => (x + 1) % images.length)}>下一张</button></div>}
      {playError && <div className="qiying-play-error">{playError}</div>}
    </div>
    <div className="detail-copy"><small>{[post.k?.[0], post.a, qiyingFormatTime(post.u || post.c)].filter(Boolean).join(" · ") || "91吃瓜"}</small><h2>{post.t || "未命名"}</h2><p>{post.d || "暂无简介"}</p>
      {videos.length > 0 && <div className="qiying-video-strip">{videos.map((video, index) => <button key={video.i || index} className={playing && currentVideo === index ? "is-active" : ""} onClick={() => startPlay(index)}>
        {playLoading && currentVideo === index ? "解析中…" : `播放视频${videos.length > 1 ? ` ${index + 1}` : ""}`}<small>{video.d ? `${video.d} 秒` : ""}{video.w ? ` · ${video.w}x${video.h}` : ""}</small>
      </button>)}</div>}
      {(post.g || []).length > 0 && <div className="qiying-tags">{(post.g || []).map((tag) => <span key={tag}>{tag}</span>)}</div>}
      <dl><div><dt>编号</dt><dd>{post.p}</dd></div><div><dt>分类</dt><dd>{(post.k || []).join(" / ") || "—"}</dd></div><div><dt>来源</dt><dd>91吃瓜网镜像 + 主站签名</dd></div></dl>
    </div>
  </article></div>;
}

function setPostPlay(post, url) {
  post.play_url = url;
}

export function App() {
  const [route, go] = useRoute();
  const [health, setHealth] = useState("checking");
  useEffect(() => {
    Promise.allSettled(Object.keys(PROVIDERS).map((provider) => fetch(`/provider-api/${provider}?pg=1&limit=1&ac=detail`).then((r) => r.ok ? r.json() : Promise.reject()))).then((results) => {
      const ready = results.filter((result) => result.status === "fulfilled");
      setHealth(ready.length === results.length ? "ok" : ready.length ? "checking" : "error");
    });
  }, []);
  const site = route.page === "site" ? SITE_BLUEPRINTS.find((s) => s.slug === route.slug) : null;
  return <div className="app"><Header go={go} health={health} /><main>{site ? <SitePage site={site} go={go} health={health} setHealth={setHealth} /> : <Home go={go} health={health} />}</main><footer><span>不许涩涩机场塔台-允许起飞 / ADULT DIRECTORY</span><span>NO ADS · MINIMAL UI · 2026</span></footer></div>;
}
