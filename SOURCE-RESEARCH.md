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
- 2026-08-16 修正 `cdn.adultiptv.net` 的分片路由特性：真实 TS 分片**只在根路径**提供（`/milf-*.ts`=640KB `47 40 00 10`），`mycamtv/` 子路径分片请求全部 200 回退为 pornstar 清单（1107B）→ hls.js 挂死。本地 manifest 代理现把每个分片行重写为 `https://cdn.adultiptv.net/{basename}`；批量探测 39 路：24 路根路径流正常、13/15 路 mycamtv 重写后可播、asian-girls/blowjob 两路 CDN 上已下线。
- oxax 详情页实时生成 `https://s.oxax.tv/{channel}/index.m3u8?k=...`，另有 `r.pokaz.me` 备用，签名不能写死。后续确认参考源页实际是可匿名访问的 `http://oxax.tv/{slug}.html`，不是原 adapter 使用的 `https://oxax.tv/{数字}`。源页以 `kodk`、`kos` 和编码 Playerjs 模板拆分签名；本地现已还原该组合，并加入只允许 `s.oxax.tv` / `r.pokaz.me` 的 HLS 清单与分片代理。`oh-ah` 和 `superone-hd` 的混淆标记插入位置不同，本地两项样本测试均可逐字还原浏览器现场请求的完整签名 URL。

### 海角原站匿名接口（`hj`，2026-08-16 已接入）

- 列表：`https://www.haijiao.com/api/topic/hot/topics?page={page}`（20/页，total 上限 1000）。
- 详情：`https://www.haijiao.com/api/topic/{topicId}`。
- 返回格式：JSON 外层 `data` 为三层 Base64 包装（`JSON.parse(atob(atob(atob(text))))`），与参考站 `decode.js`（hj.cfnav.me/js/core/decode.js）逐字一致；无需 cfnav Cookie 或登录令牌。
- 视频边界：未购买帖子只返回约 30 秒的 `_i_preview.m3u8`（25 片 × 1.25s）；`video_time_length` 字段标秒数，`sale.amount` 金币购买。
- **完整正片（2026-08-16 验证，匿名可拉、无需金币/登录）**：preview 文件名用附件 id（`{attachId}_i_preview.m3u8`）但 ts 分片名用**另一词干**（`{attachId2}Y{hash}_i{n}.ts`）；完整 m3u8 = 同目录 `{attachId2}Y{hash}_i.m3u8`（= ts 名 LCP + `.m3u8`，`hjTsStem` 实现）。两帖实测：2227731 → `13839670Y6Y1dNJG_i.m3u8` 200、1664.4s、1338 片；2232393 → `13875705kWCmgZhI_i.m3u8` 200、992s（= `video_time_length` 991s）。KEY 行（`enc_{attachId2}.key`）与 IV 与 preview 相同。注意 `{attachId}_i.m3u8`（preview 名去 `_preview`）404——反推必须走 ts 分片名。
- **图片 `.txt` 解密（无 AES）**：`pic.hj*.top/hjstore/images/...{hash}_mini.jpg.txt`（缩略）与 `{hash}.jpg.txt`（全图）为自定义 base64（字母表 `ABCD*EFGHIJKLMNOPQRSTUVWX#YZabcdefghijklmnopqrstuvwxyz1234567890`，`*`=标准 `+`、`#`=标准 `/`）；decode 输出即 `data:image/jpeg;base64,...`（JPEG magic `ff d8 ff db`，18KB 样本）。实现 `hjImgDecode` 自实现字母表 → 字节 → UTF-8 修正。
- **视频播放**：m3u8 `https://ts10.hj260302818.top/hjstore/video/{date}/{hash}/{id}_i_preview.m3u8` → 200 + CORS `*`、AES-128（`#EXT-X-KEY:METHOD=AES-128,URI="enc_{attachId}.key",IV=0x...`）、ts 相对路径 `{attachId}Y…_i{n}.ts` 25 片。
- **key 变换（wasm）**：`.key` 返回包装 key（16B `6c6bbb5b45f346beb39b4068d9ad3568`）；真 key = 官方 wasm `jquery_key(key_ptr,16,r_ptr,r_len)`（`https://www.haijiao.com/js/jquery.wasm`，12825B，emscripten 单函数，imports 仅 env `{_abort_js, emscripten_resize_heap}` + wasi `{fd_close,fd_write,fd_seek}`；`/js/jquery.js` 是 createModule 封装）；`r` = fetch m3u8 同目录 `.jpg` 文本 atob（固定字符串 = 上游泄露的 MongoDB 凭据，两个视频验证一致——**不写死进代码**，`action=key` 每次现抓）。真 key 样本 `0104d53c2a9724849cb4210cb4c45b52`，AES-128-CBC(真key, IV) 解出合法 TS `47 40 11 10`（PID 17）。
- 分区树 `/api/topic/nodes_by_ver/v2?ver=`（128 节点，`{nodeId,parentId,name,icon}`）、分区帖子 `/api/topic/node/topics?type=1&nodeId=X&page=N`、搜索 `/api/topic/searchV2?q=&page=&limit=`（total 上限 10000）。
- 详情字段：`{topicId, user{nickname,avatar,vip}, node{nodeId,name}, title, type, money_type, liteContent, viewCount, commentCount, likeCount, createTime, attachments[{id,remoteUrl,category:"images"|"video",coverUrl,video_time_length}], hasVideo, hasPic, hasAudio, is_cream, is_top, is_hot, is_original, content(HTML), sale{amount,buyCount,is_buy}, reward, doors, folderId, currentUserPurchased}`；`/api/address/{id}` → 400（参数不对，未继续）；匿名详情无 keyPath。
- 官方站 `/home` 为 Vue SPA（app.88b7fde2.js + chunk 映射），`/` 是防失联跳转页。
- 实现：worker 端 `hjB64Decode`/`hjImgDecode`/`hjEnsureWasm`（wasm base64 内嵌、模块级缓存）/`hjKeyTransform`/`hjApi`/`hjList`/`hjCats`/`hjDetail`/`hjPlay`/`hjImg`/`hjKey`/`hjPlaylist`；`action=media` 重写 m3u8（KEY 行 URI → `/provider-api/hj?action=key&u=&j=`、ts 行 → 绝对直连）；前端复用 QiyingPage/QiyingModal（QiyingModal startPlay 改动态 provider）。catalog 注册 `hj`。
- 验收（headless Chrome，2026-08-16）：列表 20 卡、封面 8/8 加载、详情 14 图、**1080×1920 播放推进**（3.46s→7.46s、readyState 4）、分区「伦理之爱」20 卡、搜索「视频」20 卡、零 JS 错误。构建与 9 项测试通过。零 cfnav 依赖。

