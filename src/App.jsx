import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { getProviderForSite, PROVIDERS } from "../providers/catalog.js";

// Homepage metadata follows the live 2026-08-17 reference portal. Provider routing
// remains slug-based in providers/catalog.js; the two new entries intentionally stay pending.
const SITE_BLUEPRINTS = [
  [1, "sf", "私房 TV", "影视", "video", "red", "#FF6B63", "255, 107, 99", "私房影视与频道内容浏览", "cinema", "direct", "1,430", true],
  [2, "98", "98堂", "影视", "video", "blue", "#63A8FF", "99, 168, 255", "分类清晰的高清视频浏览站", "cinema", "direct", "1,149", true],
  [3, "ai", "麻豆视频(AI)", "影视", "video", "cyan", "#52DDED", "82, 221, 237", "AI 视频分类、搜索与播放", "cinema", "direct", "4,519"],
  [4, "hj", "看海角", "社区", "community", "amber", "#F6C453", "246, 196, 83", "轻量内容聚合入口", "feed", "direct", "4,285"],
  [5, "91", "看91", "影视", "video", "cyan", "#8EDFE8", "142, 223, 232", "简洁影院，热门短视频与分类浏览", "cinema", "relay", "3,955"],
  [6, "mr", "看每日大赛", "社区", "community", "orange", "#FFAD78", "255, 173, 120", "数据源镜像阅读与本地解密展示", "feed", "relay", "3,256"],
  [7, "qms", "秋名山直播", "影视", "video", "orange", "#FF985C", "255, 152, 92", "聚合直播频道与低延迟播放", "live", "relay", "3,066"],
  [8, "xf", "看推特", "图集", "gallery", "blue", "#849BFF", "132, 155, 255", "图文与视频浏览器", "feed", "direct", "2,817"],
  [9, "one", "KanOne", "影视", "video", "pink", "#F178D1", "241, 120, 209", "简洁流畅的视频浏览与播放", "cinema", "direct", "2,306"],
  [10, "qiying", "栖影", "影视", "video", "lime", "#72D68C", "114, 214, 140", "安静简洁的观影入口", "cinema", "direct", "1,995"],
  [11, "sjs", "司机社（SJS）", "影视", "video", "violet", "#AA8CFF", "170, 140, 255", "主题分类、资源检索与帖子阅读", "feed", "direct", "1,951"],
  [12, "tx", "看糖心Vlog", "影视", "video", "cyan", "#48D8C8", "72, 216, 200", "视频内容浏览入口", "cinema", "relay", "1,896"],
  [13, "lg", "看OnlyFans", "图集", "gallery", "lime", "#91E85B", "145, 232, 91", "简洁的图集浏览体验", "gallery", "direct", "1,810"],
  [14, "hxc", "看含羞草", "影视", "video", "lime", "#72D68C", "114, 214, 140", "高清影视内容，分类浏览", "cinema", "relay", "1,555"],
  [15, "hqw", "好妻网", "影视", "video", "orange", "#FF985C", "255, 152, 92", "精选视频与短片浏览", "cinema", "direct", "1,441"],
  [16, "swag", "成人社交（SWAG）", "影视", "video", "violet", "#AA8CFF", "170, 140, 255", "短视频与分类内容浏览", "short", "direct", "1,285"],
  [17, "book", "有声读物", "动漫", "anime", "lime", "#BDFC48", "189, 252, 72", "书籍阅读与中文音声播放", "audio", "direct", "1,267"],
  [18, "dj", "轻看短剧", "影视", "video", "blue", "#849BFF", "132, 155, 255", "短剧内容，快速开看", "short", "direct", "1,169"],
  [19, "mt", "看蜜桃", "影视", "video", "violet", "#C187FF", "193, 135, 255", "高清成人影视，每日更新", "cinema", "relay", "1,102"],
  [20, "rou", "看肉视频", "影视", "video", "amber", "#F6C453", "246, 196, 83", "简洁观影与内容发现", "cinema", "relay", "992"],
  [21, "fj", "观番", "动漫", "anime", "lime", "#91E85B", "145, 232, 91", "简洁的番剧在线观看", "anime", "direct", "967"],
  [22, "kankan", "爱微社区", "社区", "community", "cyan", "#63C7F2", "99, 199, 242", "社区内容与热门资源", "feed", "direct", "906"],
  [23, "pmv", "成人音乐剪辑（PMV）", "影视", "video", "lime", "#56E2A7", "86, 226, 167", "音乐剪辑与高清播放", "cinema", "direct", "839"],
  [24, "jm", "禁漫天堂", "动漫", "anime", "cyan", "#48D8C8", "72, 216, 200", "漫画内容浏览入口", "comic", "direct", "820"],
  [25, "9s", "看九色", "影视", "video", "amber", "#E8D15C", "232, 209, 92", "原创高清内容，分类丰富", "cinema", "relay", "804"],
  [26, "mm", "墨影集", "图集", "gallery", "violet", "#C187FF", "193, 135, 255", "沉浸式个人影集", "gallery", "direct", "763"],
  [27, "miss", "看Miss", "影视", "video", "lime", "#56E2A7", "86, 226, 167", "聚合视频内容入口", "cinema", "direct", "742"],
  [28, "zb", "看主播", "影视", "video", "cyan", "#52DDED", "82, 221, 237", "主播视频目录与连续播放", "live", "direct", "734"],
  [29, "dsd", "看懂色帝", "影视", "video", "red", "#FF6B63", "255, 107, 99", "精选影视内容入口", "cinema", "relay", "679"],
  [30, "movie", "影视聚合", "影视", "video", "amber", "#E8D15C", "232, 209, 92", "影视内容聚合与检索", "aggregate", "direct", "605"],
  [31, "jav", "日本成人影像（JAV）", "影视", "video", "blue", "#63A8FF", "99, 168, 255", "简洁的视频片库", "cinema", "direct", "602"],
  [32, "xo", "爱看", "社区", "community", "pink", "#FF76A8", "255, 118, 168", "精选内容与发现", "cinema", "relay", "598"],
  [33, "ep", "高清成人影片（EPORNER）", "影视", "video", "cyan", "#8EDFE8", "142, 223, 232", "高清片库，支持多清晰度播放", "cinema", "direct", "580"],
  [34, "madou", "看麻豆", "影视", "video", "lime", "#BDFC48", "189, 252, 72", "麻豆影视，分类与排行浏览", "cinema", "relay", "579"],
  [35, "tna", "成人视频片库（TNAFlix）", "影视", "video", "pink", "#F178D1", "241, 120, 209", "多清晰度视频目录与搜索", "cinema", "direct", "558"],
  [36, "best", "看JavPorn", "影视", "video", "pink", "#FF76A8", "255, 118, 168", "精选热门影视内容", "cinema", "direct", "551"],
  [37, "tv", "电视直播（TV）", "影视", "video", "red", "#FF7F8F", "255, 127, 143", "直播频道与电视内容", "live", "direct", "544"],
  [38, "ja", "看JavBus", "影视", "video", "red", "#FF7F8F", "255, 127, 143", "JavBus 内容浏览入口", "cinema", "relay", "542"],
  [39, "bj", "韩国主播视频（SKBJ）", "影视", "video", "orange", "#FFAD78", "255, 173, 120", "画廊与视频内容聚合", "live", "direct", "503"],
  [40, "asmr", "助眠音声（ASMR）", "影视", "video", "cyan", "#63C7F2", "99, 199, 242", "沉浸式 ASMR 音视频助眠内容", "audio", "direct", "453"],
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
  if (name === "refresh") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>;
  if (name === "crown") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 4 4 5-6 5 6 4-4-2 12H5L3 6Z"/><path d="M5 18h14"/></svg>;
  if (name === "eye") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
  if (name === "info") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>;
  if (name === "shield") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === "plane") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 9.5 14.5M22 2l-7 20-4-8-8-4 19-8Z"/></svg>;
  if (name === "help") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.3.9-1.3 1.7M12 17h.01"/></svg>;
  if (name === "logout") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m10 8 6 4-6 4V8Z"/></svg>;
}

