# Joe's Blog

[blogs.joenyc.net](https://blogs.joenyc.net) 的原始碼。Astro 6 靜態站，部署在 Cloudflare Workers；
`/admin` 後台透過 GitHub API 把文章直接寫回這個 repo，沒有資料庫。
主題基於 [ulBo](https://github.com/xxy1103/ulbo)（MIT），這裡只保留 Joe 自己用得到的部分。

做法與踩過的坑寫在〈[這個部落格是怎麼做的：沒有資料庫，GitHub 就是資料庫](https://blogs.joenyc.net/blog/%E9%80%99%E5%80%8B%E9%83%A8%E8%90%BD%E6%A0%BC%E6%80%8E%E9%BA%BC%E5%81%9A%E7%9A%84_20260908/)〉。

## 開發

需要 Node.js 22.12 以上。

```bash
npm install
npm run dev
```

預設在 `http://localhost:4321`。

| 命令 | 說明 |
| --- | --- |
| `npm run dev` | 開發伺服器 |
| `npm run build` | 建置到 `dist/`，不會改動文章或圖片 |
| `npm run preview` | 預覽建置結果 |
| `npm run check` | Astro、TypeScript 與後台 Worker 型別檢查 |
| `npm test` | 單元測試（vitest） |
| `npm run dev:admin` | 本機啟動含後台 API 的 Worker |
| `npm run frontmatter:check` | 只讀檢查文章 frontmatter |
| `npm run frontmatter:fix` | 規範化 frontmatter |
| `npm run optimize:images:dry-run` | 預覽圖片轉 WebP 的結果 |
| `npm run optimize:images` | 產生 WebP 並更新文章引用 |

## 寫文章

在 `src/content/blog/` 新增 `.md` 或 `.mdx`，檔名慣例是 `<標題>_<YYYYMMDD>.md`：

```md
---
title: "文章標題"
date: "2026-09-08T22:00:00+08:00"
description: "一段給搜尋引擎與列表頁看的摘要。"
draft: false
categories:
  - "開發"
tags:
  - "astro"
---

正文從這裡開始。
```

- 完整欄位與校驗規則見 [standard/frontmatter.md](./standard/frontmatter.md)，寫作範本見 [docs/寫文章範本.md](./docs/寫文章範本.md)。
- 圖片放 `public/image/<文章檔名>/`，文中用 `/image/...` 引用。
- `draft: true` 的文章只在開發環境顯示，建置時一律排除。
- 簡體版由 middleware 在建置時從繁體原稿轉出，不用另外維護。

## 部署

推到 `main` 會由 [.github/workflows/deploy.yml](./.github/workflows/deploy.yml) 建置並部署到 Cloudflare Workers，
需要 repo secrets `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID`。手動部署：

```bash
npm run build && npm run deploy
```

## 網站後台

`/admin` 提供文章增刪改、Markdown 即時預覽、圖片上傳、網站設定與一鍵部署。
前台仍是純靜態，只有 `/api/*` 會經過 Worker；儲存即 commit，再由 GitHub Actions 重新建置。

首次使用要設定三個 Worker 密鑰（`npx wrangler secret put <名稱>`）：`ADMIN_PASSWORD`、`SESSION_SECRET`、`GITHUB_TOKEN`。
完整步驟見 [docs/admin-guide.md](./docs/admin-guide.md)。本機測試後台：複製 `.dev.vars.example` 為 `.dev.vars` 後執行 `npm run dev:admin`。

## 結構

```text
src/
├─ components/       頁面元件
├─ config/           站點、個人資料與 Hero 設定（settings.json 由後台讀寫）
├─ content/blog/     文章
├─ i18n/             繁簡轉換與語言路由
├─ layouts/          頁面與文章版型
├─ lib/              內容、搜尋與資料處理
├─ pages/            路由、RSS、sitemap、404
├─ plugins/          Markdown / HTML 處理外掛
└─ scripts/          搜尋、目錄、Mermaid、燈箱等前端互動

worker/               後台 API 的 Cloudflare Worker
public/admin/         後台介面（純靜態）
docs/                 架構地圖、後台說明、寫作範本
```

## 授權

[MIT](./LICENSE)
