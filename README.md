# Minecraft Web 3D ⛏️

一個在瀏覽器中運行的 **Minecraft 風格 3D 開放世界**，使用 [Three.js](https://threejs.org/) 和純 JavaScript 打造。

👉 **立即遊玩**: https://arno721.github.io/magicworld/

---

## 功能特色

- **程序化生成世界** — Perlin 噪聲生成地形，包含山脈、洞穴、樹木
- **方塊系統** — 11 種不同類型的方塊（草、泥土、石頭、原木、樹葉、沙子、木材、鵝卵石、磚塊、礫石、雪）
- **方塊破壞與放置** — 左鍵破壞方塊，右鍵放置方塊
- **物理碰撞** — 完整 AABB 碰撞檢測，支援行走、跳躍、重力
- **第一人稱視角** — Pointer Lock Controls，滑鼠控制視角
- **背包工具欄** — 9 格快捷欄，數字鍵/滾輪切換方塊
- **分塊生成 (Chunk System)** — 5×5 區塊（80×80 方塊世界），高效渲染
- **洞穴系統** — 3D 噪聲生成地下洞穴
- **動態光照** — 方向光、環境光、半球光，支援陰影

## 操作方式

| 按鍵 | 動作 |
|------|------|
| `W A S D` | 移動（前後左右） |
| `空白鍵` | 跳躍 |
| `左鍵` | 破壞方塊 |
| `右鍵` | 放置方塊 |
| `1-9` | 選擇方塊 |
| `滾輪` | 切換方塊 |
| `點擊畫面` | 鎖定滑鼠游標 |

## 技術架構

- **Three.js** — 3D 渲染引擎
- **PointerLockControls** — 第一人稱視角控制
- **Perlin Noise** — 程序化地形生成（2D/3D）
- **Greedy Meshing** — 每個 Chunk 合併為單一 Mesh 以優化效能
- **Vertex Colors** — 無需紋理即可呈現方塊顏色

## 世界生成

世界大小為 80×80 方塊（5×5 區塊），高度 64 方塊。生成過程包含：
1. 2D Perlin 噪聲決定地形高度
2. 3D Perlin 噪聲生成洞穴結構
3. 自動放置樹木（噪聲分佈控制密度）
4. 海灘/沙漠生物群落（低海拔區域）

## 本地執行

無需安裝任何套件，使用支援 ES Module 的現代瀏覽器搭配靜態伺服器執行：

```bash
# 使用 VS Code Live Server 或 npx
npx serve .

# 或直接啟動本地 server（修復版）:
python serve_local.py
```

> 因 ES Modules 使用 **CORS** 限制，無法直接雙擊開啟檔案，需要使用 HTTP 伺服器。

## 專案結構

```
magicworld/
├── index.html          # 入口頁面（HTML + CSS）
├── js/
│   ├── main.js         # 主程式入口與遊戲循環
│   ├── constants.js    # 常數、方塊類型與顏色定義
│   ├── perlin.js       # Perlin 噪聲生成器（2D/3D）
│   ├── chunk.js        # 區塊系統（資料儲存與網格建構）
│   ├── world.js        # 世界生成（地形、洞穴、樹木）
│   └── player.js       # 玩家控制（移動、碰撞檢測）
└── README.md           # 專案說明
```

## 授權

MIT License
