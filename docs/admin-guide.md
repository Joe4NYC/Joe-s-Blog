# 網站後台使用說明

`/admin` 是一個類似 WordPress `wp-admin` 的管理後台：登入之後可以看儀表板、新增與編輯文章、上傳圖片、改網站設定，還能手動觸發部署。

---

## 1. 它是怎麼運作的

這個部落格是 Astro 產生的靜態網站，內容存在 git 裡（`src/content/blog/*.md`）。後台沒有資料庫，走的是這條路：

```
瀏覽器 /admin  ──►  Cloudflare Worker (/api/admin/*)  ──►  GitHub Contents API
                                                              │
                                                              ▼
                                                        commit 到 main
                                                              │
                                                              ▼
                                                    GitHub Actions 建置
                                                              │
                                                              ▼
                                                  wrangler deploy 到 Cloudflare
```

幾個直接的後果，先知道比較不會誤會：

- **儲存 ≠ 立刻上線。** 每次儲存是一個 git commit，接著 GitHub Actions 重新建置並部署，通常 1–3 分鐘後網站才會更新。
- **所有內容都有版本紀錄。** 改壞了可以在 GitHub 上還原任何一次 commit。
- **前台完全不受影響。** 只有 `/api/*` 會經過 Worker，其他網址一律直接由 Cloudflare 的靜態資源服務，速度跟原本一樣。
- **草稿是安全的。** `draft: true` 的文章不會出現在正式網站上。

檔案位置：

| 路徑 | 作用 |
| --- | --- |
| `public/admin/` | 後台介面（HTML / CSS / JS，純靜態） |
| `worker/` | 後台 API 的 Cloudflare Worker 原始碼 |
| `src/config/settings.json` | 後台可編輯的網站設定 |
| `.github/workflows/deploy.yml` | 建置並部署到 Cloudflare |

---

## 2. 第一次設定（照順序做一次就好）

### 2.1 產生一組 GitHub Token

1. 到 <https://github.com/settings/personal-access-tokens/new>（Fine-grained tokens）。
2. **Repository access** 選 *Only select repositories* → `Joe4NYC/Joe-s-Blog`。
3. **Repository permissions** 開這兩項：
   - `Contents`：**Read and write**（讀寫文章與圖片）
   - `Actions`：**Read and write**（觸發部署、讀取建置狀態）
4. 有效期限建議設 1 年，到期後記得重新產生並更新。
5. 產生後把 token 複製下來，只會顯示一次。

### 2.2 產生 Cloudflare API Token 與 Account ID

1. 到 <https://dash.cloudflare.com/profile/api-tokens> → *Create Token* → 用 **Edit Cloudflare Workers** 範本。
2. Account ID 在 Cloudflare 儀表板右側，或執行 `npx wrangler whoami` 查得到。

### 2.3 把 Cloudflare 金鑰放進 GitHub

到 GitHub 倉庫 → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*，新增兩個：

| 名稱 | 值 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 2.2 產生的 token |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Account ID |

### 2.4 部署一次，然後設定 Worker 的密鑰

```bash
npm ci
npm run build
npm run deploy          # 第一次部署，讓 Worker 存在
```

接著設定三個密鑰（每個指令會提示你貼上值，值不會進 git）：

```bash
npx wrangler secret put ADMIN_PASSWORD    # 後台登入密碼，請用長一點的隨機字串
npx wrangler secret put SESSION_SECRET    # 簽章用金鑰，用下面的指令產生
npx wrangler secret put GITHUB_TOKEN      # 2.1 的 GitHub token
```

產生 `SESSION_SECRET` 的方法（擇一）：