### 海角油猴脚本线索（`C:\Users\z6798\Downloads\Richy.txt`，2026-07-23.3，2026-08-16 用户提供；**已验证有效并实施**）

- 用户的海角专用脚本「m3u8提取+去广告-原位播放+跳转/历史版」，匹配 `*://haijiao.com/*` 与 `*://*/post/details*`。功能：剪贴板劫持拦截（`#copy-input` 隐藏复制框 + focus/select/setSelectionRange/execCommand/Clipboard API 五重钩子）、全站去广告（CSS + MutationObserver + 落地弹窗清理，保留登录/VIP/支付业务弹窗）、sessionStorage 历史、m3u8 捕获（XHR + fetch 双通道 + Performance 兜底）。
- **m3u8 评分体系**（分数越高越像完整正片）：100 = `/api/address/` 反推主 m3u8（脚本旧逻辑核心，最可信；我们实测 `/api/address/{id}` 400，其正确参数未复现）、90 = topic 附件/预览反推完整源、80 = media、70 = DOM/播放器 hook、50 = 普通 m3u8、40 = 正文文本扫到、20 = Performance、10 = 疑似预览、0 = 不可用。
- **getRealVideoSrc（ts 分片名反推主 m3u8）**：master playlist 优先取子 m3u8；media playlist 用全部分片名求最长公共前缀（LCP）→ `{prefix}.m3u8`：老帖 `1159940.ts/1159941.ts → 115994.m3u8`，新帖 `xxx_i0.ts/xxx_i1.ts → xxx_i.m3u8`。
- **candidatesFromPreviewUrl（预览→完整片候选）**：`xxx_i_preview.m3u8 → xxx_i.m3u8`、去 `-preview`/`.preview`/`_pre`/`/preview/` 等变体，逐个 fetch 验证是合法 playlist（`#EXTM3U`）后记为完整源。
- **isLikelyPreviewPlaylist**：`#EXTINF` 总时长 ≤45s 且 ts 数 ≤50 判为试看（老帖 URL 常无 preview 字样）。
- `decodeEncryptString`：三层 `atob`（与我们的 `hjB64Decode` 一致）。
- **验证结论（2026-08-16，已实施）**：候选 `xxx_i.m3u8`（preview 名去 `_preview`）实测 404；**正确反推 = ts 分片名 LCP + `.m3u8`**（`getRealVideoSrc` 分支），且**匿名可拉、无需签名/登录**。实现：`hjPlaylist` 先拉 preview playlist → `hjTsStem` 求 ts 名 LCP → 探测 `{stem}.m3u8`，合法即用完整片、否则回退 preview。headless 验收播放越过 preview 31s 极限（duration 1664s、推进至 45.2s）。`/api/address/`（评分 100 的最可信源）正确参数仍未复现，未采用。

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

## 爱看 / 香蕉视频（`xo`，2026-08-17 已接入）

