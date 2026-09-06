# ulBo Astro Theme

<p align="center">
  <strong>一個兼顧視覺表達、長文閱讀與發布工程的 Astro 個人部落格主題。</strong>
</p>

<p align="center">
  <a href="./README.md">中文</a> ·
  <a href="./README.en.md">English</a>
</p>

<p align="center">
  <a href="https://astro.build/"><img alt="Astro 6" src="https://img.shields.io/badge/Astro-6.4.8-BC52EE?logo=astro"></a>
  <a href="https://nodejs.org/"><img alt="Node.js 22+" src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="https://template.ulna520.top"><strong>線上預覽</strong></a> ·
  <a href="https://blog.ulna520.top">真實部落格</a> ·
  <a href="https://astro.build/themes/details/ulbo/">Astro 主題商城</a> ·
  <a href="https://github.com/xxy1103/ulbo_vscode">VS Code 文章管理工具</a>
</p>

![ulBo Astro Theme 總覽](./docs/images/promo/ulbo-overview.png)

## 為什麼選擇 ulBo

ulBo 面向希望長期維護個人內容的寫作者、開發者和獨立創作者。它不只提供一套部落格頁面，還把閱讀體驗、內容組織、搜尋發現、SEO、圖片最佳化和日常寫作流程組合成一套完整方案。

| 方向 | 能力 |
| --- | --- |
| **視覺與動效** | 沉浸式 Hero、響應式佈局、明暗主題，以及基於 Astro View Transitions 和 Material Design 3 曲線的頁面動效。 |
| **長文閱讀** | 固定目錄、字數與閱讀時長、程式碼複製、KaTeX 公式、Mermaid 圖表、圖片燈箱和適合列印的 PDF 匯出。 |
| **內容發現** | Fuse.js 模糊搜尋、`Cmd/Ctrl + K` 快捷入口、文章歸檔、標籤篩選與分頁。 |
| **發布品質** | 嚴格 Frontmatter、草稿隔離、RSS、Sitemap、Canonical、Open Graph、Twitter Card 和 JSON-LD。 |
| **配置與遷移** | 站點、個人資料和 Hero 內容集中在 `src/config/`；支援 Markdown / MDX 與 Hexo 風格圖片路徑。 |
| **效能工程** | 圖片懶載入、非同步解碼、按需 KaTeX、延遲搜尋索引、預取策略，以及可預覽的 WebP 最佳化流程。 |

## 主題預覽

<table>
  <tr>
    <td width="50%"><img src="./docs/images/promo/ulbo-light-dark.png" alt="ulBo 明暗主題"></td>
    <td width="50%"><img src="./docs/images/promo/ulbo-longform.png" alt="ulBo 長文閱讀"></td>
  </tr>
  <tr>
    <td align="center"><strong>一致的明暗主題體驗</strong></td>
    <td align="center"><strong>為技術長文準備的閱讀工具</strong></td>
  </tr>
</table>

![ulBo 搜尋、標籤、歸檔與 About 頁面](./docs/images/promo/ulbo-content.png)

## 快速開始

點選 GitHub 倉庫中的 **Use this template** 建立自己的部落格，然後執行：

```bash
npm install
npm run dev
```

預設訪問地址為 `http://localhost:4321`。

環境要求：

- Node.js 22.12.0 或更高版本
- npm 9.6.5 或更高版本

## 配置部落格

通常只需要修改以下位置：

| 檔案 | 用途 |
| --- | --- |
| `src/config/site.ts` | 網站地址、標題、描述、語言和倉庫連結 |
| `src/config/profile.ts` | 頭像、身份介紹、聯絡方式和社交連結 |
| `src/config/hero.ts` | 首頁、歸檔、標籤、About 和文章預設 Hero |
| `src/content/blog/` | Markdown / MDX 文章 |
| `public/image/` | 文章與頁面圖片 |

即使 `src/content/blog/` 還是空目錄，首頁、歸檔、標籤和 About 等核心頁面也可以正常構建，適合先完成個性化配置，再開始發布內容。

## 寫一篇文章

在 `src/content/blog/` 中新建 `.md` 或 `.mdx` 檔案：

```md
---
title: "我的第一篇文章"
date: "2026-08-03T10:00:00+08:00"
description: "介紹如何使用 ulBo 搭建個人部落格，包括主題配置、文章寫作、本地預覽、圖片最佳化與部署流程。"
draft: false
categories:
  - "記錄"
tags:
  - "astro"
  - "blog"
---

正文從這裡開始。
```

