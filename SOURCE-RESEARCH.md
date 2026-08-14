# 独立来源研究记录

本项目的目标不是转发 `cfnav.me/api/*`，而是确认真正上游并以可替换 provider adapter 接入。

## 已确认、可直接独立接入

### GDLSP / MacCMS JSON

- 上游：`https://www.gdlsp.com/api/json.php`
- 发现证据：`movie.cfnav.me` 请求 `/api/proxy?url=https://www.gdlsp.com/api/json.php?...`
- 已实现：列表、分页、搜索、详情、播放地址解析、HLS 播放。
- 对 `cfnav.me` 依赖：无。
- 风险：公开源域名可能更换，因此保留 provider 替换能力。

### HStream 公开目录（观番）

- 目录：`https://hstream.moe/search`
- 详情：`https://hstream.moe/hentai/{slug}`
- 播放元数据：详情页生成临时 CSRF 会话后请求 `POST /player/api`。
- 播放媒体：接口返回 `stream_domains`、`asia_stream_domains` 与 `stream_url`，可组合为独立 MP4 / DASH 线路。
- 已实现：分页、搜索、详情解析、多线路 MP4 播放。
- 对 `cfnav.me` 依赖：无；不使用原站账号或 cfnav Cookie。

### LeakGallery JSON（图集）

- API：`https://api.leakgallery.com`
- CDN：`https://cdn.leakgallery.com`
- 已确认：热门列表、创作者搜索、创作者内容、媒体详情、图片与 MP4。
- 已实现：列表、搜索、详情、图片查看与视频播放。
- 对 `cfnav.me` 依赖：无。

### Eporner 官方 API（高清成人影片）

- API：`https://www.eporner.com/api/v2/video/search/` 与 `video/id/`。
- 已确认：匿名 JSON 列表、搜索、排序、分页、详情和官方 `embed` 播放页。
- 已实现：`ep` 路由专用 adapter；使用官方嵌入播放器，避免依赖 cfnav 的页面和代理。
- 对 `cfnav.me` 依赖：无。

### 麻豆AI 公开 API（麻豆视频 AI）

- 参考站打包前端明确写出上游：`https://www.madouai.xyz/api/v1`。
- 分类：`GET /api/v1/categories`；列表：`GET /api/v1/videos?page={n}&size=24&categoryId={id}`。
- 搜索：`GET /api/v1/videos/search?q={keyword}&page={n}&size=24`；详情：`GET /api/v1/videos/{id}`。
- 封面由 `/api/v1/image/proxy?path=...` 返回；HLS 由 `/api/v1/m3u8/proxy?path=...` 返回，清单中的 AES key 与 TS 分片来自动态媒体节点。
- 接口无需参考站登录或 cfnav Cookie；本地 adapter 只保存公开路径，不保存会话和令牌。
- 参考站搜索缺陷（2026-08-12 用户实测并由离线前端确认）：搜索框把关键词传给 `/api/v1/videos?keyword=...`，但该列表接口当前忽略 `keyword`，因此页面标题虽显示搜索词，目录仍是默认内容。真正可用的公开搜索接口是 `/api/v1/videos/search?q=...`；本项目已经使用后者，所以本地「麻豆视频 AI」搜索会正常筛选。这一修正不代表另一个 `madou` /「看麻豆」入口已完成。

### RedGifs 匿名视频 API（备用研究成果，未映射参考入口）

- 认证：`https://api.redgifs.com/v2/auth/temporary` 返回短期匿名令牌，不写入账号、Cookie 或长期密钥。
- 目录：`https://api.redgifs.com/v2/gifs/search`；详情：`/v2/gifs/{id}`。
- 媒体：接口直接给出 `media.redgifs.com` 的 HD、移动版 MP4、封面与缩略图。
- 已实现：provider adapter 支持列表、关键词搜索、详情和浏览器直连 MP4；因其目录与参考 PMV 不同，目前不映射任何已完成入口。
- 对 `cfnav.me` 依赖：无；匿名令牌只保存在本地服务内存中，到期自动更新。

### TNAFlix 公开目录（TNAFlix）

