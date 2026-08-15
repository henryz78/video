# CFNav Independent 项目总台账

> 最后更新：2026-08-14
>
> 本文件是换代理、换 AI 助手、对话压缩或重新接手时的第一入口。开始工作前先读本文件，再对照 `providers/catalog.js`、`providers/runtime.js` 和 `src/App.jsx`。如文档与代码冲突，以代码的实际运行结果为准，并立即更新本文件。

## 1. 项目目标与不可改变的决定

- 参考站：`https://cfnav.me` 及其 39 个子站入口。
- 授权：站长已允许 Henry（henryz78）参考多个网站并进行个人、非商业、学习用途的二创。
- 目标不是只做一个导航外壳，而是让每个入口具备与参考站相近的用户效果：浏览、分页、搜索、打开详情以及播放/阅读。
- 用户当前明确优先级：**先完成所有视频类入口，再处理社区、图集、漫画和音频等入口。**
- 真实性与参考一致性优先：必须确认参考子站实际返回的目录、字段、详情和媒体链路后才能接入；界面保持参考站风格，不要擅自改版。
- **禁止使用同类型替代站、关键词 preset 或通用影视源冒充某个参考子站已经完成。** 未确认的入口必须显示“尚未接入”，不能返回无关内容。
- 长期目标是找到各子站真正上游或合规的独立替代源，不长期依赖 `cfnav.me/api/*` 或 `media.cfnav.com`。
- 每个来源必须放在可替换 provider adapter 后面；不能把同一个来源虚报成多个独立接口。
- 不写入原站账号、Cookie、用户数据、长期密钥或私有令牌。

## 2. 当前总体状态

| 项目 | 当前状态 |
|---|---|
| 本地入口 | 38 个；原 39 个参考入口中的看板娘游戏已按用户决定移除 |
| 独立 provider | 16 个：GDLSP、HStream、LeakGallery、Eporner、麻豆AI、PMVHaven、TNAFlix、iptv-org、RedGifs、oxax.tv + AdultIPTV、91porna、麻豆社、MissAV、糖心Vlog、看肉视频 |
| 真实匹配完成 | 15 个完整：麻豆视频 AI、PMV 视频、观番、OnlyFans 图集、EPORNER、TNAFlix、影视聚合、看91、栖影、看麻豆、看 Miss、看糖心Vlog、看肉视频、看每日大赛、看禁漫天堂；看TV 进入部分可用 |
| 被撤销的替代映射 | 22 个 Eporner/RedGifs 关键词替代入口已移除，不再计入完成 |
| 看板娘游戏 | 用户明确取消，不进入、不接入，已从本地导航移除 |
| 视频阶段 | 第一轮筛查已结束：7 个完整匹配、看 TV 部分可用；15 个原排除站已更新并恢复待接入；仅看主播因缺独立动态目录保持 pending |
| 下一项 | `qiying`、`madou`、`miss`、`tx`、`rou`、`mr`、`jm` 已接入并本地验收；`qiying` 于 2026-08-15 转为全实时抓取（删除 gz 快照），`mr` 于 2026-08-15 复用 qiying 解析接入 mrds.com 实时上游，`jm` 于 2026-08-15 接入官方新站 18mh.net（参考站旧库 18comic.ink 被 CF 封锁）；`qms`、`hqw`、`mt`、`best`、`xf`、`sjs`、`book`、`one` 用户决定跳过（风控/登录墙/私有票据/CF 全站保护/磁力下载站/上游不明/目录锁在登录墙后）；`hj`、`hxc`、`dj`、`swag`、`kankan`、`9s`、`dsd`、`xo`、`jav`、`bj` 于 2026-08-15 恢复为待接入（原付费/VIP 门控规则已移除，进入下一阶段重新评估）；ASMR 按用户决定暂时跳过；`mm` / 墨影集 内容已由用户独立图库站「栖光集」完成（同批数据），聚合入口待接入、未来做外链跳转（链接未就绪）；看 TV 的 41 路 oxax 品牌直播已实现、待可出网部署环境逐路验收 |
| 构建 | `npm run build` 生成原 client/server 产物；`npm run build:cloudflare` 生成 Cloudflare Pages 的 `dist/client` |
| Cloudflare Pages | 适配完成、未部署；根目录 `functions/` 只处理 `/provider-api/*`，静态资源不进入 Function |
| 测试 | `npm run test:sites` 9 项；`npm run test:cloudflare` 4 项，当前均通过 |
| 主导航视觉 | 2026-08-12 已用用户保存的完整首页与在线 `cfnav.me` 直接逐屏对照，覆盖桌面 1280×720、手机 390×844、深色/浅色、卡片默认/悬停状态；当前范围内的结构、尺寸、字样、图标、主题、封面和交互已对齐。仍保留三项产品决定差异：移除看板娘游戏、未接入站点诚实显示 PENDING、统计显示 38/READY 8，而不伪装参考站的 39/GAME 1。 |

### 状态术语

- **专用已验收**：入口已有与其定位匹配的独立上游，列表/搜索/详情/播放或阅读已验收。
- **尚未接入**：参考站证据或真实接口链路未确认，页面明确显示 pending，不返回替代内容。
- **研究已确认**：已找到上游或解码链路，但因为复杂度、访问边界或尚未实现 adapter，仍未接入页面。

## 3. 原始 39 个站点总表（当前范围 38 个）