function Logo({ compact = false }) {
  return <div className={`logo ${compact ? "compact" : ""}`}><img className="logo-image" src="/brand/logo.png" alt="" /><b>不许涩涩机场塔台-允许起飞</b><small>/ 2.0</small></div>;
}

function Header({ go, health, isHome }) {
  const [effects, setEffects] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("cf-theme") === "light" ? "light" : "dark");
  const [time, setTime] = useState(() => new Date());
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const profileRef = useRef(null);
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
  useEffect(() => {
    const close = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    addEventListener("pointerdown", close);
    return () => removeEventListener("pointerdown", close);
  }, []);
  if (!isHome) return <header className="topbar">
    <button className="brand-button" onClick={() => go("/")}><Logo /></button>
    <div className="header-tools">
      <div className="header-state"><span className={`status-dot ${health}`}></span> NETWORK {health === "ok" ? "ONLINE" : health === "error" ? "DEGRADED" : "CHECKING"}</div>
      <time className="header-time">{time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
      <button className={`round-button effects-button ${effects ? "is-on" : ""}`} onClick={() => setEffects(!effects)} aria-label={`${effects ? "关闭" : "开启"}光效`}><Icon name="sparkle" /></button>
      <button className="round-button theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`切换到${theme === "dark" ? "日间" : "夜间"}模式`}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <div className="profile"><span>H</span><b>Henry</b><Icon name="chevron" /></div>
    </div>
  </header>;
  return <header className="topbar portal-topbar">
    <a className="brand" href="/" aria-label="不许涩涩机场塔台-允许起飞首页" onClick={(event) => { event.preventDefault(); go("/"); }}>
      <img className="brand-logo" src="/brand/logo.png" alt="" width="256" height="256" decoding="async" />
      <span className="brand-name">不许涩涩机场塔台-允许起飞</span><span className="brand-version">/ 2.0</span>
    </a>
    <div className="topbar-meta">
      <span className="signal"><i aria-hidden="true"></i> NETWORK ONLINE</span>
      <time className="time" aria-label="当前时间">{time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
      <span className="mascot-launcher mascot-launcher-disabled" title="看板娘入口已按项目决定移除" aria-hidden="true"><span>✦</span><span>看板娘</span></span>
      <button className="icon-button" type="button" onClick={() => setEffects(!effects)} aria-label={`${effects ? "关闭" : "开启"}光效`} title={`${effects ? "关闭" : "开启"}光效`} aria-pressed={effects}><Icon name="sparkle" /></button>
      <button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`切换到${theme === "dark" ? "日间" : "夜间"}模式`} title={`切换到${theme === "dark" ? "日间" : "夜间"}模式`} aria-pressed={theme === "light"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <div className="account-menu" ref={profileRef}>
        <button className="account-trigger" type="button" aria-haspopup="menu" aria-expanded={profileOpen} aria-label="账户菜单，Henry" onClick={() => setProfileOpen((open) => !open)}>
          <span className="account-avatar-wrap"><img className="account-avatar" alt="Henry头像" src="https://cdn.ldstatic.com/user_avatar/linux.do/henryz/288/1848603_2.png" /><span className="account-avatar-fallback">H</span></span>
          <span className="account-name">Henry</span><Icon name="chevron" />
        </button>
        <div className="account-popover" role="menu" hidden={!profileOpen} data-rank-tier="4">
          <div className="account-identity"><strong>Henry</strong><span>@henryz</span><small>LOCAL PROFILE</small>
            <div className="account-rank-row" data-rank-tier="4"><span className="account-rank-value"><span className="rank-emblem"><Icon name="trophy" /></span><span><small>LOCAL CAPTAIN / TIER 04</small><strong>资深机长</strong></span></span><button className="account-rank-help" type="button" aria-label="查看军衔升级条件"><Icon name="help" /></button></div>
            <div className={`account-leaderboard-setting ${leaderboardVisible ? "" : "is-private"}`}><span className="account-setting-copy"><Icon name={leaderboardVisible ? "eye" : "shield"} /><span><strong>参与机长排行</strong><small>{leaderboardVisible ? "已显示本地排名" : "已从排行榜隐藏"}</small></span></span><button className="account-setting-switch" type="button" role="switch" aria-checked={leaderboardVisible} onClick={() => setLeaderboardVisible((visible) => !visible)}><span></span></button></div>
          </div>
          <button className="account-logout" type="button" role="menuitem" onClick={() => setProfileOpen(false)}><Icon name="logout" />退出登录</button>
        </div>
      </div>
    </div>
  </header>;
}

function SiteCard({ site, go, favorites, toggleFavorite, position }) {
  const provider = getProviderForSite(site.slug);
  const connected = Boolean(provider);
  const [previewState, setPreviewState] = useState("");
  const moveLight = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
  };
  const icon = site.navCategory === "gallery" ? "gallery" : site.navCategory === "anime" ? "anime" : site.navCategory === "community" ? "community" : "play";
  const href = site.externalUrl || `/site/${site.slug}`;
  return <article className={`site-card accent-${site.accent} ${connected ? "is-connected" : "is-pending"}`} data-site-id={site.slug} data-category={site.navCategory} data-delivery={site.delivery} onPointerMove={moveLight} style={{ "--category": site.color, "--glow-rgb": site.rgb, animationDelay: `${Math.min((site.id - 1) * 35, 280)}ms` }}>
    <a className="site-link" href={href} target={site.externalUrl ? "_blank" : undefined} rel={site.externalUrl ? "noopener noreferrer" : undefined} onClick={(event) => { if (!site.externalUrl && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); go(href); } }} aria-label={`打开 ${site.name}`}>
      <span className={`preview-frame ${previewState}`}>
        <img className="site-preview" src={`/previews/${site.slug}.jpg?v=20260817-portal-dark`} alt={`${site.name} 网站首屏预览`} loading={position < 6 ? "eager" : "lazy"} fetchPriority={position < 6 ? "high" : undefined} decoding="async" onLoad={() => setPreviewState("is-loaded")} onError={() => setPreviewState("is-loaded is-broken")} />
        <span className="preview-shade" aria-hidden="true"></span>
        <span className="preview-grid" aria-hidden="true"></span>
      </span>
      <span className="card-top">
        <span className="card-index">NODE {String(site.id).padStart(2, "0")}</span>
        <span className="card-badges">{site.isNew && <span className="new-badge">NEW</span>}<span className="delivery-badge" data-delivery={site.delivery} title={site.delivery === "direct" ? "主要媒体由浏览器直连源站 CDN，异常时可能自动切换备用线路" : "主要媒体通过本站中转、共享缓存或 CDN 加速"}>{site.delivery === "direct" ? "直连请求" : "中转加速"}</span><span className={`status-badge ${connected ? "online" : "pending"}`}>{connected ? "ONLINE" : "PENDING"}</span></span>
      </span>
      <span className="preview-label"><i></i><span>悬浮预览</span></span>
      <span className="card-content">
        <span className="title-line"><span className="site-icon" aria-hidden="true"><Icon name={icon} /></span><strong className="site-name">{site.name}</strong></span>
        <span className="site-description">{site.description}</span>
        <span className="site-footer"><span className="site-domain">{site.slug}.cfnav.me</span><span className="site-footer-meta"><span className="site-click-count" title={`${site.clicks} 次点击`} aria-label={`${site.clicks} 次点击`}><Icon name="pointer" /><span>{site.clicks}</span></span><span className="open-label">OPEN <Icon name="arrow" /></span></span></span>
      </span>
    </a>
    <button className={`favorite-button ${favorites.includes(site.slug) ? "is-favorite" : ""}`} onClick={() => toggleFavorite(site.slug)} aria-label={`${favorites.includes(site.slug) ? "取消收藏" : "收藏"}${site.name}`} title={favorites.includes(site.slug) ? "取消收藏" : "收藏"} aria-pressed={favorites.includes(site.slug)}><Icon name="star" /></button>
  </article>;
}

