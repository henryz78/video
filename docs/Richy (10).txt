// ==UserScript==
// @name         Porn87 去广告 + 悬浮下载
// @namespace    https://porn87.com/
// @version      1.0.0
// @description  去除 porn87.com 全站广告（ExoClick/magsrv/smartpop/弹窗/播放器内嵌广告），保证 HLS 正常播放；视频页悬浮下载（桌面+手机，GM 绕过 CORS）。兼容 Tampermonkey / Violentmonkey / ScriptCat / Via / Userscripts / Stay / 狐猴 等
// @author       Richy
// @match        *://porn87.com/*
// @match        *://*.porn87.com/*
// @match        *://www.porn87.com/*
// @match        http://porn87.com/*
// @match        http://*.porn87.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      porn87.com
// @connect      *.porn87.com
// @connect      cdn-1.porn87.com
// @connect      cdn-2.porn87.com
// @connect      cdn-3.porn87.com
// @connect      cdn-4.porn87.com
// @connect      cdn-5.porn87.com
// @connect      *
// @homepageURL  https://porn87.com/
// @supportURL   https://porn87.com/
// @license      MIT
// ==/UserScript==

/**
 * Porn87 工具 v1.0
 * - 播放器：media-chrome + hls.js，嵌入页 /main/embed?id=
 * - 流地址：cdn-N.porn87.com/media/video_1/{hash}.mp4/index.m3u8（无加密 VOD）
 * - 广告：ExoClick / magsrv / pemsrv / realsrv / smartpop / mayzaent / GTM / 播放器内 #ads-in-video
 * - 手机：Kiwi / Firefox 安卓 / Via / Stay / Userscripts 等；隔离世界自动注入页面上下文
 */