| # | slug | 参考入口 | 分类 / 模式 | 当前 provider | 默认筛选 | 当前状态 | 实现与下一步 |
|---:|---|---|---|---|---|---|---|
| 1 | `one` | KanOne | 影视 / cinema | — | — | 用户跳过 / 不接入 | 2026-08-15 调查：参考站为 Next.js SPA，`/api/bootstrap` POST 公开返回 `uuid`+`hotKeywords`+`imgServers`+`cdnList`（登录会话内），目录/搜索 `/api/search` POST `{uuid,keyword,page,limit}`、详情 `/api/detail` POST `{uuid,id}` 全在 Linux.do 登录墙后（Node 401）。媒体链独立已验证：图片 `imgpw807.s7n7ue8.com`/`jmt612.xqjby.com` `/storage/thumb/{id}/{hash}.jpg` 200+CORS `*`；MP4 `dlmk0129.scycjz.com/one/compress/decry/vd/{date}/{b64}/{time}/{res}/.../decrypt/{token}.mp4` 206+CORS `*`、标准 MP4 无加密。上游域名群（`dlmk0129`×4、`0325api`×5、`imgpw807`×2 镜像）指向同一套防封站群；API 源站 `0325api.*`（Swoft）路由盲猜 60+ 路径全 500/403；`jmt612.xqjby.com` 暴露 S3 桶 `one-fruit-new` 列表（`oneVideo/hls/one/...` 2022 旧数据 757 条 + `admin/jiami/storage`），但桶内文件 403 不可下载、分页被拒（marker 403）。结论：与 `mt` 同型——媒体链独立是局部胜利，目录/搜索/详情锁在参考站登录墙后、上游 Swoft API 路由不可得、S3 桶非实时目录。用户 2026-08-15 决定跳过。无新证据（上游网页站或免登录 API）不重开。 |
| 2 | `game` | 看板娘游戏 | 游戏 / game | — | — | 用户取消 / 已移除 | 用户明确表示该游戏不需要进入、没有用途。已从本地导航和待办移除，后续不再研究或接入。 |
| 3 | `ai` | 麻豆视频 AI | 影视 / cinema | MadouAI | — | 专用已验收 | 参考前端明确指向 `www.madouai.xyz/api/v1`；已接真实分类目录、搜索、分页、详情、封面代理与 HLS 播放。参考站当前误把搜索词传入会忽略 `keyword` 的列表接口，导致搜索仍显示默认内容；本地使用真正的 `/videos/search?q=`，因此保留正常搜索效果。此入口与 `madou` /「看麻豆」不是同一站。 |
| 4 | `hj` | 看海角 | 社区 / feed | — | — | 待接入 | 已确认匿名列表、详情和三层 Base64。 |
| 5 | `91` | 看91 | 影视 / cinema | kan91 | play | 专用已验收 | 已接 91porna.com 真实分类目录（正在播放/本月热门/原创）、搜索、分页、详情（作者/播放数/时长/日期）、封面 AES 解密代理与 AES-128 HLS 播放；浏览器直连媒体域（CORS 全 `*`）。 |
| 6 | `qms` | 秋名山直播 | 直播 / live | — | — | 用户跳过 / 不接入 | 参考站结构为 131 平台 → `/api/channels/{platformId}` → FLV/MSE 直播（约 12000 频道）。2026-08-14 现场复查：绝大多数频道流被参考站登录墙内 `/api/stream/{id}` 代理隐藏，上游 CDN（hfjqkc/quanyuanhj/hesurf）全路径 403，独立无法解析真实流地址；仅少数频道直连阿里云 OSS 可公开读取（无 CORS 需转发）。用户现场确认放弃接入，保持 pending，不再要求导出全量目录。 |
| 7 | `mr` | 看每日大赛 | 社区 / feed | mr | — | 专用已验收 | 真实上游 `mrds.com`（= `www.mrds66.com`，「每日大赛」站）。2026-08-15 同源铁证：参考站 `/api/meta` 21 个分类 slug 与 mrds.com 首页导航完全一致；`/api/posts` totalPages 1691 与 mrds 首页分页 1/1691 一致；第一页 30 条 id/标题/作者与 mrds 首页 30 卡一一对应；搜索页卡片同为 `/archives/{id}/`。与 91吃瓜网同程序（Typecho/Mirages）：列表 `/`、`/page/N/`（广告卡过滤同 qiying）、21 分类 `/category/{slug}/` 与 `/{n}/` 分页（mrds 1658 页）、搜索 `/search/{kw}/` 仅第一页、详情 `/archives/{id}/`（`data-xkrkllgl` 图 + DPlayer `data-config` 签名 m3u8）。媒体链：图片 `pic.xustgq.cn` 加密 → 复用 `qiyingImageUrl` 重写 `imgpublic.ycomesc.live`；视频 `hls.dscxru.cn` 签名 m3u8 + `ts.syjiaotong.mobi` AES-128 key/ts 全部 CORS `*` 直连。headless 全链路验收：列表 27 卡+封面 27/27、分类 28 卡、分页 2/1658、搜索「小千」22 条、详情图集、1280×720 播放推进。完全复用 qiying 解析（`qiyingParseCards`/`qiyingCats`/`qiyingExtractDetail`/`qiyingImageUrl`），新增 `mrPage`/`mrDetail`/`mrPlay`/`mrList`。零 cfnav 依赖。 |
| 8 | `xf` | 看推特 | 社区 / feed | — | — | 用户跳过 / 不接入 | 2026-08-15 复评：参考站 `/api/feed`、`/x/{handle}` 无 cookie 全返 Linux.do 登录页；Twitter 官方 `cdn.syndication.twimg.com/tweet-result` 对成人视频推文全部返回 `TweetTombstone`（7/7），`timeline/profile` 端点已废弃；媒体域（video.twimg.com/pbs.twimg.com）虽可独立直连，但封面 token 不可重建、无实时独立目录；用户已否决快照/一次性导出方案。按登录墙目录 + 无实时独立上游跳过。无新证据（如独立动态目录或参考站 API 解除登录墙）不重开。 |
| 9 | `sjs` | 司机社 SJS | 社区 / feed | — | — | 用户跳过 / 不接入 | 2026-08-15 调查：参考站为司机社论坛资源分享镜像。契约：`/api/categories` 13 分类（latest/hot/domestic/western/japanese/vr/ai-video/image-video/anime-2d/anime-3d/doujin/gallery/find-source，slug 参数不生效，全站一个最新流）、`/api/home` 帖子流（id/title/author/date/replies/views）、`/api/thread/{id}` 返回 `{body, images[], links[], media[]}`；**links/media 全空、hasMedia false，下载链接埋在正文文本**（夸克网盘/Pikpak/磁力合集 + 解压密码），帖子有积分悬赏（车票）。上游本体为帖子正文暴露的 `sjs66.com`（Discuz 论坛，附件图床 `urlimage.cc` 可直连），但**全站 Cloudflare managed challenge**（Node 403）。结论：纯网盘/磁力下载资源站、无在线播放，与 `ja` / 看 JavBus 同型，按「不实现磁力/下载流程」规则与用户判断跳过。无新证据（如论坛开放在线播放或解除 CF 保护）不重开。 |
| 10 | `qiying` | 栖影 | 影视 / cinema | qiying | — | 专用已验收 | 真实上游为 91吃瓜网（Typecho，`agency.nsguiiwz.cc` 防失联线路，301 到当前主站 `agency.qxmrdvtu.cc`）。2026-08-15 起改为**全实时抓取**（用户决定：全站不要快照/一次性导出，`public/qiying/*.gz` 与 `scripts/prepare-qiying-data.mjs` 已删除）：列表 `/`、`/page/N/`（1246 页；每页 30 卡中约 15 张是广告卡无 `<h2 class="post-card-title">`，解析器跳过）；23 个分类 Tab 来自首页导航；分类页 `/category/{slug}/` 与 `/category/{slug}/{n}/` 分页（如 zxcghl 1224 页、91th 69 页；分页路径是 `/{n}/` 不是 `/page/{n}/`，后者 404）；搜索 `/search/{kw}/` 仅第一页（分页 404）；标签 `/tag/{slug}/`。详情 `/archives/{id}/` 与播放实时抓：DPlayer `data-config` 签名 m3u8（`action=play&idx=N` 多视频按块序），ts/key 走 `bgqpnx.cn` CORS `*`，帖子被删返回 404「帖子已从主站删除，仅图集可用」。**图片关键**：`pic.*.cn` 原图是加密字节（非 JPEG magic），所有图片（卡片封面 `loadBannerDirect`、详情图集、海报）必须重写为 `https://imgpublic.ycomesc.live{path}`（已验证真 JPEG）。卡片字段：id/标题/作者/日期/分类/热搜徽章；搜索页卡片是绝对 URL（`https://arrest.qxmrdvtu.cc/archives/{id}/`），id 正则需兼容两种形式。headless 全链路已验收：列表/封面/分类/分页/详情/搜索/1280×720 播放推进。零 cfnav 依赖。 |
| 11 | `tx` | 看糖心 Vlog | 影视 / cinema | tx | home | 专用已验收 | 真实上游为 `tangxinvlog.pro`（Astro 公开站，自称糖心官网），媒体 CDN `t.5gcdn.xyz`；参考站 `/api/videos?page=43` 报错直接暴露其后端实时抓取 tangxinvlog.pro（同源铁证），988 部 42 页、46 博主、slug/标题/时长/博主与参考站逐项一致（第 42 页 4 条全对）。首页最新 12 条、全部作品 42 页分页、46 博主索引（头像/作品数/全网粉丝）、博主作品列表（如饼干姐姐 79 部一页）、详情（博主/日期/时长/标签/简介/猜你喜欢 12 条）。播放为 AES-128 加密 HLS（`enc.key` + IV），媒体域无 CORS 且按 Referer 防盗链（无 `Referer: tangxinvlog.pro` 即 403），全部经同源代理转发（带 Referer/UA + CORS `*`），m3u8 内分片与 key 均重写为代理绝对 URL。headless 实测：列表/详情/博主链路全通，1080p 播放推进。参考站无搜索功能，本地隐藏搜索框对齐体验。零 cfnav 依赖。 |
| 12 | `lg` | 看 OnlyFans | 图集 / gallery | LeakGallery | — | 专用已验收 | 热门、创作者搜索、详情、图片和 MP4；媒体来自独立 CDN。 |
| 13 | `hxc` | 看含羞草 | 影视 / cinema | — | — | 待接入 | 登录后复核 9984 部、416 页以及列表/搜索/详情/完整播放；参考播放走 `/api/video/play` 后进入私有 `__cfnav_media/m/kan-hxc/playlist/*` 与分片路由。 |
| 14 | `hqw` | 好片 | 影视 / cinema | — | — | 用户跳过 / 不接入 | 真实上游 `haoqi7.com`（好妻网）技术链路已完全破解（匿名游客登录 + AES-256-ECB 加密 API、SolidStart `/_serverFn` Seroval 分类、`.ceb` 加密封面、签名 m3u8 播放），但上游反滥用极严：短时间请求即封 IP（`errorCode 1067 此ip已经禁止登陆`），研究期间多次换代理 IP 仍被反复封禁；Cloudflare Pages 部署为固定出口 IP 大概率很快被封。2026-08-14 用户判断复杂度/风险不值一个入口，放弃接入，工作区已恢复到 madou 提交。无新证据（如可长期存活的匿名会话）不重开。 |
| 15 | `book` | 有声读物 | 音声 / audio | — | — | 用户跳过 / 不接入 | 2026-08-15 调查（Next.js SPA，登录墙）：书库 `/api/book18`（GET 列表 `{id,title,slug}` 50 本/页、sort 支持 modified/popular/hot/recommended/favorited；POST `{slug}` 返回目录 chapters[]；POST `{nodeId}` 返回 Markdown 章节正文——作者 fongjia 等，nodeId 数字递增 232259~233696+，疑似某网文/TG 源，独立上游未找到）；音声 `/api/asmr?path=`（网盘目录树，20 位 hex id，isDir/type:audio）与 `/api/asmr-moon`（/中文音声、/日韩音声、/English + README.md 第二库）、`/api/audio?path=` 代理 MP3 流（ID3 元数据暴露 `ASMR.GAY` / `t.me/asmrgay`）。封面 CDN `cdn2.createaiasian.com/{hash}.jpg` 公开直连（createaiasian AI 图站，仅封面非内容源）；音声上游 `asmrgay.com` 全站 Cloudflare challenge（Node 403）；**全部 API 登录墙（Node 401）**。与 `mt` 同型：参考站登录墙 + 上游 CF 保护/上游不明，无独立实时目录。用户决定跳过。无新证据（如书库/音声的公开独立上游）不重开。 |
| 16 | `dj` | 轻看短剧 | 影视 / short | — | — | 待接入 | 待接入。 |
| 17 | `swag` | SWAG | 影视 / short | — | — | 待接入 | 公开封面来自 `public.swag.live`。 |
| 18 | `pmv` | PMV 视频 | 影视 / cinema | PMVHaven | — | 专用已验收 | 已确认参考站 24 位 ID、65006 条目录、标签、封面、详情与 MP4 均来自 PMVHaven；本地直接接公开列表/详情与匿名搜索页面数据，浏览器直连其独立媒体 CDN。 |
| 19 | `mt` | 看蜜桃 | 影视 / cinema | — | — | 用户跳过 / 不接入 | 参考站为 Next.js SPA：每个视频/封面都经 cfnav 私有时效票据（`__cfnav_media/m/kan-mt/playlist/{token}`、`/api/media/{token}` → "media ticket expired"、封面 `media.cfnav.com/m/kan-mt/image/*`）；上游源站藏在服务端 env（`SOURCE_ORIGIN`）客户端不可见；研究期间参考站自身也无法播放视频。无独立上游可建 adapter，2026-08-14 用户决定跳过。无新证据（真实 SOURCE_ORIGIN 上游 + 公开媒体路径）不重开。 |
| 20 | `rou` | 看肉视频 | 影视 / cinema | rou | home | 专用已验收 | 真实上游为 `rou.video`（Next.js SSR）。参考站 `/api/video/{id}` 的 `siteDomain` 直接返回 `https://rou.video`（同源铁证），条目 id 两边逐条一致，搜索「糖心」两边同为 39 页、标签「糖心Vlog」1804/1803、分类树 4 组 198 标签一致。首页 9 sections（最新上传 16 + 今日热门×5 + 热门×3，各 15-16 条）；标签 `/t/{tag}?order=createdAt&page=N` 26/页；搜索 `/search?q=&page=` 26/页 + 10 热词；分类 `/cat` 4 组（国产AV 57/麻豆AV 36/探花91 73/OnlyFans 32）。详情 `/v/{id}` 页 `ev` 字节减密出 `{videoUrl, thumbVTTUrl}`（`v.rn2xx.xyz/hls/{id}/{id}-720/index.jpg?v=6&exp&auth`，`.jpg` 伪装、约 1 天时效、无 EXT-X-KEY 未加密、分片独立签名）。封面 `v.rn221.xyz` imgproxy 直链无防盗链（img 直连）；播放/分片/thumbVTT 无 CORS 经同源代理（host 白名单 `v.rn\d+.xyz`，m3u8 分片行重写为代理绝对 URL）。headless 实测：9 sections 137 卡、封面 137/137、详情、720p 播放推进、分类 198 标签、标签列表分页、搜索 26 卡。零 cfnav 依赖。 |
| 21 | `fj` | 观番 | 动漫 / anime | HStream | — | 专用已验收 | 目录、搜索、详情、临时 CSRF 播放元数据、多线路 MP4。 |
| 22 | `kankan` | 爱微社区 | 社区 / feed | — | — | 待接入 | 待接入。 |
| 23 | `9s` | 看九色 | 影视 / cinema | — | — | 待接入 | 待接入。 |
| 24 | `zb` | 看主播 | 影视 / live | — | — | 研究已确认、尚未接入 | 已确认 48 个录播条目、详情 hash 路由、目录 `/api/home`、搜索 `/api/search?wd={keyword}&page=1` 与播放 `/api/player?id={id}&sid={sid}&nid={nid}`。2026-08-12 再次现场检索并核对资源清单，目录、搜索和全部封面仍依赖 `zb.cfnav.me` / `media.cfnav.com`；播放才落到独立 Backblaze B2 公开 MP4 域。该域支持 Range 并实际可播，但对象域根路径不提供目录或元数据，公开检索也未找到独立索引。因此保持 pending，不能把 48 条静态快照或猜测对象路径误报成长期接口。 |
| 25 | `jm` | 禁漫天堂 | 动漫 / comic | jm | — | 专用已验收 | 真实上游为官方新站 `18mh.net`（永久地址，GitLab 官方仓库 `18mh-net/18mh-net` 确认；免翻墙镜像 `32b.azucyfo.com`；地址发布页 `jmtt1.net`/`qkfmoba.cc`）。参考站旧库 `18comic.ink`（id 146 万级、路径 `/album/*`）主站全站 CF challenge（Node 403 + headless 均被拦，仅封面 CDN `cdn-msp2.18comic.ink` 存活），且与 18mh.net 是不同数据体系（id 2.6 万级、路径 `/comic/*`）——按独立性规则接官方新站。链路：列表 `/comic/all`（48 卡/页、总数约 2 万）+ 分页 `/comic/all/page/N`；12 分类 `/comic/all/{slug}`（rb 日本H漫 18882 条、hg/jq/xy/aq/bl/qh/tj/ll/dp/db/tr）分页 `/comic/all/{slug}/{n}`；排行 `/comic/rank`（220 卡）、热门 `/comic/hot`、最近更新 `/comic/newest`、最新上架 `/comic/freshest`；搜索 `/comic/search/{kw}`（仅第一页，SSR 卡片）；详情 `/comic/detail/{id}`（`data-comic-info` JSON + `detail-page__catalog-item` 章节列表，如 9950 共 70 话）；章节 `/comic/chapter/{id}/{n}`（`data-src` 图片列表）。**图片关键**：`pic.xmbvxj.cn` 原图是加密字节（magic `4f e8 97` 非 JPEG）→ 复用 imgpublic 重写（`imgpublic.ycomesc.live{path}` 真 JPEG/GIF，去掉 `?auth_key`）。headless 全链路验收：列表 48 卡、分类、排行 220 卡、搜索 12 条、详情 70 章节、阅读器 54 页全加载（720×3008）。零 cfnav 依赖。 |
| 26 | `mm` | 墨影集 | 图集 / gallery | — | — | 已完成（独立网站） | 2026-08-15 确认：参考站数据（14973 图集、841140 张图片、telegra.ph/file/* 直连）与用户自研图库项目「栖光集」（xrw-album.christin3.com）为**同一批数据**（Linux.do 公开帖一次性导出，85 万行 txt → D1）。内容已由独立网站形式完成，不重复接入聚合站（符合实时抓取规则：无独立实时上游，数据是一次性导出）。聚合入口保持待接入，**未来做成外链跳转**到用户图库站——跳转链接尚未就绪（用户 2026-08-15 指示），先不写死 URL，不实现跳转。 |
| 27 | `miss` | 看 Miss | 影视 / cinema | miss | — | 专用已验收 | 真实上游为 missav.media（公开站）。参考站 FastAPI Swagger（`/docs` → `/openapi.json`）暴露全接口契约，`/api/movie/{video_code}` 的 `metadata_links` 指向上游；分区映射 `new/release/today-hot/weekly-hot/monthly-hot/chinese-subtitle/uncensored-leak/fc2/heyzo/siro` ↔ 上游 `/cn/{key}`。列表/搜索（`/search/{kw}?page=N`）/分类·女优·发行商索引全 SSR 解析，每页 12 卡，分页链接带 `dm{id}` 前缀。媒体全公开直链 CORS `*`：封面 `fourhoi.mrstcdn.store/{code}/cover-t|n.jpg`、预览 `preview.mp4`、播放 `surrit.mrstcdn.store/{uuid}/playlist.m3u8`（多码率，分片为 `.jpeg` 伪装 TS，无加密、无需 token，uuid 从详情页 `surrit\.mrstcdn\.store\\?\/([0-9a-f-]{36})` 提取）。运行期零依赖 cfnav。2026-08-15 headless 验收：12 卡片、10 tabs、搜索、详情、hls.js 真实播放（640×360 推进）、封面 12/12。全站无 VIP/付费信号。 |
| 28 | `dsd` | 看懂色帝 | 影视 / cinema | — | — | 待接入 | 已确认 `/api/home`、分类、搜索和 `/api/play/{id}`；媒体经私有 `kan-dsd` 清单/分片代理。 |
| 29 | `movie` | 影视聚合 | 影视 / aggregate | GDLSP | — | 专用已验收 | MacCMS JSON 列表、分页、搜索、详情和 HLS 播放。 |
| 30 | `xo` | 爱看 | 影视 / cinema | — | — | 待接入 | 已确认真实上游是 `h5.xxoo473.org`。 |
| 31 | `jav` | 看 JAV | 影视 / cinema | — | — | 待接入 | 首页 24 条中只有部分标记 `free`；目录 `/api/home?offset=0&count=24`，封面进入 `media.cfnav.com/m/kan-jav/*`。 |
| 32 | `ep` | Flux / EPORNER | 影视 / cinema | Eporner | — | 专用已验收 | 官方 API 列表、搜索、排序、详情和官方嵌入播放。 |
| 33 | `tna` | TNAFlix | 影视 / cinema | TNAFlix | — | 专用已验收 | 用户保存的参考详情页及前端资源确认 `/api/home`、搜索、分类和详情结构；条目 `708531` 的路径、标题、封面、时长、相关 ID 与 144p/240p/360p 媒体均和官方 `www.tnaflix.com` 一致。本地已接官方公开目录、分页、搜索、详情及动态多清晰度 MP4；匿名完整播放支持 Range/CORS，不依赖 cfnav 签名。 |
| 34 | `tv` | 看 TV | 直播 / live | adulttv | — | 部分可用（41 路代码完成、待部署验收） | 已复现参考站 80 路目录（41 oxax 品牌 + 39 AdultIPTV 主题）、搜索和分页；39 路主题流已独立播放。2026-08-12 观察参考站 oxax 频道，确认它从 `http://oxax.tv/{slug}.html` 读取拆分的 Playerjs 配置，生成 `s.oxax.tv` 带时效 HLS 并通过同源中转加载 TS。本地已改为 HTTP slug 页面、还原 `kodk + 模板 + kos`、重写清单并代理受限分片；`oh-ah` 与 `superone-hd` 两种不同插入位置的真实页面样本均可精确还原现场 HLS。当前沙箱禁止本地服务进程出网，41 路仍需部署环境完成逐路播放验收。 |
| 35 | `madou` | 看麻豆 | 影视 / cinema | madou | — | 专用已验收 | 真实上游为 madou.club（麻豆社，WordPress）。已接分类目录（33 分类 Tab + 点赞排行）、搜索（`/?s=`）、分页、详情（标题/分类/标签/观看/点赞）、封面直连 `madou.club/covers/`；播放经 `dash.madou.club/share/{shareId}` 分享页现抓 100 秒时效 JWT，m3u8 带 token 请求、ts/key 直连（CORS 全 `*`）。参考站条目 slug/分类/详情 ID 与 madou.club 逐项一致；运行期零依赖 cfnav。 |
| 36 | `best` | 看 JavPorn | 影视 / cinema | — | — | 用户跳过 / 不接入 | 2026-08-15 终审（用户决定跳过）：目录 30 万条仅存于参考站登录墙 API（应用不能持用户会话），上游 www.bestjavporn.com（WordPress）除 robots.txt 外全站 Cloudflare managed challenge（wp-json/search/uploads 全 403），pornfhd.com 主站 522 已死。播放链独立可用（streamplay.win JWT → TikTok CDN PNG 外壳分片，直抓 200）、封面 CDN pics.pornfhd.com 无 CF 直连（prestige 系规律已归纳），但目录为入口级硬阻塞。重新评估条件：上游开放免 CF 入口、pornfhd.com 复活且有公开目录、或参考站 API 解除登录墙。 |
| 37 | `ja` | 看 JavBus | 资料 / magnet | — | — | 用户跳过 / 不接入 | 用户现场确认该站只有影片资料与磁力链接，不能在线直接播放，并明确决定跳过。它不符合当前“可浏览并在线播放”的视频接入目标；不实现磁力、下载或外部播放器流程，也不以其他日语片源替代。 |
| 38 | `bj` | 韩国主播视频 | 影视 / live | — | — | 待接入 | 待接入。 |
| 39 | `asmr` | 助眠音声 ASMR | 音声 / audio | — | — | 用户暂时跳过 | 浏览器权限阻止访问该参考子域；2026-08-13 用户决定暂时跳过并先做别的站点。后续仅在用户恢复该项并提供页面证据后再确认目录和播放链。 |

## 4. Provider 总表与实现方式

| provider id | 上游 | 本地实现 | 播放方式 | 会话/令牌 | 主要风险 |
|---|---|---|---|---|---|
| `gdlsp` | `www.gdlsp.com/api/json.php` | 透传允许的 MacCMS 查询参数并规范化 provider 字段 | HLS/直链由播放器解析 | 无 | 公开源域名可能变化；大量未匹配入口不应长期依赖它。 |
| `hstream` | `hstream.moe` + 返回的媒体域 | 抓目录 HTML；详情页取得 CSRF 与临时 Cookie，再请求 `/player/api` | 多线路 MP4 | 仅请求期间临时页面会话，不使用账号 | 页面结构或播放器协议变化会导致解析失效。 |
| `leakgallery` | `api.leakgallery.com` + `cdn.leakgallery.com` | JSON 热门、搜索、资料页与媒体详情 | 图片查看或 MP4 | 无 | API 字段/路径变化。 |
| `eporner` | `www.eporner.com/api/v2` | 官方搜索和详情 API；入口 preset 作为默认 query | 官方 `embed` iframe | 无 | 官方 API/嵌入策略可能变化；多个入口目前共享该源。 |
| `madouai` | `www.madouai.xyz/api/v1` | 公开列表、专用搜索、详情、图片代理与 M3U8 代理 | HLS.js / 浏览器原生 HLS | 无 | HLS 清单中的 AES key 与分片节点可能轮换；需保留健康检查。 |
| `pmvhaven` | `pmvhaven.com` + OVH 对象存储 CDN | 公开 JSON 目录/详情；搜索使用匿名公开搜索页内的 Nuxt 数据 | MP4 / HLS 直连 | 无 | 公开搜索 JSON API 要求 API key，因此本地只解析无需登录的公开搜索页，不保存凭据。 |
| `iptvorg` | `iptv-org.github.io/api` | 合并 streams/channels/logos 并过滤 | HLS.js 或浏览器原生 HLS | 无 | 直播频道天然会失效；需要健康检查和替换。 |
| `redgifs` | `api.redgifs.com` + `media.redgifs.com` | 获取匿名临时令牌；搜索与详情 JSON；45 分钟内存缓存 | HD/移动版 MP4，`no-referrer` | 匿名临时令牌，仅内存 | API 未作为本项目的稳定契约保证；CDN 会拒绝本地 Referer。 |
| `tnaflix` | `www.tnaflix.com` + TNAFlix 媒体节点 | 解析匿名公开目录、分页、搜索、详情 JSON-LD 与页面内动态清晰度地址 | 多清晰度 MP4 直连 | 无 | 官方 HTML 结构和媒体签名会轮换；adapter 每次打开详情重新取得最新地址，不写死签名。 |
| `adulttv` | `oxax.tv` / `s.oxax.tv` / `r.pokaz.me` + `cdn.adultiptv.net` | 内置经参考站逐项核对的 80 路目录；AdultIPTV 直接 HLS；oxax 访问公开 HTTP slug 页面，解析拆分的 Playerjs 签名，随后由受限同源代理重写 HLS 清单、分片和 key URI | HLS.js / 浏览器原生 HLS | 无账号或持久令牌；oxax 的临时签名不落盘；代理仅允许 `s.oxax.tv` 和 `r.pokaz.me` | 39 路主题流已本地验收；41 路品牌流解析与代理代码、真实页面样本测试已完成，待可出网部署环境逐路验收。 |
| `kan91` | `91porna.com` + `yd-hls.utxxds.cn` + `tp*.xmbvxj.cn` / `pic.xmbvxj.cn` | 抓公开 HTML 列表/搜索/详情 JSON-LD；详情页内联 packed 脚本解包出 `detail_play` 参数（`u` 固定签名 + `t` 时间桶），实时请求取 m3u8；封面经受限同源代理做 AES-128-CBC 解密；m3u8 直连浏览器 | HLS.js（AES-128 分片） | 无账号或持久令牌；detail_play 的时效签名实时取、不落盘；图片代理仅允许 `pic.xmbvxj.cn` | 主域走 Cloudflare，本地可能受 DNS 污染影响（改用真实 IP 或正常网络直连）；detail_play 参数结构若改版需重测。 |
| `qiying` | `agency.nsguiiwz.cc` / `being` / `act`（301 → `agency.qxmrdvtu.cc`，搜索页为 `arrest.qxmrdvtu.cc` 绝对 URL）+ `imgpublic.ycomesc.live` 图片 CDN + `op.vkjyoi.cn` / `bgqpnx.cn` 视频 CDN | 全实时：列表 `/`、`/page/N/`；分类 `/category/{slug}/` 与 `/category/{slug}/{n}/`；搜索 `/search/{kw}/`；标签 `/tag/{slug}/`；详情/播放抓 `/archives/{id}/` 解析 DPlayer `data-config` 签名 m3u8；所有 `pic.*.cn` 图片重写为 `imgpublic.ycomesc.live`（原图加密） | HLS.js（ts/key 直连 CDN） | 无账号；签名由 91吃瓜网服务端生成，每次点播现抓不落盘 | 主站域名轮换（防失联页多线路，adapter 内置三个镜像）；签名有时效，过期重新点播即可；分类/搜索分页路径是 `/{n}/` 而非 `/page/{n}/` |
| `madou` | `madou.club`（WordPress）+ `dash.madou.club` 分享页 | 抓首页/分类/搜索/点赞排行 HTML 解析卡片（标题/封面/观看/点赞/分类）；详情页解析 iframe shareId 与分享页短时效 JWT，拼 m3u8 完整 URL | HLS.js（AES-128，ts/key 直连） | 无账号；分享页每次现抓 100 秒时效 JWT，不落盘 | 上游域名/主题结构可能轮换；JWT 时效短，过期重新点播即可 |
| `rou` | `rou.video`（Next.js SSR）+ `v.rn2xx.xyz`（imgproxy 封面 / 签名 HLS） | 抓 `/home`/`/cat`/`/t/{tag}`/`/search`/`/v/{id}` 的 `__NEXT_DATA__`；详情 `ev` 字节减密出签名 m3u8；封面直链；播放/分片经同源代理（白名单 `v.rn\d+.xyz`，清单分片行重写） | HLS.js（无加密，分片走代理） | 无账号；签名约 1 天时效，每次打开详情现解密不落盘 | CDN 域名 `v.rnNNN.xyz` 数字后缀会轮换，正则已放宽；上游反爬尚无表现 |

## 5. 请求与数据契约

前端统一请求本地接口，不直接调用目录 API：

```text
GET /provider-api/{provider}?pg=1&limit=24&ac=detail
GET /provider-api/{provider}?pg=1&wd={用户搜索词}
GET /provider-api/{provider}?pg=1&preset={入口默认筛选}
GET /provider-api/{provider}?action=detail&id={vod_id}
```

统一列表响应至少包含：

```js
{
  code: 1,
  page: 1,
  pagecount: 1,
  limit: 24,
  total: 24,
  list: [],
  provider: "provider-id"
}
```

统一条目常用字段：

```js
{
  vod_id,
  vod_name,
  vod_pic,
  vod_remarks,
  vod_content,
  vod_play_url, // 直链或 label$url#... 多线路格式
  embed_url,    // 官方嵌入播放器
  media_kind,  // video | image | embed
  needs_detail,
  type_name,
  vod_area,
  provider
}
```

规则：用户搜索 `wd` 永远覆盖入口的 `preset`。`preset` 只控制首次打开时的默认内容。

## 6. 浏览器与网络链路

```text
用户浏览器
  ├─ 页面/API → 本地 /provider-api → provider adapter → 上游目录/详情 API
  └─ 实际媒体 → 浏览器直接访问第三方媒体 CDN 或官方 embed
```

- 这不是“伪装用户浏览器识别”。普通 API 请求由本地服务发起，实际视频/图片/HLS 通常由用户浏览器直连媒体域。
- RedGifs `<video>` 必须使用 `referrerPolicy="no-referrer"`，否则 CDN 可能因本地域名 Referer 返回 403。
- Eporner 使用官方 iframe；HLS 用 `hls.js`；浏览器支持原生 HLS 时优先原生播放。
- 本地开发由 `vite.config.mjs` 的 middleware 提供 `/provider-api`；原部署产物由 `worker/index.js` 提供同一接口；Cloudflare Pages 使用根目录 `functions/provider-api/[[path]].js`。
- `public/_routes.json` 只把 `/provider-api/*` 交给 Pages Functions，普通页面、JS、CSS 和图片继续按静态资源服务。

## 7. 代码地图

| 文件 | 职责 |
|---|---|
| `src/App.jsx` | 38 个当前范围入口定义、导航、列表、搜索、详情弹窗、HLS/MP4/iframe/图片播放器。 |
| `src/styles.css` | 当前参考站风格、响应式布局和各入口强调色。 |
| `src/directory-fidelity.css` | 主导航高保真覆盖层：首页层级、四列卡片、真实封面、状态徽章、悬停追光/缩放/入口展开及响应式修正。 |
| `providers/catalog.js` | provider 注册表和 slug → provider/preset 路由配置。 |
| `providers/runtime.js` | 所有 provider adapter、数据规范化、上游请求与错误处理。 |
| `vite.config.mjs` | 本地开发服务与 provider API middleware。 |
| `vite.build.config.mjs` | Windows 沙箱下稳定的生产构建配置。 |
| `worker/index.js` | 部署时 API 路由与 SPA 静态回退。 |
| `functions/provider-api/[[path]].js` | Cloudflare Pages Functions 入口；仅接收 GET 并复用 provider runtime。 |
| `public/_routes.json` | 限定只有 `/provider-api/*` 才调用 Pages Functions。 |
| `CLOUDFLARE-PAGES.md` | Cloudflare Pages 最简部署参数、限制和视频流量说明。 |
| `SOURCE-RESEARCH.md` | 上游发现证据、独立性判断和安全边界。 |
| `design-qa.md` | 视觉与主要交互验收记录，必须保持 `final result: passed`。 |
| `tests/sites-worker.test.mjs` | Sites worker、静态资源和 SPA 回退测试。 |
| `tests/cloudflare-pages.test.mjs` | Pages 路由范围、GET 转发、写请求拒绝和构建产物测试。 |

## 8. 已知问题和容易踩坑的地方

1. 首页显示的是独立 provider 数，不是入口数；多个入口共享一个 provider 是正常且必须诚实披露的。
2. `getProviderForSite()` 未配置的 slug 返回 `null` 并显示 pending；禁止恢复自动 GDLSP 回落。
3. 详情先显示 `detail_loading`，完成后才有播放地址。播放器 effect 必须依赖 `item.detail_loading`，否则 `<video>` 可能生成但 `src` 为空。
4. RedGifs 临时令牌只应放内存，不能写入文件、浏览器 LocalStorage 或部署变量。
5. GDLSP 和直播上游可能随时失效；adapter 错误要返回 502，前端显示来源错误，不能静默伪造成功。
6. HStream 依赖 HTML 正则和临时 CSRF，会比 JSON API 更脆弱。
7. 海角匿名接口只暴露公开预览链路，完整详情依赖参考站会话。
8. ASMR.One 类接口可能返回原本商业销售的完整音轨；来源授权不清晰时不要接入，即使技术上能播放。
9. JavBus 主要是影片资料，不等于拥有影片播放授权；资料目录、磁力和播放源应明确分开。
10. 生产构建存在单包大于 500 kB 的警告，但目前不阻塞功能；后续可做代码分包。

## 9. 验收清单

每接入或替换一个入口至少验证：

- 首次打开返回真实条目，不是空列表。
- 海报/缩略图可见，且不依赖 `cfnav.me` 或 `media.cfnav.com`。
- 搜索词能覆盖默认 preset。
- 点开条目后详情加载完成。
- 播放器拿到非空媒体 URL，或官方 iframe 正常出现。
- MP4/HLS/图片资源没有明显 403、CORS 或 Referer 错误。
- 上一页/下一页工作，至少第一页不会误显示为无内容。
- 浏览器控制台无新增 error。
- 更新本文件对应行、`SOURCE-RESEARCH.md` 和 `providers/catalog.js`。
- 完成一批后执行：

```powershell
npm.cmd run build
npm.cmd run test:sites
npm.cmd run build:cloudflare
npm.cmd run test:cloudflare
```

## 10. 接手顺序与下一步

### Cloudflare Pages 适配（已完成、未部署）

- Pages Functions 代码、静态路由范围、构建命令和 4 项测试已完成，目前没有创建或部署任何 Cloudflare 项目。
- 等用户实际准备部署时，优先使用 Git 集成：构建命令 `npm run build:cloudflare`，输出目录 `dist/client`。不要只把输出目录拖入 Direct Upload，否则根目录 `functions/` 不会随静态文件被构建。
- 41 路 oxax 会中转 HLS 分片，不应默认长期经过 Pages Functions；其余已完成来源的媒体保持浏览器直连。

### 当前最高优先级：看 TV 直播验收

1. 视频/直播入口第一轮筛查已经完成：可匹配的公开免费入口已接入，其余均已有明确证据和决定，不再为增加数量重复调查。
2. `zb` / 看主播仍缺独立动态目录；在找到公开索引前保持 pending，不写死 48 条静态快照。
3. `asmr` 已由用户决定暂时跳过，不再要求保存页面；当前利用可出网环境验证 `tv` 的 41 路 oxax 品牌频道解析、清单与媒体链。
4. `book` 等原排除站已更新、恢复待接入。
5. 未确认入口保持 pending，禁止用同类替代源填充。

### 不应重复的调查

- RedGifs 临时令牌、搜索、详情和 MP4 已验证，不需要重新证明。
- ASMR.One/`api.asmr-200.com` 技术上可返回完整音轨，但授权边界不清，当前决定是不接入。
- Internet Archive 可作为公开音频候选，但当前用户要求先完成视频，不要再优先研究音频。
- 海角匿名列表、详情和三层 Base64 已确认；下一次应直接研究公开预览 adapter 和图片/CDN 解码，不要重新从登录页开始。

## 11. 当前工作记录

### 2026-08-14

- 看91 独立 adapter 完成并验收：新增 provider `kan91`（91porna.com）。列表（play/now_month_hot/original + 分页）、搜索（梅庭 24 条）、详情（JSON-LD 标题/作者/播放数/时长/日期）、`detail_play` 实时取流（纯 JS 解包 packed 脚本，`t = now/1000/2100` 时间桶）、封面 AES-128-CBC 解密代理（key/iv 为 UTF-8 字符串）全部实测通过；m3u8/key/分片 CORS 均为 `*`，浏览器直连播放，无需媒体代理。`expose.eisees.com` 明文图域实测返回空图，不可用，封面一律走解密代理。`91` 入口从待接入改为专用已验收。
- 环境说明：91porna.com 在大陆 DNS 污染（本地曾解析到 Facebook/Dropbox IP），真实 IP 为 Cloudflare（172.67.181.57 / 104.21.40.76），可通过 `dns.google/resolve` DoH 获取；Cloudflare 部署环境 DNS 正常无需处理。

### 2026-08-12

- 最初建立 39 个本地入口和统一 UI；看板娘游戏后按用户决定移除，当前范围为 38 个入口。
- 当前共有 10 个独立 provider，7 个参考入口已完整匹配并验收；看TV 另为部分可用。
- 验证 GDLSP HLS、HStream 多线路、LeakGallery 图片/视频、Eporner 官方嵌入、iptv-org HLS、RedGifs MP4。
- 曾将 22 个入口错误地批量映射到 Eporner/RedGifs 关键词替代源；用户明确要求与参考站真实内容一致后已全部撤销。
- 未确认入口现显示 pending，不再返回 GDLSP 或同类型替代内容。
- 秋名山参考证据已确认：约 131 个成人直播平台，结构为平台列表→实时频道→直播播放器，请求 `/api/platforms`；本地专用 adapter 尚待实现。
- 看TV 参考目录与播放链已重新核对：页面当前返回 80 路，41 路来自 oxax、39 路来自 AdultIPTV；参考播放页显示 AdultIPTV 直连 `cdn.adultiptv.net/*.m3u8`，oxax 动态签名流来自 `s.oxax.tv` 并有 `r.pokaz.me` 备用。本地已实现同一目录，39 路主题流实际请求到 HLS 清单与 TS 分片；41 路原先因错误使用 HTTPS 数字路径而失败，现已按真实 HTTP slug 页面和 Playerjs 拆分签名修正，并加入受限 HLS 同源代理。
- KanOne 链路已确认：参考站通过私有 bootstrap 生成会话 UUID，再向自身 search/detail 接口请求，媒体使用带时效 token；没有找到独立公开上游，保持 pending。
- 看91 独立上游已确认：`91porna.com`。目录、搜索、详情 ID 与参考站一致；播放链路 `detail_play` → `yd-hls.utxxds.cn` m3u8（AES-128，key/分片在 `tp3.xmbvxj.cn`）已实测解密通过。主域走 Cloudflare，大陆 DNS 污染，本地验证用真实 IP 直连。
- 麻豆视频 AI 已找到参考前端写明的独立上游 `www.madouai.xyz/api/v1` 并完成 adapter：当前真实目录约 1.6 万条，支持搜索、分页、详情、封面与 HLS。
- PMV 视频已完成同源确认并接入：参考站与 `pmvhaven.com` 的 24 位 ID、最新目录、标签、封面和媒体 URL 一致；本地当前返回 65006 条目录，列表/搜索/详情/MP4 播放已验收。
- 看懂色帝已确认参考站目录、分类、搜索和 HLS 播放链；当前所有媒体仍进入私有 `kan-dsd` 代理，未找到可独立接入的真正上游，因此保持 pending。
- 完成一批剩余视频站整站筛查并写入状态：`one`、`hj`、`9s`、`swag`、`dsd`、`xo`、`jav`、`dj` 恢复待接入；`mt`、`miss`、`qiying`、`rou`、`tx`、`hqw`、`91`、`mr` 已更新、恢复待接入；`zb` 仍只有参考站私有媒体代理，继续 pending。
- 使用用户已登录的 Chrome 进一步复核 `hxc`：完整播放确实经参考站私有 `kan-hxc` HLS 路由。
- `ja` 当时受用户保存的浏览器访问权限限制；用户随后现场确认它只有影片资料与磁力链接、不能在线直接播放，并决定跳过，不实现磁力或下载流程。`madou` 已更新、恢复待接入。
- 用户再次确认：优先把视频全部完成，其他内容类型之后再做。
- 创建本总台账作为所有后续代理/助手的交接入口。
- 重新核对看板娘游戏：参考站是完整 Live2D 角色互动系统，不是本项目曾手写的体力/随机加分占位；已撤销该占位和“本地完成”状态，恢复为 pending，避免误报复刻完成。
- 用户随后明确取消看板娘游戏；已从导航与待办移除，后续不再研究或接入。
- 再次逐路测试看TV 的 41 个 oxax 品牌频道：本地详情解析 0/41 成功、41/41 返回 503；直接 TLS 请求确认 `oxax.tv` 仍返回只匹配 `xittv.net` 的证书。参考 `tv.cfnav.me` 本轮在浏览器被重定向到登录页，因此没有把参考前端是否同时失效作为已验证结论。
- 用户将受限参考子域的 TNA 详情页保存到下载目录后，已从离线前端恢复接口契约并与公开 `www.tnaflix.com` 逐项比对。`tna` 现接专用 TNAFlix adapter：列表和搜索各实测 24 条，详情可动态解析 5 档清晰度（抽样首页首条最高 720p）；MP4 Range 请求返回 206 且 CORS 为 `*`，用户浏览器可直连播放。
- 用户本轮保存的“麻豆AI”文件实际来自已完成的 `https://ai.cfnav.me/#/play/17349`，不是待研究的 `madou` /「看麻豆」。离线前端与上游实测确认参考麻豆AI搜索把词传给无效的列表 `keyword` 参数，故总显示默认内容；本地 adapter 使用公开专用搜索接口，搜索正常。待用户另存正确的「看麻豆」首页、详情及搜索状态后再研究 `madou`。
- 用户要求主导航尽可能 100% 对齐参考站，重点指出站名、封面、鼠标悬停效果、布局与信息丰富度不足。已使用下载目录中的完整首页 HTML、`styles.css`、logo、人物图及 38 张入口预览图，并同时打开在线 `cfnav.me` 与本地页逐屏对照。桌面 1280×720、手机 390×844、深色/浅色、卡片默认/悬停状态均已核对；修正图标描边、导航激活色、主题切换、区块与线路文案、页脚、移动端标题换行/首屏高度/人物位置/导航图标和卡片间距。首页搜索实测 `TNAFlix` 时只显示 1 张匹配卡，清空后恢复 38 张，未复制参考站的搜索异常。看板娘游戏继续移除；未接入条目继续显示 PENDING；38/READY 8 继续作为诚实状态，不为视觉一致改回 39/GAME 1。
- 重新从本地页面核对内容搜索链：前端提交词会写入 `wd`，且始终覆盖默认 preset。`ai`、`fj`、`ep`、`tna`、`tv` 使用绝对不命中的测试词后均由默认目录变为 0 条，PMV 使用有效词可返回 24 条独立搜索结果，未发现这些入口回退默认列表。LeakGallery 本轮热门接口本身返回空目录；GDLSP 本轮搜索请求出现上游超时，二者暂记为来源可用性问题，不能误报为搜索通过。另修复 provider 异步异常未被捕获的问题：所有 handler Promise 现在在 `try` 内 `await`，上游断线会稳定返回 502，不再打崩本地开发服务。
- 继续处理剩余视频站：`madou`、`best`、`ja`、`bj` 仍被保存的浏览器权限规则阻止，未绕过也未推断。复核“看主播”首条 56292：参考目录仍来自 `/api/home`，公开视频来自 Backblaze `guoji-02-mp4-cdnguoji.guojitaolu.sbs/file/taolu2026x/...`，实际 readyState 4、时长 632.955 秒。Backblaze 官方规则要求列目录必须授权，即使公开桶也只能匿名下载，因此无法用公开桶恢复动态目录，继续保持 PENDING。
- 看 TV 的 oxax 修复取得突破：参考 `ОХ-АХ HD` 当场生成 `s.oxax.tv/1/index.m3u8?k=...`，并请求连续 TS；独立 `http://oxax.tv/oh-ah.html` 同时可匿名打开。页面把 URL 拆为 `kodk`、`kos` 与编码 Playerjs 模板。本地 adapter 已按相同公开页面还原签名，并将 manifest、变体、key 和 TS 限定代理到 `s.oxax.tv` / `r.pokaz.me`。随后抽查 `superone-hd`，发现混淆标记会插入主 URL 中间；解析器已兼容两种位置，两个现场签名均逐字匹配浏览器实际请求。Sites 测试增为 8 项，新增完整 manifest 重写（子清单、AES key、TS）、Referer、目标域名白名单与超时保护验证。
- 再次复核“看主播”：页面仍显示 48 条；“扬州”搜索返回 1 条，资源记录新增 `/api/search?wd=扬州&page=1`，详情继续请求 `/api/player?id=56292&sid=1&nid=1`。这证明搜索功能有效，但目录、搜索和播放元数据仍是参考站私有 API，不能据此建立独立 adapter。随后尝试进入 `bj`，同一浏览器仍由用户保存权限明确阻止，已停止且未改用其他浏览器或间接访问。
- 用户要求暂停其他站点，先完成 Cloudflare Pages 适配。已新增根目录 catch-all Pages Function，直接复用现有 provider runtime；新增 `_routes.json`，确保只有 `/provider-api/*` 产生 Function 调用；新增独立构建命令、4 项测试及大白话部署文档。`npm run build:cloudflare`、4/4 Cloudflare 测试和原 8/8 测试均通过，未创建、上传或部署任何 Cloudflare 项目。
- Cloudflare Pages 适配完成后，用户明确恢复其他站点研究。原计划优先 `bj` / 韩国主播视频，随后改接 `madou` / 看豆豆。
- 用户随后保存 `madou` / 看豆豆首页、详情 HTML 及对应资源目录。离线 `app.js` 确认参考功能契约为 `/api/nav`、`/api/list`、`/api/detail?path=`、`/api/play/{shareId}`，支持分类、标签、排行、搜索、分页与 HLS；详情页已创建 HLS blob 播放器。`madou` 已更新、恢复待接入。
- 用户随后保存 `best` / 看 JavPorn 首页、详情 HTML 及对应资源目录。离线页面确认目录路由、`/search?q=`、`/v/{slug}` 与同源 `/api/play/{slug}` 播放契约；播放器优先使用接口返回的直连 HLS，失败后回退同源 HLS 代理，并包含把伪装成 PNG 的 TS 分片解包后播放的逻辑。保存下来的详情只有播放接口地址，没有 `m3u8_url` 或 `m3u8_proxy`，所以离线打开无法播放；用户称在线页面同样显示播放不了，受保存的浏览器权限限制，未绕过读取实时接口响应。`best` 已更新、恢复待接入。
- 用户现场确认 `ja` / 看 JavBus 只有影片资料和磁力链接，不能在线直接播放，并明确决定跳过。该入口保留在主导航以维持参考目录结构，但保持未接入状态；不研究或实现磁力、下载及外部播放器流程。
- 完成视频/直播阶段收尾复测：生产构建通过，Sites 8/8、Cloudflare Pages 4/4；视频站第一轮筛查至此结束。当前是 7 个完整匹配入口、看 TV 部分可用，其余视频站均有明确研究记录；看主播继续因缺少独立动态目录保持 pending。后续优先转入 `asmr` 音频入口核对。
- 2026-08-13 用户决定暂时跳过 `asmr`，不再要求保存页面；当前回到已实现但尚未完成真实网络验收的看 TV，优先逐路验证 41 个 oxax 品牌频道。
- 2026-08-14 完成 `qiying` / 栖影（91吃瓜网镜像 + 主站签名 HLS）、`madou` / 看麻豆（madou.club + dash.madou.club 100 秒 JWT）、`91` / 看91（91porna.com 全链路）接入与本地验收；`hqw` / 好片技术破解但上游封 IP 过严、`mt` / 看蜜桃无独立上游，用户决定跳过并记录重开条件；`qms` / 秋名山直播因登录墙内流代理跳过。
- 2026-08-15 完成 `miss` / 看 Miss 接入与本地验收：真实上游 missav.media，全站公开免费，媒体全直链（封面 fourhoi.mrstcdn.store、播放 surrit.mrstcdn.store 多码率 HLS，`.jpeg` 伪装 TS、无加密无 token）；10 分区 Tab + 搜索 + 详情 + hls.js 播放验证通过，零 cfnav 依赖。下一步按优先级处理 `tx` / 看糖心 Vlog。
- 2026-08-15 完成 `tx` / 看糖心 Vlog 接入与本地验收：真实上游 tangxinvlog.pro（用户提供的油猴脚本仅作上游线索参考，目录/字段/播放链全部按参考站 `tx.cfnav.me` API 契约与上游页面逐项对齐）。同源铁证：参考站 `/api/videos?page=43` 返回 `Upstream HTTP 404 for https://tangxinvlog.pro/videos/43/`；988 部 42 页、第 42 页 4 条（slug/标题/720p/时长/博主）与参考站逐条一致；46 博主、首页 12 条最新一致。播放链 AES-128（`enc.key`+IV）+ Referer 防盗链 + 无 CORS，全部媒体（封面/头像/清单/分片/key）经同源代理（带 Referer/UA，返回 CORS `*`），清单内分片与 key 重写为代理绝对 URL（key 必须重写，否则 hls.js 基于 `/provider-api/tx` 误解析出 404）。参考站无搜索，本地隐藏搜索框。headless 实测：首页 12 卡、全部作品 42 页分页、博主索引 46 位、博主作品列表、详情、1080p AES-128 播放推进全部通过。零 cfnav 依赖。
- 2026-08-15 完成 `rou` / 看肉视频接入与本地验收：真实上游 rou.video（Next.js SSR；用户提供的油猴脚本仅作解密逻辑参考）。同源铁证：参考站 `/api/video/{id}` 的 `siteDomain` 字段直接返回 `https://rou.video`，条目 id、搜索 39 页、标签 1804/1803、分类树 198 标签与上游逐项一致。首页 9 sections（最新上传 16 + 今日热门/热门 8 区）；分类 4 组（国产AV 57/麻豆AV 36/探花91 73/OnlyFans 32）；标签/搜索 26 页/26 条。详情页 `ev` 字节减密（`atob(d)` 每字节减 `k`）得 `{videoUrl, thumbVTTUrl}`——签名 HLS（`v.rn2xx.xyz/hls/{id}/{id}-720/index.jpg?v=6&exp&auth`，`.jpg` 伪装、约 1 天时效、未加密、分片独立签名）。封面 imgproxy 直链无防盗链；播放/分片/thumbVTT 无 CORS 经同源代理（host 白名单 `v.rn\d+.xyz`，m3u8 分片行重写为代理绝对 URL）。headless 实测：9 sections 137 卡、封面 137/137、详情、720p 播放推进、分类/标签/搜索全通。零 cfnav 依赖。
- 2026-08-15 终审 `best` / 看 JavPorn（用户决定跳过）：用户提供油猴脚本（BestJavPorn 去广告 v2.5.0）确认上游 www.bestjavporn.com；参考站契约全量导出（`/api/home` 3 分区 + 9 分类、`/api/list/{filter}` 20/页共 15013 页≈30 万条、`/api/search`、`/api/play/{slug}`）。播放链独立验证通过：`m3u8_url` = apiraw2.streamplay.win JWT → TikTok CDN PNG 外壳分片（5s/片、2 天签名、直抓 200）；封面 CDN pics.pornfhd.com 无 CF 直连（prestige 系路径规律已归纳，主站 pornfhd.com 522 已死）。但目录是入口级硬阻塞：参考站 API 无 cookie 全部返回登录页、上游全站 CF managed challenge（仅 robots.txt 豁免）、30 万条无法快照。重新评估条件：上游开放免 CF 入口 / pornfhd.com 复活有公开目录 / 参考站 API 解除登录墙。
- 2026-08-15 用户决定：**全部站点禁止快照/一次性导出数据文件，一律实时抓取**（要部署 Cloudflare Pages 纯静态，不想维护数据存储）。据此将 `qiying` / 栖影从「gz 镜像目录 + 实时播放」改为**全实时**：删除 `public/qiying/*.gz`（约 2.9MB）与 `scripts/prepare-qiying-data.mjs`；列表改抓 `/`、`/page/N/`（1246 页，每页 30 卡约 15 张广告卡跳过）；23 分类 Tab 抓首页导航；分类分页 `/category/{slug}/{n}/`（注意不是 `/page/{n}/`，后者 404）；搜索 `/search/{kw}/` 仅第一页；详情/播放维持实时抓 `/archives/{id}/`。发现并修复：`pic.*.cn` 原图是加密字节（非 JPEG magic `3e aa 70 8e`），所有图片（列表封面/详情图集/海报）必须重写为 `https://imgpublic.ycomesc.live{path}`（真 JPEG）；搜索页卡片用绝对 URL `https://arrest.qxmrdvtu.cc/archives/{id}/`，id 正则兼容相对/绝对两种。headless 全链路验收：列表 15 卡+封面全加载、分类 30 卡、分类分页 2/1224、详情、搜索「哪吒」12 条、清除、1280×720 播放推进。构建与 9 项测试通过。零 cfnav 依赖。
- 2026-08-15 完成 `mr` / 看每日大赛接入与本地验收：真实上游 `mrds.com`（= www.mrds66.com）。调查起点是参考站 `/api/meta` 21 分类 slug（mrds/sjbq/ztds/rstt/xazd/blyp/fctg/mhds/lqdp/jdsj/mxwh/smdh/dypd/mtds/ysds/czds/hjds/tgds/omjp/qwcs/aijc）与 `/api/posts` 的 totalPages 1691 —— 逐一与 mrds.com 核对全部一致（分类导航逐项命中、首页分页 1/1691 相同、第一页 30 条 id/标题一一对应），且与 91吃瓜网同程序（Typecho/Mirages，卡片/DPlayer 结构相同）。媒体链路全验证：`pic.xustgq.cn` 加密图（magic `09 3d e3 b1`）→ 复用 `qiyingImageUrl` 重写 `imgpublic.ycomesc.live`（真 JPEG `ff d8 ff e0`）；`hls.dscxru.cn` 签名 m3u8 + `ts.syjiaotong.mobi` AES-128 key/ts 全部 200 且 CORS `*`，浏览器直连播放。实现上完全复用 qiying 解析层（qiyingParseCards/qiyingCats/qiyingExtractDetail 参数化站点名/qiyingImageUrl），新增 `mrPage`（mrds.com + mrds66.com 镜像 failover）/`mrDetail`/`mrPlay`/`mrList`，App.jsx 的 QiyingPage/QiyingModal 参数化 provider 供 qiying/mr 共用。headless 全链路验收：列表 27 卡+封面 27/27、分类「每日大赛」28 卡、分页 2/1658、搜索「小千」22 条、详情图集、1280×720 播放推进、零 JS 错误（favicon 404 与 miss 健康检查 502 与 mr 无关）。构建与 9 项测试通过。零 cfnav 依赖。
- 2026-08-15 调查 `xf` / 看推特并跳过（无实时独立目录）：参考站 `/api/feed`、`/x/{handle}` 无 cookie 全返 Linux.do 登录页（8034B）；`cdn.syndication.twimg.com/tweet-result?id=` 对成人视频推文 7/7 返回 `TweetTombstone`；`timeline/profile` 端点已废弃（空响应）；媒体域 `video.twimg.com`（master→变体→fMP4 全 200）与 `pbs.twimg.com` 头像可独立直连，但封面 token 不可重建、参考站封面为 cfnav 私有票据；用户已否决快照/一次性导出方案。结论：登录墙目录 + 无实时独立上游 → 跳过（与 best 同型）。
- 2026-08-15 调查 `sjs` / 司机社并跳过（纯网盘/磁力下载站）：参考站契约 `/api/categories`（13 分类，slug 参数不生效全站一个最新流）、`/api/home`（threads 流，id 734xxx 递增）、`/api/thread/{id}`（`{body, images[], links[], media[]}`）。**links/media 全空、hasMedia false，下载链接（夸克网盘「1v188m」/Pikpak/磁力合集/解压密码）埋在正文文本**，帖子有积分悬赏（车票，如「回答被采纳将获得 50000 车票」）。上游本体为正文暴露的 `sjs66.com`（Discuz 论坛，附件图床 `urlimage.cc/attachments/forum/...` 直连 200 真 JPEG/GIF），但 sjs66.com 全站 Cloudflare managed challenge（Node 403）。结论：与 `ja` / 看 JavBus 同型的资源分享站、无在线播放，按「不实现磁力/下载流程」规则与用户判断跳过。
- 2026-08-15 调查 `book` / 有声读物并跳过（mt 同型：登录墙 + 上游 CF 保护/不明）：参考站为 Next.js SPA（`book.cfnav.me`，书库/音声双模式，全 API Node 401）。书库 `/api/book18`：GET `?page&sort`（sort: modified/popular/hot/recommended/favorited）→ 50 本/页 `{id,title,slug}`（繁体标题），POST `{slug}` → `{title, chapters[{nodeId,title}]}`，POST `{nodeId}` → Markdown 章节正文（`#NTR #NTL #純愛` 标签 + 作者 fongjia，nodeId 数字递增 232259~233696+，疑似网文站/TG 源，搜狗搜索无命中未找到上游）。音声：`/api/asmr?path=` 网盘目录树（20 位 hex id 阿里云盘风格，isDir/type:audio，中文音声 311 项 13 页）、`/api/asmr-moon?page`（第二库 /中文音声、/日韩音声、/English + README.md）、`/api/audio?path=` 返回 MP3 二进制流（ID3 暴露 `ASMR.GAY` / `t.me/asmrgay`）。封面 `cdn2.createaiasian.com/{hash}.jpg` 公开直连 200（createaiasian = CreatePorn AI 图站，仅封面、非内容源）；音声上游 `asmrgay.com` 全站 CF challenge（Node 403）。结论：数据全在参考站登录墙 API 内 + 上游不可达/不明，与 `mt` 同型，用户决定跳过。
- 2026-08-15 完成 `jm` / 看禁漫天堂接入与本地验收：真实上游官方新站 `18mh.net`。调查路径：参考站 `/api/meta` 自述 `source: 18comic.ink`（旧库，id 146 万级、路径 `/album/*`），但 18comic.ink 主站全站 CF challenge（Node 403、headless Chrome 也被拦），仅封面 CDN `cdn-msp2.18comic.ink` 存活；用户油猴脚本（Richy 18mh 去广告）匹配 18mh.net + jmtt1.net，GitLab 官方仓库 `18mh-net/18mh-net`（2026-03 创建）确认 18mh.net 为官方永久地址、`32b.azucyfo.com` 免翻墙镜像、`qkfmoba.cc` 地址发布页——参考站标题在 18mh.net 404 证实两库不同（id 2.6 万级、路径 `/comic/*`），按独立性规则接官方新站。全链路验证：列表 `/comic/all`（48 卡/页、总数 20476）分页 `/comic/all/page/N`；12 分类 `/comic/all/{slug}`（rb 18882 条等）分页 `/comic/all/{slug}/{n}`；排行 `/comic/rank`、热门 `/comic/hot`、最近更新 `/comic/newest`、最新上架 `/comic/freshest`；搜索 `/comic/search/{kw}` 仅第一页；详情 `/comic/detail/{id}`（`data-comic-info` JSON 类型/标签 + `detail-page__catalog-item` 章节列表含话名，9950 共 70 话）；章节 `/comic/chapter/{id}/{n}` `data-src` 图片列表（54 图/话）。图片 `pic.xmbvxj.cn` 加密字节（magic `4f e8 97 a4`）→ 复用 imgpublic 重写（去掉 `?auth_key`）。实现：新增 `JM_ORIGIN`/`JM_MIRRORS`/`jmPage`/`jmParseCards`/`jmDetail`/`jmChapter`/`jmList`（scope 参数 rank/hot/newest/freshest）、App.jsx 新增 `JmPage`/`JmModal`（阅读器 + 章节条）。headless 全链路验收：列表 48 卡、分类、排行 220 卡、搜索「姐姐们的调教」12 条、详情 70 章节、阅读器 54 页全加载（720×3008）、零 JS 错误（favicon 404 与 miss 健康检查 502 与 jm 无关）。构建与 9 项测试通过。零 cfnav 依赖。
- 2026-08-15 确认 `mm` / 墨影集为「已完成（独立网站）」：参考站数据（14973 图集、841140 张图片、telegra.ph/file/* 直连）与用户自研图库项目「栖光集」（xrw-album.christin3.com，2026-06-29 建成）为同一批 Linux.do 公开帖导出数据（85 万行 txt 标题+图片 URL，`build-free-d1-sql.mjs` 导入 Cloudflare D1）。内容以独立网站形式完成，不重复接入聚合站（数据为一次性导出、无独立实时上游，符合实时抓取规则）。聚合入口保持待接入，未来做成外链跳转；**跳转链接未就绪（用户 2026-08-15 指示暂不写死 URL）**，不实现跳转。
- 2026-08-15 调查 `one` / KanOne 并跳过（目录锁在参考站登录墙后，与 `mt` 同型）：参考站 Next.js SPA，`/api/bootstrap` POST（登录会话内）返回 `uuid`/`hotKeywords`（59 词含「镇ONE之宝」）/`imgServers`（13 域）/`cdnList`（11 域）；`/api/search` POST `{uuid,keyword,page,limit}` → `{items:[{id,modelId,thumb(私有ticket),title,subtitle,isLimitFree,number,publishedAt}],hasMore}`；`/api/detail` POST `{uuid,id}` → `{detail:{title,content(HTML),actor,author,tags,tagList,multiplePic,multiPicThumbnail,videoFile,previewVideo,videoHls(私有代理),videoHlsH265,quality,size,length,views,likeNumber,buys,coin,originalCoin...},streamUrl,mediaKind}`。全部 Node 401（Linux.do 登录墙）。媒体独立已验证：图床 `imgpw807.s7n7ue8.com`/`imgpw807.2u7qzt7.com`/`jmt612.xqjby.com`/`jmtp616.youguancm.com` `/storage/thumb/{id}/{hash}.jpg|webp` → 200 + CORS `*`；MP4 `dlmk0129.scycjz.com`/`dlmk0129.fwn9vj.com` 等 `/one/compress/decry/vd/{date}/{base64(id)}/{HHMMSS}/{WxH}/aac/h265/mp4/decrypt/{token}.mp4` → 206 + CORS `*`、`ftyp isom` 明文全片（454MB/617MB），无需 Referer/签名；HLS `.../encry/vd/.../hls/decrypt/index.m3u8` 为加密字节不可直用（有 MP4 即够）。域名群规律：`dlmk0129`×4 域、`0325api`×5 域（Swoft API，`/home/www/api` 路径）、`imgpw807`×2 域、`1vy79bws04jv/eyf08pws05jv.gdliren123.com`、`kwgewx01dl.mfpt8g.com`——同一套防封镜像站群；DoH 解析：图/视频域 23.197.86.x（Akamai）、API 域 23.62.46.x（Akamai）、jmt612 218.12.76.167/121.22.232.169（中国电信直连源站）。上游 API 路由盲猜 60+ 路径全 500「Route not found」/403；`jmt612.xqjby.com/` 公开 S3 ListBucketResult（bucket `one-fruit-new`，1000 keys/页，`/oneVideo/hls/one/{date}/{id}/index.m3u8+ts` 757 条为 2022 旧数据、`admin/jiami/storage` 222、avatar 14），但桶内文件 403 不可下载、`?marker=/prefix=` 分页 403、`list-type=2` 403——非实时目录。结论：媒体链独立但目录/搜索/详情全部锁在参考站登录墙后（同 `mt`/`best`/`qms` 目录阻塞型），用户决定跳过。重新评估条件：上游网页站（非镜像 CDN）公开可访问、或 0325api 路由暴露、或 S3 桶放行读权限。
- 2026-08-15 用户决定：**移除付费/VIP 门控规则**，原因此暂缓的 11 个站点（`one`、`hj`、`hxc`、`dj`、`swag`、`kankan`、`9s`、`dsd`、`xo`、`jav`、`bj`）全部恢复为「待接入」，进入下一阶段重新评估。同步从 PROJECT-HANDBOOK、SOURCE-RESEARCH、AGENTS.md 删除全部付费/VIP/购买/会员/积分相关的规则性表述（保留已接入站的"无 VIP/付费信号"验证记录与 sjs 的技术事实）。
