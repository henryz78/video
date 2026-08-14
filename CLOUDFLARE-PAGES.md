# Cloudflare Pages 部署说明

当前只完成适配，没有创建或部署 Cloudflare 项目。

## 最简单的部署方式

1. 把整个 `cfnav-independent` 项目放到你自己的 GitHub 仓库。
2. 在 Cloudflare 控制台打开 **Workers & Pages → Create → Pages → Connect to Git**。
3. 选择该仓库，填写：
   - Framework preset：`Vite`
   - Build command：`npm run build:cloudflare`
   - Build output directory：`dist/client`
4. 点击部署。

不要只把 `dist/client` 文件夹拖进 Direct Upload。那种方式只会上传静态页面，不会自动带上根目录的 `functions/`，目录、搜索和详情 API 会失效。

## 这次适配做了什么

- `functions/provider-api/[[path]].js`：接住所有 `/provider-api/*` 请求，复用现有 provider adapter。
- `public/_routes.json`：规定只有 `/provider-api/*` 才运行 Pages Functions。
- 普通页面、JS、CSS、封面继续由 Pages 静态托管，不占 Pages Functions 请求次数。
- 不需要数据库、KV、环境变量、Cookie 或私有 API 密钥。

## 视频流量

- 麻豆AI、PMV、观番、OnlyFans、EPORNER、TNAFlix、影视聚合，以及看TV的 39 路 AdultIPTV：Function 只解析目录/详情，最终媒体由用户浏览器直连上游。
- 看TV的 41 路 oxax：当前代码需要经 `/provider-api/adulttv?action=media` 中转 HLS 清单、key 和分片。技术上能在 Pages Functions 运行，但不建议长期使用 Cloudflare 免费网络承担第三方视频转发。正式部署时应暂时关闭这 41 路，或将中转端点迁移到你明确选定的独立服务器。

## 本地验证命令

```text
npm run build:cloudflare
npm run test:cloudflare
```

这两个命令只构建和测试，不会部署。