(function bootstrapPorn87() {
  'use strict';

  function main() {
    'use strict';

    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        if (document.documentElement.getAttribute('data-p87-tools') === '1') return;
        document.documentElement.setAttribute('data-p87-tools', '1');
      }
    } catch (_) {}

    const LOG_PREFIX = '[p87-tools]';
    const PANEL_ID = 'p87-dl-panel';
    const STYLE_ID = 'p87-adblock-style';
    const MSG_STREAM = 'P87_TOOLS_STREAM';
    const IS_MOBILE = detectMobile();
    const DL_CONCURRENCY = IS_MOBILE ? 2 : 4;
    const IS_TOP = (() => {
      try {
        return window.top === window;
      } catch (_) {
        return true;
      }
    })();
    const IS_EMBED = /\/main\/embed/i.test(location.pathname);

    function detectMobile() {
      try {
        const ua = navigator.userAgent || '';
        if (
          /Android|iPhone|iPod|iPad|Mobile|webOS|BlackBerry|IEMobile|Opera Mini|HarmonyOS|MicroMessenger|Quark|UCBrowser|HuaweiBrowser|MiuiBrowser|SamsungBrowser|VivoBrowser|OppoBrowser|HeyTapBrowser|Baidu|SogouMobile/i.test(
            ua
          )
        ) {
          return true;
        }
        if (navigator.userAgentData && navigator.userAgentData.mobile) return true;
        if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
        if (typeof window !== 'undefined' && window.matchMedia) {
          if (window.matchMedia('(max-width: 768px)').matches) return true;
          if (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900) return true;
        }
        return false;
      } catch (_) {
        return false;
      }
    }

    /** 广告 / 统计 / 弹窗域名（勿加入视频 CDN） */
    const AD_HOST_RE = new RegExp(
      [
        'doubleclick\\.net',
        'googlesyndication\\.com',
        'googletagmanager\\.com',
        'google-analytics\\.com',
        'googleadservices\\.com',
        'analytics\\.google\\.com',
        'region1\\.google-analytics\\.com',
        'mc\\.yandex\\.(ru|com)',
        'magsrv\\.com',
        'pemsrv\\.com',
        'exoclick\\.com',
        'exdynsrv\\.com',
        'exosrv\\.com',
        'exacdn\\.com',
        'ads\\.exoclick\\.com',
        'syndication\\.exoclick\\.com',
        'a\\.exosrv\\.com',
        'realsrv\\.com',
        'realsrvcdn\\.com',
        'syndication\\.realsrv\\.com',
        'juicyads',
        'trafficjunky',
        'tsyndicate',
        'adsterra',
        'popads',
        'popcash',
        'propellerads',
        'clickadu',
        'onclckbn',
        'monetag',
        'trafficshop',
        'trafficfactory',
        'smartpop',
        'mnaspm\\.com',
        'go\\.mnaspm\\.com',
        'mayzaent\\.com',
        'marzaent\\.com',
        'go\\.mayzaent\\.com',
        'creative\\.mayzaent\\.com',
        'stripchat',
        'stripcash',
        'chaturbate',
        'xhamsterlive',
        'bongacams',
        'livejasmin',
        'mavrtracktor',
        'whitetrafsa',
        'fluxtrck\\.site',
        'trackwilltrk\\.com',
        'endowmentoverhangutmost\\.com',
        'chaseherbalpasty\\.com',
        'addtoany\\.com',
        'static\\.addtoany\\.com',
        'facebook\\.net',
        'connect\\.facebook\\.net',
        'hotjar\\.com',
        'clarity\\.ms',
        'scorecardresearch\\.com',
        'bkcdn\\.net',
      ].join('|'),
      'i'
    );

    /** 视频 / 站点必要资源：绝不能拦 */
    const KEEP_HOST_RE =
      /(^|\.)(porn87\.com|cdnjs\.cloudflare\.com|jsdelivr\.net|unpkg\.com|cloudflare\.com|googleapis\.com|gstatic\.com)$/i;

    const REMOVE_SELECTORS = [
      '.mobile-ads',
      '.ads_desktop',
      '.ads_mobile',
      '.ads_column',
      '.chunk.ads',
      'div.chunk.ads',
      '#ads-in-video',
      '#ads_1',
      '#ads_4',
      '#ads_5',
      'ins.eas6a97888e14',
      'ins[class*="eas6a97888e"]',
      'ins[data-zoneid]',
      'ins[class^="eas"]',
      '.exo-native-widget-header',
      '.exo-native-widget-item',
      '[id^="google_ads"]',
      'iframe[src*="magsrv"]',
      'iframe[src*="pemsrv"]',
      'iframe[src*="exoclick"]',
      'iframe[src*="exdynsrv"]',
      'iframe[src*="exosrv"]',
      'iframe[src*="realsrv"]',
      'iframe[src*="smartpop"]',
      'iframe[src*="mnaspm"]',
      'iframe[src*="mayzaent"]',
      'iframe[src*="googlesyndication"]',
      'iframe[src*="doubleclick"]',
      'script[src*="magsrv"]',
      'script[src*="pemsrv"]',
      'script[src*="exoclick"]',
      'script[src*="exosrv"]',
      'script[src*="exdynsrv"]',
      'script[src*="realsrv"]',
      'script[src*="ad-provider"]',
      'script[src*="popunder"]',
      'script[src*="video-slider"]',
      'script[src*="splash.php"]',
      'script[src*="googletagmanager"]',
      'script[src*="google-analytics"]',
      'script[src*="gtag/js"]',
      'script[src*="addtoany"]',
      'script[src*="endowmentoverhangutmost"]',
      'script[src*="chaseherbalpasty"]',
      'a[href*="magsrv.com"]',
      'a[href*="pemsrv.com"]',
      'a[href*="exoclick.com"]',
      'a[href*="exdynsrv.com"]',
      'a[href*="exosrv.com"]',
      'a[href*="realsrv.com"]',
      'a[href*="mayzaent.com"]',
      'a[href*="mnaspm.com"]',
      'a[href*="smartpop"]',
      'a[href*="fluxtrck.site"]',
      'a[href*="trackwilltrk.com"]',
      'a[real-href*="magsrv"]',
      'a[real-href*="pemsrv"]',
      '#phone_instant',
      '.pc_instant',
      'a#phone_instant_link',
    ];

    const HIDE_CSS = `
      ${REMOVE_SELECTORS.join(',\n')},
      iframe[src*="magsrv"], iframe[src*="pemsrv"], iframe[src*="exoclick"],
      iframe[src*="exosrv"], iframe[src*="realsrv"], iframe[src*="smartpop"],
      iframe[src*="mnaspm"], iframe[src*="mayzaent"],
      ins[data-zoneid], ins[class^="eas"],
      .mobile-ads, .ads_desktop, .ads_mobile, .ads_column, .chunk.ads,
      #ads-in-video, #phone_instant, .pc_instant,
      a[href*="goodav17.com"], a[href*="fluxtrck.site"], a[href*="trackwilltrk.com"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        max-height: 0 !important;
        max-width: 0 !important;
        overflow: hidden !important;
        position: fixed !important;
        left: -99999px !important;
        top: -99999px !important;
        z-index: -1 !important;
        border: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      /* 侧栏广告列：只藏广告块，不碰主内容 */
      .columns.ads_column {
        display: none !important;
      }
      body > iframe:not([src*="porn87"]):not([id]) {
        /* 不强制全藏，避免误伤；由 isAdUrl 处理 */
      }
    `;

    const state = {
      m3u8: '',
      title: '',
      poster: '',
      videoId: '',
      downloading: false,
      abort: null,
    };

    const log = (...args) => {
      try {
        console.debug(LOG_PREFIX, ...args);
      } catch (_) {}
    };

    function getUrl(input) {
      try {
        if (!input) return '';
        if (typeof input === 'string') return input;
        if (typeof input.url === 'string') return input.url;
        if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
        return String(input);
      } catch (_) {
        return '';
      }
    }

    function hostOf(url) {
      try {
        return new URL(url, location.href).hostname;
      } catch (_) {
        return '';
      }
    }

    function isSameSite(url) {
      try {
        const h = hostOf(url);
        return h === location.hostname || /(^|\.)porn87\.com$/i.test(h);
      } catch (_) {
        return false;
      }
    }

    function isKeepUrl(url) {
      if (!url) return true;
      try {
        const u = new URL(url, location.href);
        if (KEEP_HOST_RE.test(u.hostname)) return true;
        if (isSameSite(u.href)) return true;
        // 本站视频 CDN / 静态 / 播放器
        if (/cdn-\d+\.porn87\.com$/i.test(u.hostname)) {
          // preroll / instant 是广告素材，不当 keep
          if (/\/media\/(preroll|instant)\//i.test(u.pathname)) return false;
          return true;
        }
        if (/hls\.js|media-chrome|jquery|foundation|cloudflare|jsdelivr/i.test(u.href)) return true;
        if (/\/(static|main|member)\//i.test(u.pathname) && isSameSite(u.href)) return true;
      } catch (_) {}
      return false;
    }

    function isAdUrl(url) {
      if (!url || typeof url !== 'string') return false;
      if (isKeepUrl(url)) return false;
      try {
        const u = new URL(url, location.href);
        if (AD_HOST_RE.test(u.hostname) || AD_HOST_RE.test(u.href)) return true;
        if (/\/(ads?|banner|popunder|popup|sponsor|smartpop|ad-provider)\b/i.test(u.pathname)) return true;
        if (/monetag|adsbygoogle|pagead|popunder|idzone=/i.test(u.href)) return true;
        if (/\/media\/(preroll|instant)\//i.test(u.pathname) && /porn87\.com$/i.test(u.hostname)) return true;
        if (/\.bkcdn\.net$/i.test(u.hostname)) return true;
      } catch (_) {
        return AD_HOST_RE.test(url);
      }
      return false;
    }

    function isM3u8Url(url) {
      return typeof url === 'string' && /\.m3u8(\?|$|\/)/i.test(url);
    }

    function isContentM3u8(url) {
      if (!isM3u8Url(url)) return false;
      try {
        const u = new URL(url, location.href);
        if (/\/media\/(preroll|instant)\//i.test(u.pathname)) return false;
        if (!/(^|\.)porn87\.com$/i.test(u.hostname) && !/cdn-\d+\.porn87\.com$/i.test(u.hostname)) {
          // 仅接受本站 CDN
          return false;
        }
        return /\/media\/video_/i.test(u.pathname) || /index\.m3u8/i.test(u.pathname);
      } catch (_) {
        return false;
      }
    }

    function captureStream(url, extra) {
      if (!url || !isContentM3u8(url)) return;
      try {
        const abs = new URL(url, location.href).href;
        if (state.m3u8 === abs) {
          if (extra) {
            if (extra.title) state.title = extra.title;
            if (extra.poster) state.poster = extra.poster;
            if (extra.videoId) state.videoId = String(extra.videoId);
          }
          return;
        }
        state.m3u8 = abs;
        if (extra && extra.title) state.title = extra.title;
        if (extra && extra.poster) state.poster = extra.poster;
        if (extra && extra.videoId) state.videoId = String(extra.videoId);
        log('capture m3u8', abs.slice(0, 140));
        updatePanelInfo();
        // 嵌入页通知顶层
        if (IS_EMBED && !IS_TOP) {
          try {
            window.parent.postMessage(
              {
                source: MSG_STREAM,
                m3u8: abs,
                title: state.title || readPageTitle(),
                videoId: state.videoId || readVideoId(),
                poster: state.poster || '',
              },
              '*'
            );
          } catch (_) {}
        }
      } catch (_) {}
    }

    function fakeEmptyResponse() {
      try {
        return new Response('', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      } catch (_) {
        return null;
      }
    }

    // ---------- 1. 拦截 script/iframe/img 广告资源 ----------
    function patchElementSetters() {
      const rawSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function (name, value) {
        try {
          if (
            typeof name === 'string' &&
            typeof value === 'string' &&
            /^(src|href|data-src|real-href)$/i.test(name) &&
            isAdUrl(value)
          ) {
            return;
          }
        } catch (_) {}
        return rawSetAttribute.apply(this, arguments);
      };

      for (const Tag of [HTMLScriptElement, HTMLIFrameElement, HTMLImageElement]) {
        if (!Tag || !Tag.prototype) continue;
        try {
          const desc = Object.getOwnPropertyDescriptor(Tag.prototype, 'src');
          if (!desc || !desc.set) continue;
          Object.defineProperty(Tag.prototype, 'src', {
            configurable: true,
            enumerable: desc.enumerable,
            get: desc.get,
            set(v) {
              if (isAdUrl(String(v))) return;
              return desc.set.call(this, v);
            },
          });
        } catch (_) {}
      }

      try {
        const aDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'href');
        if (aDesc && aDesc.set) {
          Object.defineProperty(HTMLAnchorElement.prototype, 'href', {
            configurable: true,
            enumerable: aDesc.enumerable,
            get: aDesc.get,
            set(v) {
              if (isAdUrl(String(v))) return;
              return aDesc.set.call(this, v);
            },
          });
        }
      } catch (_) {}
    }

    // ---------- 2. fetch / XHR：拦广告 + 抓 m3u8 ----------
    function patchNetwork() {
      if (typeof window.fetch === 'function') {
        const rawFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
          try {
            const url = getUrl(input);
            if (isContentM3u8(url)) captureStream(url);
            if (isAdUrl(url)) {
              const fake = fakeEmptyResponse();
              if (fake) return Promise.resolve(fake);
            }
          } catch (_) {}
          return rawFetch(input, init);
        };
      }

      const XO = XMLHttpRequest.prototype.open;
      const XS = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        try {
          const u = String(url || '');
          this.__p87Block = isAdUrl(u);
          if (isContentM3u8(u)) captureStream(u);
        } catch (_) {
          this.__p87Block = false;
        }
        return XO.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        if (this.__p87Block) {
          const self = this;
          setTimeout(() => {
            try {
              Object.defineProperty(self, 'readyState', { configurable: true, get: () => 4 });
              Object.defineProperty(self, 'status', { configurable: true, get: () => 200 });
              Object.defineProperty(self, 'responseText', { configurable: true, get: () => '' });
              Object.defineProperty(self, 'response', { configurable: true, get: () => '' });
              if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
              if (typeof self.onload === 'function') self.onload();
            } catch (_) {}
          }, 0);
          return;
        }
        return XS.apply(this, arguments);
      };
    }

    // ---------- 3. 弹窗 / 点击跳转 ----------
    function patchWindowOpen() {
      const rawOpen = window.open;
      window.open = function (url) {
        try {
          if (url != null && url !== '' && isAdUrl(String(url))) return null;
        } catch (_) {}
        return rawOpen.apply(this, arguments);
      };

      const blockAdClick = (e) => {
        try {
          const a = e.target && e.target.closest && e.target.closest('a[href], a[real-href]');
          if (!a) return;
          const href = a.href || a.getAttribute('href') || a.getAttribute('real-href') || '';
          if (isAdUrl(href)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
        } catch (_) {}
      };
      ['click', 'auxclick', 'mousedown', 'pointerdown'].forEach((type) => {
        document.addEventListener(type, blockAdClick, true);
      });
    }

    function hardenPrivacy() {
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push = function () {
          return 0;
        };
        window.gtag = function () {};
        window.ga = function () {};
      } catch (_) {}

      try {
        const ap = [];
        ap.push = function () {
          return 0;
        };
        window.AdProvider = ap;
      } catch (_) {}

      try {
        // ExoClick popunder 变量：提高频率计数，尽量让它认为已达上限
        if (typeof window.ad_frequency_count === 'undefined') {
          // 不主动创建，避免触发其它逻辑
        }
      } catch (_) {}

      try {
        const rawBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
        if (rawBeacon) {
          navigator.sendBeacon = function (url, data) {
            try {
              if (isAdUrl(String(url || ''))) return true;
            } catch (_) {}
            return rawBeacon(url, data);
          };
        }
      } catch (_) {}

      try {
        document.cookie.split(';').forEach((c) => {
          const name = (c.split('=')[0] || '').trim();
          if (!name) return;
          if (/popmagic|pu_|idzone|exo|venor|^_ga|^_gid|^_gat|^__utm/i.test(name)) {
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            document.cookie =
              name +
              '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.' +
              location.hostname.replace(/^www\./, '');
          }
        });
      } catch (_) {}
    }

    // 钩 hls.js loadSource，保证抓到流
    function hookHls() {
      try {
        let current = window.Hls;
        const wrap = (HlsCtor) => {
          if (!HlsCtor || HlsCtor.__p87Hooked) return HlsCtor;
          function WrappedHls() {
            const inst = new (Function.prototype.bind.apply(
              HlsCtor,
              [null].concat([].slice.call(arguments))
            ))();
            try {
              const rawLoad = inst.loadSource && inst.loadSource.bind(inst);
              if (rawLoad) {
                inst.loadSource = function (src) {
                  try {
                    if (src) captureStream(String(src), { title: readPageTitle(), videoId: readVideoId() });
                  } catch (_) {}
                  return rawLoad(src);
                };
              }
            } catch (_) {}
            return inst;
          }
          try {
            Object.keys(HlsCtor).forEach((k) => {
              try {
                WrappedHls[k] = HlsCtor[k];
              } catch (_) {}
            });
          } catch (_) {}
          try {
            WrappedHls.prototype = HlsCtor.prototype;
            WrappedHls.isSupported = HlsCtor.isSupported
              ? HlsCtor.isSupported.bind(HlsCtor)
              : undefined;
            WrappedHls.version = HlsCtor.version;
            WrappedHls.DefaultConfig = HlsCtor.DefaultConfig;
            WrappedHls.Events = HlsCtor.Events;
            WrappedHls.__p87Hooked = true;
          } catch (_) {}
          return WrappedHls;
        };

        if (typeof current === 'function') {
          window.Hls = wrap(current);
        }
        try {
          Object.defineProperty(window, 'Hls', {
            configurable: true,
            enumerable: true,
            get() {
              return current;
            },
            set(v) {
              current = typeof v === 'function' ? wrap(v) : v;
            },
          });
        } catch (_) {
          if (typeof current === 'function') window.Hls = wrap(current);
        }
      } catch (e) {
        log('hook Hls failed', e);
      }
    }

    // ---------- 4. DOM 清理 ----------
    function injectCSS() {
      try {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
          style = document.createElement('style');
          style.id = STYLE_ID;
          (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = HIDE_CSS + panelCSS();
      } catch (_) {}
    }

    function isProtectedNode(el) {
      if (!el || el.nodeType !== 1) return true;
      try {
        if (el.id === STYLE_ID || el.id === PANEL_ID) return true;
        if (el.closest && el.closest('#' + PANEL_ID)) return true;
        if (el.id === 'my-video') return true;
        if (el.tagName === 'MEDIA-CONTROLLER' || el.tagName === 'VIDEO') return true;
        if (el.closest && el.closest('media-controller, #my-video, .video_frame, #' + PANEL_ID)) {
          // 播放器内部：仅允许删明确广告
          return !(
            el.id === 'ads-in-video' ||
            (el.tagName === 'IFRAME' && isAdUrl(el.src || '')) ||
            (el.tagName === 'A' && isAdUrl(el.href || '')) ||
            (el.tagName === 'SCRIPT' && isAdUrl(el.src || ''))
          );
        }
        if (el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'HEAD' || el.tagName === 'MAIN') {
          return true;
        }
        // 嵌入播放器 iframe 本身要保留
        if (el.tagName === 'IFRAME') {
          const src = el.src || el.getAttribute('src') || '';
          if (/\/main\/embed/i.test(src) || (isSameSite(src) && !isAdUrl(src))) return true;
        }
        if (el.tagName === 'SCRIPT') {
          const src = el.src || el.getAttribute('src') || '';
          if (!src) return true;
          if (/hls\.js|media-chrome|jquery|foundation|cloudflare|jsdelivr/i.test(src)) return true;
          if (isSameSite(src) && !isAdUrl(src)) return true;
        }
        // 主布局
        if (el.classList) {
          if (
            el.classList.contains('video_frame') ||
            el.classList.contains('video_chunk') ||
            el.classList.contains('video_info') ||
            el.classList.contains('video_title') ||
            el.classList.contains('top-bar') ||
            el.classList.contains('title-bar')
          ) {
            return true;
          }
        }
      } catch (_) {}
      return false;
    }

    function removeNode(el) {
      if (!el || isProtectedNode(el)) return false;
      try {
        el.remove();
        return true;
      } catch (_) {
        try {
          if (el.parentNode) el.parentNode.removeChild(el);
          return true;
        } catch (__) {
          return false;
        }
      }
    }

    function isAdNode(el) {
      if (!el || el.nodeType !== 1) return false;
      if (isProtectedNode(el)) return false;
      const tag = el.tagName;
      const id = el.id || '';
      const cls = typeof el.className === 'string' ? el.className : String(el.className || '');

      if (id === 'ads-in-video' || id === 'phone_instant') return true;
      if (/\b(mobile-ads|ads_desktop|ads_mobile|ads_column|chunk\s+ads|\bads\b)\b/i.test(cls) && !/video_/i.test(cls)) {
        // chunk ads / ads_column
        if (/\bads\b/i.test(cls) || /ads_/i.test(cls) || /mobile-ads/i.test(cls)) return true;
      }

      if (tag === 'SCRIPT') {
        const src = el.src || el.getAttribute('src') || '';
        if (!src) return false;
        return isAdUrl(src);
      }
      if (tag === 'IFRAME' || tag === 'IMG') {
        return isAdUrl(el.src || el.getAttribute('src') || el.getAttribute('data-src') || '');
      }
      if (tag === 'A') {
        return isAdUrl(el.href || el.getAttribute('href') || el.getAttribute('real-href') || '');
      }
      if (tag === 'INS' && (el.getAttribute('data-zoneid') || /^eas/i.test(cls))) return true;

      try {
        if (tag === 'DIV' && el.querySelector) {
          if (el.id === 'ads-in-video') return true;
          // 几乎只有广告 iframe 的 chunk
          if (
            el.classList &&
            (el.classList.contains('ads') ||
              el.classList.contains('ads_column') ||
              el.classList.contains('mobile-ads') ||
              el.classList.contains('ads_desktop') ||
              el.classList.contains('ads_mobile'))
          ) {
            return true;
          }
          const onlyAdIframe =
            el.querySelector(
              'iframe[src*="magsrv"], iframe[src*="pemsrv"], iframe[src*="exoclick"], iframe[src*="realsrv"], iframe[src*="smartpop"], iframe[src*="mayzaent"]'
            ) &&
            !el.querySelector('media-controller, #my-video, .video_frame, .video_thumbnail, .video_info');
          if (onlyAdIframe && el.children.length <= 3) return true;
        }
      } catch (_) {}
      return false;
    }

    function sweep() {
      injectCSS();
      try {
        // 播放器内广告
        const adsInVideo = document.getElementById('ads-in-video');
        if (adsInVideo) removeNode(adsInVideo);

        REMOVE_SELECTORS.forEach((sel) => {
          try {
            document.querySelectorAll(sel).forEach((el) => removeNode(el));
          } catch (_) {}
        });

        document.querySelectorAll('script[src], iframe[src], a[href], a[real-href]').forEach((el) => {
          const url = el.src || el.href || el.getAttribute('real-href') || '';
          if (isAdUrl(url)) removeNode(el);
        });

        document.querySelectorAll('ins[data-zoneid], ins[class^="eas"]').forEach((el) => removeNode(el));

        // body 直挂广告层
        document.querySelectorAll('body > div, body > iframe').forEach((el) => {
          if (!el || el.id === PANEL_ID) return;
          if (isAdNode(el)) removeNode(el);
        });
      } catch (e) {
        log('sweep error', e);
      }
    }

    function observe() {
      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            m.addedNodes.forEach((n) => {
              if (n.nodeType !== 1) return;
              if (isAdNode(n)) {
                removeNode(n);
                return;
              }
              if (n.querySelectorAll) {
                n.querySelectorAll(
                  'iframe[src], script[src], ins[data-zoneid], #ads-in-video, .mobile-ads, .ads_column, .chunk.ads, a[real-href]'
                ).forEach((el) => {
                  if (isAdNode(el) || isAdUrl(el.src || el.href || el.getAttribute('real-href') || '')) {
                    removeNode(el);
                  }
                });
              }
            });
          } else if (m.type === 'attributes') {
            const el = m.target;
            if (!el) continue;
            if (m.attributeName === 'src' || m.attributeName === 'href' || m.attributeName === 'real-href') {
              const url = el.src || el.href || el.getAttribute('real-href') || '';
              if (isAdUrl(url)) removeNode(el);
              if (isContentM3u8(url)) captureStream(url);
            }
          }
        }
      });
      mo.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'href', 'data-src', 'real-href'],
      });
    }

    // ---------- 5. 页面信息 ----------
    function readPageTitle() {
      try {
        if (IS_EMBED) {
          return (document.title || '')
            .replace(/\s*Porn87\s*Player\s*$/i, '')
            .replace(/\s*[-|_].*Porn87.*$/i, '')
            .trim()
            .slice(0, 120);
        }
        const h =
          document.querySelector('.video_title, .row.video_title, h1, .columns.video_title') ||
          document.querySelector('title');
        if (h && h.textContent) {
          return h.textContent
            .trim()
            .replace(/\s*[-|_].*Porn87.*$/i, '')
            .trim()
            .slice(0, 120);
        }
        return (document.title || 'porn87')
          .replace(/\s*[-|_].*Porn87.*$/i, '')
          .trim()
          .slice(0, 120);
      } catch (_) {
        return 'porn87';
      }
    }

    function readVideoId() {
      try {
        const q = new URLSearchParams(location.search).get('id');
        if (q) return q;
        const m = location.href.match(/[?&]id=(\d+)/i);
        if (m) return m[1];
        const iframe = document.querySelector('iframe[src*="/main/embed"]');
        if (iframe) {
          const m2 = (iframe.src || '').match(/[?&]id=(\d+)/i);
          if (m2) return m2[1];
        }
      } catch (_) {}
      return '';
    }

    function readPoster() {
      try {
        const poster = document.querySelector('media-poster-image[src], media-poster-image');
        if (poster) {
          const s = poster.getAttribute('src') || poster.src || '';
          if (s) return s;
        }
        const img = document.querySelector('.video_frame img, .video_chunk img');
        if (img && img.src) return img.src;
      } catch (_) {}
      return '';
    }

    function isDetailPage() {
      try {
        if (IS_EMBED) return true;
        if (/\/main\/html/i.test(location.pathname) && /[?&]id=\d+/i.test(location.search + location.href)) {
          return true;
        }
        if (document.querySelector('iframe[src*="/main/embed"], .video_frame, media-controller, #my-video')) {
          return true;
        }
        return false;
      } catch (_) {
        return false;
      }
    }

    /** 从封面图推导 m3u8：image_1/{hash}_N.jpg → video_1/{hash}.mp4/index.m3u8 */
    function m3u8FromPoster(posterUrl) {
      try {
        const u = new URL(posterUrl, location.href);
        const m = u.pathname.match(/\/media\/image_1\/([a-z0-9]+)_\d+\.(?:jpg|jpeg|png|webp)$/i);
        if (!m) return '';
        const hash = m[1];
        const host = u.hostname;
        return u.protocol + '//' + host + '/media/video_1/' + hash + '.mp4/index.m3u8';
      } catch (_) {
        return '';
      }
    }

    function probeFromPage() {
      try {
        state.title = readPageTitle() || state.title;
        state.videoId = readVideoId() || state.videoId;
        state.poster = readPoster() || state.poster;

        // 嵌入页：内联 videoSrc
        document.querySelectorAll('script:not([src])').forEach((s) => {
          const t = s.textContent || '';
          const m =
            t.match(/videoSrc\s*=\s*["'](https?:[^"']+\.m3u8[^"']*)["']/i) ||
            t.match(/["'](https?:\/\/cdn-\d+\.porn87\.com\/media\/video_[^"']+\.m3u8[^"']*)["']/i);
          if (m) captureStream(m[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&'));
        });

        // poster 推导
        if (state.poster) {
          const derived = m3u8FromPoster(state.poster);
          if (derived) captureStream(derived);
        }
        document.querySelectorAll('media-poster-image[src], img[src*="/media/image_1/"]').forEach((el) => {
          const src = el.getAttribute('src') || el.src || '';
          const derived = m3u8FromPoster(src);
          if (derived) captureStream(derived, { poster: src });
        });

        // 同域 iframe 读取
        if (IS_TOP) {
          document.querySelectorAll('iframe[src*="/main/embed"]').forEach((frame) => {
            try {
              const doc = frame.contentDocument || frame.contentWindow?.document;
              if (!doc) return;
              doc.querySelectorAll('script:not([src])').forEach((s) => {
                const t = s.textContent || '';
                const m = t.match(/videoSrc\s*=\s*["'](https?:[^"']+\.m3u8[^"']*)["']/i);
                if (m) captureStream(m[1]);
              });
              const poster = doc.querySelector('media-poster-image[src]');
              if (poster) {
                const src = poster.getAttribute('src') || '';
                const derived = m3u8FromPoster(src);
                if (derived) captureStream(derived, { poster: src });
              }
              // 顺带清 iframe 内广告
              try {
                const ads = doc.getElementById('ads-in-video');
                if (ads) ads.remove();
                doc
                  .querySelectorAll(
                    'iframe[src*="magsrv"], iframe[src*="pemsrv"], script[src*="pemsrv"], script[src*="popunder"], script[src*="magsrv"]'
                  )
                  .forEach((n) => {
                    try {
                      n.remove();
                    } catch (_) {}
                  });
              } catch (_) {}
            } catch (_) {}
          });
        }

        // performance 资源
        try {
          performance.getEntriesByType('resource').forEach((r) => {
            if (r && r.name && isContentM3u8(r.name)) captureStream(r.name);
          });
        } catch (_) {}

        // HTML 全文兜底
        try {
          const html = document.documentElement && document.documentElement.innerHTML;
          if (html) {
            const re = /https?:\/\/cdn-\d+\.porn87\.com\/media\/video_[^"'\\\s<>]+\.m3u8[^"'\\\s<>]*/gi;
            let mm;
            while ((mm = re.exec(html))) {
              captureStream(mm[0].replace(/&amp;/g, '&'));
            }
          }
        } catch (_) {}
      } catch (e) {
        log('probe failed', e);
      }
      updatePanelInfo();
    }

    // 顶层接收嵌入页流地址
    function listenEmbedStream() {
      if (!IS_TOP) return;
      window.addEventListener('message', (ev) => {
        try {
          const d = ev.data;
          if (!d || d.source !== MSG_STREAM) return;
          if (d.m3u8) {
            captureStream(d.m3u8, {
              title: d.title,
              videoId: d.videoId,
              poster: d.poster,
            });
          }
        } catch (_) {}
      });
    }

    // ---------- 6. HLS 下载（无加密） ----------
    function sanitizeFilename(name) {
      return (
        String(name || 'porn87')
          .replace(/[\\/:*?"<>|]+/g, '_')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, IS_MOBILE ? 80 : 120) || 'porn87'
      );
    }

    function formatBytes(n) {
      if (!n || n < 0) return '0 B';
      const u = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      let v = n;
      while (v >= 1024 && i < u.length - 1) {
        v /= 1024;
        i += 1;
      }
      return v.toFixed(i ? 1 : 0) + ' ' + u[i];
    }

    function parseM3u8(text, baseUrl) {
      const lines = String(text || '').split(/\r?\n/);
      const segs = [];
      let mediaSequence = 0;
      let expectUri = false;
      const m = String(text).match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/i);
      if (m) mediaSequence = parseInt(m[1], 10) || 0;
      let sn = mediaSequence;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('#')) {
          if (/^#EXTINF:/i.test(line)) expectUri = true;
          continue;
        }
        if (expectUri || !line.startsWith('#')) {
          let href = line;
          try {
            href = new URL(line, baseUrl).href;
          } catch (_) {}
          segs.push({ url: href, sn });
          sn += 1;
          expectUri = false;
        }
      }
      return { segs, mediaSequence };
    }

    function gmBridgeFetch(url, signal) {
      return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
          reject(new DOMException('已取消', 'AbortError'));
          return;
        }
        const id = 'p87_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        let done = false;
        const cleanup = () => {
          try {
            window.removeEventListener('message', onMsg);
          } catch (_) {}
          if (signal) {
            try {
              signal.removeEventListener('abort', onAbort);
            } catch (_) {}
          }
        };
        const onAbort = () => {
          if (done) return;
          done = true;
          cleanup();
          try {
            window.postMessage({ source: 'p87-page', cmd: 'fetch-abort', id }, '*');
          } catch (_) {}
          reject(new DOMException('已取消', 'AbortError'));
        };
        const onMsg = (ev) => {
          try {
            const d = ev.data;
            if (!d || d.source !== 'p87-content' || d.id !== id) return;
            if (done) return;
            done = true;
            cleanup();
            if (!d.ok) {
              reject(new Error(d.err || 'GM 下载失败'));
              return;
            }
            resolve(d.buf);
          } catch (e) {
            if (!done) {
              done = true;
              cleanup();
              reject(e);
            }
          }
        };
        window.addEventListener('message', onMsg);
        if (signal) signal.addEventListener('abort', onAbort);
        try {
          window.postMessage(
            {
              source: 'p87-page',
              cmd: 'fetch',
              id,
              url: String(url),
              referer: location.href,
              origin: location.origin,
            },
            '*'
          );
        } catch (e) {
          done = true;
          cleanup();
          reject(e);
        }
        setTimeout(() => {
          if (done) return;
          done = true;
          cleanup();
          reject(new Error('GM 下载超时 ' + String(url).slice(0, 60)));
        }, 60000);
      });
    }

    async function fetchBuf(url, signal) {
      try {
        let res;
        try {
          res = await fetch(url, {
            credentials: 'include',
            mode: 'cors',
            signal,
            referrer: location.href,
          });
        } catch (_) {
          res = await fetch(url, {
            credentials: 'omit',
            mode: 'cors',
            signal,
            referrer: location.href,
          });
        }
        if (res && res.ok) return res.arrayBuffer();
        if (res && !res.ok) throw new Error('HTTP ' + res.status);
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
      }
      try {
        if (typeof window.__p87GmReady === 'boolean' && window.__p87GmReady === false) {
          throw new Error('无 GM 通道');
        }
        return await gmBridgeFetch(url, signal);
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        throw new Error(
          '下载失败（CORS/网络）：' +
            (e && e.message ? e.message : String(e)) +
            '。可改用「复制流」到外部下载器'
        );
      }
    }

    async function downloadHls(m3u8Url, { onProgress, signal } = {}) {
      const listText = await (async () => {
        const buf = await fetchBuf(m3u8Url, signal);
        return new TextDecoder().decode(buf);
      })();
      if (!/#EXTM3U/i.test(listText)) throw new Error('不是有效的 m3u8');

      // 多码率 master
      if (/#EXT-X-STREAM-INF/i.test(listText)) {
        const lines = listText.split(/\r?\n/).map((l) => l.trim());
        let best = null;
        let lastBw = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^#EXT-X-STREAM-INF/i.test(line)) {
            const bm = line.match(/BANDWIDTH=(\d+)/i);
            const bw = bm ? parseInt(bm[1], 10) : 0;
            const next = lines[i + 1];
            if (next && !next.startsWith('#') && bw >= lastBw) {
              lastBw = bw;
              try {
                best = new URL(next, m3u8Url).href;
              } catch (_) {
                best = next;
              }
            }
          }
        }
        if (!best) throw new Error('主播放列表中未找到子流');
        return downloadHls(best, { onProgress, signal });
      }

      const { segs } = parseM3u8(listText, m3u8Url);
      if (!segs.length) throw new Error('播放列表无分片');

      const total = segs.length;
      const parts = new Array(total);
      let done = 0;
      let bytes = 0;
      let idx = 0;
      let failed = null;

      async function worker() {
        while (idx < total) {
          if (signal && signal.aborted) throw new DOMException('已取消', 'AbortError');
          if (failed) throw failed;
          const i = idx++;
          const seg = segs[i];
          let attempt = 0;
          while (attempt < 3) {
            try {
              const buf = await fetchBuf(seg.url, signal);
              parts[i] = buf;
              bytes += buf.byteLength;
              done += 1;
              if (onProgress) onProgress({ done, total, bytes, index: i });
              break;
            } catch (e) {
              if (e && e.name === 'AbortError') throw e;
              attempt += 1;
              if (attempt >= 3) {
                failed = new Error('分片失败 #' + i + ': ' + (e && e.message));
                throw failed;
              }
              await new Promise((r) => setTimeout(r, 400 * attempt));
            }
          }
        }
      }

      const workers = [];
      const n = Math.min(DL_CONCURRENCY, total || 1);
      for (let i = 0; i < n; i++) workers.push(worker());
      await Promise.all(workers);
      return new Blob(parts, { type: 'video/mp2t' });
    }

    async function triggerBlobDownload(blob, filename) {
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        a.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.documentElement.appendChild(a);
        a.click();
        setTimeout(() => {
          try {
            a.remove();
          } catch (_) {}
        }, 2000);
      } catch (e) {
        log('a.download failed', e);
      }

      if (IS_MOBILE) {
        try {
          const file = new File([blob], filename, { type: blob.type || 'video/mp2t' });
          if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
            await navigator.share({ files: [file], title: filename, text: filename });
            setTimeout(() => {
              try {
                URL.revokeObjectURL(url);
              } catch (_) {}
            }, 60000);
            return 'share';
          }
        } catch (e) {
          if (e && e.name === 'AbortError') {
            setTimeout(() => {
              try {
                URL.revokeObjectURL(url);
              } catch (_) {}
            }, 60000);
            return 'share-cancel';
          }
          log('share failed', e);
        }
        try {
          const opened = window.open(url, '_blank');
          if (!opened) setStatus('请允许弹窗，或改用「复制流」到下载器', 'wait');
        } catch (_) {}
      }

      setTimeout(
        () => {
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
        },
        IS_MOBILE ? 120000 : 15000
      );
      return 'download';
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_) {}
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText =
          'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;margin:0;border:0;opacity:0;';
        document.body.appendChild(ta);
        ta.focus();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (_) {
        return false;
      }
    }

    // ---------- 7. 悬浮面板 UI ----------
    const ICONS = {
      logo: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" stroke-width="1.6"/><path d="M10 9.2v5.6l5-2.8-5-2.8Z" fill="currentColor"/></svg>',
      download:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      copy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M6 15V6.8A1.8 1.8 0 0 1 7.8 5H15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
      open: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5h5v5M10 14 19 5M18 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      link: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l1.76-1.76a5 5 0 0 0-7.07-7.07L10 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.07 0L5.17 12.76a5 5 0 1 0 7.07 7.07L14 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
      refresh:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.2-5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 5v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      minus:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      plus: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      stop: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/></svg>',
    };

    function panelCSS() {
      return `
      #${PANEL_ID} {
        --p-bg: rgba(12, 14, 20, 0.94);
        --p-bg-2: rgba(22, 28, 40, 0.9);
        --p-line: rgba(255, 255, 255, 0.08);
        --p-line-strong: rgba(251, 113, 133, 0.28);
        --p-text: #eef3fb;
        --p-muted: #9aa8bd;
        --p-faint: #6b778a;
        --p-accent: #f43f5e;
        --p-accent-2: #fb7185;
        --p-ok: #34d399;
        --p-warn: #fbbf24;
        --p-err: #f87171;
        --p-shadow: 0 18px 50px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.04);
        position: fixed;
        right: 18px;
        bottom: 92px;
        z-index: 2147483646;
        width: 348px;
        max-width: calc(100vw - 20px);
        color: var(--p-text);
        font-family: "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        font-size: 13px;
        line-height: 1.45;
        border-radius: 18px;
        background:
          radial-gradient(120% 90% at 0% 0%, rgba(244, 63, 94, 0.22), transparent 55%),
          radial-gradient(90% 70% at 100% 0%, rgba(251, 113, 133, 0.12), transparent 50%),
          linear-gradient(165deg, var(--p-bg-2), var(--p-bg) 42%, #0a0d14 100%);
        border: 1px solid var(--p-line-strong);
        box-shadow: var(--p-shadow);
        backdrop-filter: blur(18px) saturate(1.2);
        -webkit-backdrop-filter: blur(18px) saturate(1.2);
        overflow: hidden;
        isolation: isolate;
        animation: p87-in 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
        transition: width 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease, bottom 0.2s ease;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        max-height: calc(100dvh - 24px);
      }
      #${PANEL_ID}.is-mobile {
        right: max(10px, env(safe-area-inset-right, 0px));
        bottom: calc(12px + env(safe-area-inset-bottom, 0px) + 52px);
        width: min(380px, calc(100vw - 20px));
        font-size: 14px;
      }
      #${PANEL_ID}.is-mobile.p87-sheet {
        left: max(10px, env(safe-area-inset-left, 0px));
        right: max(10px, env(safe-area-inset-right, 0px));
        width: auto;
        bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        border-radius: 18px 18px 14px 14px;
        max-height: min(78dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 16px));
        display: flex;
        flex-direction: column;
      }
      #${PANEL_ID}.is-mobile.p87-sheet .p87-bd {
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        flex: 1;
        min-height: 0;
      }
      #${PANEL_ID} > * { position: relative; z-index: 1; }
      @keyframes p87-in {
        from { opacity: 0; transform: translateY(14px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes p87-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.55; transform: scale(0.92); }
      }
      @keyframes p87-spin { to { transform: rotate(360deg); } }
      @keyframes p87-shimmer {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }
      #${PANEL_ID}.p87-collapsed {
        width: auto;
        min-width: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, #1a1014 0%, #0c121c 100%);
        max-height: none;
        left: auto !important;
      }
      #${PANEL_ID}.p87-collapsed.is-mobile {
        bottom: calc(16px + env(safe-area-inset-bottom, 0px) + 48px);
        right: max(12px, env(safe-area-inset-right, 0px));
        box-shadow: 0 10px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(244,63,94,0.35);
      }
      #${PANEL_ID}.p87-collapsed .p87-bd,
      #${PANEL_ID}.p87-collapsed .p87-hd-meta,
      #${PANEL_ID}.p87-collapsed .p87-hd-actions [data-act="refresh"] {
        display: none !important;
      }
      #${PANEL_ID}.p87-collapsed .p87-hd {
        padding: 10px 12px 10px 14px;
        gap: 10px;
        background: transparent;
        border: 0;
      }
      #${PANEL_ID}.p87-collapsed .p87-brand-text { display: none; }
      #${PANEL_ID}.is-dragging {
        box-shadow: 0 28px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(244,63,94,0.28);
        cursor: grabbing;
      }
      #${PANEL_ID} .p87-hd {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 14px 12px;
        cursor: grab;
        user-select: none;
        border-bottom: 1px solid var(--p-line);
        background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent);
      }
      #${PANEL_ID} .p87-hd:active { cursor: grabbing; }
      #${PANEL_ID} .p87-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;
      }
      #${PANEL_ID} .p87-logo {
        width: 34px;
        height: 34px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        color: #fff;
        background: linear-gradient(145deg, var(--p-accent), #be123c 55%, var(--p-accent-2));
        box-shadow: 0 8px 18px rgba(244, 63, 94, 0.35), inset 0 1px 0 rgba(255,255,255,0.25);
        flex-shrink: 0;
      }
      #${PANEL_ID} .p87-logo svg { width: 18px; height: 18px; }
      #${PANEL_ID} .p87-brand-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      #${PANEL_ID} .p87-brand-text strong {
        font-size: 13.5px;
        font-weight: 700;
        color: #fff;
      }
      #${PANEL_ID} .p87-brand-text span {
        font-size: 11px;
        color: var(--p-muted);
      }
      #${PANEL_ID} .p87-hd-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      #${PANEL_ID} .p87-icon-btn {
        width: 30px;
        height: 30px;
        min-width: 30px;
        min-height: 30px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        background: rgba(255,255,255,0.04);
        color: #e8eef8;
        display: inline-grid;
        place-items: center;
        cursor: pointer;
        padding: 0;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      }
      #${PANEL_ID}.is-mobile .p87-icon-btn {
        width: 42px;
        height: 42px;
        min-width: 42px;
        min-height: 42px;
        border-radius: 12px;
      }
      #${PANEL_ID} .p87-icon-btn svg { width: 15px; height: 15px; }
      #${PANEL_ID}.is-mobile .p87-icon-btn svg { width: 18px; height: 18px; }
      #${PANEL_ID} .p87-icon-btn:hover {
        background: rgba(255,255,255,0.1);
        border-color: rgba(255,255,255,0.16);
      }
      #${PANEL_ID} .p87-icon-btn:active { transform: scale(0.94); }
      #${PANEL_ID} .p87-icon-btn.is-spinning svg { animation: p87-spin 0.7s linear; }
      #${PANEL_ID} .p87-bd {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      #${PANEL_ID} .p87-status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #${PANEL_ID} .p87-badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 4px 10px 4px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        color: var(--p-muted);
      }
      #${PANEL_ID} .p87-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--p-faint);
        box-shadow: 0 0 0 3px rgba(255,255,255,0.04);
      }
      #${PANEL_ID}[data-state="ready"] .p87-dot { background: var(--p-ok); box-shadow: 0 0 0 3px rgba(52,211,153,0.15); }
      #${PANEL_ID}[data-state="wait"] .p87-dot { background: var(--p-warn); animation: p87-pulse 1.4s ease infinite; }
      #${PANEL_ID}[data-state="busy"] .p87-dot { background: var(--p-accent); animation: p87-pulse 1s ease infinite; }
      #${PANEL_ID}[data-state="ok"] .p87-dot { background: var(--p-ok); }
      #${PANEL_ID}[data-state="err"] .p87-dot { background: var(--p-err); }
      #${PANEL_ID}[data-state="ready"] .p87-badge { color: #c9f7e2; border-color: rgba(52,211,153,0.22); background: rgba(52,211,153,0.08); }
      #${PANEL_ID}[data-state="wait"] .p87-badge { color: #ffe7a3; border-color: rgba(251,191,36,0.22); background: rgba(251,191,36,0.08); }
      #${PANEL_ID}[data-state="busy"] .p87-badge { color: #fecdd3; border-color: rgba(244,63,94,0.25); background: rgba(244,63,94,0.1); }
      #${PANEL_ID}[data-state="ok"] .p87-badge { color: #c9f7e2; border-color: rgba(52,211,153,0.22); background: rgba(52,211,153,0.08); }
      #${PANEL_ID}[data-state="err"] .p87-badge { color: #ffc9c9; border-color: rgba(248,113,113,0.25); background: rgba(248,113,113,0.1); }
      #${PANEL_ID} .p87-vid {
        font-size: 11px;
        color: var(--p-faint);
        font-variant-numeric: tabular-nums;
      }
      #${PANEL_ID} .p87-title {
        margin: 0;
        font-size: 14px;
        font-weight: 650;
        color: #fff;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.4;
        min-height: 1.4em;
      }
      #${PANEL_ID} .p87-stream {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 9px 10px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255,255,255,0.06);
      }
      #${PANEL_ID} .p87-stream-tag {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #fda4af;
        background: rgba(244, 63, 94, 0.14);
        border: 1px solid rgba(244, 63, 94, 0.22);
        border-radius: 7px;
        padding: 3px 7px;
        white-space: nowrap;
      }
      #${PANEL_ID} .p87-url {
        font-size: 11px;
        color: var(--p-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: ui-monospace, "SF Mono", Consolas, "Courier New", monospace;
      }
      #${PANEL_ID} .p87-stream .p87-icon-btn {
        width: 28px;
        height: 28px;
        border-radius: 8px;
      }
      #${PANEL_ID} .p87-actions {
        display: grid;
        grid-template-columns: 1.35fr 1fr 1fr;
        gap: 8px;
      }
      #${PANEL_ID} .p87-btn {
        appearance: none;
        -webkit-appearance: none;
        border: 0;
        border-radius: 12px;
        padding: 10px 8px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 650;
        color: #fff;
        transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        min-height: 40px;
      }
      #${PANEL_ID}.is-mobile .p87-btn {
        min-height: 48px;
        font-size: 14px;
        border-radius: 14px;
        padding: 12px 10px;
      }
      #${PANEL_ID} .p87-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
      #${PANEL_ID} .p87-btn:hover { filter: brightness(1.08); }
      #${PANEL_ID} .p87-btn:active { transform: translateY(1px) scale(0.98); }
      #${PANEL_ID} .p87-btn:disabled {
        opacity: 0.42;
        cursor: not-allowed;
        filter: grayscale(0.25);
        transform: none;
        box-shadow: none;
      }
      #${PANEL_ID} .p87-btn-primary {
        background: linear-gradient(135deg, #fb7185 0%, #e11d48 48%, #f43f5e 160%);
        box-shadow: 0 10px 22px rgba(225, 29, 72, 0.32), inset 0 1px 0 rgba(255,255,255,0.22);
      }
      #${PANEL_ID} .p87-btn-ghost {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        color: #e8eef8;
      }
      #${PANEL_ID} .p87-btn-ghost:hover {
        background: rgba(255,255,255,0.09);
        border-color: rgba(255,255,255,0.14);
      }
      #${PANEL_ID} .p87-btn-stop {
        width: 100%;
        background: linear-gradient(135deg, #3a1a1a, #5c1d1d);
        border: 1px solid rgba(248, 113, 113, 0.28);
        color: #ffd4d4;
        display: none;
      }
      #${PANEL_ID}.is-busy .p87-btn-stop { display: inline-flex; }
      #${PANEL_ID}.is-busy .p87-actions { display: none; }
      #${PANEL_ID} .p87-progress-wrap { display: grid; gap: 7px; }
      #${PANEL_ID} .p87-progress-meta {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        font-size: 11px;
        color: var(--p-muted);
      }
      #${PANEL_ID} .p87-pct {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: #fecdd3;
      }
      #${PANEL_ID} .p87-prog {
        height: 8px;
        border-radius: 99px;
        background: rgba(255,255,255,0.06);
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.04);
      }
      #${PANEL_ID} .p87-prog > i {
        display: block;
        height: 100%;
        width: 0%;
        border-radius: inherit;
        background: linear-gradient(90deg, #fb7185, #f43f5e, #fb7185);
        background-size: 200% 100%;
        box-shadow: 0 0 12px rgba(244, 63, 94, 0.45);
        transition: width 0.18s linear;
      }
      #${PANEL_ID}.is-busy .p87-prog > i { animation: p87-shimmer 1.2s linear infinite; }
      #${PANEL_ID} .p87-status {
        font-size: 12px;
        color: var(--p-muted);
        min-height: 1.35em;
        word-break: break-word;
      }
      #${PANEL_ID}[data-state="ok"] .p87-status { color: #b8f5d8; }
      #${PANEL_ID}[data-state="err"] .p87-status { color: #ffb4b4; }
      #${PANEL_ID}[data-state="busy"] .p87-status { color: #fecdd3; }
      #${PANEL_ID} .p87-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-top: 2px;
        border-top: 1px solid rgba(255,255,255,0.05);
      }
      #${PANEL_ID} .p87-tip {
        font-size: 11px;
        color: var(--p-faint);
        line-height: 1.35;
      }
      #${PANEL_ID} .p87-link-btn {
        border: 0;
        background: transparent;
        color: #fda4af;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        padding: 4px 0;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      #${PANEL_ID} .p87-link-btn svg { width: 12px; height: 12px; }
      #${PANEL_ID} .p87-link-btn:hover { color: #fecdd3; text-decoration: underline; }
      #${PANEL_ID} .p87-link-btn:disabled,
      #${PANEL_ID} .p87-icon-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        pointer-events: none;
      }
      @media (max-width: 480px), (pointer: coarse) {
        #${PANEL_ID}:not(.p87-collapsed) {
          left: max(10px, env(safe-area-inset-left, 0px));
          right: max(10px, env(safe-area-inset-right, 0px));
          width: auto;
          bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          border-radius: 18px 18px 14px 14px;
        }
        #${PANEL_ID} .p87-actions { grid-template-columns: 1fr; }
        #${PANEL_ID} .p87-btn { min-height: 48px; font-size: 14px; }
        #${PANEL_ID} .p87-hd { padding: 12px 12px 10px; min-height: 56px; }
        #${PANEL_ID} .p87-stream { grid-template-columns: auto 1fr 42px; padding: 10px; }
        #${PANEL_ID} .p87-foot { flex-wrap: wrap; gap: 6px; }
        #${PANEL_ID} .p87-tip { font-size: 12px; flex: 1 1 100%; }
        #${PANEL_ID} .p87-link-btn { min-height: 40px; padding: 8px 4px; font-size: 13px; }
      }
      @media (prefers-reduced-motion: reduce) {
        #${PANEL_ID},
        #${PANEL_ID} .p87-prog > i,
        #${PANEL_ID} .p87-dot,
        #${PANEL_ID} .p87-icon-btn.is-spinning svg {
          animation: none !important;
          transition: none !important;
        }
      }
      /* 嵌入页播放器全屏时面板仍可见 */
      #${PANEL_ID}.is-embed {
        bottom: 12px;
        right: 12px;
        width: min(320px, calc(100vw - 16px));
      }
    `;
    }

    function ensurePanel() {
      // 顶层详情页 或 单独打开的嵌入页 显示面板；嵌在 iframe 里的嵌入页不显示（避免双面板）
      if (!isDetailPage()) return null;
      if (IS_EMBED && !IS_TOP) return null;
      if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);
      if (!document.body) return null;

      const box = document.createElement('div');
      box.id = PANEL_ID;
      box.dataset.state = 'wait';
      if (IS_MOBILE) box.classList.add('is-mobile', 'p87-sheet', 'p87-collapsed');
      if (IS_EMBED) box.classList.add('is-embed');
      const sub = IS_MOBILE ? '点此展开 · 手机版' : '去广告 · HLS 直下';
      const tip = IS_MOBILE
        ? '手机可下载/分享 .ts；不行就复制 m3u8 到下载器'
        : '浏览器合并 TS 分片，PotPlayer / VLC 可直接播';
      box.innerHTML = `
      <div class="p87-hd" data-drag="1">
        <div class="p87-brand">
          <div class="p87-logo">${ICONS.logo}</div>
          <div class="p87-brand-text">
            <strong>Porn87 下载</strong>
            <span>${sub}</span>
          </div>
        </div>
        <div class="p87-hd-actions">
          <button type="button" class="p87-icon-btn" data-act="refresh" title="重新探测流地址" aria-label="刷新">${ICONS.refresh}</button>
          <button type="button" class="p87-icon-btn" data-act="collapse" title="${IS_MOBILE ? '展开面板' : '折叠/展开'}" aria-label="折叠">${IS_MOBILE ? ICONS.plus : ICONS.minus}</button>
        </div>
      </div>
      <div class="p87-bd">
        <div class="p87-status-row">
          <div class="p87-badge"><i class="p87-dot" data-el="dot"></i><span data-el="badge">探测中</span></div>
          <div class="p87-vid" data-el="vid"></div>
        </div>
        <h3 class="p87-title" data-el="title">等待视频页…</h3>
        <div class="p87-stream">
          <span class="p87-stream-tag">M3U8</span>
          <div class="p87-url" data-el="url" title="">尚未捕获到流地址</div>
          <button type="button" class="p87-icon-btn" data-act="copy" title="复制 m3u8" aria-label="复制流地址">${ICONS.copy}</button>
        </div>
        <div class="p87-actions">
          <button type="button" class="p87-btn p87-btn-primary" data-act="download">${ICONS.download}<span>${IS_MOBILE ? '下载 / 分享' : '下载 TS'}</span></button>
          <button type="button" class="p87-btn p87-btn-ghost" data-act="open">${ICONS.open}<span>打开</span></button>
          <button type="button" class="p87-btn p87-btn-ghost" data-act="copy-page">${ICONS.link}<span>页面</span></button>
        </div>
        <button type="button" class="p87-btn p87-btn-stop" data-act="stop" data-el="stop-btn">${ICONS.stop}<span>停止下载</span></button>
        <div class="p87-progress-wrap">
          <div class="p87-progress-meta">
            <span data-el="status">就绪</span>
            <span class="p87-pct" data-el="pct">0%</span>
          </div>
          <div class="p87-prog"><i data-el="bar"></i></div>
        </div>
        <div class="p87-foot">
          <div class="p87-tip">${tip}</div>
          <button type="button" class="p87-link-btn" data-act="copy" title="复制完整 m3u8">${ICONS.copy}<span>复制流</span></button>
        </div>
      </div>`;
      document.body.appendChild(box);
      bindPanel(box);
      makeDraggable(box, box.querySelector('[data-drag]'));
      updatePanelInfo();
      return box;
    }

    function qs(root, sel) {
      return root.querySelector(sel);
    }

    function setPanelState(mode) {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) return;
      const map = {
        wait: '探测中',
        ready: '可下载',
        busy: '下载中',
        ok: '已完成',
        err: '出错',
        idle: '待命',
      };
      const key = mode || (state.m3u8 ? 'ready' : isDetailPage() ? 'wait' : 'idle');
      panel.dataset.state = key === 'idle' ? 'wait' : key;
      panel.classList.toggle('is-busy', key === 'busy');
      const badge = qs(panel, '[data-el="badge"]');
      if (badge) badge.textContent = map[key] || map.wait;
    }

    function setStatus(text, mode) {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) return;
      const el = qs(panel, '[data-el="status"]');
      if (el) el.textContent = text || '';
      if (mode) setPanelState(mode);
    }

    function setProgress(pct) {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) return;
      const val = Math.max(0, Math.min(100, pct || 0));
      const bar = qs(panel, '[data-el="bar"]');
      const label = qs(panel, '[data-el="pct"]');
      if (bar) bar.style.width = val + '%';
      if (label) label.textContent = Math.round(val) + '%';
    }

    function shortUrl(url) {
      if (!url) return '';
      try {
        const u = new URL(url);
        const path = u.pathname.split('/').filter(Boolean).slice(-2).join('/') || u.pathname;
        return u.hostname.replace(/^www\./, '') + '/' + path + (u.search ? '…' : '');
      } catch (_) {
        return String(url).slice(0, 64);
      }
    }

    function updatePanelInfo() {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) return;
      if (!state.title) state.title = readPageTitle();
      if (!state.videoId) state.videoId = readVideoId();
      const t = qs(panel, '[data-el="title"]');
      const u = qs(panel, '[data-el="url"]');
      const vid = qs(panel, '[data-el="vid"]');
      const titleText = state.title || (isDetailPage() ? '视频详情页' : '请先打开视频详情页');
      if (t) {
        t.textContent = titleText;
        t.title = titleText;
      }
      if (u) {
        if (state.m3u8) {
          u.textContent = shortUrl(state.m3u8);
          u.title = state.m3u8;
        } else {
          u.textContent = isDetailPage() ? '等待播放器加载流地址…' : '进入详情页后自动捕获';
          u.title = '';
        }
      }
      if (vid) vid.textContent = state.videoId ? '#' + state.videoId : '';
      const dl = qs(panel, '[data-act="download"]');
      if (dl) dl.disabled = !state.m3u8 || state.downloading;
      panel.querySelectorAll('[data-act="copy"], [data-act="open"]').forEach((btn) => {
        btn.disabled = !state.m3u8 || state.downloading;
      });
      if (!state.downloading) {
        setPanelState(state.m3u8 ? 'ready' : isDetailPage() ? 'wait' : 'idle');
      }
    }

    function bindPanel(panel) {
      panel.addEventListener('click', (e) => {
        if (!panel.classList.contains('p87-collapsed')) return;
        if (panel.dataset.p87Dragged === '1') return;
        if (e.target && e.target.closest && e.target.closest('[data-act="collapse"]')) return;
        if (e.target && e.target.closest && e.target.closest('[data-act="refresh"]')) return;
        const btn = panel.querySelector('[data-act="collapse"]');
        if (btn) btn.click();
      });

      panel.addEventListener('click', async (e) => {
        const btn = e.target && e.target.closest && e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        if (panel.dataset.p87Dragged === '1') return;
        e.preventDefault();
        e.stopPropagation();
        const act = btn.getAttribute('data-act');
        if (act === 'collapse') {
          const collapsed = panel.classList.toggle('p87-collapsed');
          if (IS_MOBILE) {
            panel.classList.toggle('p87-sheet', !collapsed);
            if (!collapsed) {
              panel.style.left = '';
              panel.style.right = '';
              panel.style.top = '';
              panel.style.bottom = '';
            }
          }
          btn.innerHTML = collapsed ? ICONS.plus : ICONS.minus;
          btn.title = collapsed ? '展开面板' : '折叠面板';
          btn.setAttribute('aria-label', collapsed ? '展开' : '折叠');
          return;
        }
        if (act === 'refresh') {
          btn.classList.add('is-spinning');
          setTimeout(() => btn.classList.remove('is-spinning'), 700);
          probeFromPage();
          updatePanelInfo();
          setStatus(state.m3u8 ? '已刷新流地址' : '仍未捕获到流，试着点一下播放', state.m3u8 ? 'ready' : 'wait');
          return;
        }
        if (act === 'copy') {
          if (!state.m3u8) return setStatus('没有可复制的 m3u8', 'err');
          const ok = await copyText(state.m3u8);
          setStatus(ok ? 'm3u8 已复制到剪贴板' : '复制失败，请手动选择', ok ? 'ok' : 'err');
          return;
        }
        if (act === 'copy-page') {
          const ok = await copyText(location.href);
          setStatus(ok ? '页面链接已复制' : '复制失败', ok ? 'ok' : 'err');
          return;
        }
        if (act === 'open') {
          if (!state.m3u8) return setStatus('没有 m3u8', 'err');
          window.open(state.m3u8, '_blank', 'noopener');
          setStatus('已在新标签打开 m3u8', 'ok');
          return;
        }
        if (act === 'stop') {
          if (state.abort) state.abort.abort();
          setStatus('已请求停止', 'wait');
          return;
        }
        if (act === 'download') startDownload();
      });
    }

    function makeDraggable(box, handle) {
      if (!handle) return;
      let ox = 0;
      let oy = 0;
      let sx = 0;
      let sy = 0;
      let dragging = false;
      let moved = false;
      let pid = null;

      const onDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target && e.target.closest && e.target.closest('button, a, input')) return;
        if (IS_MOBILE && !box.classList.contains('p87-collapsed') && box.classList.contains('p87-sheet')) return;
        dragging = true;
        moved = false;
        pid = e.pointerId;
        try {
          handle.setPointerCapture(pid);
        } catch (_) {}
        box.classList.add('is-dragging');
        const rect = box.getBoundingClientRect();
        ox = rect.left;
        oy = rect.top;
        sx = e.clientX;
        sy = e.clientY;
        box.style.left = ox + 'px';
        box.style.top = oy + 'px';
        box.style.right = 'auto';
        box.style.bottom = 'auto';
        if (e.cancelable) e.preventDefault();
      };

      const onMove = (e) => {
        if (!dragging) return;
        if (pid != null && e.pointerId !== pid) return;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        const margin = IS_MOBILE ? 8 : 0;
        const maxX = Math.max(margin, window.innerWidth - box.offsetWidth - margin);
        const maxY = Math.max(margin, window.innerHeight - Math.min(box.offsetHeight, 56) - margin);
        box.style.left = Math.min(maxX, Math.max(margin, ox + dx)) + 'px';
        box.style.top = Math.min(maxY, Math.max(margin, oy + dy)) + 'px';
        if (e.cancelable) e.preventDefault();
      };

      const onUp = (e) => {
        if (!dragging) return;
        if (pid != null && e.pointerId !== pid) return;
        dragging = false;
        box.classList.remove('is-dragging');
        try {
          if (pid != null) handle.releasePointerCapture(pid);
        } catch (_) {}
        pid = null;
        if (moved) {
          box.dataset.p87Dragged = '1';
          setTimeout(() => {
            try {
              delete box.dataset.p87Dragged;
            } catch (_) {}
          }, 350);
        }
      };

      handle.style.touchAction = 'none';
      handle.addEventListener('pointerdown', onDown, { passive: false });
      handle.addEventListener('pointermove', onMove, { passive: false });
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    }

    async function startDownload() {
      probeFromPage();
      if (!state.m3u8) {
        setStatus('尚未捕获 m3u8，请先播放视频', 'err');
        return;
      }
      if (state.downloading) return;
      state.downloading = true;
      state.abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
      updatePanelInfo();
      setPanelState('busy');
      setProgress(0);
      setStatus(IS_MOBILE ? '手机下载中，请保持页面打开…' : '开始下载…', 'busy');
      try {
        const blob = await downloadHls(state.m3u8, {
          signal: state.abort ? state.abort.signal : undefined,
          onProgress: ({ done, total, bytes }) => {
            const pct = total ? (done / total) * 100 : 0;
            setProgress(pct);
            setStatus(`下载中 ${done}/${total} · ${formatBytes(bytes)}`, 'busy');
          },
        });
        const name = sanitizeFilename(state.title || state.videoId || 'porn87') + '.ts';
        const mode = await triggerBlobDownload(blob, name);
        setProgress(100);
        if (mode === 'share') {
          setStatus('已调起系统分享（' + formatBytes(blob.size) + '）', 'ok');
        } else if (mode === 'share-cancel') {
          setStatus('已取消分享，文件仍可通过下载入口获取', 'wait');
        } else {
          setStatus(
            IS_MOBILE
              ? '完成 ' + name + '（' + formatBytes(blob.size) + '）。若未保存请看新标签页长按文件'
              : '完成 ' + name + '（' + formatBytes(blob.size) + '）',
            'ok'
          );
        }
      } catch (e) {
        if (e && e.name === 'AbortError') setStatus('已取消下载', 'wait');
        else {
          setStatus('失败：' + (e && e.message ? e.message : String(e)), 'err');
          if (IS_MOBILE && state.m3u8) {
            setTimeout(() => setStatus('可改用「复制流」到 nPlayer / Documents 下载', 'wait'), 2500);
          }
        }
        log('download failed', e);
      } finally {
        state.downloading = false;
        state.abort = null;
        updatePanelInfo();
      }
    }

    // ---------- 8. 启动 ----------
    function onReady(fn) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
      } else {
        fn();
      }
    }

    try {
      hardenPrivacy();
      patchElementSetters();
      patchNetwork();
      patchWindowOpen();
      hookHls();
    } catch (e) {
      log('early patch failed', e);
    }

    injectCSS();
    listenEmbedStream();
    if (document.documentElement) observe();
    else document.addEventListener('DOMContentLoaded', observe, { once: true });

    onReady(() => {
      injectCSS();
      sweep();
      ensurePanel();
      probeFromPage();
      let ticks = 0;
      const timer = setInterval(() => {
        sweep();
        probeFromPage();
        if (isDetailPage()) ensurePanel();
        ticks += 1;
        if (ticks > 80) clearInterval(timer);
      }, 500);
    });

    window.addEventListener('load', () => {
      sweep();
      ensurePanel();
      probeFromPage();
      setTimeout(sweep, 1000);
      setTimeout(sweep, 3000);
      setTimeout(() => {
        sweep();
        probeFromPage();
        updatePanelInfo();
      }, 6000);
    });

    // 延迟再钩一次 Hls（CDN 脚本后加载）
    (function rehookHls() {
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        try {
          if (typeof window.Hls === 'function' && !window.Hls.__p87Hooked) {
            hookHls();
          }
          if (typeof window.Hls === 'function' && window.Hls.__p87Hooked) clearInterval(timer);
        } catch (_) {}
        if (tries > 60) clearInterval(timer);
      }, 200);
    })();

    try {
      window.__p87Tools = {
        version: '1.0.0',
        mobile: IS_MOBILE,
        embed: IS_EMBED,
        sweep,
        probeFromPage,
        getState: () => Object.assign({}, state, { mobile: IS_MOBILE }),
        captureStream,
      };
    } catch (_) {}
  } // end main()

  // ---------- GM 下载桥（content 世界） ----------
  function getGmXhr() {
    try {
      if (typeof GM_xmlhttpRequest === 'function') return GM_xmlhttpRequest;
    } catch (_) {}
    try {
      if (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') return GM.xmlHttpRequest;
    } catch (_) {}
    return null;
  }

  function gmFetchBinary(url, referer, origin) {
    const gmXhr = getGmXhr();
    if (!gmXhr) return Promise.reject(new Error('当前脚本管理器不支持 GM_xmlhttpRequest'));
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, v) => {
        if (settled) return;
        settled = true;
        fn(v);
      };
      try {
        gmXhr({
          method: 'GET',
          url: String(url),
          responseType: 'arraybuffer',
          headers: {
            Referer: referer || location.href,
            Origin: origin || location.origin,
            Accept: '*/*',
          },
          onload(res) {
            try {
              const status = res.status || 0;
              if (status >= 200 && status < 300 && res.response) {
                finish(resolve, res.response);
              } else {
                finish(reject, new Error('HTTP ' + status + ' ' + String(url).slice(0, 80)));
              }
            } catch (e) {
              finish(reject, e);
            }
          },
          onerror() {
            finish(reject, new Error('网络错误 ' + String(url).slice(0, 80)));
          },
          ontimeout() {
            finish(reject, new Error('超时 ' + String(url).slice(0, 80)));
          },
          onabort() {
            finish(reject, new DOMException('已取消', 'AbortError'));
          },
          timeout: 60000,
        });
      } catch (e) {
        finish(reject, e);
      }
    });
  }

  function installGmBridge() {
    const gmXhr = getGmXhr();
    const hasGm = !!gmXhr;
    try {
      window.addEventListener('message', (ev) => {
        try {
          const d = ev.data;
          if (!d || d.source !== 'p87-page') return;
          if (d.cmd === 'fetch') {
            if (!hasGm) {
              window.postMessage(
                {
                  source: 'p87-content',
                  id: d.id,
                  ok: false,
                  err: '无 GM_xmlhttpRequest，请用 Tampermonkey/Violentmonkey 安装',
                },
                '*'
              );
              return;
            }
            gmFetchBinary(d.url, d.referer, d.origin)
              .then((buf) => {
                window.postMessage({ source: 'p87-content', id: d.id, ok: true, buf }, '*');
              })
              .catch((e) => {
                window.postMessage(
                  {
                    source: 'p87-content',
                    id: d.id,
                    ok: false,
                    err: e && e.message ? e.message : String(e),
                  },
                  '*'
                );
              });
          }
        } catch (_) {}
      });
    } catch (_) {}

    try {
      const root = document.documentElement || document.head || document.body;
      if (root) {
        const s = document.createElement('script');
        s.textContent = 'window.__p87GmReady=' + (hasGm ? 'true' : 'false') + ';';
        root.appendChild(s);
        s.remove();
      }
    } catch (_) {}
    return hasGm;
  }

  function injectIntoPage(fn) {
    try {
      const root = document.documentElement || document.head || document.body;
      if (!root) return false;
      const s = document.createElement('script');
      s.id = 'p87-tools-bridge';
      s.textContent = '(' + fn.toString() + ')();';
      root.appendChild(s);
      s.remove();
      return true;
    } catch (e) {
      try {
        console.debug('[p87-tools] inject failed', e);
      } catch (_) {}
      return false;
    }
  }

  function isIsolatedWorld() {
    try {
      if (typeof exportFunction === 'function') return true;
      if (typeof cloneInto === 'function') return true;
      if (typeof wrappedJSObject !== 'undefined' && wrappedJSObject && wrappedJSObject !== window) {
        return true;
      }
      if (typeof GM_xmlhttpRequest === 'function' || (typeof GM !== 'undefined' && GM && GM.xmlHttpRequest)) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function boot() {
    installGmBridge();
    try {
      if (document.documentElement && document.documentElement.getAttribute('data-p87-tools') === '1') {
        return;
      }
    } catch (_) {}

    // 有 GM / 隔离世界：注入 page 才能钩住播放器与广告
    let injected = false;
    if (isIsolatedWorld()) {
      injected = injectIntoPage(main);
    }
    if (!injected) {
      try {
        main();
      } catch (e) {
        try {
          console.error('[p87-tools] main failed', e);
        } catch (_) {}
        // 再尝试注入
        injectIntoPage(main);
      }
    }

    // content 侧轻量 CSS 双保险
    try {
      const STYLE_ID = 'p87-adblock-style-content';
      const css = `
        .mobile-ads, .ads_desktop, .ads_mobile, .ads_column, .chunk.ads,
        #ads-in-video, #phone_instant, .pc_instant,
        iframe[src*="magsrv"], iframe[src*="pemsrv"], iframe[src*="exoclick"],
        iframe[src*="exosrv"], iframe[src*="realsrv"], iframe[src*="smartpop"],
        iframe[src*="mnaspm"], iframe[src*="mayzaent"],
        ins[data-zoneid], ins[class^="eas"],
        a[href*="magsrv.com"], a[href*="mayzaent.com"], a[href*="fluxtrck.site"] {
          display: none !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          position: fixed !important;
          left: -99999px !important;
        }
      `;
      const apply = () => {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
          style = document.createElement('style');
          style.id = STYLE_ID;
          (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = css;
      };
      apply();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once: true });
      }
    } catch (_) {}
  }

  if (document.documentElement) boot();
  else {
    const t = setInterval(() => {
      if (document.documentElement) {
        clearInterval(t);
        boot();
      }
    }, 10);
    setTimeout(() => clearInterval(t), 5000);
  }
})();