```bash
openssl rand -base64 48
# 或
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 2.5 確認

打開 <https://joe-s-blog.ng80160.workers.dev/admin/>，用 `ADMIN_PASSWORD` 登入。看到儀表板顯示文章數量就代表整條路都通了。

登入帳號名稱只是顯示用，寫在 `wrangler.jsonc` 的 `ADMIN_USERNAME`；真正驗證的是密碼。

---

## 3. 日常怎麼用

### 寫一篇新文章

1. 左側 **新增文章**。
2. 填標題 → 內文用 Markdown 寫，右邊會即時預覽。
3. 右欄填 **分類**（只能一個）和 **標籤**（至少一個），輸入後按 Enter。
4. 想先存著不公開 → 勾「儲存為草稿」；要正式上線 → 取消勾選。
5. 按 **建立文章**（或 `Ctrl` / `⌘` + `S`）。

檔名會自動用「標題_日期」產生，例如 `交換第一週_20260901.md`，網址就是 `/blog/交換第一週_20260901/`。

### 插入圖片

三種方式都可以：

- 直接**貼上**剪貼簿裡的圖片到編輯區
- 把圖片檔**拖進**編輯區
- 工具列的 **圖片** 按鈕 → 從媒體庫挑一張

圖片會存到 `public/image/<文章名>/`，文章裡用 `/image/...` 引用。單檔上限 5MB；很大的照片建議先壓縮，或部署後用 `npm run optimize:images` 轉成 WebP。

### 改網站設定

**網站設定** 頁可以改站名、描述、關於我頁面的個人資料與社群連結，以及各頁的標題文案。這些會寫回 `src/config/settings.json`。

改不到的東西（要動程式碼）：Hero 背景圖、頭像、版面配色。

### 發佈變更

正常情況下不用管——每次儲存都會自動觸發部署。右上角的 **發佈變更** 是給這些情況用的：

- 覺得網站沒更新，想手動重跑一次
- 部署失敗後要重試

**部署** 頁可以看最近幾次建置的成功／失敗與 GitHub 上的完整記錄。

---

## 4. 安全性

- 密碼存在 Cloudflare 的加密 secret 裡，登入後發一個 12 小時有效的簽章 cookie（`HttpOnly` + `Secure` + `SameSite=Strict`）。
- 所有寫入 API 會檢查請求來源，擋掉跨站送出的請求。
- 連續登入失敗會逐步延長鎖定時間。這個計數存在單一 Worker 執行個體的記憶體裡，換執行個體會重來，**所以真正的防線是一組夠長的密碼**——建議 20 字元以上的隨機字串，用密碼管理器存。
- `/admin` 與 `/api/` 已經在 `robots.txt` 與回應標頭標記 `noindex`，不會被搜尋引擎收錄。但這只是不被索引，網址本身是公開的，任何人都能看到登入畫面。
- GitHub token 只授權這一個倉庫的 Contents 與 Actions，外洩的影響範圍有限。覺得可能外洩就到 GitHub 撤銷並重設一次。

---

## 5. 遇到問題時

| 症狀 | 原因與處理 |
| --- | --- |
| 登入畫面顯示「缺少設定：ADMIN_PASSWORD」 | 密鑰沒設好，重跑 2.4 的 `wrangler secret put` |
| 「GitHub 拒絕存取」 | token 過期或權限不足，回 2.1 重新產生（要 Contents + Actions 讀寫） |
| 「找不到工作流程 deploy.yml」 | `.github/workflows/deploy.yml` 還沒推到 `main` 分支 |
| 儲存成功但網站沒變 | 到 **部署** 頁看建置是不是失敗了，點「紀錄」看 GitHub Actions 的錯誤訊息 |
| 建置失敗，錯誤提到 frontmatter | 本機執行 `npm run frontmatter:fix` 再推上去 |
| 「這篇文章在別處被改過了」 | 你在別的地方（本機或 GitHub 網頁）改過同一篇，重新載入頁面再編輯 |
| 部署一直是「進行中」 | GitHub Actions 排隊中，等一兩分鐘後按「重新整理」 |

### 本機測試後台

```bash
cp .dev.vars.example .dev.vars   # 填入測試用的密碼與 token
npm run dev:admin                # 建置後在 http://localhost:8787 起 Worker
```

`.dev.vars` 已經在 `.gitignore` 裡，不會被提交。

---

## 6. 開發者備註

- `worker/lib/frontmatter.ts` 的輸出格式刻意跟 `scripts/normalize-frontmatter.mjs` 逐字元一致，後台寫出的文章不會讓 `npm run frontmatter:check` 變紅。有測試（`worker/lib/frontmatter.test.ts`）盯著這件事。
- 文章列表用一次 GraphQL 請求把所有檔案內容抓回來，避免踩到 Cloudflare 的 subrequest 上限；GraphQL 不可用時會退回 REST，但只顯示最新的 30 篇。
- `npm run check` 會同時跑 `astro check` 與 Worker 的 `tsc`。
- 後台介面是沒有建置步驟的原生 ES module，改完 `public/admin/*` 直接重新 `npm run build` 就好。