- 参考前端标注上游 `https://h5.xxoo473.org`；登录态下 `/api/*` 路径全部回退为 SPA 页面本身（前端路由），但 `app.js?v=20260806-public-playlist1` 与 `player-policy.js` 匿名可抓，源码注释直接写明「数据源: https://h5.xxoo473.org」并暴露全部接口路径（同源铁证）。
- 接口全匿名可用（`https://h5.xxoo473.org/api`）：列表 `/v2/vod/listing-{cateid}-{areaid}-{yearid}-{definition}-{duration}-{freetype}-{mosaic}-{langvoice}-{orderby}-{page}`（16 条/页，总 42815 条/2676 页，pageinfo 全量分页）、分类树 categories（cateid 16 香蕉原创/5 制服诱惑/6 清纯少女/7 辣妹大奶/8 女同专属/9 素人出演/10 角色扮演/11 成人动漫/12 人妻熟女/13 变态另类）、排序 orders（1 好评/2 播放/3 评分）、搜索 `/search?wd=&page=`、详情 `/vod/show/{id}`（vodrow + categories + similarrows + likerows）、短视频 `/minivod/*`。列表字段：vodid/title/coverpic/preview_url/play_url/view_price/vip_price/duration/scorenum/upnum/definition/yearname。
- 播放：`/vod/reqplay/{id}` 基本全站 VIP 锁定（retcode 5 "VIP独享内容"；无额度时 retcode 3 带 httpurl_preview）。**参考站 app.js 内置 Richy 解锁（源码注释 `Richy-style: preview KEY → full master when reqplay is VIP-locked`）**：拉 preview m3u8 的 KEY URI `https://{cdn}/{date}/{id}/{bitrate}kb/hls/key.key` → 反推完整 master `https://{cdn}/{date}/{id}/index.m3u8`（多码率 STREAM-INF）→ 指向完整 `index.m3u8`（AES-128，key 相对路径、TS 绝对 URL）。
- 媒体链全 CORS `*` 匿名直连：preview 与 master/key/TS 在 mymb041.com（8u3m21v5b / st21v5 等子域，每片独立域）、preview 入口 preview2.k18e7j.com、封面 aqsmimg3999.sbs。实测 83835 完整片 678 分片/2035.7s（33:55 与详情标注一致）、key 16B、TS 200。
- **状态：专用已验收。** `kanxo` adapter 已实现并本地 headless 验收：列表 16 卡、详情解析完整片、1920×1080 readyState=4 currentTime 推进、零 JS 错误。参考站同款 VIP 锁定→Richy 解锁策略完全复刻，零 cfnav 依赖。

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

## 看 Miss / missav.media（`miss`，2026-08-15 接入，2026-08-16 上游 CF 挑战阻塞）

### 2026-08-16 上游 CF 挑战调查（用户要求查明参考站为何能过 CF）

- **现状**：missav.media/.ai/.ws/.fans/.live/123.com/njavtv.com 全部返回 Cloudflare「Just a moment」托管挑战 403。实测矩阵：完整浏览器指纹头（sec-ch-ua/UA/Accept-Language/Sec-Fetch-*）→ 403；headless Chrome（真实引擎）→ 卡「请稍候…/安全验证」页（8s 无解）；DoH（cloudflare-dns.com）解析 A 记录正常（172.64.x.x / 104.26.x.x = CF 边缘）→ 排除 DNS 污染；missav.com 已被扣押并变 **ThisAV**（title "ThisAV - 世界最高の無料アダルト エンターテイメント サイト"，无 missav 卡片）。
- **参考站路线（已查明架构）**：`miss.cfnav.me` 是 **FastAPI 后端**，`/openapi.json` 契约：`/api/catalog`、`/api/home`、`/api/list/{section_key}`、`/api/movie/{video_code}`、`/api/search`、`/api/genres`、`/api/actresses`、`/api/makers`、`/proxy/hls`、`/proxy/cover/{video_code}`、`/proxy/preview/{video_code}` —— 即**服务器端代抓 missav + `/proxy/*` 媒体代理**，浏览器端零直连上游。参考站存活但本机 403 ⇒ CF 挑战按出口 IP/指纹放行差异（参考站部署在海外服务器或走 cfnav 通道；其 FastAPI 无浏览器会话也能工作，排除"登录会话"假设，最可能是**出口 IP 不在 CF 风控名单**）。
- **未验证项（交给可开真实浏览器 + 登录态的 agent）**：(a) 用户浏览器直连 missav.ai 是否 200（验证 CF 是否仅拦截本机出口）；(b) 海外 IP（如代理/VPS）请求 missav.ai 是否放行；(c) 参考站 `/api/movie/{code}` 在登录态下的响应是否仍含 missav 直链 metadata_links；(d) 是否有未套 CF 的 missav 新镜像（域名轮换频繁）。
- **决策**：记录为「上游 CF 挑战阻塞」，与 hqw/sjs/qms 同型但路线可查（参考站 FastAPI 代抓 → 若海外 IP 可过 CF，可考虑独立的海外代理方案；需先由另一 agent 确认 (b)）。

### 参考站与上游同源证据（2026-08-15，当时 .media 无 CF 可直接抓）

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

## KanOne / 看ONE（`one`，2026-08-15 调查后用户决定跳过）

### 参考站结构（Next.js SPA，全部 API 在 Linux.do 登录墙后）