完整欄位與校驗規則見 [Frontmatter 標準](./standard/frontmatter.md)。

生產構建會統一排除草稿，覆蓋首頁、歸檔、詳情頁、標籤、搜尋索引和 RSS；開發環境仍可通過草稿標識檢視和校對內容。

## 推薦搭配 ulBo Article Manager

[ulBo Article Manager](https://github.com/xxy1103/ulbo_vscode) 是為本主題開發的可選 VS Code 寫作工具。它讓你在熟悉的 Markdown 編輯器旁完成：

- 新建草稿，搜尋、篩選和開啟文章；
- 視覺化編輯標題、日期、描述、分類、標籤和草稿狀態；
- 使用 VS Code 語言模型生成文章描述，不可用時回退到本地提取；
- 啟動 Astro 開發服務並直接預覽當前文章；
- 發布前校驗 Frontmatter、標籤和正文引用圖片；
- 將文章與關聯圖片精確暫存到 Git；
- 將刪除的文章移入系統回收站，保留恢復能力。

主題負責展示與構建，外掛負責寫作和文章管理。外掛不會自動執行 commit、push 或部署，最終發布仍由你控制。

當前版本可從外掛倉庫安裝本地 VSIX，詳細說明見 [ulBo Article Manager README](https://github.com/xxy1103/ulbo_vscode#readme)。

## SEO 與效能

當前程式碼已經實現：

- Canonical、robots、Open Graph、Twitter Card 和 JSON-LD；
- 首頁 `WebSite`、About 頁 `Person`、文章頁 `BlogPosting` 結構化資料；
- RSS、Sitemap，以及歸檔分頁的 `noindex,follow` 與 `rel=prev/next`；
- Markdown 圖片懶載入和非同步解碼；
- 文章 Hero 預載入、KaTeX 樣式按需載入；
- 搜尋索引首次開啟時再獲取；
- 防止明暗主題首屏閃爍；
- 獨立於普通構建的 WebP 圖片最佳化工具。

`npm run build` 只負責構建，不會修改文章或圖片。需要最佳化圖片時，先預覽變更，再顯式執行：

```bash
npm run optimize:images:dry-run
npm run optimize:images
```

更完整的實現邊界和程式碼位置見 [英文 README](./README.en.md#seo-optimizations-code-aligned)。

## 常用命令

| 命令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 構建生產版本，不修改文章或圖片 |
| `npm run preview` | 預覽生產構建結果 |
| `npm run check` | 檢查 Astro 與 TypeScript |
| `npm test` | 執行測試 |
| `npm run frontmatter:check` | 只讀檢查文章 Frontmatter |
| `npm run frontmatter:fix` | 規範化 Frontmatter，並驗證正文未被改動 |
| `npm run optimize:images:dry-run` | 預覽圖片最佳化結果 |
| `npm run optimize:images` | 生成 WebP 並更新文章引用 |

## 部署

專案輸出為靜態檔案，可部署到 Cloudflare Workers / Pages、Vercel、Netlify 或 GitHub Pages。

倉庫已包含 Cloudflare Workers Static Assets 配置：

```bash
npm run build
npm run deploy
```

使用其他平台時，將構建命令設為 `npm run build`，輸出目錄設為 `dist`。

## 專案結構

```text
src/
├─ components/       頁面元件
├─ config/           站點、個人資料與 Hero 配置
├─ content/blog/     Markdown / MDX 文章
├─ layouts/          通用頁面與文章佈局
├─ lib/              內容、搜尋和資料處理邏輯
├─ pages/            首頁、歸檔、標籤、About、RSS 等路由
├─ plugins/          Markdown / HTML 處理外掛
└─ scripts/          搜尋、目錄、Mermaid、燈箱與頁面互動
```

前端模組關係見 [架構地圖](./docs/frontend-architecture-map.md)。

## 相關專案

- [ulBo Article Manager](https://github.com/xxy1103/ulbo_vscode)：配套的 VS Code 文章管理工具。
- [xxy1103.github.io](https://github.com/xxy1103/xxy1103.github.io)：使用 ulBo 搭建的真實個人部落格。

## 參與貢獻

歡迎提交 Issue 和 Pull Request。開始前請閱讀 [貢獻指南](./CONTRIBUTING.md)、[行為準則](./CODE_OF_CONDUCT.md) 與 [安全策略](./SECURITY.md)。

## 許可證

[MIT](./LICENSE)
