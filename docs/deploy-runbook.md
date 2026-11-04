# 部署 runbook

## 日常流程

`main` = 部署分支。push 到 `main` → VPS 2 分鐘內自動部署。
`feature/*` 分支不會自動部署，合併進 `main` 才會。

## VPS 上的位置

- 線上目錄：`/home/llama/liferisk`（服務就是跑這個目錄的檔案）
- 服務：`liferisk-site.service`（systemd **user** service，`127.0.0.1:8390`）
- 對外：Cloudflare Tunnel `liferisk.tamayaki.org` → `127.0.0.1:8390`
- 部署腳本：`/home/llama/liferisk-deploy/deploy.sh`（**刻意放在 repo 外**，避免被 commit 改掉執行權限內容）
- 部署 log：`/home/llama/liferisk-deploy/deploy.log`

## 常用指令（在 VPS 上以 `llama` 身分執行）

```bash
systemctl --user status liferisk-site.service        # 服務狀態
systemctl --user restart liferisk-site.service       # 只重啟，不換版
systemctl --user start liferisk-deploy.service        # 立刻部署（不等 2 分鐘）
systemctl --user list-timers liferisk-deploy.timer    # 下次輪詢時間
tail -30 /home/llama/liferisk-deploy/deploy.log       # 看最近部署紀錄
curl -s http://127.0.0.1:8390/health                  # 本機健康檢查
```

## 部署成功長怎樣

`deploy.log` 會出現：

```
偵測到新 commit：abc1234 -> def5678
✅ 測試通過 @ def5678，開始部署
🚀 部署完成 def5678｜health=200｜公開站台=200
```

## 失敗時會怎樣

- **測試失敗**：部署取消，線上維持舊版，log 寫 `❌ Python/Node 測試失敗`
- **健康檢查失敗**：自動 `git reset --hard` 回上一個 commit 並重啟，log 寫 `↩️ 已回滾`
- **回滾後仍不健康**：`🔥` 開頭，需要人工看 `systemctl --user status liferisk-site.service`

## 憑證

`git fetch` 用的是 VPS 上 `/home/llama/.git-credentials`（`600`，只讀得到 = 只有 `llama`）。
`gh` CLI 沒有登入，也不需要用。

## 不做的事

- 不動 `.env`（API key 在那裡，git 未追蹤）
- 不跑資料庫 migration（本專案沒有資料庫）
- 不改 Cloudflare / DNS 設定