- 入口 `one.cfnav.me`：`/api/bootstrap` POST（登录会话内）→ `{ok, uuid, hotKeywords[59]（含「镇ONE之宝」「限时免费」「抄底」「抽奖」等运营词）, imgServers[13], cdnList[11]}`；uuid 缓存在 localStorage `kanone-session-v2`。
- `/api/search` POST `{uuid, keyword, page, limit}` → `{ok, items:[{id, modelId, thumb/thumbnail/thumbTiny(cfnav 私有 ticket), title, subtitle, isLimitFree, seriesCategory, number, publishedAt}], page, keyword, hasMore}`——**参考站首页就是 hotKeywords 标签流**（默认「限时免费」），无独立最新列表。
- `/api/detail` POST `{uuid, id}` → `{ok, detail:{id, modelId, title, subtitle, description, content(HTML), actor, author, tags[], tagList[{id,slug}], thumb/thumbnail(私有 ticket), multiplePic[], multiPicThumbnail[], videoFile, previewVideo, videoHls(/api/media?token= 私有代理), videoHlsH265(直链), quality, size, length, views, likeNumber, buys, downloadCount, collectionNumber, shareNumber, replyCounts, publishedAt, isLimitFree, coin, originalCoin, isLike}, streamUrl, mediaKind, thumbUrl}`——**coin/originalCoin/buys 是上游计费体系字段**。
- `/api/comments` POST `{uuid, articleId, page}`；`/api/image?url=` 代理外部图片（非 `media.cfnav.com/m/kan-one/` 的 http URL 走代理）；`/api/download?url=` 下载代理。
- Node 直连：全部 API + 静态 chunk 均 401（登录墙）；用户浏览器会话内可正常调用。

### 独立媒体链（已验证，全部 CORS `*`）

- 图床：`imgpw807.s7n7ue8.com` / `imgpw807.2u7qzt7.com` / `jmt612.xqjby.com` / `jmtp616.youguancm.com` `/storage/thumb/{id}/{hash}.jpg|webp` → 200/206 + CORS `*`（真 JPEG/WebP，如 `55873/6a7faf41ef290.jpg` 101KB）。`/storage/thumb/` 是该站群唯一开放路径，其余路径 403。
- MP4：`dlmk0129.scycjz.com` / `dlmk0129.fwn9vj.com` / `dlmk0129.bx7qxb.com` / `dlmk0129.upmf83.com` 等 `/one/compress/decry/vd/{日期}/{base64(10hex 视频ID)}/{HHMMSS}/{WxH}/aac/h265/mp4/decrypt/{token}.mp4` → 206 + CORS `*`、`ftyp isom` 明文全片（实测 454MB/617MB、Range 正常），无需 Referer/签名；路径中 base64 段解码为 10 位 hex（如 `ZWY2YjAyOGQ0M`→`53f71ac0f6`）。
- HLS：`1vy79bws04jv.gdliren123.com` / `eyf08pws05jv.gdliren123.com` `/encry/vd/{同结构}/hls/decrypt/index.m3u8` → 返回**加密字节**（非文本清单，decrypt 名不副实）不可直用——有 MP4 即够，忽略。
- 域名群规律（同一套防封镜像站群）：`dlmk0129`×4 域、`0325api`×5 域、`imgpw807`×2 域、`vd.qmq85ps.com`/`vd.47d1fc4.com`、`su0220vd.3ca7yj.com`、`kwgewx01dl.mfpt8g.com`、`ppfgfj02dl.scycjz.com`、`1vy79bws04jv/eyf08pws05jv.gdliren123.com`、`jmt612`/`jmtp616`。
- DoH 解析：图/视频 CDN 域 → `23.197.86.x`（Akamai）；`0325api.*` → `23.62.46.x`（Akamai）；`jmt612.xqjby.com` → `218.12.76.167` / `121.22.232.169`（中国电信直连源站，本机 DNS 污染无 A 记录）。

### 上游 API 与 S3 桶

- `0325api.*` 为 Swoft（PHP）API 服务（错误信息暴露 `/home/www/api/vendor/swoft/...`）；60+ 常见路由探测全 500「Route not found」或 403，swagger/openapi/.env 均不可得。
- **S3 桶公开列表**：`jmt612.xqjby.com/`（无参数）返回 `ListBucketResult`（bucket `one-fruit-new`，1000 keys/页）：
  - `/oneVideo/hls/one/{日期}/{视频ID}/index.m3u8 + index{n}.ts`（757 keys，但均为 **2022 年旧数据**，如 `20220727/022120-001-carib-C`）
  - `admin/jiami/storage/...`（222 keys 图片）、`admin/jiami/avatar`（14）、`admin/jiami/images`（3）
  - 桶内文件全部 403 不可下载；分页全部 403（`?marker=`、`?prefix=`、`?list-type=2`、`?continuation-token=`），仅无参数列表返回 200（其余变体是 CDN 缓存同一响应）。
- 结论：S3 桶是历史备份/存储暴露，非实时目录源。

### 跳过结论（用户 2026-08-15 决定）

- 与 `mt` 同型：**媒体链（图/MP4）完全独立是局部胜利，但目录/搜索/详情全部锁在参考站登录墙后**；上游 Swoft API 路由不可得；S3 桶非实时目录。不实现。
- 重新评估条件：上游网页站（非镜像 CDN）公开可访问、0325api 路由暴露、或 S3 桶放行文件读与分页。

