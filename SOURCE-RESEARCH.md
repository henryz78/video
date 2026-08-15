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
- 视频边界：未购买帖子只返回约 30 秒的 `_preview.m3u8`；完整媒体需独立上游进一步确认。
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
- 2026-08-14 用户确认 15 个原排除站点已更新，恢复为待接入：`mt`、`miss`、`qiying`、`rou`、`tx`、`hqw`、`91`、`mr`、`mm`、`jm`、`book`、`madou`、`best`、`sjs`、`qms`。
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
- 结论：只记录链路，不复用参考私有 token；入口继续 pending。

## 爱看 / 香蕉视频

- 参考前端明确标注上游 `https://h5.xxoo473.org`，目录字段与上游页面逐项一致。
- 状态：上游已确认，待接入。

## 2026-08-12 剩余视频站整站筛查

### 已更新站点（2026-08-14 用户确认，恢复为待接入）

- `mt` / 看蜜桃：已更新，恢复为待接入。**2026-08-14 复查后用户决定跳过（见文件末尾「看蜜桃 / mt 复查结论」）。**
- `miss` / 看 Miss：页面提供类型、女优、发行商和 API 文档入口；已更新，恢复为待接入。**2026-08-15 已接入并本地验收（见下节「看 Miss / missav.media」）。**
- `qiying` / 栖影：约 4246 帖、7796 视频，详情为图文视频混合；已更新，恢复为待接入。**2026-08-14 已接入并本地验收（见下节「栖影 / 91吃瓜网」）。**
- `rou` / 看肉视频：有分类、标签和详情 ID；已更新，恢复为待接入。**2026-08-15 已接入并本地验收（见下节「看肉视频 / rou.video」）。**
- `tx` / 看糖心 Vlog：有作品、博主和详情 ID；已更新，恢复为待接入。**2026-08-15 已接入并本地验收（见下节「看糖心Vlog / tangxinvlog.pro」）。**
- `dj` / 轻看短剧：存在默认、`free`、`line2` 等多条线路；接口包含 `/api/cdn/lines` 与 `/api/home`。已更新，恢复为待接入。
- `hqw` / 好片：14 个分类；详情 `/api/video/{id}`，播放为参考站签名 `/api/cdn-playlist/{id}`；已更新，恢复为待接入。**2026-08-14 上游破解后用户决定跳过（见下方「好片 / haoqi7.com 破解记录（2026-08-14，未接入）」）。**
- `91` / 看91：独立上游已确认为 `91porna.com`（2026-08-14 全功能实测通过）。目录与看91 参考站完全一致（分类 `/comic/index/video?category=play|now_month_hot|original`、搜索 `/comic/index/search?keyword=`、JSON-LD 与看91 的 `#/watch/{id}` 同 ID；列表/分页/搜索/相关视频 `/comic/av/relvideo`/RSS `/feed/video`/embed `/comic/index/embed?id=` 均验证可用）。播放链路已实测打通：详情页内联混淆脚本 `document.write` 调 `/index/detail_play?img={封面路径}&ads={广告}&u={视频稳定签名}&t={parseInt(now/1000/2100)}`（JSONP 风格，返回混淆 JS），纯 JS 解包 packed 脚本后实时请求得 m3u8；m3u8 为单码率 AES-128 加密清单（显式 IV），`crypt.key` 与 5 秒分片位于 `tp*.xmbvxj.cn`（多台边缘，均已签名，`auth_key` 短时效需实时取流）。封面图在 `pic.xmbvxj.cn`，**图片本身也是 AES-CBC 加密**（固定密钥 `f5d965df75336270` / IV `97b60394abc2fbe1`，PKCS7，`crypto_image.js` 客户端解密，服务端需解密后使用）。`expose.eisees.com` 明文图域实测返回空图不可用。主站 Cloudflare 后面，大陆 DNS 被污染（真实 IP 172.67.181.57 / 104.21.40.76，可用 `dns.google/resolve` DoH 获取；本机 `--resolve` 或正常网络直连即可）。已实现为 provider `kan91`（列表/搜索/分页/详情/封面解密代理/AES-128 HLS 播放），实测 200、CORS 全 `*`，入口状态专用已验收。
- `mr` / 看每日大赛：约 1677 页、每页 30 条；接口 `/api/meta`、`/api/posts?page=1`，图片为 `media.cfnav.com/m/kan-mr/*`；已更新，恢复为待接入。**2026-08-15 已接入并本地验收（见下节「看每日大赛 / mrds.com」）。**
- `mm` / 墨影集：14973 图集、841140 张图片；图片直连 `telegra.ph/file/*`；已更新，恢复为待接入。**2026-08-15 确认：与用户自研图库「栖光集」（xrw-album.christin3.com）为同一批 Linux.do 公开帖导出数据（85 万行 txt → D1），内容已以独立网站形式完成，聚合入口待接入（未来做外链跳转，链接未就绪）。**
- `jm` / 禁漫天堂：80 本/页，封面来自 `cdn-msp2.18comic.ink`，排行、分类与搜索可见；已更新，恢复为待接入。**2026-08-15 已接入并本地验收（见下节「看禁漫天堂 / 18mh.net」）。**
- `book` / 有声读物：书库/音声双模式，书库第一页 50 本，封面直连 `cdn2.createaiasian.com`；已更新，恢复为待接入。

### 尚无独立上游

- `hxc` / 看含羞草：登录后确认 9984 部、416 页及 6 个分类；目录 `/api/videos`，详情 `/api/video/info`，播放 `/api/video/play`，完整 HLS 经参考站私有 `__cfnav_media/m/kan-hxc/playlist/*` 与分片路由。
- `zb` / 看主播：参考站是 48 个录播条目而非实时直播；目录 `/api/home`，搜索实测调用 `/api/search?wd={keyword}&page=1`，播放调用 `/api/player?id={id}&sid={sid}&nid={nid}`。2026-08-12 再次在已授权页面以“扬州”检索，确实返回 1 条而不是客户端过滤，但资源清单证明目录和搜索都仍来自 `zb.cfnav.me/api/*`；48 张封面继续全部来自 `media.cfnav.com/m/kan-zb/image/*`。首条实际播放直接落到公开 MP4 域 `guoji-02-mp4-cdnguoji.guojitaolu.sbs`，支持 Range 且完整时长可加载；同条第二线路 `yazhou-02-mp4-cdn.yazhoutaolu.cyou` 当前证书域名错误。公开媒体域根路径跳转到 Backblaze B2 产品页，没有对象目录或元数据 API；按精确标题、条目 ID、文件 ID与域名检索均未找到独立索引。媒体文件可独立读取不等于目录可独立更新，故继续 pending，不写死 48 条快照。

### 当前无法核对

- `asmr`：用户保存的浏览器权限阻止访问对应参考子域。遵守浏览器限制，不通过其他浏览器或间接方式绕过；2026-08-13 用户决定暂时跳过，后续不再主动要求页面资料，直到用户恢复该项。
- `madou` / 看豆豆：用户于 2026-08-12 保存首页和一条详情页，连同两个资源目录共四项。前端契约为 `/api/nav`、`/api/list?page=&category|tag|rank|q=`、`/api/detail?path=`、`/api/play/{shareId}`；详情返回 `shareId` 后用 HLS.js 播放 `m3u8`。保存页面没有出现会员、积分、金币、购买或付费入口；2026-08-14 用户确认站点已更新，恢复为待接入。
- `bj`：2026-08-12 用户保存的浏览器权限阻止访问对应参考子域。遵守浏览器限制，不通过其他浏览器或间接方式绕过；2026-08-14 用户确认站点已更新，恢复为待接入。
- `tna` 已由用户主动保存并提供参考页面及完整前端资源，因此无需再操作受限的参考子域；已根据该离线证据与公开官方上游完成同源核对和接入。

