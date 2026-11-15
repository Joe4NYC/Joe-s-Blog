---
title: "雲端 VM 上的 AI agent：我把 Claude Code 撤下來，換成 DeepSeek API"
date: "2026-11-15T21:00:00+08:00"
description: "我的 Oracle Cloud VM 原本由 Claude Code 登入帳號、經 Telegram bot 接指令，也負責替 jobwatch 的實習職位打標籤。後來我覺得這樣做風險太大，改成用 DeepSeek Harness 配 DeepSeek API key，VM 上的改動交給 Mac 上的 Claude Code 做。這篇記錄換的過程和幾個取捨。"
draft: true
categories:
  - "開發"
tags:
  - "oracle-cloud"
  - "deepseek"
  - "automation"
  - "side-project"
---

上一篇[一部免費雲端 VM 幫我盯住兩樣嘢](/blog/免費vm自動監察實習與canvas死線_20261101/)講過，我在 Oracle Cloud 開了一部 VM 跑 jobwatch 和 canvaswatch。當時 VM 上還裝了 Claude Code，登入我的帳號，經一個 Telegram bot 接指令，jobwatch 的職位標籤也是由它打的。

用了一陣子，我決定把 VM 上的 Claude Code 撤下來，改成 DeepSeek Harness（dsh）配 DeepSeek API key。這篇講為什麼換、試過哪些路、換完之後分工變成怎樣。

<!-- more -->

![架構對比圖：左邊是之前，VM 上的 Claude Code 登入帳號、經 Telegram bot 接指令，同時替 jobwatch 打標籤；右邊是之後，VM 上改跑 DeepSeek Harness 和 jobwatch，各用一條獨立的 DeepSeek API key，VM 的改動由 Mac 上的 Claude Code 執行，API key 由我自己寫入](/image/vm-agent換deepseek_20261115/before-after.svg)

*換之前和換之後：VM 上不再有登入帳號的 Claude Code，也不再有 Telegram bot。*

## 為什麼覺得在 VM 上跑 Claude Code 有風險

<!-- TODO(Joe)：補你覺得風險喺邊（例如：VM 長開、帳號登入狀態放喺雲端、Telegram 任何訊息都可以叫佢做嘢？），用你自己嘅講法寫，唔好放 VM 名、IP、帳號資料 -->

所以我把 VM 上的 agent 改成用 API key 的做法，不再在 VM 上登入 Claude Code。

## 試過的路：先免費模型，再直接用 DeepSeek

![路線圖：第一步是 VM 上的 Claude Code（已撤下），第二步試過 OpenRouter 的免費模型，第三步買了 ¥10 DeepSeek 額度、直接用 DeepSeek API（deepseek v4.1 flash），最後選用第三步](/image/vm-agent換deepseek_20261115/route.svg)

*我實際走過的三步，最後停在直接用 DeepSeek API。*

1. **OpenRouter 的免費模型**：第一個試的，因為不用付錢。
   <!-- TODO(Joe)：補點解唔用 OpenRouter 免費模型（速度？限額？質素？） -->
2. **直接用 DeepSeek API**：買了 ¥10 的 DeepSeek 額度，模型用 deepseek v4.1 flash，最後就定了這個。
   <!-- TODO(Joe)：補用咗一段時間之後 ¥10 用咗幾多、夠唔夠用 -->

agent 本身用 DeepSeek Harness（dsh）。

<!-- TODO(Joe)：補 dsh 係乜、點裝、點解揀佢（可以附官方連結） -->

## 換完之後，誰做什麼

| 工作 | 之前 | 之後 |
| --- | --- | --- |
| VM 上的 agent | Claude Code（登入帳號） | DeepSeek Harness＋DeepSeek API key |
| jobwatch 自動打標籤 | VM 上的 Claude Code | DeepSeek API，**另開一條獨立 key** |
| 改 VM 上的設定和程式 | VM 上的 Claude Code 自己改 | Mac 上的 Claude Code 去改 |
| 把 API key 寫上 VM | — | 我自己手動寫，不經 AI |
| 用 Telegram 指揮 agent | 有一個 Telegram bot | 不要了，bot 已刪除 |

幾個決定的原因：

- **jobwatch 用獨立的 key**：打標籤和 agent 各用一條 DeepSeek key。<!-- TODO(Joe)：補點解要分開兩條 key -->
- **API key 自己寫**：VM 的改動交給 Mac 上的 Claude Code，但 key 由我自己寫上 VM。<!-- TODO(Joe)：補點解 key 要自己寫 -->
- **不做 Telegram 介面**：原本計劃替 dsh 也接一個 Telegram bot，後來發現我根本不需要用手機指揮 VM，於是連計劃也取消了；舊的 Claude Code 也登出了，它用的 Telegram bot 一併刪掉。

## 順手簡化了 jobwatch 的標籤

搬標籤功能的時候，我也重看了一次標籤設計。原本除了 🎯、👀、➖，還有一個 ⏱，代表「可以計入 WIE（實習學分）」。後來我想通了：**任何實習都可以計入我的 WIE 要求**，這個標籤分不出什麼，所以刪掉，只留 🎯、👀、➖ 三個。

<!-- TODO(Joe)：補 🎯／👀／➖ 各自代表咩、DeepSeek 打標籤準唔準 -->

## 小結

<!-- TODO(Joe)：補換咗之後嘅感受：穩定性、成本、有冇懷念 Claude Code 嘅地方 -->

回頭看，這次改動其實是三件事：VM 上的 agent 由登入帳號改成用 API key、key 由我自己寫、用不著的 Telegram 入口直接拿走。
