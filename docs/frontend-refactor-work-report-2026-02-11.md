# 前端程式碼治理工作內容報告（2026-02-11）

## 1. 報告目標
- 記錄本次前端重構後的專案結構。
- 記錄關鍵頁面、佈局、元件、腳本、公共庫之間的引用關係。
- 記錄本次新增/修改/刪除內容與驗證結果，方便後續維護和交接。

## 2. 本次改動範圍總覽

### 2.1 新增檔案
- `docs/frontend-architecture-map.md`
- `src/layouts/PageShell.astro`
- `src/lib/content/blog.ts`
- `src/lib/content/text.ts`
- `src/lib/profile/social.ts`
- `src/components/ContentCard.astro`
- `src/components/SectionHeader.astro`
- `src/components/PostMeta.astro`
- `src/components/PostListItem.astro`
- `src/scripts/pages/registry.ts`
- `src/scripts/pages/home.client.ts`
- `src/scripts/pages/blog-list.client.ts`
- `src/scripts/pages/tags-index.client.ts`
- `src/scripts/pages/tag-detail.client.ts`

### 2.2 刪除檔案
- `src/utils/seo.ts`
- `src/assets/blog-placeholder-2.jpg`
- `src/assets/blog-placeholder-3.jpg`
- `src/assets/blog-placeholder-4.jpg`

### 2.3 主要修改檔案（核心）
- 頁面：`src/pages/index.astro`、`src/pages/about.astro`、`src/pages/blog/[...page].astro`、`src/pages/tags/index.astro`、`src/pages/tags/[tag].astro`、`src/pages/blog/[...slug].astro`
- 佈局與元件：`src/layouts/BlogPost.astro`、`src/components/Footer.astro`、`src/components/FormattedDate.astro`、`src/components/SearchModal.astro`、`src/components/Typewriter.astro`
- 腳本：`src/scripts/search-modal.client.ts`、`src/scripts/lightbox.ts`、`src/scripts/toc.ts`、`src/scripts/header.client.ts`
- 樣式與工程：`src/styles/global.css`、`package.json`、`package-lock.json`、`astro.config.mjs`、`README.md`、`README.en.md`

## 3. 重構後項目結構（關鍵目錄）

```text
src/
  assets/
    blog-placeholder-1.webp
    blog-placeholder-5.jpg
    blog-placeholder-about.webp
  components/
    BaseHead.astro
    Header.astro
    Footer.astro
    SearchModal.astro
    HeroHeader.astro
    FormattedDate.astro
    ContentCard.astro
    SectionHeader.astro
    PostMeta.astro
    PostListItem.astro
    ...
  layouts/
    PageShell.astro
    BlogPost.astro
  lib/
    content/
      blog.ts
      text.ts
    profile/
      social.ts
  pages/
    index.astro
    about.astro
    blog/
      [...page].astro
      [...slug].astro
    tags/
      index.astro
      [tag].astro
    rss.xml.js
    search-index.json.ts
  scripts/
    header.client.ts
    search-modal.client.ts
    custom-cursor.client.ts
    toc.ts
    code-block.ts
    lightbox.ts
    pages/
      registry.ts
      home.client.ts
      blog-list.client.ts
      tags-index.client.ts
      tag-detail.client.ts
  styles/
    global.css
```

## 4. 引用關係（核心）

### 4.1 頁面層 -> 本地依賴
- `src/pages/index.astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard,PostListItem,SectionHeader}.astro`
  - `src/lib/content/blog.ts`
  - `src/scripts/pages/registry.ts`
- `src/pages/about.astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard}.astro`
  - `src/lib/profile/social.ts`
- `src/pages/blog/[...page].astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard,PostListItem,SectionHeader}.astro`
  - `src/lib/content/{blog,text}.ts`
  - `src/scripts/pages/registry.ts`
- `src/pages/tags/index.astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard,SectionHeader}.astro`
  - `src/lib/content/blog.ts`
  - `src/scripts/pages/registry.ts`
- `src/pages/tags/[tag].astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard,PostListItem,SectionHeader}.astro`
  - `src/lib/content/{blog,text}.ts`
  - `src/scripts/pages/registry.ts`
- `src/pages/blog/[...slug].astro`
  - `src/layouts/BlogPost.astro`
  - `src/lib/content/blog.ts`
  - `src/lib/content/text.ts`
- `src/pages/rss.xml.js`
  - `src/lib/content/blog.ts`
  - `src/lib/content/text.ts`
- `src/pages/search-index.json.ts`
  - `src/lib/content/blog.ts`
  - `src/lib/content/text.ts`

### 4.2 佈局層
- `src/layouts/PageShell.astro`
  - 統一注入：`BaseHead`、`Header`、`Footer`、`SearchModal`
- `src/layouts/BlogPost.astro`
  - 文章詳情專用佈局
  - 依賴 `BaseHead`、`Header`、`Footer`、`HeroHeader`、`SearchModal`
  - 增強腳本：`toc.ts`、`code-block.ts`、`lightbox.ts`

### 4.3 元件層複用關係
- `PostListItem.astro` -> `PostMeta.astro`
- `PostMeta.astro` -> `FormattedDate.astro`
- `Footer.astro` -> `lib/profile/social.ts`
- `FormattedDate.astro` -> `config.locale`

### 4.4 頁面互動腳本引用關係
- `src/scripts/pages/registry.ts` 統一註冊並排程：
  - `home.client.ts`
  - `blog-list.client.ts`
  - `tags-index.client.ts`
  - `tag-detail.client.ts`
- 頁面只調用 `runPageEnhancements('<page-id>')`，避免分散的重複 `astro:page-load` 管理。

## 5. 資料與職責收斂

### 5.1 內容讀取與處理
- `src/lib/content/blog.ts`
  - `getBlogPosts()`
  - `getPostsByTag()`
  - `getTagStats()`
  - `sortPostsByDateDesc()`
- `src/lib/content/text.ts`
  - `stripMarkdownAndHtml()`
  - `extractExcerpt()`
  - `extractSeoDescription()`

### 5.2 個人社交資訊處理
- `src/lib/profile/social.ts`
  - `resolveSocialUrl()`
  - `getRenderableSocials()`
  - `buildSameAsLinks()`

## 6. 結構最佳化成果摘要
- 頁面殼層統一為 `PageShell`，減少重複 `BaseHead/Header/Footer/SearchModal/main-content` 結構。
- 多頁面重複資料邏輯收斂到 `src/lib`（內容讀取、摘要、社交連結）。
- 列表/元資訊檢視元件化，減少首頁、部落格、標籤頁模板重複。
- 頁面互動腳本模組化並統一生命週期入口，降低事件重複綁定風險。
- 搜尋渲染補充 HTML 轉義並統一高亮處理，降低 XSS 風險。
- 全域性樣式過渡從 `*` 全域性常駐切換為 `html.theme-transitioning` 受控觸發。

## 7. 工程驗證結果
- 執行 `npm run build:astro`：通過。
- 執行 `npm run check`：通過（0 errors）。
- 當前內容庫為空時會出現內容警告（`src/content/blog` 無文章），屬於預期提示，不阻塞構建。

## 8. 維護約定（落地）
- 新頁面優先使用 `src/layouts/PageShell.astro`。
- 新的部落格資料讀取必須走 `src/lib/content/blog.ts`。
- 摘要與 SEO 文本處理走 `src/lib/content/text.ts`。
- 社交連結處理走 `src/lib/profile/social.ts`。
- 頁面互動腳本放 `src/scripts/pages/*` 並通過 `registry.ts` 註冊。

## 9. 參考文件
- `docs/frontend-architecture-map.md`
