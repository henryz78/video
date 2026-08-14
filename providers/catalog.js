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
};

export function getProviderForSite(slug) {
  const route = ROUTE_CONFIGS[slug];
  if (!route) return null;
  return { ...PROVIDERS[route.provider], preset: route.preset || "" };
}