## 私房 TV / sf.cfnav.me（`sf`，2026-08-17 浏览器探测）

### 参考站导航与接口

- 使用内置浏览器的现有登录态打开 `https://sf.cfnav.me/`；首页标题为「私房TV」，导航包含「最新 / 自拍 / 偷拍 / 主播实录 / 欧美 / 日本 / 免费专区」及排序「最新 / 最多观看」。卡片 hash 路由形如 `#/watch/{id}?category=2`，详情页包含标题、ID、时长、日期、清晰度、播放线路 1~8、精彩画面和相关推荐。
- 页面脚本实际请求：`GET /api/meta`、`GET /api/videos?category=New&page=1&sort=start_date`、`GET /api/videos/{id}?category=2`、`GET /api/play/{id}?method=0&category=2`。分页按钮会把 `page=1` 改为 `page=2`（首页 964 页）；分类按钮把 `category=New` 改为 `category=1/2/3/6/wmov/free`；排序下拉把 `sort=start_date` 改为 `sort=hot_count`。搜索提交在当前浏览器 UI 中没有改变 hash；按前端路由手动打开 `#/?q=情深叉喔` 后确实发出 `/api/videos?...&q=情深叉喔`，但返回「没有找到内容」（已知首页存在同标题卡），因此搜索当前应视为后端未实现/失效，而不是独立可用搜索。
- 未携带登录态的 Node/curl 请求对上述四类接口均返回 **401 Unauthorized**；参考站接口是登录墙，但页面本身的字段契约已通过渲染结果确认（列表卡片：id/title/date/views/duration/category；详情：title/id/date/resolution/description/线路；播放返回 blob 下的 DASH）。

### 媒体链路与结论

- 登录态浏览器打开首条详情后，播放器的 `video.currentSrc` 为 blob，底层资源为 `https://14.29.46.204/aboxVOD/.../manifest.mpd`（路径中含授权后生成的长 opaque token），并继续请求同目录 MPEG-DASH 分片。浏览器实测 `readyState=4`、854×480、约 1757 秒，播放可推进。
- 这里要区分两个站：**SF 参考站本身不是试看**——登录态的 `SFA9301` 是 29:17（1757 秒）完整时长并可播放；「正在播放预览，VIP 可免费观看完整视频」是反查到的 `gcav.club` 候选上游页面文案。GCAV 对同一批条目匿名只给 `preview_mp4/{id}.mp4`（约 60 秒），完整 `/v/{id}/manifest` 仅在它判定账号有权限时返回；不能把 GCAV 的 VIP 门槛误写成 SF 的播放器限制。
- 登录态内置浏览器抓到完整媒体请求：`https://14.29.46.204/aboxVOD/mp4:{opaque-token}/manifest.mpd`，同目录继续请求 `chunk_*_mpd.m4s` 视频/音频片段；首条详情 `SFA9301` 实测 `readyState=4`、854×480、1757 秒。相同详情连续刷新两次得到的 manifest URL 长度均 974，但 token 有 357 个字符不同，证明是每次播放动态生成；它由 `/api/play/{id}` 返回，未发现可从页面公开重建的签名算法。
- 按站名继续挖到的 `sifangs.com` / `sifang.online` 会跳转到无关的「杏吧」站，`sifangtv.one` 是另一个公开影视站（数字 `/v/{id}`，搜索「大宇1」无结果、标题/ID 与 SF 不匹配），均不能认定为 SF 上游。
- 继续按标题、片长和页面来源反查，发现 `gcav.club`（别名 `gcav.me`、`gcav.run`、`cnav.live`）是一个可公开浏览的 GCAV 目录站，和 SF 共享同一批近期条目及 `gc.skylines.pro` 媒体 CDN。逐条对上了同标题，部分片长也完全一致：`SFA9301`「大宇1-今天约了个兼职美女 人美逼遭罪」↔ GCAV `58497`（29:17）、`SFA9325`↔`58494`（53:32）、`SFA9332`↔`58493`（38:55）、`SFE13566`「超纯腼腆的小妹妹【叮当猫】…」↔`56266`（28:48），以及 `SFR11337`「情深叉喔,合租室友肉体勾引」↔ GCAV `58476`（33:06）；`SFA9311`/`58496`、`SFA9318`/`58495` 也同标题但当前页面片长有数十秒差异。这个结果足以证明同库/同批分发，但仍不能把 GCAV 直接等同于 SF 的完整源站：GCAV 的 `/search/{关键词}` 和 `/video/load?block={block}&page=N` 是公开实时 HTML/JSON 目录，详情 `/v/{数字 id}` 公开预览 `https://gc.skylines.pro/preview_mp4/{id}.mp4`；对应上述条目页面均标记 `has_access=false`、VIP `$6/月`，匿名请求 `/v/{id}/manifest` 返回空响应。只有 GCAV 明确免费条目（例如 `7863`）才会返回 `.../videos/{id}/{uuid}/manifest.m3u8`，该 manifest 可匿名拉取，但不覆盖 SF 当前条目。
- **结论（2026-08-17 继续深挖后）：保持门户 PENDING，不实现 adapter。** 目前有希望接入的是「同库目录 + 公开试看」或未来找到 GCAV/同 CDN 的正式授权完整源；SF 自身的完整 DASH 仍依赖登录态 `/api/play` 生成的长 token，不能写入长期配置，也不能通过猜 URL 绕过 GCAV VIP。重新评估条件：找到不依赖 cfnav 登录的公开 token/manifest 生成接口，或上游明确开放完整播放（含稳定目录、详情、搜索和可持续媒体链）。
- **优先级拆分**：SF 整站（需要完整播放）放在已确认公开上游的站点之后；免费子集可以单独继续核对，但必须逐条证明「公开目录 → 详情 → 完整媒体」链路。当前 SF 免费专区抽样的 `SFE12758`、`SFE12738`、`SFE12741` 在 GCAV 对应条目仍是 `has_access=false`、manifest 空，尚不足以先做一个只显示试看或假装免费完整的 adapter。VIP/完整链路只有在出现独立公开授权接口后再做，不绕过登录或付费控制。

