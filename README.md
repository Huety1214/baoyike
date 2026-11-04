# LifeRisk 保險大富翁 · 新人理專決策練習場

新版 MVP 以「理解客戶 → 規劃保障 → 擲骰觸發事件 → 財務及理賠結算 → 教學回饋」為核心。玩家是新人理專，不以理賠最多或期末資產最高作為勝利條件。

- 四個預設客戶：工程師、醫師、教師、技術工作者。
- 五種參數化虛構商品：壽險、健康險、意外險、投資型保險、年金。
- 20 格棋盤、每位客戶 9 張專屬事件卡；一回合一年，共六回合。
- 每回合按落點類別從角色牌組獨立抽卡，同類未見的卡優先。
- 財務與風險規則、有效保單快照、條款判定、選答觀念題與回合結算。
- 同一事件下的目前規劃／不新增投保兩條現金路徑，計入本局保費、費用、帳戶、還款與給付。
- 六項可展開公式的財務儀表；固定壓力測試及標準化能力評分。
- 一位客戶跑完六回合，直接查看報告；開局勾選的需求與判斷保留在客戶卡與匯出紀錄。
- localStorage 續玩、決策歷程與學習報告 JSON 匯出、繁體中文響應式介面。

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
set -a
. ./.env
set +a
python3 deploy/serve.py
```

開啟 `http://127.0.0.1:8390`。Nginx 將整站（含 `/api/coach`）轉送到此服務。沿用 repo 的 systemd 範例時，將 WorkingDirectory、EnvironmentFile、ExecStart 的絕對路徑改成實際目錄。金鑰僅由後端讀取，靜態檔案僅從 `dist/` 供應。HTTP 503 表示未配置或暫時無法服務；上游拒絕時 server log 會顯示上游 HTTP 狀態。請檢查模型權限與 base URL。測試採模擬端點，未使用正式帳號推論。

## 教練與人工試玩

每個規劃回合及配置變更後會請求風險提示。期末教練讀取六年事件、配置與調整紀錄。模型回答固定三個陣列 `risks`、`strengths`、`weaknesses`，各項含 `evidenceId`、`insight`。前後端驗證引用的證據、欄位和長度後，前端加上回合及原始觀察。失敗時顯示規則摘要，提供重試。金額與分數由規則引擎計算。

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
| `dist/academy.css` | 新版視覺與響應式版面 |
| `dist/academy-engine.js` | 角色、契約、事件、財務、風險、評分與回饋規則 |
| `dist/academy.js` | 視圖、互動、存檔與匯出 |
| `tests/academy.test.cjs` | 新版引擎測試 |
| `docs/mvp-design.md` | 架構、公式、規則、假設與後續 LLM 邊界 |
| `dist/v0.html` | 保留的 V0 入口及其既有資產 |
| `docs/v0-readme.md` | 原版說明與 VPS 部署資料 |
| `deploy/` | 原 V0 VPS 設定，本次未操作 |

## 範圍與限制

每回合代表一年，六回合結算。未實作真實核保、等待期、完整商品費率、即時市場、多人競賽或完整數十年人生。

角色、報酬、費用、保障與年金轉換係數都是教學假設，並非真實商品或預測。既有壽險假設已繳清，其歷史成本不在本局計算中。不同角色和題目難度尚未校準，不用於正式專業評等。詳見 [MVP 設計](docs/mvp-design.md)。
