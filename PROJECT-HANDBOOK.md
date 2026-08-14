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
- 不绕过付费、购买、登录或其他访问控制。海角未购买内容只允许使用公开预览，不恢复完整付费媒体。
- 用户最新固定决定（按整站处理）：只要某个参考站出现任何 VIP、付费、购买或登录限制内容，该站点整体暂不介入，连免费子集也不接；当前只完成目录和播放全部公开免费的站点，禁止实现任何解锁或“预览升级完整片源”逻辑。

## 2. 当前总体状态

| 项目 | 当前状态 |
|---|---|
| 本地入口 | 38 个；原 39 个参考入口中的看板娘游戏已按用户决定移除 |
| 独立 provider | 11 个：GDLSP、HStream、LeakGallery、Eporner、麻豆AI、PMVHaven、TNAFlix、iptv-org、RedGifs、oxax.tv + AdultIPTV、91porna |
| 真实匹配完成 | 8 个完整：麻豆视频 AI、PMV 视频、观番、OnlyFans 图集、EPORNER、TNAFlix、影视聚合、看91；看TV 进入部分可用 |
| 被撤销的替代映射 | 22 个 Eporner/RedGifs 关键词替代入口已移除，不再计入完成 |
| 看板娘游戏 | 用户明确取消，不进入、不接入，已从本地导航移除 |
| 视频阶段 | 第一轮筛查已结束：7 个完整匹配、看 TV 部分可用；15 个原排除站已更新并恢复待接入；仅看主播因缺独立动态目录保持 pending |
| 下一项 | `qiying`（栖影）已接入并本地验收（本地镜像目录 + 主站签名视频播放）；ASMR 按用户决定暂时跳过；看 TV 的 41 路 oxax 品牌直播已实现、待可出网部署环境逐路验收 |
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
| 1 | `one` | KanOne | 影视 / cinema | — | — | 整站暂缓（非全站免费） | 首页以“限时免费”为单独分区，并同时出现抽奖、抄底等非纯免费入口；参考站还依赖私有 `/api/bootstrap` 会话 UUID、详情接口与带时效媒体 token。按整站免费规则不接免费子集，也不复用私有会话。 |
| 2 | `game` | 看板娘游戏 | 游戏 / game | — | — | 用户取消 / 已移除 | 用户明确表示该游戏不需要进入、没有用途。已从本地导航和待办移除，后续不再研究或接入。 |
| 3 | `ai` | 麻豆视频 AI | 影视 / cinema | MadouAI | — | 专用已验收 | 参考前端明确指向 `www.madouai.xyz/api/v1`；已接真实分类目录、搜索、分页、详情、封面代理与 HLS 播放。参考站当前误把搜索词传入会忽略 `keyword` 的列表接口，导致搜索仍显示默认内容；本地使用真正的 `/videos/search?q=`，因此保留正常搜索效果。此入口与 `madou` /「看麻豆」不是同一站。 |
| 4 | `hj` | 看海角 | 社区 / feed | — | — | 整站暂缓（含购买） | 已确认匿名列表、详情和三层 Base64，但完整内容存在购买边界。按整站规则不再接公开预览子集，不实现购买内容或任何解锁路径。 |
| 5 | `91` | 看91 | 影视 / cinema | kan91 | play | 专用已验收 | 已接 91porna.com 真实分类目录（正在播放/本月热门/原创）、搜索、分页、详情（作者/播放数/时长/日期）、封面 AES 解密代理与 AES-128 HLS 播放；浏览器直连媒体域（CORS 全 `*`）。 |
| 6 | `qms` | 秋名山直播 | 直播 / live | — | — | 待接入 | 待接入。 |
| 7 | `mr` | 看每日大赛 | 社区 / feed | — | — | 待接入 | 待接入。 |
| 8 | `xf` | 看推特 | 社区 / feed | — | — | 尚未加入 | 待接入。 |
| 9 | `sjs` | 司机社 SJS | 社区 / feed | — | — | 待接入 | 待接入。 |
| 10 | `qiying` | 栖影 | 影视 / cinema | qiying | — | 专用已验收 | 真实上游为 91吃瓜网（Typecho，`agency.nsguiiwz.cc` 等防失联线路）。本地镜像目录来自参考站 media-data 导出（23368 条；其中 4383 条为有标题的活动帖，18985 条为无标题废弃存档、主站已删，列表已过滤）；列表/搜索/分页/26 分类 Tab/标签/图集全部用镜像数据（浏览器 gzip 解压内存过滤）。2026-08-14 复核实测：有标题帖在主站 100% 存在（抽样 20/20），带视频帖 100% 有服务端签名 m3u8（抽样 19/19），多视频帖按 dplayer 块序与镜像一一对应（`action=play&idx=N` 逐个播放）；视频经 worker 实时抓主站帖子页 `data-config` 内签名 m3u8 直连浏览器播放（ts/key 走 `bgqpnx.cn` 带签名，CORS 全 `*`），帖子被删时返回友好 404「帖子已从主站删除，仅图集可用」。图片直连 `pic.uforxk.cn` / `imgpublic.ycomesc.live`。参考站数据仅一次性导出用，运行期零依赖。 |
| 11 | `tx` | 看糖心 Vlog | 影视 / cinema | — | — | 待接入 | 待接入。 |
| 12 | `lg` | 看 OnlyFans | 图集 / gallery | LeakGallery | — | 专用已验收 | 热门、创作者搜索、详情、图片和 MP4；媒体来自独立 CDN。 |
| 13 | `hxc` | 看含羞草 | 影视 / cinema | — | — | 整站暂缓（上游含 VIP / 私有媒体） | 登录后复核 9984 部、416 页以及列表/搜索/详情/完整播放；参考播放走 `/api/video/play` 后进入私有 `__cfnav_media/m/kan-hxc/playlist/*` 与分片路由。原始含羞草接口字段明确包含 `isVip`、`isBuy`、`isNeedLogin`、`isTemporarilyFree`，并区分预览地址；按整站免费规则不接入，也不使用任何预览升级或 VIP 解锁逻辑。 |
| 14 | `hqw` | 好片 | 影视 / cinema | — | — | 待接入 | 待接入。 |
| 15 | `book` | 有声读物 | 音声 / audio | — | — | 待接入 | 待接入。 |
| 16 | `dj` | 轻看短剧 | 影视 / short | — | — | 尚未加入 | 待接入。 |
| 17 | `swag` | SWAG | 影视 / short | — | — | 整站暂缓（含付费） | “短影音”分区为免费，但切换“动态”后明确显示大量“付费”条目；按整站规则连免费短影音也不接。公开封面来自 `public.swag.live`，只保留来源证据。 |
| 18 | `pmv` | PMV 视频 | 影视 / cinema | PMVHaven | — | 专用已验收 | 已确认参考站 24 位 ID、65006 条目录、标签、封面、详情与 MP4 均来自 PMVHaven；本地直接接公开列表/详情与匿名搜索页面数据，浏览器直连其独立媒体 CDN。 |
| 19 | `mt` | 看蜜桃 | 影视 / cinema | — | — | 待接入 | 待接入。 |
| 20 | `rou` | 看肉视频 | 影视 / cinema | — | — | 待接入 | 待接入。 |
| 21 | `fj` | 观番 | 动漫 / anime | HStream | — | 专用已验收 | 目录、搜索、详情、临时 CSRF 播放元数据、多线路 MP4。 |
| 22 | `kankan` | 爱微社区 | 社区 / feed | — | — | 整站暂缓（VIP / 金币） | 首页与最新、热推目录大量明确标记 VIP 或金币；不是全站免费，按规则整站暂缓。 |
| 23 | `9s` | 看九色 | 影视 / cinema | — | — | 整站暂缓（含付费） | 分类中明确存在“非付费”，首页亦出现“有偿”条目，说明不是全站免费；按整站规则不接任何免费子集。 |
| 24 | `zb` | 看主播 | 影视 / live | — | — | 研究已确认、尚未接入 | 已确认 48 个录播条目、详情 hash 路由、目录 `/api/home`、搜索 `/api/search?wd={keyword}&page=1` 与播放 `/api/player?id={id}&sid={sid}&nid={nid}`。2026-08-12 再次现场检索并核对资源清单，目录、搜索和全部封面仍依赖 `zb.cfnav.me` / `media.cfnav.com`；播放才落到独立 Backblaze B2 公开 MP4 域。该域支持 Range 并实际可播，但对象域根路径不提供目录或元数据，公开检索也未找到独立索引。因此保持 pending，不能把 48 条静态快照或猜测对象路径误报成长期接口。 |
| 25 | `jm` | 禁漫天堂 | 动漫 / comic | — | — | 待接入 | 待接入。 |
| 26 | `mm` | 墨影集 | 图集 / gallery | — | — | 待接入 | 待接入。 |
| 27 | `miss` | 看 Miss | 影视 / cinema | — | — | 待接入 | 待接入。 |
| 28 | `dsd` | 看懂色帝 | 影视 / cinema | — | — | 整站暂缓（含 VIP） | 已确认 `/api/home`、分类、搜索和 `/api/play/{id}`；目录存在 VIP，媒体经私有 `kan-dsd` 清单/分片代理。按整站规则不接入，不绕 VIP。 |
| 29 | `movie` | 影视聚合 | 影视 / aggregate | GDLSP | — | 专用已验收 | MacCMS JSON 列表、分页、搜索、详情和 HLS 播放。 |
| 30 | `xo` | 爱看 | 影视 / cinema | — | — | 整站暂缓（含 VIP） | 已确认真实上游是 `h5.xxoo473.org`，但目录同时包含 VIP/付费内容；按用户最新规则整站不介入，连免费子集也暂不接入。 |
| 31 | `jav` | 看 JAV | 影视 / cinema | — | — | 整站暂缓（非全站免费 / 私有媒体） | 首页 24 条中只有部分标记 `free`，因此未证明全站免费；目录 `/api/home?offset=0&count=24`，封面进入 `media.cfnav.com/m/kan-jav/*`。不接免费子集，也不复用私有媒体链。 |
| 32 | `ep` | Flux / EPORNER | 影视 / cinema | Eporner | — | 专用已验收 | 官方 API 列表、搜索、排序、详情和官方嵌入播放。 |
| 33 | `tna` | TNAFlix | 影视 / cinema | TNAFlix | — | 专用已验收 | 用户保存的参考详情页及前端资源确认 `/api/home`、搜索、分类和详情结构；条目 `708531` 的路径、标题、封面、时长、相关 ID 与 144p/240p/360p 媒体均和官方 `www.tnaflix.com` 一致。本地已接官方公开目录、分页、搜索、详情及动态多清晰度 MP4；匿名完整播放支持 Range/CORS，不依赖 cfnav 签名。 |
| 34 | `tv` | 看 TV | 直播 / live | adulttv | — | 部分可用（41 路代码完成、待部署验收） | 已复现参考站 80 路目录（41 oxax 品牌 + 39 AdultIPTV 主题）、搜索和分页；39 路主题流已独立播放。2026-08-12 观察参考站 oxax 频道，确认它从 `http://oxax.tv/{slug}.html` 读取拆分的 Playerjs 配置，生成 `s.oxax.tv` 带时效 HLS 并通过同源中转加载 TS。本地已改为 HTTP slug 页面、还原 `kodk + 模板 + kos`、重写清单并代理受限分片；`oh-ah` 与 `superone-hd` 两种不同插入位置的真实页面样本均可精确还原现场 HLS。当前沙箱禁止本地服务进程出网，41 路仍需部署环境完成逐路播放验收。 |
| 35 | `madou` | 看麻豆 | 影视 / cinema | — | — | 待接入 | 待接入。 |
| 36 | `best` | 看 JavPorn | 影视 / cinema | — | — | 待接入 | 待接入。 |
| 37 | `ja` | 看 JavBus | 资料 / magnet | — | — | 用户跳过 / 不接入 | 用户现场确认该站只有影片资料与磁力链接，不能在线直接播放，并明确决定跳过。它不符合当前“可浏览并在线播放”的视频接入目标；不实现磁力、下载或外部播放器流程，也不以其他日语片源替代。 |
| 38 | `bj` | 韩国主播视频 | 影视 / live | — | — | 整站暂缓（会员 / 积分） | 2026-08-12 用户现场确认站内存在会员和积分内容。按整站免费规则，不再要求保存页面，也不接其中可能免费的子集。 |
| 39 | `asmr` | 助眠音声 ASMR | 音声 / audio | — | — | 用户暂时跳过 | 浏览器权限阻止访问该参考子域；2026-08-13 用户决定暂时跳过并先做别的站点。后续仅在用户恢复该项并提供页面证据后再确认目录、付费边界和播放链。 |

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
| `qiying` | `agency.nsguiiwz.cc` / `being` / `act` + `public/qiying/*.gz` 本地镜像 + `pic.uforxk.cn` / `imgpublic.ycomesc.live` / `op.vkjyoi.cn` / `bgqpnx.cn` | 目录/搜索/详情图集用导出分片（浏览器 gzip 解压内存过滤）；视频实时抓主站 `/archives/{id}/` 帖子页，解析 DPlayer `data-config` 内服务端签名 m3u8 | HLS.js（AES-128 分片，ts/key 直连 CDN） | 无账号；签名由 91吃瓜网服务端生成，每次点播现抓不落盘 | 主站域名轮换（防失联页多线路，adapter 内置三个镜像）；签名有时效，过期重新点播即可 |

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
7. 海角匿名接口不是“完整内容公开”。未购买详情只给公开预览，不能越过购买边界。
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
4. `book` 等原排除站已更新、恢复待接入；`hj` 含购买，付费/VIP 排除站决定不变。
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
- 看懂色帝已确认参考站目录、分类、搜索和 HLS 播放链；当前所有媒体仍进入私有 `kan-dsd` 代理，且部分详情明确标为 VIP，未找到可独立接入的真正上游，因此保持 pending。
- 完成一批剩余视频站整站筛查并写入状态：`one`、`hj`、`9s`、`swag`、`dsd`、`xo`、`jav` 因含付费/VIP/购买或未证明全站免费而整站暂缓；`dj` 因含付费信号整站暂缓；`mt`、`miss`、`qiying`、`rou`、`tx`、`hqw`、`91`、`mr` 已更新、恢复待接入；`zb` 仍只有参考站私有媒体代理，继续 pending。
- 使用用户已登录的 Chrome 进一步复核 `hxc`：完整播放确实经参考站私有 `kan-hxc` HLS 路由；原始接口体系存在 VIP、购买、登录、限免及预览字段，因此改为整站暂缓，不实现预览升级或 VIP 解锁。
- `ja` 当时受用户保存的浏览器访问权限限制；用户随后现场确认它只有影片资料与磁力链接、不能在线直接播放，并决定跳过，不实现磁力或下载流程。`bj` 已由用户现场确认存在会员和积分内容，整站暂缓。`madou` 已更新、恢复待接入。
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
- Cloudflare Pages 适配完成后，用户明确恢复其他站点研究。原计划优先 `bj` / 韩国主播视频，但用户随即现场确认站内存在会员和积分内容；依照整站免费规则停止调查，不再要求用户保存页面，不接免费子集。
- 用户随后保存 `madou` / 看豆豆首页、详情 HTML 及对应资源目录。离线 `app.js` 确认参考功能契约为 `/api/nav`、`/api/list`、`/api/detail?path=`、`/api/play/{shareId}`，支持分类、标签、排行、搜索、分页与 HLS；详情页已创建 HLS blob 播放器。`madou` 已更新、恢复待接入。
- 用户随后保存 `best` / 看 JavPorn 首页、详情 HTML 及对应资源目录。离线页面确认目录路由、`/search?q=`、`/v/{slug}` 与同源 `/api/play/{slug}` 播放契约；播放器优先使用接口返回的直连 HLS，失败后回退同源 HLS 代理，并包含把伪装成 PNG 的 TS 分片解包后播放的逻辑。保存下来的详情只有播放接口地址，没有 `m3u8_url` 或 `m3u8_proxy`，所以离线打开无法播放；用户称在线页面同样显示播放不了，受保存的浏览器权限限制，未绕过读取实时接口响应。`best` 已更新、恢复待接入。
- 用户现场确认 `ja` / 看 JavBus 只有影片资料和磁力链接，不能在线直接播放，并明确决定跳过。该入口保留在主导航以维持参考目录结构，但保持未接入状态；不研究或实现磁力、下载及外部播放器流程。
- 完成视频/直播阶段收尾复测：生产构建通过，Sites 8/8、Cloudflare Pages 4/4；视频站第一轮筛查至此结束。当前是 7 个完整匹配入口、看 TV 部分可用，其他视频站均有明确暂缓/排除证据；看主播继续因缺少独立动态目录保持 pending。后续优先转入 `asmr` 音频入口核对。
- 2026-08-13 用户决定暂时跳过 `asmr`，不再要求保存页面；当前回到已实现但尚未完成真实网络验收的看 TV，优先逐路验证 41 个 oxax 品牌频道。
