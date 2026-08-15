export const PROVIDERS = {
  gdlsp: {
    id: "gdlsp",
    name: "GDLSP / MacCMS JSON",
    upstream: "www.gdlsp.com/api/json.php",
    discoveredFrom: "movie.cfnav.me 前端请求",
    capabilities: "列表 / 搜索 / 详情 / HLS 播放",
  },
  hstream: {
    id: "hstream",
    name: "HStream 公开目录",
    upstream: "hstream.moe + 独立媒体节点",
    discoveredFrom: "观番页来源标注与播放器调用链",
    capabilities: "目录 / 搜索 / 详情 / 多线路 MP4",
  },
  leakgallery: {
    id: "leakgallery",
    name: "LeakGallery JSON",
    upstream: "api.leakgallery.com + cdn.leakgallery.com",
    discoveredFrom: "OnlyFans 图集页来源域与公开 API",
    capabilities: "列表 / 创作者搜索 / 详情 / 图片与视频",
  },
  eporner: {
    id: "eporner",
    name: "Eporner 官方 API",
    upstream: "www.eporner.com/api/v2",
    discoveredFrom: "EPORNER 站点公开 JSON API",
    capabilities: "列表 / 搜索 / 排序 / 详情 / 官方嵌入播放",
  },
  madouai: {
    id: "madouai",
    name: "麻豆AI 公开 API",
    upstream: "www.madouai.xyz/api/v1",
    discoveredFrom: "麻豆AI 参考站前端源码中的公开上游地址",
    capabilities: "分类目录 / 搜索 / 分页 / 详情 / HLS 播放",
  },
  pmvhaven: {
    id: "pmvhaven",
    name: "PMVHaven 公开目录",
    upstream: "pmvhaven.com + pmvhavencloud.s3.eu-west-par.io.cloud.ovh.net",
    discoveredFrom: "参考 PMV 站条目 ID、目录字段与媒体 CDN 的逐项同源核对",
    capabilities: "目录 / 搜索 / 分页 / 标签 / 详情 / MP4 与 HLS 播放",
  },
  iptvorg: {
    id: "iptvorg",
    name: "iptv-org 开放频道库",
    upstream: "iptv-org.github.io/api",
    discoveredFrom: "iptv-org 官方公开 API 与播放列表",
    capabilities: "电视直播 / 频道搜索 / 台标 / HLS 播放",
  },
  adulttv: {
    id: "adulttv",
    name: "oxax.tv + AdultIPTV 双源",
    upstream: "oxax.tv / s.oxax.tv / r.pokaz.me + cdn.adultiptv.net",
    discoveredFrom: "看TV 页面源标注、公开频道目录与播放页链路",
    capabilities: "80 路直播目录 / 搜索 / 双源 HLS / 品牌流实时解析",
  },
  redgifs: {
    id: "redgifs",
    name: "RedGifs 匿名视频 API",
    upstream: "api.redgifs.com + media.redgifs.com",
    discoveredFrom: "匿名临时令牌接口与公开媒体 CDN",
    capabilities: "列表 / 搜索 / 详情 / HD 与移动版 MP4",
  },
  tnaflix: {
    id: "tnaflix",
    name: "TNAFlix 公开目录",
    upstream: "www.tnaflix.com + TNAFlix 媒体节点",
    discoveredFrom: "用户保存的参考详情页与 TNAFlix 官方页面逐项核对",
    capabilities: "目录 / 搜索 / 分页 / 详情 / 多清晰度 MP4",
  },
  kan91: {
    id: "kan91",
    name: "91porna 公开目录",
    upstream: "91porna.com + yd-hls.utxxds.cn + tp*.xmbvxj.cn / pic.xmbvxj.cn",
    discoveredFrom: "看91 参考条目与 91porna.com 目录/搜索/详情/播放 ID 逐项同源核对",
    capabilities: "分类目录 / 搜索 / 分页 / 详情 / 图片解密代理 / AES-128 HLS 播放",
  },
  qiying: {
    id: "qiying",
    name: "91吃瓜网 镜像 + 主站",
    upstream: "agency.nsguiiwz.cc / being / act + 本地静态目录 + pic.uforxk.cn / ycomesc CDN",
    discoveredFrom: "栖影 数据分片导出与 91吃瓜网 防失联页主站域名的同源核对",
    capabilities: "本地图帖目录 / 分类 / 搜索 / 详情图集 / 主站签名 HLS 播放",
  },
  madou: {
    id: "madou",
    name: "麻豆社 公开目录",
    upstream: "madou.club + dash.madou.club（分享页短时效 JWT + AES-128 HLS）",
    discoveredFrom: "看麻豆 参考条目 slug/分类/详情与 madou.club 逐项同源核对",
    capabilities: "分类目录 / 搜索 / 点赞·周·月排行 / 详情 / 分享页签名 HLS 播放",
  },
  miss: {
    id: "miss",
    name: "MissAV 公开目录",
    upstream: "missav.media + fourhoi.mrstcdn.store / surrit.mrstcdn.store",
    discoveredFrom: "看Miss 参考站 OpenAPI 文档与 missav.media 条目/媒体逐项同源核对",
    capabilities: "分区目录 / 搜索 / 详情 / 女优·类型·发行商索引 / 直链多码率 HLS 播放",
  },
  tx: {
    id: "tx",
    name: "糖心Vlog 公开目录",
    upstream: "tangxinvlog.pro + t.5gcdn.xyz（AES-128 HLS，同源代理转发）",
    discoveredFrom: "看糖心Vlog 参考站 API 契约与 tangxinvlog.pro 条目/媒体逐项同源核对",
    capabilities: "首页最新 / 全部作品分页 / 46 博主索引 / 博主作品页 / 详情 / 代理 AES-128 HLS 播放",
  },
  rou: {
    id: "rou",
    name: "看肉视频 公开目录",
    upstream: "rou.video + v.rn2xx.xyz（imgproxy 封面直链 / 签名 HLS 同源代理）",
    discoveredFrom: "看肉视频 参考站 API 契约（siteDomain 直接返回 rou.video）与上游 SSR 数据逐项同源核对",
    capabilities: "首页 9 分区 / 分类树 4 组 / 全量标签 / 搜索 / 详情 / 代理签名 HLS 播放",
  },
};

const ROUTE_CONFIGS = {
  ai: { provider: "madouai" },
  fj: { provider: "hstream" },
  lg: { provider: "leakgallery" },
  ep: { provider: "eporner" },
  movie: { provider: "gdlsp" },
  pmv: { provider: "pmvhaven" },
  tna: { provider: "tnaflix" },
  tv: { provider: "adulttv" },
  91: { provider: "kan91" },
  qiying: { provider: "qiying" },
  madou: { provider: "madou" },
  miss: { provider: "miss" },
  tx: { provider: "tx", preset: "home" },
  rou: { provider: "rou", preset: "home" },
};

export function getProviderForSite(slug) {
  const route = ROUTE_CONFIGS[slug];
  if (!route) return null;
  return { ...PROVIDERS[route.provider], preset: route.preset || "" };
}