## 98堂 / 98.cfnav.me（`98`，2026-08-17 浏览器探测）

### 参考站与源站线索

- 使用内置浏览器进入年龄确认后，首页标题为「Kan98 · 高清视频」，导航含首页、热门、最新、分类和搜索；分类入口可见国产自拍、中文字幕、日韩无码/有码、欧美风情、剧情三级、卡通动漫等。
- 页脚写明「源站 CDN 直连播放」并明确给出 `https://dmn12.vip`。进入年龄提示后确认：它就是公开可浏览的 Discuz 论坛「98堂[原色花堂]」，不是只有静态 JSON 的未知站。
- 源站分类页为服务端 HTML：`/forum-41-1.html`（国产自拍，当前 1017 页）、`/forum-109-1.html`、`/forum-42-1.html`、`/forum-43-1.html`、`/forum-44-1.html`、`/forum-45-1.html`、`/forum-46-1.html`，分类 ID 与参考站 7 个分类一一对应。分页链接是 `/forum-{fid}-{page}.html`。
- 源站搜索是 Discuz 表单：`POST /search.php?searchsubmit=yes`，字段 `mod=forum`、`srchtxt`、`srchtype=title`、`srhfid`；提交后跳到 `GET /search.php?mod=forum&searchid=0&searchmd5=...&orderby=lastpost&ascdesc=desc&searchsubmit=yes&kw=...&page=N`。实测关键词「西野」返回 1716 条、58 页，并包含参考条目 3691532。
- 参考站前端加载 `/data/site.json`、`/data/groups.json`、`/data/categories.json`、`/data/videos.json`；这些是参考门户自己的受保护快照，未携带登录态四个 `/data/*` 和 `/api/play/*` 均为 **401 Unauthorized**，不作为本地数据源。

### 媒体链路与结论

- 源站详情页 `/thread-3691532-1-1.html` 的首帖容器公开带 `data-tid="3691532" data-pid="69011960" data-vid="G260815038"`；标题/ID/时长与参考站完全一致。第二条 3691530 也逐项匹配（`pid=69011935`、`vid=G260815037`）。
- 源站播放器脚本为 `forum_viewthread.js` + `hls.min.js` + `DPlayer.min.js` + `player-2.1.js?t=20260622`。播放请求为 `GET /play.php?callback=...&tid={tid}&pid={pid}&vid={vid}&rand={random}&_={timestamp}`，浏览器直接得到 JSONP：`callback({"k":true,"msg":"获取成功","data":{"flvurl":"https://tyjs.ypxjft.cn/.../index.m3u8?auth_key=..."}})`。实测每次响应的 `auth_key` 会变化，必须实时请求。
- 同一媒体 CDN 的 manifest、16 字节 `key.key`、首个 TS 均可无 Cookie HTTP 200，CORS 为 `*`；HLS 使用 AES-128，manifest 的 `#EXT-X-KEY` URI 为 `key.key`、IV 为全 0。
- 匿名 curl 直接访问 dmn12 分类/详情/搜索/`play.php` 会遇到 Cloudflare managed challenge（403），不是账号 401；内置浏览器可通过年龄页。已按用户授权的年龄流程在研究 adapter 中动态读取公开 `safeid` 并重试 `_safe` cookie。**Pages 边缘实测已通过**：列表 200（1017 页/30 卡）、搜索「西野」200（58 页/30 条，包含 3691532）、详情 3691532 200（tid/pid/vid 正确）、动态 HLS manifest/key/TS 全部 200+CORS。
- `providers/runtime.js` 的 `kan98` adapter 已在 Pages 边缘验证有效，并已注册到 `PROVIDERS`/`ROUTE_CONFIGS`；门户 98 卡现在显示 ONLINE。真实本地 Node 仍可能被源站 CF challenge 拦截，因此本地开发若出现来源 502 属出口差异，Pages 部署端是当前可用出口。
- 部署端完整用户链路验收：`/site/98` 列表 24 卡，封面经 `/provider-api/kan98?action=image&url=` 受限代理后 24/24 加载；分页第 2 页 24 卡；搜索「西野」返回 24 卡；同源条目 3691532 详情可打开，动态 HLS 播放 `readyState=4`、时间推进，详情海报回填正常。参考站的 210 条静态快照与 dmn12 实时 1017 页目录数量/排序不相同，这是独立实时源的预期差异；参考子站专用热门/最新/分类壳与本地通用详情弹窗仍有 UI 差异，但浏览→搜索→详情→播放链路可用。
- **状态：专用已验收（Pages 边缘）。** 实现实时抓 dmn12 HTML（分类/搜索/详情）→ 从 `data-tid/pid/vid` 调 `play.php` → 直连 `tyjs.ypxjft.cn` HLS；没有复制参考 `/data/*.json` 快照。