### 看 JavBus（`ja`）用户决定

- 用户于 2026-08-12 现场确认该参考入口只有影片资料和磁力链接，不能在线直接播放。
- 用户明确决定跳过该站。它不进入当前在线视频 provider 范围；不实现磁力、下载或调用外部播放器，也不使用其他日语片源冒充 JavBus。

### 看 JavPorn（`best`）离线证据与排除决定

- 用户于 2026-08-12 保存首页、一条 `cawd-956` 详情页及两个资源目录。目录路由包括 `/list/latest`、`/list/popular`、`/list/most-viewed`、`/list/longest`、`/list/censored`、`/list/uncensored`、`/list/amateur`、`/list/english-subtitle`，另有分类、标签、演员、片商和 `/search?q=`。
- 详情路由为 `/v/{slug}`，播放器元素只带 `data-play-endpoint="/api/play/{slug}"`。前端会在打开详情后请求该同源接口，期待 JSON 中的 `m3u8_url` 与 `m3u8_proxy`；优先直连 HLS，失败后回退代理。`hls-direct.js` 还会从 PNG 外壳后提取 MPEG-TS 分片，说明播放依赖参考站专用媒体处理链，不能把页面路径当作独立公开上游。
- 保存的 `cawd-956` 页面没有落下 `data-hls-direct` 或 `data-hls-proxy`，故离线 HTML 无法调用原站同源接口，播放失败是预期结果。用户表示在线现场也显示无法播放；浏览器的保存权限规则阻止代理读取实时接口响应，已遵守限制停止，未通过替代浏览器或间接方式绕过。因此只能确认在线播放当时失败，不能断言具体是源失效、接口错误还是临时媒体地址失败。
- 首页未见会员、积分、金币、付费或购买入口；2026-08-14 用户确认站点已更新，`best` 恢复为待接入。

### 2026-08-15 终审结论（用户决定跳过，不再接入）

- 用户提供油猴脚本 `Richy.txt`（BestJavPorn 去广告与原生播放修复 v2.5.0，@include `(?:[^./]+\.)*bestjavporn\.com`）——纯广告拦截 + 播放器浮层修复，无源 URL 线索；确认上游为 `www.bestjavporn.com`，播放器是 blob iframe（`#playeriframe`，沙箱内 JW Player 直播正片），正片 m3u8 来自 streamplay。
- 参考站契约（用户登录态 console 导出，全部确认）：`/api/home`（最新/最多观看/热门 3×20 + 9 sections：最新/最多观看/热门/时长/有码/无码/素人/英字/减码）、`/api/list/{filter}?page=N`（20/页，latest 共 15013 页≈30 万条）、`/api/search?q=&page=`（14959 页）、`/api/play/{slug}` → `{m3u8_proxy（cfnav 私有 /proxy/hls/{token}，不用）, m3u8_url（直连）}`；详情 `/v/{slug}` SSR（发布日期/简介/相关推荐），播放器元素仅 `data-play-endpoint`（运行时 fetch，SSR 不预填）。
- **播放链独立可用（实测）**：`m3u8_url` = `apiraw2.streamplay.win/data/master.m3u8/{JWT}` → `index-v1-a1.m3u8?data=` → 分片在 TikTok CDN（`p16/p19-ad-site-sign-sg.tiktokcdn.com/ad-site-i18n-sg/...~tplv-d5opwmad15-ttam-origin.image?lk3s=&x-expires=&x-signature=`，5 秒/片，签名约 2 天时效），分片为 **PNG 外壳包 TS**（`image/png`，PNG 签名 + IEND 后 TS 数据，需前端解包——参考站 hls-direct.js 的 `unwrapPngSegment` 同款逻辑）。整条链不经 cfnav，直抓 200。
- **封面独立源（部分）**：上游封面在 `pics.pornfhd.com`（无 CF 直连 200，image/jpeg ~509KB）；prestige 系规律 `/mgs/images/prestige/{品牌小写}/{数字}/pb_e_{番号}.jpg`（abf-319 → `prestige/abf/319/`、dlv-006 → `prestige/dlv/006/` 两例吻合）；但非 prestige 品牌路径未知，主站 `pornfhd.com` 522（CF 源站超时，已死），无法遍历/归纳全品牌。
- **目录是入口级硬阻塞**：参考站 `/api/*` 无 cookie 全部返回 Linux.do 登录页（应用不能持用户会话）；上游 bestjavporn.com 为 WordPress（robots.txt 证实 `wp-includes`/`admin-ajax`），除 robots.txt 外全站 Cloudflare managed challenge（wp-json/search/uploads 全 403，curl 2 分钟 headless 不过 Turnstile）；30 万条实时目录无法一次性快照（1.5 万页请求）。
- **结论（用户 2026-08-15 决定跳过）**：与 `mt`（cfnav 私有票据）`qms`（目录登录墙）同型——目录/播放 JWT 均锁在参考站登录墙后，上游被 CF 保护。播放媒体链（streamplay/TikTok CDN）与封面 CDN（pics.pornfhd.com）独立是局部胜利，但无目录即无入口。**重新评估条件**：上游开放免 CF 的公开入口、pornfhd.com 复活并提供公开目录、或参考站 API 解除登录墙。

## 其他分类第一批筛查

- `xf` / 看推特：2026-08-14 用户确认站点已更新，恢复为待接入。
- `sjs` / 司机社：2026-08-14 用户确认站点已更新，恢复为待接入。
- `kankan` / 爱微社区：已更新，恢复为待接入。

## 秋名山直播补充结论

- 已确认参考站真实结构为 131 平台 → `/api/channels/{platformId}` → FLV/MSE 直播播放器，实测频道 readyState 4；不是录播目录。
- 2026-08-14 用户确认站点已更新，恢复为待接入；参考结构（131 平台 → `/api/channels/{platformId}` → FLV/MSE 直播播放器）仍为研究记录。
- **2026-08-14 复查结论（用户决定跳过，不再接入）**：
  - 参考站 `qms.cfnav.me` 与 qiying 相同有 cfnav.me 登录墙（Node 全 401）；用户浏览器登录态导出 `/api/platforms`（131 平台、约 12000 频道）与 `/api/channels/{platformId}`（每条含 `{id,title,image,imageFallback,stream,streamFallback,streamType}`）。
  - 频道封面/流多数落在保护 CDN（`camhaoer07.hfjqkc.com/7707`、`mandhhdhdnhzhc1kd.quanyuanhj.com/7701`、`17daskweter.hesurf.com/7701`），任意路径 403（S3 风格 AccessDenied），流地址被参考站 `/api/stream/{id}` 登录墙内代理隐藏，独立无法解析真实 FLV 规律。
  - 仅少数频道暴露直连阿里云 OSS（如 `zjkkdkdkd06.oss-ap-northeast-2.aliyuncs.com/zxcvb/1.flv`、`xiaodonzi.oss-ap-northeast-2.aliyuncs.com/VID_*.mp4`）：实测公开可读、FLV magic/MP4 正常、支持 Range，但无 CORS 头（浏览器需同源转发）。
  - 参考站自身播放亦不稳定：用户现场日志显示 `Fetch stream meet Early-EOF`（断流）后自动切下一频道才成功——直播断流为常态。
  - 因绝大多数频道流依赖参考站登录墙代理、独立上游不可得，且用户现场确认放弃，`qms` 保持 pending，不再要求导出全量目录或尝试接入。