function RefreshButton({ className, label, refreshing, onRefresh }) {
  return <button className={`${className} ${refreshing ? "is-loading" : ""}`} type="button" aria-label={label} title={label} disabled={refreshing} onClick={onRefresh}><Icon name="refresh" /></button>;
}

function CaptainLeaderboard({ hidden }) {
  const [period, setPeriod] = useState("week");
  const [refreshing, setRefreshing] = useState(false);
  const refresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 520); };
  return <section className="captain-leaderboard" role="tabpanel" aria-labelledby="leaderboard-tab" hidden={hidden}>
    <div className="section-heading captain-heading"><div><span>02</span><h2>机长排行榜</h2></div><div className="captain-heading-actions"><div className="leaderboard-period-switch" role="group" aria-label="排行榜周期"><button className={`leaderboard-period ${period === "week" ? "is-active" : ""}`} type="button" aria-pressed={period === "week"} onClick={() => setPeriod("week")}>本周</button><button className={`leaderboard-period ${period === "all" ? "is-active" : ""}`} type="button" aria-pressed={period === "all"} onClick={() => setPeriod("all")}>总榜</button></div><RefreshButton className="leaderboard-refresh" label="刷新机长排行榜" refreshing={refreshing} onRefresh={refresh} /></div></div>
    <div className="captain-summary is-private" aria-label="我的飞行数据"><div><span>YOUR RANK</span><strong>--</strong><small>未参与排行</small></div><div><span>FLIGHT TIME</span><strong>数据仍在累计</strong></div><div className="captain-chase-summary"><span>NEXT POSITION</span><strong>开启后恢复排名</strong><span className="captain-progress" role="progressbar" aria-label="追赶上一名进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></span></div></div>
    <div className="captain-champion"><Icon name="crown" /><span><small>LAST WEEK CHAMPION</small><strong>--</strong></span><b>--</b></div>
    <ol className="captain-podium captain-placeholder-podium" aria-label="本期前三名">{[2, 1, 3].map((rank) => <li key={rank} className="captain-podium-entry is-placeholder" data-rank={rank} data-rank-tier="1"><span className="captain-podium-rank">{rank === 1 && <Icon name="crown" />}#{String(rank).padStart(2, "0")}</span><span className="captain-avatar-wrap captain-podium-avatar"><span>—</span></span><strong>等待真实数据</strong><span className="captain-podium-username">—</span><span className="captain-badges"><span className="captain-title-badge" data-rank-tier="1">—</span></span><b>--</b></li>)}</ol>
    <div className="captain-list-meta"><span>RANKING / 04-50</span><span><strong>0</strong> 位机长 <i>/</i> 累计 <strong>0 分钟</strong></span></div>
    <div className="captain-empty"><Icon name="trophy" /><strong>{period === "week" ? "暂无本周真实排行数据" : "暂无总榜真实排行数据"}</strong><span>排行榜结构已还原；本地没有独立统计源，因此不填充虚构用户或时长。</span></div>
  </section>;
}

function NumberRankingPanel({ hidden }) {
  const [mode, setMode] = useState("ranking");
  const [period, setPeriod] = useState("daily");
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState(() => new Date());
  const refresh = () => { setRefreshing(true); setTimeout(() => { setUpdated(new Date()); setRefreshing(false); }, 520); };
  const periodLabel = period === "daily" ? "今日" : period === "weekly" ? "本周" : "本月";
  return <section className="number-ranking" role="tabpanel" aria-labelledby="number-ranking-tab" hidden={hidden}>
    <div className="section-heading number-ranking-heading"><div><span>03</span><h2>佬友优选</h2></div><div className="number-ranking-actions"><div className="number-mode-switch" role="group" aria-label="佬友优选视图"><button className={`number-mode ${mode === "ranking" ? "is-active" : ""}`} type="button" aria-pressed={mode === "ranking"} onClick={() => setMode("ranking")}>热门</button><button className={`number-mode ${mode === "history" ? "is-active" : ""}`} type="button" aria-pressed={mode === "history"} onClick={() => setMode("history")}>最近观看</button></div><div className="number-period-switch" role="group" aria-label="佬友优选周期" hidden={mode === "history"}>{[["daily", "日榜"], ["weekly", "周榜"], ["monthly", "月榜"]].map(([key, label]) => <button key={key} className={`number-period ${period === key ? "is-active" : ""}`} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div><RefreshButton className="number-ranking-icon-button" label="刷新佬友优选" refreshing={refreshing} onRefresh={refresh} /></div></div>
    <div className="number-ranking-overview"><div className="number-source-status"><span className="number-source-signal" data-state="live" aria-hidden="true"></span><span><small>DATA SOURCE</small><strong>本地真实打开记录</strong></span><time>更新于 {updated.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }).replace("/", "/")} {updated.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</time></div><div className="number-content-summary"><span><small>PERIOD</small><strong>{mode === "history" ? "最近" : periodLabel}</strong></span><span><small>ITEMS</small><strong>0 条</strong></span></div></div>
    <div className="number-ranking-notice" hidden={mode !== "history"}><Icon name="info" /><span>最近观看只展示本机真实产生的记录。</span></div>
    <div className="number-ranking-empty"><Icon name="film" /><strong>{mode === "history" ? "暂无真实观看记录" : "暂无真实打开数据"}</strong><span>优选界面与切换逻辑已还原；没有独立数据源时保持空态，不生成虚构条目。</span></div>
  </section>;
}

function DecoyPage({ onUnlock }) {
  const hitsRef = useRef(0);
  const hitTimer = useRef(null);
  useEffect(() => {
    document.title = "Welcome to nginx!";
    return () => clearTimeout(hitTimer.current);
  }, []);
  const handleHit = () => {
    hitsRef.current += 1;
    clearTimeout(hitTimer.current);
    hitTimer.current = setTimeout(() => { hitsRef.current = 0; }, 3000);
    if (hitsRef.current >= 5) onUnlock();
  };
  return <div className="decoy-shell" onClick={handleHit}>
    <div className="decoy-page">
      <h1>Welcome to nginx!</h1>
      <p>If you see this page, the nginx web server is successfully installed and
      working. Further configuration is required.</p>

      <p>For online documentation and support please refer to{" "}
      <a href="http://nginx.org/" onClick={(event) => event.stopPropagation()}>nginx.org</a>.<br />
      Commercial support is available at{" "}
      <a href="http://nginx.com/" onClick={(event) => event.stopPropagation()}>nginx.com</a>.</p>

      <p><em>Thank you for using nginx.</em></p>
    </div>
  </div>;
}

function Home({ go }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState("directory");
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cf-favs") || "[]");
      return Array.isArray(saved) ? saved.filter((slug) => SITE_BLUEPRINTS.some((site) => site.slug === slug)) : [];
    } catch { return []; }
  });
  const searchRef = useRef(null);
  const categories = [["all", "全部"], ["video", "影视"], ["anime", "动漫"], ["gallery", "图集"], ["community", "社区"], ["game", "游戏"], ["favorite", "我的收藏"]];
  const shown = useMemo(() => SITE_BLUEPRINTS.filter((site) => {
    const textMatch = `${site.name}${site.description}${site.slug}`.toLowerCase().includes(query.toLowerCase());
    const catMatch = category === "all" || (category === "favorite" ? favorites.includes(site.slug) : site.navCategory === category);
    return textMatch && catMatch;
  }), [query, category, favorites]);
  useEffect(() => {
    const focusSearch = (event) => { if (event.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName || "")) { event.preventDefault(); searchRef.current?.focus(); } };
    addEventListener("keydown", focusSearch); return () => removeEventListener("keydown", focusSearch);
  }, []);
  const toggleFavorite = (slug) => { const next = favorites.includes(slug) ? favorites.filter((x) => x !== slug) : [...favorites, slug]; setFavorites(next); localStorage.setItem("cf-favs", JSON.stringify(next)); };
  const categoryTitle = categories.find(([key]) => key === category)?.[1] || "全部";
  const selectView = (next) => setView(next);
  return <>
    <section className="intro" aria-labelledby="page-title"><img className="home-character-mascot" src="/brand/home-character.png" alt="" width="1536" height="1536" decoding="async" aria-hidden="true" /><div className="intro-number" aria-hidden="true">00 / INDEX</div><div className="intro-copy"><p className="eyebrow"><span>ADULT CONTENT DIRECTORY</span><i></i><span>18+</span></p><div className="title-lockup"><h1 id="page-title"><span>不许涩涩</span><span>机场塔台-允许起飞</span></h1><p>无广告<br />聚合导航</p></div><p className="intro-description">成人内容无广告聚合导航站。简约 UI，快速直达精选内容。</p></div><div className="intro-aside" aria-label="导航统计"><div className="stat-block"><span>ACTIVE NODES</span><strong>{SITE_BLUEPRINTS.length}</strong><i>ONLINE</i></div><div className="stat-block"><span>GAME</span><strong>0</strong><i>ONLINE</i></div></div><div className="hero-scan" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div></section>
    <div className="main-view-tabs" role="tablist" aria-label="主页视图"><button className={`main-view-tab ${view === "directory" ? "is-active" : ""}`} id="directory-tab" type="button" role="tab" aria-selected={view === "directory"} onClick={() => selectView("directory")}><Icon name="radar" />导航目录</button><button className={`main-view-tab ${view === "leaderboard" ? "is-active" : ""}`} id="leaderboard-tab" type="button" role="tab" aria-selected={view === "leaderboard"} onClick={() => selectView("leaderboard")}><Icon name="trophy" />机长排行榜</button><button className={`main-view-tab ${view === "number-ranking" ? "is-active" : ""}`} id="number-ranking-tab" type="button" role="tab" aria-selected={view === "number-ranking"} onClick={() => selectView("number-ranking")}><Icon name="film" />佬友优选</button><a className="main-view-tab main-view-tab-external" href="http://xbwz1494444.bohrium.tech:5000/258bac5f3baad49548be675c1cb35ef886a7" target="_blank" rel="noopener noreferrer"><Icon name="arrow" />起飞绿色通道</a></div>
    <div className="directory-view" role="tabpanel" aria-labelledby="directory-tab" hidden={view !== "directory"}><section className="control-panel" aria-label="搜索和筛选"><label className="search-box" htmlFor="site-search"><Icon name="search" /><span className="sr-only">搜索站点</span><input id="site-search" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="输入站点、内容或域名" autoComplete="off" spellCheck="false" /><span className="shortcut" aria-hidden="true">/</span></label><div className="filter-row"><div className="filters" role="tablist" aria-label="站点分类">{categories.map(([key, label]) => { const count = key === "all" ? SITE_BLUEPRINTS.length : key === "favorite" ? favorites.length : SITE_BLUEPRINTS.filter((site) => site.navCategory === key).length; return <button key={key} className={`filter ${key === "favorite" ? "filter-favorite" : ""} ${key === category ? "is-active" : ""}`} type="button" data-count={String(count).padStart(2, "0")} role="tab" aria-selected={key === category} aria-label={`${label}${key === "all" ? "站点" : "节点"}，${count} 个站点`} onClick={() => setCategory(key)}>{key === "favorite" && <Icon name="star" />}{label}</button>; })}</div><p className="result-count" aria-live="polite"><span>{String(shown.length).padStart(2, "0")}</span> / <span>{SITE_BLUEPRINTS.length}</span> NODES</p></div></section><section className="directory"><div className="section-heading"><div><span>01</span><h2>{query ? `搜索“${query}”` : category === "all" ? "全部站点" : categoryTitle}</h2></div><p><i aria-hidden="true"></i> HOVER TO REVEAL</p></div><div className="delivery-legend" aria-label="媒体线路标注说明"><span className="delivery-badge" data-delivery="direct">直连请求</span><span className="delivery-badge" data-delivery="relay">中转加速</span><small>按主要播放链路标注，线路异常时可能自动切换备用通道</small></div><div className="site-grid">{shown.map((site, index) => <SiteCard key={site.slug} site={site} go={go} favorites={favorites} toggleFavorite={toggleFavorite} position={index} />)}</div>{!shown.length && <div className="empty-directory"><small>NO MATCHED NODE</small><h3>没有找到对应站点</h3><button onClick={() => { setQuery(""); setCategory("all"); }}>清除筛选</button></div>}</section></div>
    <CaptainLeaderboard hidden={view !== "leaderboard"} />
    <NumberRankingPanel hidden={view !== "number-ranking"} />
  </>;
}

