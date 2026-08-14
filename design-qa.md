# Design QA

- Source visual truth: `C:\Users\z6798\Downloads\不许涩涩机场塔台-允许起飞 · 成人内容聚合.html`, its adjacent `_files` asset directory, and the live `https://cfnav.me/` homepage.
- Comparison method: live reference and local implementation were opened in the same browser and compared at matching CSS viewports.
- Desktop viewport: 1280 × 720 CSS px.
- Mobile viewport: 390 × 844 CSS px.
- State: dark theme, signed-in-inspired header, navigation directory, independent aggregate site, detail modal, HLS playback request.

## Full-view comparison evidence

The implementation now matches the saved and live source's black/green technical editorial direction, compact header, two-line Chinese hero, mono microcopy, paired statistics, bordered view tabs, boxed search/filter row, dense node catalog, light theme, and responsive collapse. The authorized saved logo, hero character, and 38 card preview images are served locally rather than hotlinked.

## Focused region comparison evidence

- Hero/header: proportions, dark palette, cyan/lime status colors, and desktop-to-mobile collapse visually match the source hierarchy.
- Search/filter: query input, category counts, current result count, favorite persistence, and mobile wrapping remain visible and usable.
- Resource pages: source-specific accent color, independent source status, list/search/detail/player sequence are clear and consistent.
- Media: the verified detail opens a direct HLS URL; page assets show the `.m3u8` manifest plus sequential `.ts` segments loading.

## Findings

- No remaining P0/P1/P2 visual issue in the homepage scope.
- Fidelity correction: unverified routes now render an explicit pending state instead of unrelated provider fallback content; this prevents a visually functional but semantically false completion state.
- Intentional divergence: the game/看板娘 entry and launcher remain removed by user decision, so the implementation shows 38 entries and `READY 8` rather than the source's 39 entries and `GAME 1`.
- Intentional divergence: unverified routes show `PENDING` instead of copying the source's `ONLINE` label.

## Required fidelity surfaces

- Fonts and typography: system Chinese sans and monospace microcopy closely reproduce hierarchy; wrapping and truncation work on desktop/mobile.
- Spacing and layout rhythm: desktop gutters, hero height, filter shell and card grid align with source structure; no horizontal mobile overflow.
- Colors and visual tokens: near-black background, pale foreground, cyan/lime status colors, and per-site accents are consistent.
- Image quality and assets: authorized saved homepage logo, character, and card previews are local files; verified upstream posters still load through their provider-specific paths.
- Copy and content: rewritten as an authorized personal, non-commercial independent version; source health and adapter origin are disclosed.

## Comparison history

1. Initial implementation rendered blank due to an invalid React effect cleanup return. Fixed the theme effect and recaptured `qa-home-desktop-v2.png`.
2. First detail capture did not show a player because direct single-URL MacCMS payloads were not parsed. Added direct URL parsing and HLS.js; post-fix evidence shows one stream button, one video element, an HLS manifest, and `.ts` segment requests.
3. Mobile capture showed 390 × 844 responsive layout with a 375 px document width and no horizontal overflow.
4. PMV verification loaded 20 RedGifs results, keyword search updated the result heading, detail opened an HD `media.redgifs.com` MP4 with `no-referrer`, and a detail-loading timing bug that could leave the video `src` unset was fixed.
5. JAV verification loaded 24 results through the Eporner `japanese` preset while preserving normal user search override behavior.
6. 麻豆视频 AI verification returned the same public upstream catalog exposed by the reference frontend, with 24-item paging, dedicated keyword search, detail metadata, working image responses, and a valid HLS manifest with AES key and segment URLs.

## Primary interactions tested

- Directory route and all 38 in-scope local route definitions; the game route remains removed.
- Category filtering and favorite persistence structure.
- Live source health request.
- Latest list load (20 visible cards).
- Search request and result heading.
- Detail modal.
- Direct HLS parsing and manifest/segment loading.
- RedGifs list/search/detail plus direct MP4 source assignment.
- Eporner route preset behavior for JAV/JavPorn.
- Mobile responsive layout.
- Console errors checked after fixes: none.
- Homepage search checked independently from the reference bug: `TNAFlix` narrows the directory to one matching card and clearing restores all 38 cards.
- Homepage dark/light theme, desktop/mobile layout, card default state, and card hover state were compared directly with the saved and live reference.
- QMS pending state verified in-browser after removing the unrelated movie fallback.
- 看TV 本地页已验收：80 路目录分页加载；MyCamTV MILF 弹出真实播放器，无控制台错误；资源清单显示 HLS manifest 与连续 `.ts` 分片均来自 `cdn.adultiptv.net`。oxax 参考首路已观察到真实签名 manifest 和连续 TS；本地已补公开 HTTP slug 页面解析和受限同源 HLS 代理，解析样本测试通过，逐路播放仍待可出网部署环境验收。

- PMV 视频：本地目录与参考站第一页逐项相同；点击 PUFFY PINK 后详情与 190.356833 秒 MP4 正常加载，readyState 3，控制台无 error。

final result: passed
