# 研究方法与技巧清单（参考站 → 真实上游挖接口）

> 供带浏览器的研究 agent 使用。目标：从 cfnav 参考站找到真实上游，验证其接口可独立接入（不依赖 cfnav 登录态、不复制快照数据）。

## 一、找上游线索

- 参考站页脚/版权/源码注释常暴露源站域名（98堂页脚直接写 `https://dmn12.vip`）。
- 参考站有 Swagger 就翻 `/docs` → `/openapi.json`，能看到全部接口契约（miss 先例）。
- 参考站前端 JS bundle 里搜关键字：`api`、`m3u8`、`auth_key`、`token`、`domain`、`play`，能找到接口路径和 CDN 域名。
- 看媒体 CDN 的域名/路径结构反推上游（如 `surrit.mrstcdn.store/{uuid}/playlist.m3u8`）。
- 静态 JSON（`/data/site.json`、`/data/videos.json`）里的域名、字段名。
- 防失联页/镜像列表（91吃瓜网有 being/act 镜像行，都 301 到当前主站；jm 有 GitLab 官方仓库 + 地址发布页）。
- crt.sh 证书透明日志查同站群域名：`crt.sh/?q=%25.dmn12.vip&output=json`。
- 媒体文件元数据（MP3 的 ID3 标签暴露 `t.me/asmrgay` 先例）。

## 二、同源铁证（证明参考站 = 某上游）

- 参考站 API 报错信息泄露上游 URL（tx 先例：`/api/videos?page=43` 报 `Upstream HTTP 404 for https://tangxinvlog.pro/videos/43/`）。
- 参考站 API 返回 `siteDomain` 字段（rou 先例：返回 `"siteDomain": "https://rou.video"`）。
- **逐条核对**：参考站第一页的 id/标题/作者 vs 上游首页卡片，必须一一对应（含标点、空格）。
- 分页总数一致：参考站 `/api/posts` totalPages 1691 == 上游分页 1/1691。
- 搜索同关键词两边结果页数一致（rou：搜索"糖心"两边都是 39 页）。
- 分类/标签树一致：参考站 21 个分类 slug == 上游导航 1:1；198 个标签树完全一致。
- 单个条目深核对：路径、标题、封面、时长、相关 ID、各清晰度媒体 URL 全一致（tna 先例）。

## 三、网络面板抓接口

- DevTools Network 过滤 XHR/Fetch，忽略图片和静态资源，找数据请求。
- 点播放后跟踪：m3u8/mpd 请求 → key 请求 → ts 分片，看签名怎么来。
- 每个数据请求记：方法、完整 URL、参数、响应 JSON 结构（1-2 条样例就够，别复制全量）。
- 分页翻页看 URL 变化；搜索看 URL 变化。
- JS bundle 文件名记下来。

## 四、匿名性验证（关键）

- 把数据接口请求复制成 curl，去掉所有 cookie 再请求——返回 JSON = 接口匿名，只有 CF 挡门；返回 401/403 = 有登录墙。
- 新标签直接打开数据接口 URL 看是否直接出 JSON。
- 媒体直连测试：manifest、key、TS 分别无 cookie fetch，看 200 + CORS 头。
- 无 CORS → 需要同源代理；有 CORS `*` → 浏览器直连。
- Referer 防盗链 403 → 代理带 Referer（tx 先例）。
- 签名带时效（auth_key/exp/token）→ 必须每次实时生成，不能写死。

## 五、CF 挑战处理经验

- Node/headless Chrome 403 或卡"请稍候" → 换真实浏览器（内置 Browser 指纹能过）。
- 年龄页/验证页：找"进入/确认"按钮点击。
- 数据中心 IP 被拒但住宅 IP 正常（oxax 先例：s.oxax.tv 404 CF 数据中心 IP）→ 测一下部署端 CF edge 出口能不能过（miss 先例：CF edge 过了 missav 的挑战，部署端 12 卡可播）。
- 签名绑定解析者 IP（oxax 先例：k= 签名只对解析页面的那个 IP 有效）→ 签名要由请求者自己解析。
- DNS 污染：本地解析失败但真实浏览器正常 → 用 DoH 或正常网络。

## 六、登录墙判断（项目规则）

- 无会话 401 = 登录墙（one/mt/best 先例，全部跳过）。
- 参考站的静态 JSON 快照**不算**独立上游，禁止复制成数据文件。
- 唯一合格标准：有公开、可实时抓取的目录/详情接口（允许只有 CF challenge 挡门——部署端可能过）。

## 七、最终判断输出格式

真实上游域名、目录/详情/搜索接口契约（URL 模式+参数+响应样例）、媒体地址生成方式、匿名性结论、哪些域名不在 CF 挑战后、可接入或阻塞原因。