function SourcePanel({ health }) {
  return <section id="source-panel" className="source-panel">
    <div><span className={`status-dot ${health}`}></span><small>PROVIDER REGISTRY</small><h2>{Object.keys(PROVIDERS).length} 条独立来源</h2><p>全部绕开 cfnav 会话与接口；路由按内容类型选择专用 adapter。</p></div>
    <dl>{Object.values(PROVIDERS).map((provider) => <div key={provider.id}><dt>{provider.name}</dt><dd>{provider.upstream}</dd><small>{provider.capabilities}</small></div>)}<div><dt>替换方式</dt><dd>修改 provider 注册表，不动页面</dd><small>CFNav 依赖：无</small></div></dl>
  </section>;
}

function SitePage({ site, go, health, setHealth }) {
  const provider = getProviderForSite(site.slug);
  if (provider?.id === "qiying" || provider?.id === "mr" || provider?.id === "hj") return <QiyingPage site={site} go={go} setHealth={setHealth} provider={provider} />;
  if (provider?.id === "jm") return <JmPage site={site} go={go} setHealth={setHealth} />;
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
    <nav className="subnav"><button onClick={() => go("/")}><Logo compact /></button><div className="sub-brand"><strong>{site.name}</strong><small>{site.description}</small></div><span className="status-chip error">SOURCE PENDING</span></nav>
    <section className="sub-hero"><small>{site.category.toUpperCase()} / {site.slug}.local</small><h1>{site.name}</h1><p>{site.description}</p><div className="source-note">参考站真实接口核对中 · 暂不返回替代内容</div></section>
    <section className="content-section"><div className="error-state"><h3>这个入口尚未接入</h3><p>为保证与参考项目的内容和使用效果一致，此处不再使用其他站点的数据作为临时替代。</p><button onClick={() => go("/")}>返回导航</button></div></section>
  </div>;
  return <div className={`site-page accent-${site.accent} mode-${site.mode}`}>
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
    const isHls = /\.m3u8(?:$|\?)/i.test(active.url) || (!/\.(mp4|webm|ogg|m4v|mp3|m4a|aac)(?:$|\?)/i.test(active.url) && Hls.isSupported());
    const appleNative = isHls && /(iphone|ipod|ipad|mac)/i.test(navigator.userAgent) && media.canPlayType("application/vnd.apple.mpegurl");
    if (!isHls || appleNative) {
      media.src = active.url;
      media.play().catch(() => {});
      return () => { media.removeAttribute("src"); media.load(); };
    }
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(active.url); hls.attachMedia(media);
      hls.on(Hls.Events.MANIFEST_PARSED, () => media.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) console.error("hls fatal:", data.type, data.details); });
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