## Pornhub 公开目录与播放（`ph`，2026-08-17 调查，尚未实现 adapter）

> **定位说明**：Pornhub 不在参考站 38 个入口范围内，本调查是用户单独要求的实验性来源，不影响任何参考入口的保真声明。用户明确要求「先调查、不改代码」，以下结论供后续单独实现时使用。用户提供的油猴脚本 `docs/Richy (13).txt`（Pornhub 去广告 v1.1.0）在本架构中**不需要也不能直接复用**（见下文「与 Richy(13) 的关系」）。

### 目录 / 列表 / 搜索（全为服务端 HTML，Node 直抓 200，无 CF challenge）

- 首页最新：`https://www.pornhub.com/video`，分页 `?page=N`（如 `?page=10`）。
- 搜索：`https://www.pornhub.com/video/search?search={kw}`，分页 `&page=N`。实测「asian」200、1.2MB HTML、38 个 `data-video-vkey`。
- 分类：`https://www.pornhub.com/video?c={id}`（如 `c=732` Audio Impaired），分页 `&page=N`，排序 `&o=mv|tr|lg|cm`（Most Viewed / Top Rated / Longest / Newest）。分类目录入口：首页顶部菜单 `Top Categories` 的 `js-topCategories` 子菜单含固定链接（如 Lesbian `?c=27`、MILF `?c=29`、Anal `?c=35`、Threesome `?c=65`、Mature `?c=28`、Ebony `?c=17`、Japanese `?c=111`…，以及 `/categories/teen`、`/categories/hentai` 等 slug 页）；完整分类页 `/categories` 被 Premium 网关覆盖，不能从那里抓分类树。
- **卡片解析要点**：每个视频是 `<li class="pcVideoListItem ...">`，关键字段：
  - 视频 key：`data-video-vkey="69b42af149bd7"`（38 个/页）。
  - 详情链接：`<a href="/view_video.php?viewkey={vkey}" title="{标题}">`。
  - 封面：`<img src="https://ei.phncdn.com/.../{编号}/original/(m=...)(mh=...){seq}.jpg" alt="标题" loading="lazy">`（部分卡是 `pix-fl.phncdn.com` 的 `?hdnea=` 签名封面，需单独处理或改用 `ei.phncdn.com` 原图）。
  - 时长：`<var class="duration">16:40</var>`。
- 搜索框提交形式为 `?search=`，URL 编码中文可用（实测首页菜单含 `/video/search?search=%E8%84%B1%E8%A1%A3%E8%88%9E` 等）。

### 详情（`/view_video.php?viewkey={vkey}`，Node 直抓 200）

- 标题：`<h1>` 或 `<title>`。
- 时长：`"video_duration":659`（秒）。
- 封面：`<meta property="og:image" content="https://ei.phncdn.com/...original/(m=...)(mh=...)14.jpg">`（200、真实 JPEG `ff d8 ff e0`、约 41KB）。
- **播放列表（关键）**：页内联脚本有 `mediaPriority:"hls","mediaDefinitions":[{...}]`。解析方法：定位 `mediaDefinitions` 后取第一个 `[` 做方括号配对到配平的 `]`，整体 `JSON.parse`（数组内 URL 是 `\/` 转义形式，JSON.parse 可正常还原）。每个条目字段：
  - `format: "hls"`：`quality`（1080/240/480/720，注意是数字字符串）、`height/width`、`videoUrl` = `https://iv-h.phncdn.com/{token},{exp}/hls/videos/{date}/{id}/{quality}P_{bitrate}K_{id}.mp4/master.m3u8?validfrom=...&validto=...&ipa=1&hdl=-1&hash=...`。
  - `format: "mp4"`：`videoUrl` 是 `https://www.pornhub.com/video/get_media?s={jwt}`，实测直接 GET 返回 `[]`（空数组），完整 MP4 参数未复现——**实现时优先 HLS，不要依赖 mp4**。
- 可选：`og:video` 指向 240p 示例 MP4（`ev.phncdn.com` 签名，仅在 640×360 下可用，不作为主源）。

### 媒体链路（全部 200 可拉，但**无 CORS → 必须同源代理**）