## 栖影 / 91吃瓜网（`qiying`，2026-08-14 接入）

### 参考站真实上游

- 栖影参考站（`qiying.cfnav.me`）与看91 一样，是 91吃瓜网（Typecho 博客，官网自述"91吃瓜网-第一成人吃瓜色情资讯平台"）的聚合前端。列表/详情/图集/视频全部来自 91吃瓜网的发布内容。
- 主站域名从 91吃瓜网防失联页（用户提供）解码得到，多线路：
  - 线路一 `https://agency.nsguiiwz.cc`（实测 = 主站）、线路二 `https://being.nsguiiwz.cc`、线路三 `https://act.nsguiiwz.cc`、线路四 `https://d1jgfjfuhhmyma.cloudfront.net`（CloudFront）、`Powered by 91cg1.com`。
  - 注意 `91vip2x.com` / `91chigua.com` 等历史域名已被劫持/停用（页面显示 bilibili 视频），不能使用。
- 主站架构（Typecho）：帖子页 `/archives/{id}/`、分类列表 `/category/{code}/`（每页 30 条，卡片含 `loadBannerDirect` 封面、`h2.post-card-title` 标题、作者、日期、分类）、搜索 `/search/{kw}/`、RSS `/feed/rss/`。

### 播放链路（关键发现）

- 主站帖子页内嵌 DPlayer：`data-config='{"...","video":{"url":"https://op.vkjyoi.cn/videos5/{hash}/{hash}.m3u8?auth_key=..."}}'`。
- `auth_key` 由 91吃瓜网服务端生成（短时效，数分钟内过期）；无签名请求被拒：`op.vkjyoi.cn` 无签名 400、`as.bgqpnx.cn`（ts/key 域）无签名 403、`ffxddn` 线路当前断开（用户浏览器亦 ERR_CONNECTION_CLOSED）、`eisees` 家族域无视频镜像。
- 签名链实测（Node）：m3u8 200 → 清单内 ts/key 被改写为 `as.bgqpnx.cn` 并带各自 `auth_key` → ts 200（1MB/片）、key 200（16B AES key），全部 `Access-Control-Allow-Origin: *`。
- 结论：**视频必须点播时现爬主站帖子页拿新鲜签名 URL**，不能离线保存或复用 cfnav.me 的 `/api/hls`。签名私钥在服务端，不尝试复刻。

### 图片链路

- 主站帖子页图片属性 `data-xkrkllgl`（主站页只含部分图，如 120333 仅 8 张，而完整图集 18 张）；图集以主站帖子页实时解析为准（2026-08-15 起不再用镜像数据）。
- **2026-08-15 关键发现**：`pic.*.cn`（pic.uforxk.cn / pic.xustgq.cn 等）直连返回的是**加密字节**（magic `3e aa 70 8e 8e 51 91 ed`，非 JPEG `ff d8 ff`），浏览器 `<img>` 解码失败；正确通道是 `https://imgpublic.ycomesc.live{path}`（真 JPEG `ff d8 ff e0`，CORS OK）。所有图片（列表封面 `loadBannerDirect('...')`、详情图集、海报）必须经 `qiyingImageUrl()` 重写为 imgpublic CDN。

### 实时目录（2026-08-15 起，替代一次性镜像）

- 用户决定（2026-08-15）：**全站禁止快照/一次性导出数据文件，一律实时抓取**。`public/qiying/*.gz`（2.9MB 镜像）与 `scripts/prepare-qiying-data.mjs` 已删除。
- 实时端点全部实测可抓（Node/PowerShell 200）：
  - 列表 `/`、`/page/N/`：共 1246 页 × 30 卡；**每页 30 卡中约 15 张是广告卡**（`post-card-ads` class、无 `<h2 class="post-card-title">`、gif 封面），解析器按无标题过滤，首页展示 15 条真实帖子。
  - 分类 `/category/{slug}/` 与分页 `/category/{slug}/{n}/`（**注意是 `/{n}/` 不是 `/page/{n}/`，后者 404**）：23 个分类从首页导航解析（zxcghl/今日吃瓜 1224 页、mjmsjb/体育直播、sstp/实时偷拍、rsdg/最高点击、zdtop/91周榜、ydtop/91月榜、bcdg/必吃大瓜、whhl/网红黑料、mxhl/明星黑料、qwys/社会奇闻、mrds/每日大赛、dydj/AI短剧、lpsd/深夜撸片、hjll/海角乱伦、91th/91探花 69 页、crdm/成人动漫、xsjlb/师生专栏、fclv/反差靓女、tgqg/投稿求瓜、gcwh/网黄合集、aikj/明星AI、zptp/自拍偷拍、lqzk/猎奇重口）。
  - 搜索 `/search/{kw}/`：仅第一页可用（`/search/{kw}/{n}/` 404）；实测「哪吒」12 条。
  - 标签 `/tag/{slug}/`：第一页可用（如热搜 20 卡）。
  - 卡片字段：`p`(id)、`t`(标题，去热搜徽章)、`r`(封面，imgpublic 重写后)、`a`(作者)、`u`(datePublished ISO)、`k`(分类数组)、`hot`(热搜徽章布尔)。**搜索页卡片链接是绝对 URL**（`https://arrest.qxmrdvtu.cc/archives/{id}/`），id 正则需兼容相对/绝对两种形式。
  - 上游所有域名（nsguiiwz.cc/being/act）301 重定向到当前主站 `agency.qxmrdvtu.cc`（防失联机制，fetch 自动跟随）。

### 本地实现（provider `qiying`）

- 浏览器端（2026-08-15 重写）：实时列表（15 卡/页 + 分页 1/1246）、23 分类 Tab（点击即实时抓 `/category/{slug}/`）、搜索（实时抓 `/search/{kw}/`）、详情（实时抓 `/archives/{id}/`）；封面/图集直连 `imgpublic.ycomesc.live`；移除全部 gz 解压代码。
- worker 端：`qiyingPage`（主站多线路 failover 抓页面）、`qiyingParseCards`（列表/分类/搜索卡片解析，跳过广告卡）、`qiyingCats`（导航分类）、`qiyingExtractDetail`（解析 `data-xkrkllgl` 图片与 `data-config` 签名视频，支持多 DPlayer 块）、`qiyingImageUrl`（pic.*.cn → imgpublic.ycomesc.live）、`qiyingDetail`、`qiyingPlay`（`idx` 参数选第 N 个视频；主站无页面时返回 404「帖子已从主站删除，仅图集可用」）。
- 验收（headless Chrome，2026-08-15）：列表 15 卡、封面全加载（1280×1300px）、分类 30 卡、分类分页 2/1224、详情（图集+视频按钮）、搜索「哪吒」12 条、清除回 15 卡、播放 readyState 4 且 1280×720 推进、页面零错误。

## 看每日大赛 / mrds.com（`mr`，2026-08-15 接入）

### 参考站与上游同源证据