function QiyingPage({ site, go, setHealth, provider }) {
  const api = `/provider-api/${provider?.id || "qiying"}`;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cats, setCats] = useState([]);
  const [selected, setSelected] = useState(null);
  const request = (params) => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ action: "list", ...params });
    return fetch(`${api}?${qs}`).then((response) => response.json().then((body) => ({ ok: response.ok, body }))).then(({ ok, body }) => {
      if (!ok) throw new Error(body?.message || "目录加载失败");
      setPosts(body.items || []);
      setTotalPages(body.totalPages || 1);
      setLoading(false);
      setHealth("ok");
    }).catch((loadError) => {
      setError(loadError.message || "目录加载失败");
      setLoading(false);
      setHealth("error");
    });
  };
  useEffect(() => {
    let cancelled = false;
    fetch(`${api}?action=cats`).then((response) => response.json()).then((body) => { if (!cancelled) setCats(body || []); }).catch(() => {});
    request({ page: 1 });
    return () => { cancelled = true; };
  }, []);
  const tabs = [["", "全部"], ...cats.map((cat) => [cat.slug, cat.name])];
  const openCategory = (key) => {
    setCategory(key);
    setSubmitted("");
    setQuery("");
    setPage(1);
    request(key ? { category: key, page: 1 } : { page: 1 });
  };
  const submit = (event) => {
    event.preventDefault();
    setCategory("");
    setPage(1);
    const keyword = query.trim();
    setSubmitted(keyword);
    request(keyword ? { q: keyword, page: 1 } : { page: 1 });
  };
  const gotoPage = (next) => {
    setPage(next);
    if (submitted) request({ q: submitted, page: next });
    else if (category) request({ category, page: next });
    else request({ page: next });
  };
  const openDetail = (post) => {
    setSelected({ ...post, pid: post.p, detail_loading: true });
    fetch(`${api}?action=detail&id=${encodeURIComponent(post.p)}`).then((response) => response.json().then((body) => ({ ok: response.ok, body }))).then(({ ok, body }) => {
      if (!ok) throw new Error(body?.message || "详情加载失败");
      setSelected((current) => current && current.p === post.p ? { ...current, detail_loading: false, images: body.media_gallery || [], videos: body.videos || [], d: body.vod_content || "", play_url: body.vod_play_url || "" } : current);
    }).catch((detailError) => {
      setSelected((current) => current && current.p === post.p ? { ...current, detail_loading: false, detail_error: detailError.message } : current);
    });
  };
  return <div className={`site-page accent-${site.accent} mode-${site.mode}`}>
    <nav className="subnav"><button onClick={() => go("/")}><Logo compact /></button><div className="sub-brand"><strong>{site.name}</strong><small>{site.description}</small></div><span className="status-chip ok">SOURCE ONLINE</span></nav>
    <section className="sub-hero"><small>{site.category.toUpperCase()} / {site.slug}.local</small><h1>{site.name}</h1><p>{site.description}</p><div className="source-note">实时上游目录 · 主站签名播放 · {provider?.name || "实时上游"}</div></section>
    <form className="content-search" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索 ${site.name} 的图文内容`} /><button>搜索</button>{submitted && <button type="button" className="clear" onClick={() => { setQuery(""); setSubmitted(""); setCategory(""); setPage(1); request({ page: 1 }); }}>清除</button>}</form>
    <div className="qiying-tabs">{tabs.map(([key, label]) => <button key={key} className={category === key ? "is-active" : ""} onClick={() => openCategory(key)}>{label}</button>)}</div>
    <section className="content-section">
      <div className="content-heading"><div><small>{submitted ? "SEARCH RESULT" : category ? "CATEGORY" : "LATEST UPDATE"}</small><h2>{submitted ? `“${submitted}”` : category ? (cats.find((cat) => cat.slug === category)?.name || "分类") : "最新图文"}</h2></div><span>{posts.length} 条</span></div>
      {loading && <div className="loading-grid">{Array.from({ length: 12 }, (_, i) => <i key={i}></i>)}</div>}
      {error && <div className="error-state"><h3>目录加载失败</h3><p>{error}</p><button onClick={() => request({ page: 1 })}>重新加载</button></div>}
      {!loading && !error && <>
        <div className="qiying-grid">{posts.map((post) => <button className="qiying-card" key={post.p} onClick={() => openDetail(post)}>
          <div className="qiying-cover"><img src={post.r} alt="" loading="lazy" referrerPolicy="no-referrer" />{post.hot && <span className="qiying-counts">热搜</span>}</div>
          <div className="qiying-meta"><strong>{post.t || "未命名"}</strong><p>{[post.a, qiyingFormatTime(post.u)].filter(Boolean).join(" · ") || "最新资源"}</p></div>
        </button>)}</div>
        {!posts.length && <div className="error-state"><h3>没有匹配内容</h3><p>换个关键词或分类试试。</p><button onClick={() => { setQuery(""); setSubmitted(""); setCategory(""); setPage(1); request({ page: 1 }); }}>清除筛选</button></div>}
        <div className="pager"><button disabled={page <= 1} onClick={() => gotoPage(page - 1)}>上一页</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => gotoPage(page + 1)}>下一页</button></div>
      </>}
    </section>
    {selected && <QiyingModal post={selected} onClose={() => setSelected(null)} provider={provider} />}
  </div>;
}

function QiyingModal({ post, onClose, provider }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState("");
  const [playLoading, setPlayLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(0);
  const mediaRef = useRef(null);
  const images = post.images || [];
  const videos = post.videos || [];
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
    fetch(`/provider-api/${provider?.id}?action=play&id=${encodeURIComponent(post.p)}&idx=${index}`).then((response) => response.json().then((body) => ({ ok: response.ok, body }))).then(({ ok, body }) => {
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
      {post.detail_loading ? <div className="no-stream">正在加载图文详情…</div> : post.detail_error ? <div className="no-stream">{post.detail_error}</div> : playing && post.play_url ? <video ref={mediaRef} controls playsInline autoPlay poster={images[0] || post.r} referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: "72vh", background: "#000" }} /> : images.length ? <img src={currentImage} alt="" referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: "72vh", objectFit: "contain", background: "#000" }} /> : <div className="no-stream">此帖子没有公开媒体</div>}
      {images.length > 1 && !playing && <div className="qiying-image-nav"><button onClick={() => setImageIndex((x) => (x + images.length - 1) % images.length)}>上一张</button><span>{imageIndex + 1} / {images.length}</span><button onClick={() => setImageIndex((x) => (x + 1) % images.length)}>下一张</button></div>}
      {playError && <div className="qiying-play-error">{playError}</div>}
    </div>
    <div className="detail-copy"><small>{[post.k?.[0], post.a, qiyingFormatTime(post.u)].filter(Boolean).join(" · ") || provider?.name || "每日大赛"}</small><h2>{post.t || "未命名"}</h2><p>{post.d || "暂无简介"}</p>
      {videos.length > 0 && <div className="qiying-video-strip">{videos.map((video, index) => <button key={video.i || index} className={playing && currentVideo === index ? "is-active" : ""} onClick={() => startPlay(index)}>
        {playLoading && currentVideo === index ? "解析中…" : `播放视频${videos.length > 1 ? ` ${index + 1}` : ""}`}
      </button>)}</div>}
      {(post.g || []).length > 0 && <div className="qiying-tags">{(post.g || []).map((tag) => <span key={tag}>{tag}</span>)}</div>}
      <dl><div><dt>编号</dt><dd>{post.p}</dd></div><div><dt>分类</dt><dd>{(post.k || []).join(" / ") || "—"}</dd></div><div><dt>来源</dt><dd>{provider?.name || "实时上游"} + 主站签名</dd></div></dl>
    </div>
  </article></div>;
}

function setPostPlay(post, url) {
  post.play_url = url;
}

const JM_TABS = [
  ["", "全部禁漫"], ["rb", "日本H漫"], ["hg", "韩国H漫"], ["jq", "剧情"], ["xy", "校园"],
  ["aq", "爱情"], ["bl", "BL"], ["qh", "奇幻"], ["tj", "调教"], ["ll", "乱伦"],
  ["dp", "短篇"], ["db", "单本"], ["tr", "同人"],
];
const JM_SCOPES = [["all", "全部"], ["rank", "排行榜"], ["hot", "热门"], ["newest", "最近更新"], ["freshest", "最新上架"]];

function JmPage({ site, go, setHealth }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState("all");
  const [selected, setSelected] = useState(null);
  const request = (params) => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ action: "list", ...params });
    return fetch(`/provider-api/jm?${qs}`).then((response) => response.json().then((body) => ({ ok: response.ok, body }))).then(({ ok, body }) => {
      if (!ok) throw new Error(body?.message || "目录加载失败");
      setItems(body.items || []);
      setTotalPages(body.totalPages || 1);
      setLoading(false);
      setHealth("ok");
    }).catch((loadError) => {
      setError(loadError.message || "目录加载失败");
      setLoading(false);
      setHealth("error");
    });
  };
  useEffect(() => {
    const params = { page: 1 };
    if (submitted) { params.q = submitted; params.category = ""; params.scope = "all"; }
    else if (scope !== "all") params.scope = scope;
    else if (category) params.category = category;
    request(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, scope, category]);
  useEffect(() => { setPage(1); }, [submitted, scope, category]);
  useEffect(() => {
    if (page === 1) return;
    const params = { page };
    if (submitted) { params.q = submitted; params.category = ""; params.scope = "all"; }
    else if (scope !== "all") params.scope = scope;
    else if (category) params.category = category;
    request(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  const submit = (event) => {
    event.preventDefault();
    setScope("all");
    setCategory("");
    setSubmitted(query.trim());
  };
  const openDetail = (comic) => {
    setSelected({ ...comic, detail_loading: true, images: [], chapter_id: "", reader: false });
    fetch(`/provider-api/jm?action=detail&id=${encodeURIComponent(comic.p)}`).then((response) => response.json().then((body) => ({ ok: response.ok, body }))).then(({ ok, body }) => {
      if (!ok) throw new Error(body?.message || "详情加载失败");
      setSelected((current) => current && current.p === comic.p ? { ...current, detail_loading: false, chapters: body.chapters || [], d: body.vod_content || "", author: body.vod_blurb || "", type_name: body.type_name || "漫画" } : current);
    }).catch((detailError) => {
      setSelected((current) => current && current.p === comic.p ? { ...current, detail_loading: false, detail_error: detailError.message } : current);
    });
  };
  const openChapter = (chapterId) => {
    const comic = selected;
    if (!comic) return;
    setSelected((current) => current && current.p === comic.p ? { ...current, reader: true, chapter_id: chapterId, chapter_loading: true, chapter_error: "" } : current);
    fetch(`/provider-api/jm?action=chapter&id=${encodeURIComponent(comic.p)}&chapter=${encodeURIComponent(chapterId)}`).then((response) => response.json().then((body) => ({ ok: response.ok, body }))).then(({ ok, body }) => {
      if (!ok) throw new Error(body?.message || "章节加载失败");
      setSelected((current) => current && current.p === comic.p && current.chapter_id === chapterId ? { ...current, chapter_loading: false, images: body.images || [] } : current);
    }).catch((loadError) => {
      setSelected((current) => current && current.p === comic.p && current.chapter_id === chapterId ? { ...current, chapter_loading: false, chapter_error: loadError.message } : current);
    });
  };
  return <div className={`site-page accent-${site.accent} mode-${site.mode}`}>
    <nav className="subnav"><button onClick={() => go("/")}><Logo compact /></button><div className="sub-brand"><strong>{site.name}</strong><small>{site.description}</small></div><span className="status-chip ok">SOURCE ONLINE</span></nav>
    <section className="sub-hero"><small>{site.category.toUpperCase()} / {site.slug}.local</small><h1>{site.name}</h1><p>{site.description}</p><div className="source-note">实时上游目录 · 禁漫天堂 18mh.net</div></section>
    <form className="content-search" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索 ${site.name} 的漫画`} /><button>搜索</button>{submitted && <button type="button" className="clear" onClick={() => { setQuery(""); setSubmitted(""); }}>清除</button>}</form>
    <div className="qiying-tabs">{JM_SCOPES.map(([key, label]) => <button key={key} className={scope === key && !category && !submitted ? "is-active" : ""} onClick={() => { setScope(key); setCategory(""); setSubmitted(""); }}>{label}</button>)}</div>
    <div className="qiying-tabs">{JM_TABS.map(([key, label]) => <button key={key} className={category === key && scope === "all" && !submitted ? "is-active" : ""} onClick={() => { setCategory(key); setScope("all"); setSubmitted(""); }}>{label}</button>)}</div>
    <section className="content-section">
      <div className="content-heading"><div><small>{submitted ? "SEARCH RESULT" : category ? "CATEGORY" : scope === "all" ? "LATEST UPDATE" : "RANK / HOT"}</small><h2>{submitted ? `“${submitted}”` : category ? (JM_TABS.find(([k]) => k === category)?.[1] || "分类") : (JM_SCOPES.find(([k]) => k === scope)?.[1] || "全部")}</h2></div><span>{items.length} 条</span></div>
      {loading && <div className="loading-grid">{Array.from({ length: 12 }, (_, i) => <i key={i}></i>)}</div>}
      {error && <div className="error-state"><h3>目录加载失败</h3><p>{error}</p><button onClick={() => request({ page: 1, ...(category ? { category } : {}) })}>重新加载</button></div>}
      {!loading && !error && <>
        <div className="qiying-grid">{items.map((comic) => <button className="qiying-card" key={comic.p} onClick={() => openDetail(comic)}>
          <div className="qiying-cover"><img src={comic.r} alt="" loading="lazy" referrerPolicy="no-referrer" />{comic.k?.[0] && <span className="qiying-counts">{comic.k[0]}</span>}</div>
          <div className="qiying-meta"><strong>{comic.t || "未命名"}</strong><p>#{comic.p}</p></div>
        </button>)}</div>
        {!items.length && <div className="error-state"><h3>没有匹配内容</h3><p>换个关键词或分类试试。</p></div>}
        {!submitted && !category && scope === "all" && <div className="pager"><button disabled={page <= 1} onClick={() => setPage((x) => Math.max(1, x - 1))}>上一页</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((x) => x + 1)}>下一页</button></div>}
      </>}
    </section>
    {selected && <JmModal comic={selected} onClose={() => setSelected(null)} onChapter={openChapter} />}
  </div>;
}

