# LifeRisk 保險大富翁 · 新人理專決策練習場

新版 MVP 以「理解客戶 → 規劃保障 → 擲骰觸發事件 → 財務及理賠結算 → 教學回饋」為核心。玩家是新人理專，不以理賠最多或期末資產最高作為勝利條件。

- 四個預設客戶：工程師、醫師、教師、技術工作者。
- 五種參數化虛構商品：壽險、健康險、意外險、投資型保險、年金。
- 20 格棋盤、每位客戶 9 張專屬事件卡；一回合一年，共六回合。
- 每回合按落點類別從角色牌組獨立抽卡，同類未見的卡優先。
- 財務與風險規則、有效保單快照、條款判定、選答觀念題與回合結算。
- 同一事件下的目前規劃／不新增投保兩條現金路徑，計入本局保費、費用、帳戶、還款與給付；現金圖並標示兩條路徑的期間最低現金。
- 六項可展開公式的財務儀表；遊戲畫面即時試算住院、意外與失業三種情境；固定壓力測試以規劃／不新增投保對照。
- 一位客戶跑完六回合，直接查看報告；角色預設的優先需求保留在客戶卡與匯出紀錄。
- 桌機遊戲頁將品牌、客戶資訊、保險規劃、人生手帳與重開按鈕整合為單列頁首；窄螢幕自動換行。
- 決策歷程與學習報告 JSON 匯出、繁體中文響應式介面；重新整理即重新開始一局。

## VPS 啟動

Python 3.9+，無額外套件。從完整 bundle 可直接執行：

```sh
git clone liferisk-vps.bundle liferisk
cd liferisk
cp .env.example .env
chmod 600 .env
```

在伺服器的 `.env` 填入 `LLM_API_KEY`。預設 `LLM_BASE_URL=https://api.mistral.ai/v1` 與 `LLM_MODEL=zai-glm-5-3-flash`；請以帳號或相容供應商實際開放的模型 ID 為準。Base URL 含版本前綴，不加 `/chat/completions`。模型必須支援 chat completions 及 JSON mode。

```sh
python3 deploy/serve.py
```

啟動時會自動載入專案根目錄的 `.env`，不受目前工作目錄影響；shell 或 systemd 已設定的環境變數優先（包含空值）。支援單行 `KEY=value`、單／雙引號、`export` 前綴與註解，不執行命令或展開變數。`.env` 不存在時仍可啟動；格式錯誤會指出行號並停止啟動。修改後需重啟服務。

開啟 `http://127.0.0.1:8390`。Nginx 將整站（含 `/api/coach`）轉送到此服務。沿用 repo 的 systemd 範例時，將 WorkingDirectory、EnvironmentFile、ExecStart 的絕對路徑改成實際目錄。金鑰僅由後端讀取，靜態檔案僅從 `dist/` 供應。HTTP 503 表示未配置或暫時無法服務；上游拒絕時 server log 會顯示上游 HTTP 狀態。請檢查模型權限與 base URL。測試採模擬端點，未使用正式帳號推論。

## 教練與人工試玩

固定展示網址為 `http://127.0.0.1:8390/?demo=technician`，沿用同一個服務與 port。先顯示正常首頁，選張小姐後啟用固定六年骰點與事件（其他角色維持隨機），投保與推進回合仍由玩家手動操作；首頁維持一般遊戲。畫面與一般遊戲相同，重開使用原有按鈕；故事、旁白與錄影提示僅放在獨立 Markdown。相同配置可重現相同財務結果，教練文字可能不同。完整故事與三分鐘錄影建議見 [展示操作指南](docs/demo-storyboard.md)。

