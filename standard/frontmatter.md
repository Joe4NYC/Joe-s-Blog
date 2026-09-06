# ulbo 文章 Frontmatter 標準

> 標準版本：1.1  
> 生效日期：2026-07-29  
> 適用範圍：ulbo 主題中的 `.md`、`.mdx` 文章，以及 ulbo Article Manager。

本文件是主題模板的 Frontmatter 規範依據。“必須”“不得”為強制要求，“建議”為不阻止草稿儲存的推薦要求。

## 1. 正式文章

```yaml
---
title: "ulbo VS Code 文章管理外掛設計"
date: "2026-07-29T14:30:00+08:00"
updated: "2026-07-29T18:00:00+08:00"
description: "介紹 ulbo 文章管理外掛的產品設計、工作流程與技術架構。"
draft: false
categories:
  - "專案"
tags:
  - "ulbo"
  - "vscode"
  - "astro"
---
```

`draft` 可省略；省略時等同於 `false`。

## 2. 草稿

```yaml
---
title: "未完成的文章"
date: "2026-07-29T14:30:00+08:00"
draft: true
categories: []
tags: []
---
```

- 新建文章預設寫入 `draft: true`。
- 草稿必須保留 `categories` 和 `tags`，但允許空陣列。
- 開發環境可以展示草稿，並應顯示草稿標識。
- 生產環境必須從首頁、歸檔、詳情路由、標籤、搜尋索引、RSS 和站點地圖中排除草稿。
- 準備發布前必須將 `draft` 改為 `false` 並通過正式文章校驗。

## 3. 欄位順序

欄位必須按以下順序寫入：

1. `title`
2. `date`
3. `updated`
4. `description`
5. `draft`
6. `categories`
7. `tags`

可選欄位沒有值時必須省略，不得寫成空字串或 `null`。

## 4. 欄位約束

| 欄位 | 類型 | 必填 | 約束 |
| --- | --- | --- | --- |
| `title` | 字串 | 是 | 去除首尾空格後不得為空 |
| `date` | 日期字串 | 是 | 帶 `+08:00` 時區的 ISO 8601 格式 |
| `updated` | 日期字串 | 否 | 與 `date` 格式相同，只在實質更新時寫入 |
| `description` | 字串 | 否 | 去除首尾空格後不得為空，建議 40–160 字 |
| `draft` | 布林值 | 否 | 預設為 `false`，不得使用字串表示 |
| `categories` | 字串陣列 | 是 | 正式文章恰好一個；草稿允許為空 |
| `tags` | 字串陣列 | 是 | 正式文章至少一個；草稿允許為空；不得重複 |

## 5. YAML 排版

- Frontmatter 必須位於檔案開頭。
- `---` 分隔符必須單獨佔一行。
- Frontmatter 結束後保留一個空行再寫正文。
- 普通字串統一使用雙引號。
- 每級使用兩個空格縮排，不使用 Tab。
- 分類和標籤使用 YAML 塊陣列。
- 不使用內聯陣列。
- 不保留重複欄位或重複標籤。
- 格式化 Frontmatter 時不得修改正文。

正確：

```yaml
categories:
  - "筆記"
tags:
  - "astro"
  - "vscode"
```

錯誤：

```yaml
categories: 筆記
tags: ["Astro", "VS Code"]
```

## 6. 日期

```yaml
date: "2026-07-29T14:30:00+08:00"
```

不得省略時區，也不得使用斜槓日期或空格分隔的舊格式。`updated` 不得在每次儲存時自動重新整理。

## 7. 分類與標籤

- 正式文章必須只有一個分類。
- 英文字母標籤統一小寫。
- 純英文多詞標籤使用連字元。
- 中文標籤使用簡潔、穩定的名詞。
- 同一概念使用一個規範名稱。
- 相關但語義不同的標籤不得自動合併。
- 標籤建議 2–4 個；這是推薦要求，不是草稿儲存的硬限制。

規範化示例：

| 原始標籤 | 規範標籤 |
| --- | --- |
| `Astro` | `astro` |
| `CCF` | `ccf` |
| `MySQL` | `mysql` |
| `VS Code` | `vscode` |
| `Front Matter` | `front-matter` |
| `AI使用` | `ai使用` |

`資料庫/mysql`、`web開發/前端`、`ai使用/aigc` 表達不同概念，不得自動合併。

## 8. 禁止欄位

文章不得寫入：

- `pubDate`
- `updatedDate`
- `heroImage`
- `cover`
- `permalink`
- `comments`
- `layout`
- `laout`
- `excerpt`

頁面層可以派生 `pubDate = date` 和 `updatedDate = updated`，但不得寫回 YAML。

文章不設定 `heroImage`，所有文章頁使用主題配置中的 `postDefaultBackground`。

## 9. 新文章模板

```yaml
---
title: "${title}"
date: "${datetime}"
draft: true
categories: []
tags: []
---

<!-- more -->
```

`${datetime}` 必須輸出為 `yyyy-MM-ddTHH:mm:ss+08:00`。

## 10. 發布前校驗

- `title` 非空。
- `date` 合法且包含 `+08:00`。
- `updated` 存在時格式合法。
- `draft` 存在時是布林值。
- 正式文章恰好一個分類、至少一個標籤。
- 標籤沒有重複項。
- 不包含禁止欄位、重複鍵或無法解析的 YAML。

`draft: true` 必須阻止準備發布，直到使用者確認轉為正式文章。缺少 `description`、標籤少於 2 個或多於 4 個只產生提醒。

## 11. 倉庫命令

只讀檢查所有文章：

```bash
npm run frontmatter:check
```

顯式修復 Frontmatter：

```bash
npm run frontmatter:fix
```

修復工具會驗證正文雜湊，發現解析錯誤或正文變化時停止；它不會自動提交或暫存檔案。