- 用户保存的参考详情页：`Kan TNA.html`，原地址为 `tna.cfnav.me/#/watch/708531?.../video708531`；离线前端显示参考接口为 `/api/home`、`/api/list`、`/api/search`、`/api/categories` 和 `/api/video/{id}`。
- 同源证据：参考条目 `708531` 的路径、标题、5:02 时长、封面、相关条目 ID 以及 144p/240p/360p 媒体文件均与 `www.tnaflix.com` 官方详情页一致。参考站 `/media/video/*` 的签名参数内也可还原出同一 TNAFlix MP4 地址。
- 免费边界：官方匿名详情直接返回完整视频清晰度，不是试看；登录入口只用于收藏、稍后观看和播放列表，没有作为目录、搜索、详情或播放门槛。本轮未发现 VIP、订阅或购买内容分区。
- 已实现：官方首页及 `/featured/{page}` 分页、`/search?what=...&page=...` 搜索、详情页 JSON-LD、动态多清晰度 MP4 解析。
- 播放验证：抽样 MP4 对无 Referer、本地 Referer 和本地 Origin 均返回 `206 Partial Content`，`Access-Control-Allow-Origin: *`，由用户浏览器直连播放。
- 对 `cfnav.me` 依赖：无；不保存参考站签名，因为官方页面每次会生成新的可用媒体地址。

### 参考真实性规则

- 同类型替代源、关键词 preset 或通用影视源不能算参考子站已实现。
- 只有目录、字段、详情和媒体链路均与参考站证据匹配的入口才接入 provider。
- 未确认入口显示 pending，不返回无关内容。

### 秋名山直播参考证据

- 参考站页面显示约 131 个成人直播平台及各平台频道数。
- 用户流程是平台列表 → 获取某平台实时频道 → 直播播放器，页面状态含“正在获取直播信号”和“正在直播”。
- 已观察到请求 `https://qms.cfnav.me/api/platforms`；尚需继续确认其真正上游与后续频道/流接口。
- 2026-08-12 复核 `tv.cfnav.me`：目录为 80 路（41 `oxax` + 39 `adultiptv`）。参考站 AdultIPTV 详情直接返回 `https://cdn.adultiptv.net/{topic}.m3u8`；MyCamTV 使用 `https://cdn.adultiptv.net/mycamtv/{topic}.m3u8`；实测清单和连续 TS 分片可从本地浏览器直接请求。
- oxax 详情页实时生成 `https://s.oxax.tv/{channel}/index.m3u8?k=...`，另有 `r.pokaz.me` 备用，签名不能写死。后续确认参考源页实际是可匿名访问的 `http://oxax.tv/{slug}.html`，不是原 adapter 使用的 `https://oxax.tv/{数字}`。源页以 `kodk`、`kos` 和编码 Playerjs 模板拆分签名；本地现已还原该组合，并加入只允许 `s.oxax.tv` / `r.pokaz.me` 的 HLS 清单与分片代理。`oh-ah` 和 `superone-hd` 的混淆标记插入位置不同，本地两项样本测试均可逐字还原浏览器现场请求的完整签名 URL。

### 海角原站匿名接口（阶段一已确认）

- 列表：`https://www.haijiao.com/api/topic/hot/topics?page={page}`。
- 详情：`https://www.haijiao.com/api/topic/{topicId}`。
- 返回格式：JSON 外层 `data` 为三层 Base64 包装；无需 cfnav Cookie 或登录令牌。
- 视频边界：未购买帖子只返回约 30 秒的 `_preview.m3u8`；完整媒体仍受海角购买/登录权限控制。
- 状态：上游与解码已确认。专用 adapter 留到第二阶段，同时处理图片 `.txt` 编码和 HJ CDN 的自定义 AES 密钥变换。

### iptv-org 开放频道库（电视直播）

- API：`channels.json`、`streams.json`、`logos.json`。
- 规则：只接中国地区、非 NSFW、HTTPS HLS 且无需额外 Referer / User-Agent 的公开直播线路。
- 已实现：`tv` 路由专用 adapter，支持频道列表、分页、搜索、台标和 HLS 播放。
- 对 `cfnav.me` 依赖：无。

### 有声读物候选

- 内容 CDN：`https://cdn2.createaiasian.com`
- 证据：`book.cfnav.me` 首页的独立书籍封面直接来自该域名。
- 状态：已识别媒体域，列表与音频元数据上游仍需继续反查。

## 不能算独立来源

下列代表性站点当前把资源放在 `media.cfnav.com`：

- 看海角 (`kan-hj`)
- 看 OnlyFans (`kan-lg`) 旧资源 URL；本项目已改接 LeakGallery 原始 API/CDN
- 观番 (`kan-fj`) 旧资源 URL；本项目已改接 HStream 原始目录与播放器接口
- 看 JAV (`kan-jav`)

`kan-91` 已不再属于本清单：看91 的独立原始上游已确认为 `91porna.com`（见下方条目）。

直接使用这些 `media.cfnav.com` 地址仍会与 cfnav 同时失效，因此不会作为长期 provider；后续需要继续追到其原始来源、抓取规则或可替代公开源。

## 当前实现状态

