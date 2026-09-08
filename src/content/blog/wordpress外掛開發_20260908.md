---
title: "寫一個 WordPress 外掛：修好散落在上千篇文章裡的壞掉短碼"
date: "2026-09-08T14:00:00+08:00"
description: "一個單檔 WordPress 外掛的完整設計說明：用 preg_replace_callback 分兩段修短碼、被 wptexturize 偷換成彎引號的坑、不需要 OFFSET 的自然分批，以及教學文章最常省略的那幾行權限檢查。"
draft: false
categories:
  - "開發"
tags:
  - "wordpress"
  - "php"
  - "外掛開發"
  - "正規表達式"
---

網站搬遷或換編輯器之後，最麻煩的不是版面跑掉——那看得見。最麻煩的是短碼被改壞：頁面上什麼都不顯示，但你要一篇一篇打開才知道哪些壞了。

我寫了一個外掛處理這件事，[原始碼在 GitHub](https://github.com/Joe4NYC/pdfjs-viewer-shortcode-fixer)。這篇不是教學，是把幾個當下做過取捨的決定寫下來，包括一個我覺得很難自己想到、只能踩過才知道的 WordPress 行為。

<!-- more -->

## 壞掉的長什麼樣

`[pdfjs-viewer]` 這個短碼被改壞成兩種形狀。

第一種是多出一個 `attachment_id`，而且常常**直接黏在前一個屬性後面，中間沒有空白**：

```text
[pdfjs-viewer url="https://example.com/file.pdf"attachment_id="123" ...]
```

第二種更惡劣，`url` 的值被 auto-linkify 轉成了 Markdown 連結語法：

```text
url="[https://example.com/file.pdf"](https://example.com/file.pdf%22 "https://example.com/file.pdf%22")
```

它應該只是：

```text
url="https://example.com/file.pdf"
```

兩種都不會讓 WordPress 報錯，只會讓 viewer 安靜地不顯示。

## 為什麼是單一檔案、沒有類別

整個外掛是一個 `.php` 檔、514 行，沒有 class、沒有 composer、沒有建置步驟。所有函式用 `pjvsf_` 前綴避免撞名。

這不是偷懶。WordPress 外掛的部署現實是「把檔案丟進 `wp-content/plugins/`」，加一層 autoloader 只是讓自己多一個要維護的東西。功能單一、生命週期短的工具外掛，單檔就是正確答案。

開頭那行是規矩，不是裝飾：

```php
defined( 'ABSPATH' ) || exit;
```

沒有它，別人直接用網址打你的 `.php` 就會在 WordPress 環境外執行。

## 修字串：先切出短碼，再分兩段洗

直覺做法是寫一個超大的正規表達式一次比對整段內容。我沒有這樣做，因為那種正規表達式三個月後自己也看不懂。

實際做法是先把每個短碼**整段**抓出來，再在裡面做兩次獨立替換：

```php
function pjvsf_clean_content( $content ) {
    return preg_replace_callback(
        '/\[pdfjs-viewer\b[^\]]*\]/iu',
        static function ( $match ) {
            $shortcode = $match[0];

            // 1. 拿掉多餘的 attachment_id
            $shortcode = preg_replace( '/[\p{Z}\s]*attachment_id[\p{Z}\s]*=.../iu', '', $shortcode );

            // 2. 把被轉成 Markdown 的 url 修回來
            $shortcode = preg_replace( '/url\s*=\s*.../iu', 'url="$1"', $shortcode );

            return $shortcode;
        },
        $content
    );
}
```

兩次替換是**無條件執行**的，不先判斷「這篇是哪一種壞法」。少一組分支，也少一組會出錯的判斷。沒中就原字串返回，沒有副作用。

另外注意 `[\p{Z}\s]*` 而不是 `\s*`。`\p{Z}` 是 Unicode 的空白類別，涵蓋不斷行空格那種從 Word 貼進來的東西。搭配 `/u` 修飾符才會生效。

## 那個只能踩過才知道的坑

第二段正規表達式裡，引號的部分我寫成 `[”"“]`——**同時接受直引號和兩種彎引號**。

原因是 WordPress 有個叫 `wptexturize()` 的函式，會自動把直引號 `"` 轉成排版用的彎引號 `“ ”`。它是為了讓文章排版好看，但它**不管那個引號是不是短碼屬性的一部分**。

所以同一個壞掉的短碼，在資料庫裡可能是直引號，也可能是彎引號，取決於它當初怎麼被存進去。只認直引號的正規表達式會漏掉一半的資料，而且你完全不會發現——因為它們不會報錯，只是沒被修到。

這種行為在文件裡不會寫成「警告」，只能在資料上撞到。

## 分批：不需要 OFFSET

要處理幾千篇文章就得分批。傳統做法是 `LIMIT 50 OFFSET 0`、`OFFSET 50`、`OFFSET 100` 一路往下記頁碼。

這裡不用，因為**修好的文章會自動從結果集消失**——它的內容已經不符合任何一種壞掉的形狀了。所以每次都查「第一批還壞著的」就好，天然就是下一批：

```php
// 修好的文章下次查詢就不會再出現，
// 所以用同樣的 limit 再跑一次，拿到的自然是下一批。
$posts = pjvsf_get_affected_posts( $batch_size );
```

代價是不能靠 SQL 直接篩出「壞掉的」——`LIKE '%pdfjs-viewer%'` 只能篩出「含有這個短碼的」，裡面有很多是好的。所以要**多撈一點再用 PHP 過濾**：

```php
LIMIT %d  // max( $limit * 4, $limit + 200 )
```

撈四倍是個經驗值，不是算出來的。壞掉比例很低的網站可能要調高。

查詢還排除了四種狀態：

```sql
WHERE post_status NOT IN ('auto-draft', 'inherit', 'revision', 'trash')
```

`revision` 這個特別重要。WordPress 的修訂版本也是 `posts` 表裡的一列，內容是舊版全文。不排除的話同一篇文章會被算很多次，而且你去改修訂版本沒有任何意義。

## 一次修一篇，不要迴圈跑完

修改的部分走 AJAX，一次只處理一篇文章。

理由是 PHP 有執行時間上限。一個迴圈跑兩千次 `wp_update_post()`，在共享主機上幾乎一定會超時，然後你不知道它做到哪裡、有沒有做完。

一次一篇的話：超時最多影響一篇，進度條是真的進度，每篇的結果（修好／跳過／失敗）都看得到。前端用原生 `fetch`，沒有 jQuery。

```php
$result = wp_update_post( array( 'ID' => $post_id, 'post_content' => $cleaned ), true );

if ( is_wp_error( $result ) ) {
    wp_send_json_error( array( 'message' => $result->get_error_message() ) );
}
```

`wp_update_post()` 第二個參數傳 `true` 才會回傳 `WP_Error`，否則失敗時只回傳 `0`，你拿不到原因。

## 教學文章最常省略的那幾行

每個 AJAX handler 開頭都有這兩段：

```php
check_ajax_referer( PJVSF_NONCE_ACTION, 'nonce' );

if ( ! current_user_can( 'manage_options' ) ) {
    wp_send_json_error( array( 'message' => 'Insufficient permissions.' ) );
}
```

第一行擋 CSRF，第二行擋權限。**兩個都要，缺一不可**，因為它們防的是不同的事：nonce 防「別的網站誘導你的管理員發出這個請求」，權限檢查防「已登入的訂閱者直接呼叫這個端點」。

只做 nonce 不做權限，任何登入使用者都能改你全站的文章內容。這是 WordPress 外掛最常見的漏洞形狀之一，而網路上大量的 AJAX 教學只寫了 nonce。

所有進來的 ID 也都過 `absint()`，批次大小另外夾在 1–5000 之間，避免一個手殘的輸入讓資料庫一次撈幾十萬列。

## 刻意不做的事

外掛**只改 `post_content`**，不碰附件文章、不碰媒體檔案、不碰短碼裡其他任何屬性。

範圍定得越窄，出事的時候越好回滾。這個工具的最壞情況是「改壞了文章內容」，而那個有資料庫備份就能救。如果它還會動媒體檔案，最壞情況就變成不可逆了。

同樣的理由，它也沒有做預覽 diff。要做就要處理短碼在編輯器裡的各種呈現差異，複雜度會翻倍，但真正需要的資訊——「這篇會不會被改」——列表已經回答了。

---

回頭看，這個外掛真正花時間的不是寫功能，是搞清楚資料到底壞成什麼形狀。`wptexturize()` 那個彎引號如果沒發現，功能全都寫對也只會修好一半，而且你會以為自己修完了。

寫工具型外掛的順序大概是：先把壞掉的樣本撈幾十筆出來看清楚，再決定正規表達式怎麼寫。反過來做一定會漏。