function JmModal({ comic, onClose, onChapter }) {
  const images = comic.images || [];
  const chapters = comic.chapters || [];
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className="qiying-modal">
    <button className="modal-close" onClick={onClose}>关闭</button>
    <div className="qiying-player-area">
      {comic.detail_loading ? <div className="no-stream">正在加载漫画详情…</div> : comic.detail_error ? <div className="no-stream">{comic.detail_error}</div> : comic.chapter_loading ? <div className="no-stream">正在加载章节图片…</div> : comic.chapter_error ? <div className="no-stream">{comic.chapter_error}</div> : images.length ? <div className="jm-reader">{images.map((src, index) => <img key={index} src={src} alt={`第 ${index + 1} 页`} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "block" }} />)}</div> : comic.r ? <img src={comic.r} alt="" referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", background: "#000" }} /> : <div className="no-stream">暂无封面</div>}
    </div>
    <div className="detail-copy"><small>{comic.type_name || "COMIC DETAIL"}</small><h2>{comic.t || "未命名"}</h2><p>{comic.d || "暂无简介"}</p>
      {chapters.length > 0 && <div className="jm-chapter-strip">{chapters.map((chapter) => <button key={chapter.id} className={comic.chapter_id === chapter.id ? "is-active" : ""} onClick={() => onChapter(chapter.id)}>{chapter.name}</button>)}</div>}
      <dl><div><dt>编号</dt><dd>#{comic.p}</dd></div><div><dt>来源</dt><dd>禁漫天堂 18mh.net 实时上游</dd></div></dl>
    </div>
  </article></div>;
}