- 参考站 `mr.cfnav.me` API 登录墙（Node 401 返回 Linux.do 登录页 + CDK 激活）；图片/播放全走 cfnav 私有票据域（`media.cfnav.com/m/kan-mr/image/{token}`、`mr.cfnav.me/__cfnav_media/m/kan-mr/playlist/{token}`，`media.cfnav.com` 全站 Cloudflare challenge，Node 403）。用户浏览器登录态导出 `/api/meta`（21 分类）与 `/api/posts?page=1`（30 条，字段 `id/title/author/dateText/categories/coverUrl`，totalPages 1691）与 `/api/post/{id}` 详情（`textBlocks/images/videos[].playUrl`）。
- **真实上游 `mrds.com`（= `www.mrds66.com`，「每日大赛-实时吃瓜爆料平台」）**，与 91吃瓜网**同程序**（Typecho + Mirages 主题）：
  - `/api/meta` 21 个分类 slug（mrds/sjbq/ztds/rstt/xazd/blyp/fctg/mhds/lqdp/jdsj/mxwh/smdh/dypd/mtds/ysds/czds/hjds/tgds/omjp/qwcs/aijc）与 mrds.com 首页导航 21 项**完全一致**。
  - `/api/posts` totalPages 1691 与 mrds.com 首页分页 `1/1691` 一致；第一页 30 条 id/标题/作者与 mrds.com 首页 30 卡一一对应（如 188690「AI改编 咒术回战…」作者赛利亚）。**注意**：参考站总页数会随上游增长（旧记录 1677 → 现 1691）。
  - 参考站搜索页卡片为 `/archives/{id}/` 绝对/相对链接，与上游卡片同构。
- 上游域名：`mrds.com` 与 `www.mrds.com` 均 200（`http` 301 → https，CloudFront）；`www.mrds66.com` 为 canonical。首页卡片结构与 qiying 完全一致（`article.itemscope` → `div.post-card` → `h2.post-card-title` + `loadBannerDirect('...')` 封面 + `post-card-info` 作者/日期/分类；广告卡 `post-card-ads` 无标题需跳过）。首页 30 卡中约 27 条有标题（广告卡数量与 qiying 略不同，解析器按 `h2.post-card-title` 过滤即可）。

### 媒体链路（全验证，2026-08-15）

- **图片**：详情页 `data-xkrkllgl="https://pic.xustgq.cn/upload_01/..."`；`pic.xustgq.cn` 直连返回**加密字节**（magic `09 3d e3 b1 fc 4a f4 6f`，`content-type: binary/octet-stream`，CORS `*`）→ 复用 `qiyingImageUrl` 重写为 `https://imgpublic.ycomesc.live{path}`（真 JPEG `ff d8 ff e0`，CORS 无但 `<img>` 无需 CORS）。图片域与 91吃瓜网相同家族。
- **播放**：详情页 DPlayer `data-config` 内 `video.url = https://hls.dscxru.cn/videos5/{hash}/{hash}.m3u8?auth_key=...&v=3&time=0`（服务端签名，短时效）；m3u8 200 + CORS `*`；`#EXT-X-KEY:METHOD=AES-128,URI="https://ts.syjiaotong.mobi/videos5/{hash}/crypt.key?auth_key=..."` + IV；ts 分片与 key 均 200 + CORS `*`（ts 约 1.8MB/片、key 16B）。浏览器 hls.js 直连播放无需代理。
- **付费检查**：上游首页/分类/搜索/详情均无会员/VIP/付费/购买/金币信号，全站公开免费。

### 本地实现（provider `mr`，完全复用 qiying 解析层）

- worker 端：复用 `qiyingParseCards`/`qiyingCats`/`qiyingExtractDetail`（新增 `siteName` 参数默认「91吃瓜网」，mr 传「每日大赛」）/`qiyingImageUrl`；新增 `MR_ORIGIN = mrds.com` + `MR_MIRRORS = [www.mrds66.com, www.mrds.com]`、`mrPage`（镜像 failover）、`mrDetail`、`mrPlay`（`idx` 选第 N 个视频；帖子被删 404「帖子已从主站删除，仅图集可用」）、`mrList`（列表 `/`、`/page/N/`；分类 `/category/{slug}/` 与 `/{n}/`；搜索 `/search/{kw}/` 仅第一页）。`qiyingCats` 参数化接受已抓 HTML。
- 浏览器端：`QiyingPage`/`QiyingModal` 参数化 `provider`（api 前缀 `/provider-api/{id}`、来源名），qiying 与 mr 共用同一组件。
- 验收（headless Chrome，2026-08-15）：列表 27 卡 + 封面 27/27 加载、分类「每日大赛」28 卡、分页 1/1658 → 2/1658（30 卡）、搜索「小千」22 条、详情（图集 + 1 视频按钮）、**播放 readyState 4、1280×720 推进**、页面零 JS 错误（favicon 404 与 miss 健康检查 502 与 mr 无关）。

## 看禁漫天堂 / 18mh.net（`jm`，2026-08-15 接入）

### 参考站与上游关系（重要分歧）