- 38 个当前范围入口与独立路由；原看板娘游戏入口已按用户决定移除。
- 与参考证据匹配的入口保留映射：影视聚合/GDLSP、观番/HStream、OnlyFans/LeakGallery、EPORNER/Eporner、麻豆视频 AI/MadouAI、PMV/PMVHaven、TNAFlix/TNAFlix。
- 看 TV 已切换为参考目录一致的 oxax + AdultIPTV adapter；39 路 AdultIPTV 已播放验收，41 路 oxax 的公开 HTTP 页面解析与受限 HLS 代理已实现，待可出网部署环境逐路播放验收。
- RedGifs 与 iptv-org 保留为已研究 provider，但不再作为 PMV 或看 TV 的同类型替代映射。
- 其余入口显示 pending，不再以 Eporner/RedGifs/GDLSP 替代内容冒充完成。
- 2026-08-14 用户确认 15 个原排除站点已更新，恢复为待接入：`mt`、`miss`、`qiying`、`rou`、`tx`、`hqw`、`91`、`mr`、`mm`、`jm`、`book`、`madou`、`best`、`sjs`、`qms`；`dj` 因仍含付费信号保留整站暂缓。
- 看板娘游戏已按用户决定从范围和导航中移除。
- 这不是“当前范围入口真实上游全部拆完”的完成声明；每拆出一个新上游，应将对应路由从共享 adapter 切换到专用 adapter。

## 安全边界

- 不写入原站 cookie、会话、用户数据或私有令牌。
- 不把 `cfnav.me/api/*` 作为持久依赖。
- 不把 `media.cfnav.com` 误标为第三方独立上游。

## PMV 视频 / PMVHaven

- 参考站 API：`/api/directory`、`/api/videos?page=1&limit=24&sort=latest`、`/api/video/{24位ID}`。
- 独立上游：`https://pmvhaven.com/api/videos`、`https://pmvhaven.com/api/videos/{id}`。
- 同源证据：参考与上游的条目 ID、标题、时长、标签、缩略图路径逐项一致；实际 MP4 来自 `pmvhavencloud.s3.eu-west-par.io.cloud.ovh.net`。
- 独立搜索：上游的 `/api/search` 需要 API key，不在项目中获取或保存；匿名公开 `/search?q=...` 页面会返回同一搜索目录的 Nuxt payload，本地适配器只解析这一公开数据。
- 验证：本地第一页 24 条、总数 65006；搜索 `puffy` 返回 24 条；详情 `6a7bebbbe9976c7200ac4db4` 返回可播放 190.356833 秒 MP4，浏览器 readyState 3，无控制台错误。

## 看懂色帝 / kan-dsd

- 参考接口：`/api/categories`、`/api/home`、`/api/list?type=...`、`/api/search?q=...`、`/api/play/{id}`。
- 参考播放：详情返回约 2 小时 HLS，但浏览器实际请求全部进入参考站 `__cfnav_media/m/kan-dsd/playlist/{token}` 与 `segment/{token}`。
- 目录含明确 VIP 标记。当前公开检索未识别到可独立调用的原始目录或媒体站。
- 结论：只记录链路，不复用参考私有 token，不绕过 VIP；入口继续 pending。

## 爱看 / 香蕉视频

- 参考前端明确标注上游 `https://h5.xxoo473.org`，目录字段与上游页面逐项一致。
- 上游同时包含公开条目、VIP 条目和明确“付费”条目；参考脚本还出现了 `vipUnlock`/预览升级相关逻辑，本项目不会复现。
- 用户已决定按整站跳过：只要一个站含任何 VIP/付费/登录内容，该站连免费子集也暂不介入。因此 `xo` 保持 pending。

## 2026-08-12 剩余视频站整站筛查

本批只记录参考站可见事实与资源路径；下列“整站不接入/暂缓”站点不会建立 provider，也不会摘取其免费子集。

### 含付费、VIP 或非全站免费

- `one` / KanOne：首页把“限时免费”作为独立分区，并同时列出抽奖、抄底等入口；现有链路还依赖私有 bootstrap 会话和时效媒体 token。结论：非全站免费，整站暂缓。
- `9s` / 看九色：分类明确含“非付费”，最新条目出现“有偿”；结论：目录不是全站免费，整站暂缓。
- `swag`：短影音列表显示“免费”，但切换“动态”后 193 条中大量明确标为“付费”；结论：整站含付费，不接免费短影音子集。公开封面可见于 `public.swag.live`，但不据此接入。
- `dsd` / 看懂色帝：目录含 VIP，播放经过私有 `kan-dsd` HLS 代理；结论：整站暂缓。
- `xo` / 爱看：上游包含 VIP/付费，参考脚本还存在预览升级逻辑；结论：整站暂缓。
- `hj` / 看海角：完整帖子存在购买边界；结论：整站暂缓，不再单独接公开预览。
- `jav` / 看 JAV：首页 24 条中只有一部分标 `free`，未证明全站免费；请求 `/api/home?offset=0&count=24`，封面为 `media.cfnav.com/m/kan-jav/*`。结论：整站暂缓。