export function App() {
  const [route, go] = useRoute();
  const [health, setHealth] = useState("checking");
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem("cf-decoy") === "1" || ((location.hostname === "127.0.0.1" || location.hostname === "localhost") && new URLSearchParams(location.search).has("qa")));
  const [ageAccepted, setAgeAccepted] = useState(() => localStorage.getItem("cf-age") === "yes" || ((location.hostname === "127.0.0.1" || location.hostname === "localhost") && new URLSearchParams(location.search).has("qa")));
  useEffect(() => {
    Promise.allSettled(Object.keys(PROVIDERS).map((provider) => fetch(`/provider-api/${provider}?pg=1&limit=1&ac=detail`, { signal: AbortSignal.timeout(1500) }).then((r) => r.ok ? r.json() : Promise.reject()))).then((results) => {
      const ready = results.filter((result) => result.status === "fulfilled");
      setHealth(ready.length === results.length ? "ok" : ready.length ? "checking" : "error");
    });
  }, []);
  const site = route.page === "site" ? SITE_BLUEPRINTS.find((s) => s.slug === route.slug) : null;
  const isHome = !site;
  const unlock = () => { localStorage.setItem("cf-decoy", "1"); setUnlocked(true); };
  if (!unlocked) return <DecoyPage onUnlock={unlock} />;
  return <div className={`app ${isHome ? "portal-app" : ""}`}><Header go={go} health={health} isHome={isHome} /><main>{site ? <SitePage site={site} go={go} health={health} setHealth={setHealth} /> : <Home go={go} />}</main><footer><span>不许涩涩机场塔台-允许起飞 / ADULT DIRECTORY</span><span>NO ADS · MINIMAL UI · 2026</span></footer>
    {!ageAccepted && <div className="age-gate"><div><small>ADULT CONTENT / 18+</small><h2>年满 18 岁方可进入</h2><p>这是一个个人、非商业的学习项目。请确认你已达到所在地区的法定年龄。</p><button onClick={() => { localStorage.setItem("cf-age", "yes"); setAgeAccepted(true); }}>我已年满 18 岁</button></div></div>}
  </div>;
}
