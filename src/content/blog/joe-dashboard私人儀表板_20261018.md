---
title: "一個只有我看得到的儀表板：Cloudflare Worker＋Apple Reminders＋排程 AI"
date: "2026-10-18T21:45:00+08:00"
updated: "2026-10-18T21:52:19+08:00"
description: "我把死線、學校郵件、交換進度、學會工作放進同一個網頁 dash.joenyc.net，用 Cloudflare Access 鎖成只有自己能開。這篇記錄資料從哪裡來、怎樣自動更新，以及為什麼我刻意不把它做成另一個要手動維護的 App。"
draft: false
categories:
  - "開發"
tags:
  - "cloudflare-workers"
  - "automation"
  - "side-project"
---

大學生的事情散在太多地方：死線、學校郵件、交換進度、學會工作，各有各的地方。我想要的是早上打開手機，一個畫面就知道接下來 30 日要做什麼。

於是我做了 dash.joenyc.net：一個跑在 Cloudflare Worker 上的私人儀表板，前面加一層 Cloudflare Access，只有我自己登入得到。這篇講三件事——資料從哪裡來、怎樣做到幾乎不用手動更新、以及幾個設計上的取捨。

<!-- more -->

## 儀表板上有什麼

| 區塊 | 內容 | 資料來源 |
| --- | --- | --- |
| 未來 30 日 | 所有死線按日期排 | Apple Reminders |
| 學業 | 可按科目篩選；本週／未完成／全部 | Apple Reminders |
| 學校郵件摘要 | 每個平日早上的重點郵件 | Claude 排程任務 → Notion |
| 投資 | 每週損益與成本 | IBKR Flex 自動匯出 |
| LiU 交換 | 交換流程的待辦與倒數 | — |
| Campus YMCA | 內閣工作 | — |
| 個人 | 其他雜項 | Apple Reminders |

學校郵件摘要原本的位置是「實習申請」區塊，後來申請季過了，換成每天真正會看的郵件摘要。

## 架構：Worker＋KV，從 Mac 部署

整個站是一個 Cloudflare Worker，資料存在 Workers KV，專案放在我 Mac 上，用 `wrangler` 部署。

### 用 Cloudflare Access 鎖門，而不是自己寫登入

儀表板上有學業、郵件和投資資料，絕對不能公開。我沒有自己寫登入系統，而是在 Worker 前面放 Cloudflare Access：只有我的帳號能通過，其他人連頁面都看不到。

在 iPhone 上我把它加到主畫面當 PWA 用，打開就像一個 App。

## 讓它自己更新：三條自動化管道

儀表板最怕的是變成「又一個要手動維護的東西」。所以我定了一條原則：**我只在原本就會用的地方輸入，儀表板只負責顯示。**

### 1. Apple Reminders ⇄ 儀表板：每小時雙向同步

待辦我主要在 Apple Reminders 加和剔，因為 iPhone、Mac、Siri 都能直接用。Mac 上有一個 launchd 排程，每小時把 Reminders 同步到儀表板；完成狀態是雙向的——在儀表板剔了，Reminders 也會剔。

### 2. 學校郵件：Claude 排程任務 → Notion → 儀表板

每個平日早上 9 點，一個 Claude 排程任務會讀學校郵件、寫一份摘要到 Notion 一個叫「郵件總結」的頁面，儀表板再去讀那一頁。

有趣的是，我自己從來不打開那個 Notion 頁面——Notion 在這裡純粹是中轉站，讓 AI 有一個寫得進去、Worker 又讀得出來的地方。

### 3. 投資：IBKR Flex 每個平日早上自動拉

投資區塊只看三樣：每週損益、成本、總損益。數據用 IBKR 的 Flex 報表在平日早上自動拉回來，不用手動抄。