每個規劃回合及配置變更後會請求風險提示，顯示於「保險規劃」視窗左側面板；回合候選會結合上回合事件、開局優先需求與最近調整，並肯定做對的配置；棋盤畫面不放教練面板。期末教練讀取六年事件、配置與調整紀錄。「查看條款」內的「AI 白話解釋」與生活例子為內建模板文字，不呼叫 LLM。模型回答固定三個陣列 `risks`、`strengths`、`weaknesses`，各項含 `evidenceId`、`insight`。前後端驗證引用的證據、欄位和長度後，前端加上回合及原始觀察。失敗時顯示規則摘要，提供重試。金額與分數由規則引擎計算。教練的 system prompt 放在 `deploy/coach-prompt.txt`，可用環境變數 `COACH_PROMPT_FILE` 指到其他檔案；修改後重啟服務即生效，不需動 `serve.py`。

人工試玩可核對引擎測試的住院案例：林先生首年配置一單位健康險，遇到 10 萬元住院支出，兩條路徑給付分別為 8 萬／0 元，期末現金為 98.2 萬／92 萬元。未新增保單的一側仍保有既有壽險。若兩條線重疊可展開逐點金額。回合選答不計分；終局三題全部完成後，契約理解 20 分才併入總分。試玩者可匯出本機決策紀錄。

## 驗證

```sh
python3 -m unittest discover -s tests -p "test_*.py"
node --test tests/*.cjs
node tests/engine.test.cjs
node tests/investment.test.cjs
node --check dist/academy.js
```

新引擎測試涵蓋：事件前投保鎖定、給付上限與除外情境、投資及年金帳務、還款本金、身故避免雙計、解約費、流動性與借款、雙時間線、角色抽卡、運氣不直接計分、退休非破壞式試算、狀態守門及四角色完整流程。

## 檔案

| 路徑 | 用途 |
| --- | --- |
| `dist/index.html` | 新版入口 |
| `dist/logo.svg` | 品牌 logo（傘＋骰子徽章），同時作為 favicon |
| `dist/academy.css` | 新版視覺與響應式版面 |
| `dist/academy-engine.js` | 角色、契約、事件、財務、風險、評分與回饋規則 |
| `dist/academy.js` | 視圖、互動與匯出 |
| `tests/academy.test.cjs` | 新版引擎測試 |
| `tests/ui-smoke.cjs` | 視圖流程煙霧測試（開局至報告，無瀏覽器） |
| `docs/mvp-design.md` | 架構、公式、規則、假設與後續 LLM 邊界 |
| `dist/v0.html` | 保留的 V0 入口及其既有資產 |
| `docs/v0-readme.md` | 原版說明與 VPS 部署資料 |
| `deploy/` | 原 V0 VPS 設定，本次未操作 |

## 自動部署（push to main → VPS）

`main` 是部署分支。任何人 push 到 `main`，VPS 會在 **2 分鐘內**自動部署（systemd timer 輪詢）：

1. `git fetch` 比對 `origin/main`
2. 在獨立 worktree 檢出該 commit，跑 `python3 -m unittest` 與 `node --test`
3. **測試全過才會** `git reset --hard` 到該 commit、重啟服務
4. 健康檢查 `GET /health`；15 秒內沒起來就**自動回滾**到前一個 commit

- 測試失敗 → 部署取消，線上維持舊版（log 會寫原因）
- `.env`、`server.log` 等未追蹤檔不會被 reset 覆蓋
- 部署 log：VPS `/home/llama/liferisk-deploy/deploy.log`
- 想立刻部署：`systemctl --user start liferisk-deploy.service`（不必等 2 分鐘）

> 因為 GitHub Actions 的 self-hosted runner 需要 repo admin 權限，這裡採 pull-based CD（VPS 主動拉），不需要對外開任何 inbound port。

## 範圍與限制

每回合代表一年，六回合結算。未實作真實核保、等待期、完整商品費率、即時市場、多人競賽或完整數十年人生。

角色、報酬、費用、保障與年金轉換係數都是教學假設，並非真實商品或預測。既有壽險假設已繳清，其歷史成本不在本局計算中。不同角色和題目難度尚未校準，不用於正式專業評等。詳見 [MVP 設計](docs/mvp-design.md)。