- `master.m3u8`：200、标准 `#EXT-X-STREAM-INF`（1920×1080 等），子清单相对路径 `index-v1-a1.m3u8`。
- `index-v1-a1.m3u8`：200、VOD playlist、分片相对路径 `seg-{n}-v1-a1.ts`、无 `#EXT-X-KEY`（**未加密**）。
- TS 分片：200、真实 MPEG-TS（首字节 `47 40 00 10`、约 159KB/3-6s）。
- 封面：`ei.phncdn.com` 200 真实 JPEG。
- **关键约束**：`iv-h.phncdn.com` / `ei.phncdn.com` / `ev-h.phncdn.com` / `ev.phncdn.com` / `pix-fl.phncdn.com` 全部**不返回 `Access-Control-Allow-Origin`**（实测 null）→ 浏览器 hls.js / `<video>` 直连会被 CORS 拒绝。实现必须照搬 `tx`/`rou` 的同源代理方案：media 走 `/provider-api/ph?action=media&url={全URL}`（host 白名单限上述 phncdn 域），代理转发时补 `ACAO: *`，把 master/index 里的分片行重写为代理绝对 URL。
- **签名时效与 IP 绑定**：mediaDefinitions 的 URL 带 `validfrom/validto`（约 2 小时窗口）且 URL 路径含 `{token},{exp}`；MP4 签名参数含 `ip=`（抓取时出口 IP）。每次打开详情必须实时现抓、不能缓存。本地（同一出口 IP）抓取与播放一致，可播；**部署到 CF Pages 后媒体必须全程走代理（用 CF 出口 IP 抓签名并代理转发）**，且视频流量大，违背「媒体尽量直连」原则——本地玩合适，部署端不建议作为主要媒体通道。

### 免费边界

- 普通视频（非 Premium）匿名详情直接给出 240~1080 完整 HLS，**无试看、无需登录、无 VIP 门槛**；这是与 missav/rou 同级的公开免费源。
- 含 Premium 内容的页面会插网关弹层，但 mediaDefinitions 仍会给出完整 HLS；实现时若发现目标条目 mediaDefinitions 缺失或为空，标记为不可播即可，不实现绕过付费逻辑。

### 与 Richy(13) 的关系（为什么不需要它）

- `docs/Richy (13).txt` 是匹配 `*://pornhub.com/*` 的页面去广告油猴脚本：拦截 TrafficJunky 等广告域名、MutationObserver 隐藏广告元素、patch `window.MGP.createPlayer` 清空 `mainRoll/flashSettings` 的 pre-roll/pause/post-roll、拦截广告导航。
- 本项目播放器不加载 pornhub.com 页面，而是**用自己的 HLS.js 直接播 mediaDefinitions 的 HLS**——原站广告是页面内注入的，我们根本没有原站页面，所以「免广告」天然成立，脚本机制在本架构中无从生效。若未来想内嵌官方 `/embed/{viewkey}` iframe，才需要考虑广告清理，但本项目首选自建播放器，不走 embed。

### 反爬风险（实现前必须读）

- Pornhub 对高频抓取敏感（参考 `hqw` / haoqi7 的封 IP 教训）。本地手动点播/低频率测试可以，**不要做高并发目录抓取**；adapter 应带最小超时与失败退避，避免被上游封出口。
- 当前本机（Node UA + accept header）实测首页/搜索/分类/详情全部 200，无 CF challenge、无年龄墙；后续是否变化需复测。
- 搜索「asian」实测命中；搜索中文需注意 URL 编码与 Pornhub 的搜索词规范化（搜索页无 `showing` 计数 div，总条数不易拿，可只提供 `pagecount` 兜底值）。

### 实现要点（供后续实现者）

1. `providers/catalog.js`：新增 `ph` provider（name「Pornhub 公开目录」、upstream `www.pornhub.com` + `*.phncdn.com` 媒体 CDN、capabilities「列表/搜索/分类/详情/HLS 播放」）。**不写入 `ROUTE_CONFIGS`**（Pornhub 不是参考入口；若要本地访问，用未映射的直接路由或临时演示页，不污染 40-node 门户保真）。
2. `providers/runtime.js`：`phList`（抓 `/video` / `/video/search` / `/video?c=` 三选一 + 分页，解析 `li.pcVideoListItem`）、`phDetail`（抓 `/view_video.php?viewkey=`，解析标题/时长/封面/mediaDefinitions）、`phMedia`（同源代理，host 白名单 `(?:iv-h|ei|ev-h|ev|pix-fl)\.phncdn\.com`，转发时补 `ACAO:*`，重写清单分片行为代理绝对 URL）、卡片字段映射（`vod_id`=vkey、`vod_play_url`=`/provider-api/ph?action=media&url={master}`、`media_kind="video"`、`type_name="PORNHUB"`）。
3. 前端：可复用现有 QiyingModal/DetailModal 的 hls.js 播放路径；参考 `tx` 的媒体代理交互方式。
4. 验证：列表 24 卡 + 封面加载 → 详情 → hls.js 播放推进（readyState=4）→ 分页/搜索/分类，零 console 错误。
5. 文档：实现后更新 `PROJECT-HANDBOOK.md` 对应记录与 `SOURCE-RESEARCH.md` 本节状态；`npm run build` + `npm run test:sites` 必须通过。