### 已更新站点（2026-08-14 用户确认，恢复为待接入）

- `mt` / 看蜜桃：已更新，恢复为待接入。
- `miss` / 看 Miss：页面提供类型、女优、发行商和 API 文档入口；已更新，恢复为待接入。
- `qiying` / 栖影：约 4246 帖、7796 视频，详情为图文视频混合；已更新，恢复为待接入。
- `rou` / 看肉视频：有分类、标签和详情 ID；已更新，恢复为待接入。
- `tx` / 看糖心 Vlog：有作品、博主和详情 ID；已更新，恢复为待接入。
- `dj` / 轻看短剧：存在默认、`free`、`line2` 等多条线路，只有部分条目标“免费”；接口包含 `/api/cdn/lines` 与 `/api/home`。2026-08-14 用户复核后保留原判断：含付费信号，整站暂缓。
- `hqw` / 好片：14 个分类；详情 `/api/video/{id}`，播放为参考站签名 `/api/cdn-playlist/{id}`；已更新，恢复为待接入。
- `91` / 看91：独立上游已确认为 `91porna.com`（2026-08-14 全功能实测通过）。目录与看91 参考站完全一致（分类 `/comic/index/video?category=play|now_month_hot|original`、搜索 `/comic/index/search?keyword=`、JSON-LD 与看91 的 `#/watch/{id}` 同 ID；列表/分页/搜索/相关视频 `/comic/av/relvideo`/RSS `/feed/video`/embed `/comic/index/embed?id=` 均验证可用）。播放链路已实测打通：详情页内联混淆脚本 `document.write` 调 `/index/detail_play?img={封面路径}&ads={广告}&u={视频稳定签名}&t={parseInt(now/1000/2100)}`（JSONP 风格，返回混淆 JS），纯 JS 解包 packed 脚本后实时请求得 m3u8；m3u8 为单码率 AES-128 加密清单（显式 IV），`crypt.key` 与 5 秒分片位于 `tp*.xmbvxj.cn`（多台边缘，均已签名，`auth_key` 短时效需实时取流）。封面图在 `pic.xmbvxj.cn`，**图片本身也是 AES-CBC 加密**（固定密钥 `f5d965df75336270` / IV `97b60394abc2fbe1`，PKCS7，`crypto_image.js` 客户端解密，服务端需解密后使用）。`expose.eisees.com` 明文图域实测返回空图不可用。主站 Cloudflare 后面，大陆 DNS 被污染（真实 IP 172.67.181.57 / 104.21.40.76，可用 `dns.google/resolve` DoH 获取；本机 `--resolve` 或正常网络直连即可）。已实现为 provider `kan91`（列表/搜索/分页/详情/封面解密代理/AES-128 HLS 播放），实测 200、CORS 全 `*`，入口状态专用已验收。
- `mr` / 看每日大赛：约 1677 页、每页 30 条；接口 `/api/meta`、`/api/posts?page=1`，图片为 `media.cfnav.com/m/kan-mr/*`；已更新，恢复为待接入。
- `mm` / 墨影集：14973 图集、841140 张图片；图片直连 `telegra.ph/file/*`；已更新，恢复为待接入。
- `jm` / 禁漫天堂：80 本/页，封面来自 `cdn-msp2.18comic.ink`，排行、分类与搜索可见；已更新，恢复为待接入。
- `book` / 有声读物：书库/音声双模式，书库第一页 50 本，封面直连 `cdn2.createaiasian.com`；已更新，恢复为待接入。

### 尚无独立上游