- 参考站 `jm.cfnav.me` 的 `/api/meta` 自述 `sourceType: "18comic-web"`、note「数据来自 18comic 网页端 /album/* /albums /photo/*」，`/api/list` source 为 `https://18comic.ink`（旧库）：id 146 万级（如 1461564「[英雄联盟漫画]星守御姐们的Onlyfans直播秀」）、封面 `cdn-msp2.18comic.ink/media/albums/{id}_3x4.jpg?u=`、分类 10 个（doujin/single/short/another/hanman/meiman/doujin_cosplay/3D/english_site）。参考站 JS（app.js）另有 `/api/album?id=`、`/api/chapter?id=` 详情接口。
- **18comic.ink 主站全站 Cloudflare challenge**：Node 403、headless Chrome 也停在「请稍候… 安全验证」（`cdn-msp2.18comic.ink` 封面 CDN 仍可直连 200 真 JPEG）。
- **官方新站 `18mh.net`**：用户油猴脚本（Richy「18mh.net 去广告·隐私保护·保播放」）匹配 `18mh.net` + `jmtt1.net`；GitLab 官方仓库 `18mh-net/18mh-net`（2026-03-19 创建，README 公布：永久地址 18mh.net、免翻墙最新入口 `32b.azucyfo.com`、海外中转 `qkfmoba.cc`、TG `t.me/t_18dm_net`、邮箱 huijiadelu109@gmail.com）确认官方身份。
- **两库不同源**：18mh.net id 2.6 万级、路径 `/comic/*`；参考站旧库标题（星守御姐们的Onlyfans直播秀）在 18mh.net 搜索/详情均 404。按独立性规则（参考站同源 18comic.ink 无法独立抓取）接官方新站 18mh.net。
- 付费检查：18mh.net 首页/分类/排行/搜索/详情/章节均无会员/VIP/付费/购买/金币信号，全站公开免费。

### 站点结构（18mh.net，全部 Node 直抓 200）

- 导航：漫画 `/comic`（all/rank/hot/newest/freshest + 12 分类）、小说 `/novel`、视频 `/mv`。
- 列表 `/comic/all`：48 卡/页（SSR，`ul.dx-novel-list > li > a[href="/comic/detail/{id}"]`，`img[data-src]` 封面 + `alt` 标题 + 完结/连载徽章），总数见 `dx-filter-total（20476）`；分页 `/comic/all/page/N`。
- 分类 `/comic/all/{slug}`（rb 日本H漫 18882 条、hg 韩国H漫、jq 剧情、xy 校园、aq 爱情、bl BL、qh 奇幻、tj 调教、ll 乱伦、dp 短篇、db 单本、tr 同人）；**分页是 `/comic/all/{slug}/{n}`**（`/page/N` 404）。
- 排行 `/comic/rank`（220 卡，周/月/年榜 Tab，页面含 JSON-LD `itemListElement` 100 项含 author/genre）、热门 `/comic/hot`、最近更新 `/comic/newest`、最新上架 `/comic/freshest`（各 48 卡）。
- 搜索 `/comic/search/{kw}`：SSR 卡片，**仅第一页**（任何分页形式均 404）。
- 详情 `/comic/detail/{id}`：`data-comic-info` JSON（comic_type_name 类型/comic_tag_name 标签）、`<meta name="description">` 简介、章节列表 `<a class="detail-page__catalog-item..." href="/comic/chapter/{id}/{n}">`（内含 `chapter-badge`「第 N 话」+ `chapter-title` 话名；注意 class 属性是**单引号 + 尾空格**、href 前双空格，正则需宽松）。「开始阅读」按钮是 `detail-page__read-btn` 不含 catalog-item class，不会被误抓。**注意**：`a.detail-page__catalog-item` 块超 600 字符（含右侧操作区），`{0,600}?` 上限会漏抓，需 2000。
- 章节 `/comic/chapter/{id}/{n}`：`<img data-src="...">` 图片列表（54 图/话，懒加载）；标题「{漫画名} 第N话 - 高清漫画在线看」。

### 图片链路

- 封面/章节图都在 `pic.xmbvxj.cn`（与 kan91 同域家族），`?auth_key=` 签名参数**可省略**（无签名 200 同字节）；但**原图是加密字节**（magic `4f e8 97 a4` 非 JPEG）→ 必须重写为 `imgpublic.ycomesc.live{path}`（真 JPEG `ff d8 ff e0` / GIF），并去掉 `?auth_key`。复用 qiying 的 imgpublic CDN 即可。

### 本地实现（provider `jm`）

- worker 端：`JM_ORIGIN = 18mh.net` + `JM_MIRRORS = [32b.azucyfo.com]`、`jmPage`（镜像 failover）、`jmImageUrl`（pic.*.cn → imgpublic + 去 auth_key）、`jmParseCards`（兼容相对/绝对 href、`{0,4000}` 卡片上限）、`jmDetail`（data-comic-info + catalog-item 章节列表）、`jmChapter`（章节图片列表）、`jmList`（scope 参数 all/rank/hot/newest/freshest、category、q）。
- 浏览器端：新增 `JmPage`（两级 Tab：范围 全部/排行榜/热门/最近更新/最新上架 + 分类 13 项；搜索；分页仅「全部」显示）+ `JmModal`（详情 + 章节条 + 纵向阅读器 `.jm-reader`）。
- 验收（headless Chrome，2026-08-15）：列表 48 卡、分类「日本H漫」48 卡、排行 220 卡、搜索「姐姐们的调教」12 条、详情 70 章节、**阅读器 54 页全加载（720×3008）**、零 JS 错误（favicon 404 与 miss 健康检查 502 与 jm 无关）。

## 看麻豆 / madou.club（`madou`，2026-08-14 接入）

### 参考站与上游同源证据

- 参考站 `madou.cfnav.me` 登录墙（Node 401）；用户浏览器登录态导出契约：`/api/nav`（分类）、`/api/list?page=`（`{id,title,path,cover,views,likes,badge}`）、`/api/detail?path=`（`{title,path,shareId,tags,categories,views,likes,prev,next}`）、`/api/play/{shareId}`（返回 `__cfnav_media/m/kan-madou/playlist/{token}` 私有代理 m3u8）。
- **真实上游 `madou.club`（麻豆社-专注国产剧情中文对白小电影，WordPress）**：参考站 list 的 `path`（如 `/md0362-%e6%b7%ab%e5%83%a7...html`）与 madou.club 首页链接完全一致；参考站 `postid=28789` 与上游 `data-pid="28789"` 一致；分类名逐项一致（麻豆传媒、麻豆番外篇、HongKongDoll、PsychopornTW、91制片厂、果冻传媒、蜜桃影像、天美传媒、皇家华人、兔子先生、星空无限传媒、爱豆、麻豆导演系列、大象传媒、猫爪影像、精东影业、杏吧、乐播传媒、草莓、抖阴、SA国际传媒、起点传媒-性视界传媒、大鸟十八、小鹏奇啪行、女优淫娃培训营、淫欲游戏王、女神羞羞研究所、突袭女优家、情趣K歌房、KISS糖果屋 等 33 个）。

### 目录与搜索

- 首页/分类：`/`、`/category/{slug}/page/{n}`（每页 20 条）；搜索 `/?s={kw}`（WordPress 标准）；点赞排行 `/likes`（100 条）；`/week` `/month` 页面 200 但内容为空，未采用。
- 卡片结构：`article.excerpt` → `a.thumbnail[href]`（详情路径）、`img.data-src`（封面 `madou.club/covers/{date}/{hash}-240x180.jpg`）、`h2 > a`（标题）、`footer .post-like[data-pid]`（点赞）、`span.post-view`（观看）、`rel="category tag"`（分类）。
- 详情页：`h1.article-title`、`article-content > p > iframe[src=https://dash.madou.club/share/{shareId}]`（**注意 iframe 属性无引号**）、`article-tags`、`article-actions .action-like[data-pid]`、观看数、上一部/下一部、相关推荐。
- 付费检查：首页/分类/详情/搜索均无会员/VIP/付费/购买/金币/积分/充值/订阅信号，全站公开免费。

### 播放链路（关键发现，完全独立于 cfnav）

- 详情页 iframe 指向 `https://dash.madou.club/share/{shareId}`（DPlayer 播放器页面，公开 200，CORS `*`）。
- share 页内联脚本：`var m3u8 = '/videos/{shareId}/index.m3u8'; var token = "{JWT}";`，最终 URL `…/index.m3u8?token={JWT}`。JWT payload `{"access":"view","iat":…,"exp":iat+100}` —— **有效期仅 100 秒**，每次打开 share 页实时生成。
- 实测（Node）：m3u8 带 token 200（CORS `*`，AES-128 加密清单）；ts 分片与 `ts.key` **无需 token** 直接 200（CORS `*`，16 字节 key）；poster/thumbnails.jpg 直连 200。分享页 Referer 检查 `antiurl="https://madou.club"` 只影响 share 页自身渲染，不影响 m3u8/ts 请求。
- 结论：每次点播现抓 share 页拿新 JWT → m3u8 带 token → ts/key 直连。与 qiying 同模式，但无需登录、零 cfnav 依赖。

### 本地实现（provider `madou`）

- worker 端：`madouPage`（90 秒内存缓存）、`madouParseCards`、`madouList`（首页/分类 preset/搜索/点赞排行/分页）、`madouDetail`（详情字段 + shareId + 现抓分享页拼 m3u8）、`madouPlay`、`madouResolvePlay`。
- 前端：SitePage 通用列表/详情 + 33 个分类 Tab（`preset` 参数）+ 搜索；DetailModal 标准 HLS.js 播放。
- 验收（headless Chrome）：列表 20 卡片、分类 Tab 切换（麻豆传媒 20 条）、详情（MD0362 标题/观看/点赞）、点播放 → hls.js → readyState 4、1280×720、播放推进、搜索"苏畅" 20 条。测试链 sites 9/9、cloudflare 4/4 全绿。

## 好片 / haoqi7.com 破解记录（2026-08-14，未接入）

> 技术链路已完全破解并实测，但因上游反滥用封 IP 过严，用户决定放弃接入。代码已从工作区移除（恢复至 madou 提交 `487908d`）。以下为完整研究记录，供未来有新证据时参考。

### 参考站与上游

- 参考站 `hqw.cfnav.me` 登录墙（Node 401）；用户浏览器导出契约：`/api/categories`（14 分类 `{id,name}`）、`/api/recommend?page=&limit=&category=`（列表）、`/api/video/{id}`（详情）、`/api/search?q=`（游客搜索返回空）、`/api/play`（cfnav 私有 `__cfnav_media` 代理）。
- **真实上游 `haoqi7.com`（好妻网-首映好片，SolidStart + React）**：参考站 list 的条目 id/分类 id 与上游 API 完全一致；媒体在 CloudFront `d17e80montytxe.cloudfront.net`（源为 Cloudflare R2），视频 `web/raw/...`、封面 `web/static/*.ceb`（AES 加密）。

### 上游 API（全部实测打通）

- **游客登录**：`POST /api/v1/users/signin`，body `{verifyType:"anonymous", pid:"HQW", channel:"h5", uuid, inviteCode:"", captcha:"", key:"sFRUdDdCbu62vfSnrJaPedBRCyKyLu8m", url:"https://haoqi7.com/", t:"h", type:"guest"}`，headers 必须含 `referer/origin: https://haoqi7.com/`、`accept-language`、`t:"2", k:"2"`。返回 `data` 为 **AES-256-ECB(PKCS7) 加密**，密钥 = 同上 `key` 字符串（32 字节 UTF-8）；解密后是 **gzip(base64)** JSON `{resToken:{token: JWT}}`。
- **API 响应加密**：所有 `/api/v1/*` 响应 `data` 字段同样 AES-256-ECB + gzip(base64) 加密。请求头带 `token`（JWT）。
- 列表：`GET /api/v1/videos/recommend?page=&pageSize=` → `{videos:[{id,name,playCnt,likedCnt,price,payType,time,width,height,coverURL:"web/static/*.ceb",...}]}`。
- 详情：`GET /api/v1/videos/{id}` → `{video:{...,files:[{url:"https://haoqi7.com/api/v1/videos/m3u8pre/{id}/{id}/f.m3u8?s={签名}&p=20&h=haoqi7.com",...}], user:{...}}}`。
- **播放**：m3u8pre 签名 URL 直连 200（CORS `*`，AES-128，ts/key 在 `bvzjm.xiaomayipt.com` / `lhx7l.zzzjrcbank.com` 等边缘域，ts 带 `sign=时间戳-...` 时效签名）。
- **分类**：14 分类来自 SolidStart serverFn `GET /_serverFn/1354834ad42c8644691fcd33e28d91fbdbe39517f95959fe5811245de0ef4148`（Seroval JSON 响应，`{id,name}`）；分类视频列表 `POST /_serverFn/edb02c42c935ccf0aa4b61c9363d57fd40f78f6cce9a66e6fbb435ba70c148b4`，body 为 **Seroval 序列化** `{t:{t:10,p:{k:["data"],v:[...]}},f:63,m:[]}`，参数 `{cateId,page,pageSize,hasTop,hasGuide,compositeSort:4}` → `{guideCategories,childCategories:[{videos}]}`。Seroval 布尔节点 `true={t:2,s:2}`、`false={t:2,s:3}`（t:3 是 BigInt，勿混）。
- **封面**：`.ceb` 文件 AES-256-ECB 解密（密钥 `82758dd12749c777ef579f1839ceea6a`）后为 `data:image/jpeg;base64,...` 字符串。

### 放弃原因

- 上游反滥用：短时间多次请求即 `errorCode 1067 此ip已经禁止登陆`，换多个代理 IP 均被反复封禁（一次研究会话内封禁多次）。
- Cloudflare Pages 部署出口 IP 固定，大概率很快被封；复杂度（AES 解密 + Seroval + 风控）与单一入口的收益不成比例。用户 2026-08-14 决定放弃。
- **重开条件**：新证据表明封禁非纯 IP 维度（如可长期存活的匿名会话、稳定的签名请求模式）。

## 看蜜桃 / mt 复查结论（2026-08-14，未接入）

- 参考站 `mt.cfnav.me` 为 **Next.js App Router SPA**（登录墙，Node 401）。用户浏览器导出：首页 HTML + RSC payload + 关键 chunk。
- **目录结构**：layout 硬编码 15 个分类（`{id,name}`：10030 吃瓜、10001 动漫、10004 网黄、10031 麻豆、10036 国产、10011 AV、10039 三级、10016 SWAG、10032 OnlyFans、10018 裸舞、10010 少女、10003 欧美、10013 精选、10019 ASMR、10035 另类）；路由 `/category/{id}`、`/latest`、`/search?q=`、`/watch/{id}`、`/topic/{id}`；卡片字段 `{id, title, imagePath, createdAtText, duration, tags, playPreviewPath}`。
- **媒体链全部为 cfnav 私有**：播放 `https://mt.cfnav.me/__cfnav_media/m/kan-mt/playlist/{token}`（多线路 `sources` 数组 + `fallbackUrl:/api/media/{token}`）、封面 `media.cfnav.com/m/kan-mt/image/{token}`。`/api/media/{token}` 直接请求返回 **"media ticket expired"**（短时效票据，由 cfnav 服务端生成）。
- **上游源站**：Next.js 服务端 `SOURCE_ORIGIN` env 持有上游域名，客户端 bundle/RSC 均不暴露；服务端 fetch 不可见。
- **参考站自身播放失败**：研究期间打开 `/watch/65982` 无法播放（票据/媒体链路不稳定或已失效），与用户网络无关。
- 结论：无独立公开上游可建 adapter，与 qms/hqw 同类（cfnav 私有媒体封装）。用户 2026-08-14 决定跳过，保持 pending，不写代码。
- **重开条件**：获得真实 `SOURCE_ORIGIN` 上游域名 + 公开媒体路径的新证据。

## 看 Miss / missav.media（`miss`，2026-08-15 接入）

### 参考站与上游同源证据

- 参考站 `miss.cfnav.me` 登录墙（Node 401）。用户浏览器登录态打开 `/docs` 暴露 **FastAPI Swagger**：`/openapi.json` 列出 `/api/catalog`、`/api/home`、`/api/list/{section_key}`、`/api/movie/{video_code}`、`/api/search`、`/api/genres`、`/api/actresses`、`/api/makers`、`/proxy/hls`、`/proxy/cover/{video_code}`、`/proxy/preview/{video_code}`。
- **真实上游 `missav.media`（公开站，MissAV）**：参考站 `/api/movie/{video_code}` 返回的 `metadata_links` 指向 missav.media；条目 video_code、封面、预览、m3u8 与 missav.media 逐项一致。
- 分区映射（参考站 section_key ↔ 上游 `/cn/{key}`）：`new` 最近更新、`release` 新作上市、`today-hot` 今日热门、`weekly-hot` 本周热门、`monthly-hot` 本月热门、`chinese-subtitle` 中文字幕、`uncensored-leak` 无码流出、`fc2`、`heyzo`、`siro`。
- 全站公开免费：首页/分区/搜索/详情/分类/女优/发行商页面均无会员/VIP/付费/购买信号，无登录要求（仅首页年龄门 `.age-gate`，点击即过）。

### 媒体链路（全部公开直链，CORS `*`，无鉴权）

- 封面：`https://fourhoi.mrstcdn.store/{code}/cover-t.jpg`（列表缩略）/ `cover-n.jpg`（详情大图）；预览 `https://fourhoi.mrstcdn.store/{code}/preview.mp4`。
- 播放：详情页内联脚本含 `surrit\.mrstcdn\.store\\?\/([0-9a-f-]{36})`（seek 缩略图 URL 与 packer 混淆字典均含该 uuid）→ master `https://surrit.mrstcdn.store/{uuid}/playlist.m3u8`，多码率 360p~1080p。
- 实测（Node）：master 200（CORS `*`）；子清单/分片 200；**分片是 `.jpeg` 伪装的 TS**（magic `47401110`）；无 `EXT-X-KEY`（不加密）；清单里 `#EXT-X-TOKEN` 只是装饰，不带 token 也能播。

### 解析要点

- 卡片：`data-src="https://fourhoi.mrstcdn.store/{code}/cover-t.jpg"` + `alt="{标题}"` + 时长 badge；每页 12 卡，分页链接带 `dm{id}` 前缀，最后一页链接数即总页数。
- 列表路径：分区 `/cn/{section_key}?page=N`；搜索 `/search/{kw}?page=N`（**不是** `/search?q=`）；分类/女优/发行商 `/cn/{kind}/{slug}?page=N`；genres/actresses/makers 索引页也是 SSR（名称+条数），用作前端 tab 计数与 preset。
- 详情：og:title / og:image、`<meta name="duration" content="秒">`、`<time datetime>` 发行日期、`<span>番号/发行商/导演:</span>`、女优/类型链接。
- 女优提取用 `/dm\d+\/cn\/actresses\/([^"]+)` + decodeURIComponent；类型提取必须过滤 sidebar 无 `dm` 前缀的链接（如 "VR"），否则污染 `vod_remarks`。
- 年龄门：headless 验证必须先点 `.age-gate button`（localStorage `cf-age`），否则卡片为 0。

### 本地实现（provider `miss`）

- worker 端：`missavPage`、`missavAsset`、`parseMissavCards`、`missavPageCount`、`missavList`（preset 支持 `genre:`/`actress:`/`maker:` 前缀 + 分页 + 搜索）、`missavDetail`（字段 + uuid → m3u8 直链，无代理无缓存）。
- 前端：10 个分区 Tab + 搜索 + 标准 HLS.js 播放（直连 m3u8/ts，零 cfnav 依赖）。
- 验收（headless Chrome，2026-08-15）：列表 12 卡片、10 tabs 逐个可用、搜索（SNOS）12 条、详情（SNOS-334 · S1 · 肉尊 · 2026-08-07）打开、点播放 → hls.js → videoWidth 640x360、paused:false、time 推进、12 张封面全部 200/ok、页面零错误。

## 看糖心Vlog / tangxinvlog.pro（`tx`，2026-08-15 接入）

### 参考站与上游同源证据

- 参考站 `tx.cfnav.me` 登录墙（Linux.do 登录页），无登录态无法访问内容；用户登录态 console 导出 API 契约（`/api/home`、`/api/videos?page=`、`/api/videos/{slug}`、`/api/artists`、`/api/artists/{name}`），SPA hash 路由 `#/`、`#/videos`、`#/artists`，页脚「内容来自公开源站,仅作聚合展示」。
- **同源铁证**：参考站 `/api/videos?page=43` 返回 `{"error":"Upstream HTTP 404 for https://tangxinvlog.pro/videos/43/"}`——参考站后端实时抓取 `tangxinvlog.pro`，两边同为 42 页封顶。
- **逐项核对**：988 部 = 41×24 + 第 42 页 4 条；第 42 页 4 条（标题/720p/时长/博主）与参考站逐条一致（含「人形兔兔」标题双空格细节）；首页 12 条 slug/标题/博主/时长一致；参考站 `西野加奈` 详情 24 条/1 页（参考站截断），上游博主页实为全量（本地直接接上游全量，如饼干姐姐 79 部）。
- 参考站无搜索（`/api/search` 404）→ 本地隐藏搜索框对齐体验。
- 上游线索来源：用户提供的油猴下载脚本（`Richy.txt`，tangxinvlog.pro 抓流解密脚本）确认域名/防盗链/AES-128，仅作参考，不复制其逻辑。

### 上游结构（Astro v6.3.1）

- 列表：`/videos/`（24/页）、分页 `/videos/{n}/`（`<nav class="pagination">` `current` 如 `2 / 42`）；首页 `/` 12 条最新；博主页 `/artists/{name}/` 全量一页（header 含作品数/身高/三围/本站粉丝/全网粉丝/简介）。
- 卡片：`<a class="video-card" href="/videos/{slug}/">` + `<img src="https://t.5gcdn.xyz/videos/{cdnId}/cover.jpg" alt="{标题}">` + `.quality`（1080p）+ `.duration`（MM:SS）+ `.title` + `.meta span`（博主）。
- 详情：`<video id="player" data-src="https://t.5gcdn.xyz/videos/{cdnId}/index.m3u8">`、`<h1>` 标题、`.row`（博主链接 + 日期 `YYYY-MM-DD` + 时长）、`.tag`、`.video-desc`、猜你喜欢 12 卡。
- 博主卡片：`<a class="artist-card" href="/artists/{name}/">` + `<img src="/avatars/{name}.jpg" width="120">` + `.name` + 两个 `.stat`（作品数、全网粉丝）。

### 媒体链路（防盗链 + AES-128，必须同源代理）

- 播放清单为 **AES-128 加密**：`#EXT-X-KEY:METHOD=AES-128,URI="enc.key",IV=0x64cf...`，4 秒/片 `segN.ts`（约 706 片），清单内全相对路径。
- **防盗链**：`t.5gcdn.xyz` 无 CORS 头，且不带 `Referer: https://tangxinvlog.pro/` 即 403（浏览器跨域被 CORS + 403 双拦截）；博主头像同源无 CORS。
- **代理设计**：全部媒体走 `/provider-api/tx?action=media&path=...`（worker 带 Referer/UA 抓取 + 返回 CORS `*`），path 白名单 `videos/{cdnId}/{file}` 或 `avatars/{name}.jpg`；m3u8 内**分片与 key 均重写为代理绝对 URL**。
- **关键坑（实测）**：key 行 `URI="enc.key"` 必须一并重写，否则 hls.js 基于 manifest URL（`/provider-api/tx?action=media&...`）把目录解析成 `/provider-api/`，请求 `/provider-api/enc.key` → 404 → 永远卡加载。
- 直测（Node + 浏览器）：m3u8 200（~66KB）、seg 200（~1.4MB）、key 200（16B）、封面/头像 200 image/jpeg。

### 本地实现（provider `tx`）

- worker 端：`tangxinPage`（Referer/UA）、`tangxinMediaUrl`、`parseTangxinCards`、`tangxinPageCount`、`tangxinList`（preset `home`/`videos`/`artist:{name}`；videos 为上游页式分页直接返回该页 24 条，artist 为全量切片 24/页）、`tangxinArtists`（46 位，media_kind `artist`）、`tangxinDetail`（m3u8/博主/日期/时长/标签/简介/猜你喜欢，vod_play_url 为代理 m3u8）、`tangxinMedia`（代理 + m3u8 分片/key 重写）。
- 前端：3 个 Tab（最新/全部作品/博主）；博主 tab 渲染 46 位圆形头像卡片，点击进该博主作品列表；隐藏搜索框（参考站无搜索）。
- 验收（headless Chrome，2026-08-15）：首页 12 卡、全部作品第 2/42 页（24/4 条）、博主索引 46 位（头像/作品数/粉丝）、饼干姐姐作品列表 24 卡、详情打开、**1080p AES-128 播放推进**（currentTime 11~15s、1920×1080、buffered 43s+），零 cfnav 依赖。

## 看肉视频 / rou.video（`rou`，2026-08-15 接入）

### 参考站与上游同源证据

- 参考站 `rou.cfnav.me` 登录墙；用户登录态 console 导出 API 契约：`/api/home`（9 sections）、`/api/video/{id}`、`/api/search?q=`、`/api/tag/{tag}`、`/api/cat`，SPA hash 路由 `#/`、`#/cat`、`#/tag/{tag}`、`#/v/{id}`，播放器为 ArtPlayer + MSE（blob src）。
- **同源铁证**：参考站 `/api/video/{id}` 的 `data.siteDomain` 字段直接返回 `"https://rou.video"`；条目 id 两边逐条一致（首页首条同为 `cmsslmkd30000s6zfbq1icg6h`）；`stream.videoUrl` 与本地从上游 `/v/{id}` 页 `ev` 解密得到的 URL 结构逐字一致（`https://v.rn2xx.xyz/hls/{id}/{id}-720/index.jpg?v=6&exp=...&auth=...`，连 exp 相同）；封面同域 imgproxy（`v.rn221.xyz/m/...`，`czM6Ly9yb3V2L2hscy97aWR9L2NvdmVyLmpwZw.jpg` = base64「rou/hls/{id}/cover.jpg」）。
- **逐项核对**：搜索「糖心」参考站 totalPage 39 = 上游 39；标签「糖心Vlog」参考站 1804 = 上游 1803（`/cat` count）；`/api/cat` 的 4 groups（gcAV/madouAV/v91/onlyfans，198 标签）与上游 `/cat` pageProps 完全一致（如糖心Vlog count 1804 两边相同）；参考站 9 sections 与上游 `/home` 9 sections 一一对应（最新上传 16、今日热门×5 各 15-16、热门×3 各 15）。
- 参考站私有接口一律不用：播放走其 `/api/playlist/{id}?q=` + `/api/proxy?url=`（cfnav 代理），封面另有 `coverProxyUrl`（media.cfnav.com）；本地全部直连上游。

### 上游结构（Next.js App Router SSR）

- 首页 `/home`（`/` 仅 9KB 空 pageProps）：`latestVideos[16]`、`dailyHotCNAV[16]`、`dailyHotSelfie[15]`、`dailyHot91[15]`、`dailyOnlyFans[15]`、`dailyJV[15]`、`hotCNAV[15]`、`hotSelfie[15]`、`hot91[15]`、`clickADUDomain`。
- 条目字段：`{id, vid(null), name(繁), nameZh(简), description, ref(原站URL如 https://xchina.co/video/id-... 或站内 /slug/), tags(繁), published, publisher, createdAt, updatedAt, viewCount, likeCount, dislikeCount, duration(秒), archived, sources:[{resolution:720, folder:"{id}-720"}], coverImageUrl}`。
- 分类 `/cat`：pageProps `{gcAV[57], madouAV[36], v91[73], onlyfans[32]}`，tag 形如 `{id:"糖心Vlog", count:1804, parent:"國產AV", level:0}`。
- 标签 `/t/{tag}?order=createdAt&page=N`：26/页，`{tag, tagZh, order, videos, pageNum, totalPage(如糖心Vlog 70), totalVideoNum(1803), tagsOF/tagsForCNAV/tags91(侧栏标签)}`。
- 搜索 `/search?q={kw}&page=N`：26/页，`{videos, q, t, sort, pageNum, totalPage(39), totalVideoNum(1000 截断), hotSearches[10]}`。
- 详情 `/v/{id}`：pageProps `{video(同上字段), relatedVideos[8+], siteDomain:"https://rou.video", defaultQuality:720, ev:{d:base64,k:number}}`；**ev 解密 = `atob(d)` 每字节减 k → `JSON.parse` → `{videoUrl, thumbVTTUrl}`**（与用户提供油猴脚本逻辑一致，仅作参考）。

### 媒体链路（签名 HLS，无加密，同源代理转发）

- 封面 `v.rn221.xyz/m/{key}/rs:fit:1280:0:0:0/wm:1/{base64源路径}.jpg`：**imgproxy 直链、无防盗链**（无 Referer 200 image/jpeg，img 标签直连即可）。
- 播放 `v.rn2xx.xyz/hls/{id}/{id}-720/index.jpg?v=6&exp={1天时效}&auth={签名}`（`.jpg` 伪装 m3u8；码率档 `-720`/`-1080`/`-480` 按视频实际存在，替换不存在的档返回 400）。
- 清单：`#EXTM3U`、每片 10 秒、**无 EXT-X-KEY（未加密）**；分片为**独立签名 URL**（多域名 `v.rn213.xyz`/`v.rn212.xyz` 等，`.jpg` 伪装 TS，magic `47 44 11 10`）。
- **无 CORS 头** → 浏览器播放需同源代理：`/provider-api/rou?action=media&url={完整签名URL}`（白名单 host `^v\.rn\d+\.xyz$` + path `^/hls/`，其余 400；m3u8 响应把分片行重写为代理绝对 URL，query 完整保留；thumbVTT 同走代理）。
- 直测（Node + 浏览器）：m3u8 549 行重写正确、分片 200（~1.95MB）、thumbVTT 200、evil host 400、封面带 Referer 也 200。

### 本地实现（provider `rou`）

- worker 端：`rouPage`（UA）、`rouParseNextData`（`__NEXT_DATA__`）、`rouPageData`、`rouDecodeEv`（字节减密）、`rouAssetUrl`、`rouFormatCount`（万）、`rouNormalize`、`rouVideosResponse`（26/页）、`rouList`（preset `home`/`cat`/`tag:{tag}` + `wd` 搜索）、`rouDetail`（ev 解密 → vod_play_url 代理 m3u8 + relatedVideos 8 条）、`rouMedia`（白名单代理 + m3u8 分片重写）。
- 前端：3 个 Tab（首页/分类/标签）；首页渲染 9 sections（最新上传 16 + 8 个热门分区，qiying-card 复用）；分类渲染 4 组 198 标签（组内排布）；标签平铺全部 198 标签按 count 降序；点击标签 → 该标签分页列表（`tag:{tag}` preset）；搜索保留（上游 `/search`，26/页，39 页封顶）。
- 验收（headless Chrome，2026-08-15）：首页 9 sections 137 卡、封面 137/137 直链加载（lazy 需滚动触发）、详情打开、**720p 播放推进**（1280×720、currentTime 5.9s、readyState 4）、分类 4 组 198 标签、糖心Vlog 标签列表 26 卡分页、搜索「糖心」26 卡 39 页、无 JS 错误，零 cfnav 依赖。