- `hxc` / 看含羞草：登录后确认 9984 部、416 页及 6 个分类；目录 `/api/videos`，详情 `/api/video/info`，播放 `/api/video/play`，完整 HLS 经参考站私有 `__cfnav_media/m/kan-hxc/playlist/*` 与分片路由。原始接口体系包含 `isVip`、`isBuy`、`isNeedLogin`、`isTemporarilyFree` 及预览地址字段，说明不是全站免费；按用户规则整站暂缓，不实现预览升级或 VIP 解锁。
- `zb` / 看主播：参考站是 48 个录播条目而非实时直播；目录 `/api/home`，搜索实测调用 `/api/search?wd={keyword}&page=1`，播放调用 `/api/player?id={id}&sid={sid}&nid={nid}`。2026-08-12 再次在已授权页面以“扬州”检索，确实返回 1 条而不是客户端过滤，但资源清单证明目录和搜索都仍来自 `zb.cfnav.me/api/*`；48 张封面继续全部来自 `media.cfnav.com/m/kan-zb/image/*`。首条实际播放直接落到公开 MP4 域 `guoji-02-mp4-cdnguoji.guojitaolu.sbs`，支持 Range 且完整时长可加载；同条第二线路 `yazhou-02-mp4-cdn.yazhoutaolu.cyou` 当前证书域名错误。公开媒体域根路径跳转到 Backblaze B2 产品页，没有对象目录或元数据 API；按精确标题、条目 ID、文件 ID与域名检索均未找到独立索引。媒体文件可独立读取不等于目录可独立更新，故继续 pending，不写死 48 条快照。

### 当前无法核对

- `asmr`：用户保存的浏览器权限阻止访问对应参考子域。遵守浏览器限制，不通过其他浏览器或间接方式绕过；2026-08-13 用户决定暂时跳过，后续不再主动要求页面资料，直到用户恢复该项。
- `madou` / 看豆豆：用户于 2026-08-12 保存首页和一条详情页，连同两个资源目录共四项。前端契约为 `/api/nav`、`/api/list?page=&category|tag|rank|q=`、`/api/detail?path=`、`/api/play/{shareId}`；详情返回 `shareId` 后用 HLS.js 播放 `m3u8`。保存页面没有出现会员、积分、金币、购买或付费入口；2026-08-14 用户确认站点已更新，恢复为待接入。
- `bj`：2026-08-12 用户在可见页面现场确认站内存在会员和积分内容。根据项目的整站免费门槛，整站暂缓，不继续抓取接口，也不摘取其中免费内容。
- `tna` 已由用户主动保存并提供参考页面及完整前端资源，因此无需再操作受限的参考子域；已根据该离线证据与公开官方上游完成同源核对和接入。

### 看 JavBus（`ja`）用户决定

- 用户于 2026-08-12 现场确认该参考入口只有影片资料和磁力链接，不能在线直接播放。
- 用户明确决定跳过该站。它不进入当前在线视频 provider 范围；不实现磁力、下载或调用外部播放器，也不使用其他日语片源冒充 JavBus。

### 看 JavPorn（`best`）离线证据与排除决定

- 用户于 2026-08-12 保存首页、一条 `cawd-956` 详情页及两个资源目录。目录路由包括 `/list/latest`、`/list/popular`、`/list/most-viewed`、`/list/longest`、`/list/censored`、`/list/uncensored`、`/list/amateur`、`/list/english-subtitle`，另有分类、标签、演员、片商和 `/search?q=`。
- 详情路由为 `/v/{slug}`，播放器元素只带 `data-play-endpoint="/api/play/{slug}"`。前端会在打开详情后请求该同源接口，期待 JSON 中的 `m3u8_url` 与 `m3u8_proxy`；优先直连 HLS，失败后回退代理。`hls-direct.js` 还会从 PNG 外壳后提取 MPEG-TS 分片，说明播放依赖参考站专用媒体处理链，不能把页面路径当作独立公开上游。
- 保存的 `cawd-956` 页面没有落下 `data-hls-direct` 或 `data-hls-proxy`，故离线 HTML 无法调用原站同源接口，播放失败是预期结果。用户表示在线现场也显示无法播放；浏览器的保存权限规则阻止代理读取实时接口响应，已遵守限制停止，未通过替代浏览器或间接方式绕过。因此只能确认在线播放当时失败，不能断言具体是源失效、接口错误还是临时媒体地址失败。
- 首页未见会员、积分、金币、付费或购买入口；2026-08-14 用户确认站点已更新，`best` 恢复为待接入。

## 其他分类第一批筛查

- `xf` / 看推特：公开信息流中出现 VIP 节选与完整版订阅导流；整站暂缓。
- `sjs` / 司机社：2026-08-14 用户确认站点已更新，恢复为待接入。
- `kankan` / 爱微社区：首页大量标记 VIP 或金币；整站暂缓。

## 秋名山直播补充结论

- 已确认参考站真实结构为 131 平台 → `/api/channels/{platformId}` → FLV/MSE 直播播放器，实测频道 readyState 4；不是录播目录。
- 2026-08-14 用户确认站点已更新，恢复为待接入；参考结构（131 平台 → `/api/channels/{platformId}` → FLV/MSE 直播播放器）仍为研究记录。
