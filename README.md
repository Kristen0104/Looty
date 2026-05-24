# Looty

Looty, Make games easy.

Looty 是一个面向独立游戏开发者的 2D 游戏素材生成工具 MVP。目标是把“生图 -> 抠图 -> 导入引擎”的流程压缩成“输入文字 -> 选择风格 -> 下载透明 PNG”。

## 本地运行

推荐使用后端模式运行，这样前端会调用真实的 `/api/generate` 接口，完整展示“前端输入 -> 后端 Prompt 封装 -> 图片生成 -> 透明 PNG 返回”的产品链路。

```bash
python backend/server.py
```

打开浏览器访问：

```text
http://127.0.0.1:8000
```

当前后端默认使用 `mock` provider，不需要 API Key，也不需要安装依赖。它会根据任意用户输入生成一张透明 PNG 图标，并返回 Prompt、素材类型、属性、进化等级和 3 个变体。

如果直接打开 `index.html`，页面仍然可以运行，但会走前端本地兜底生成，能力弱于后端模式。

## 已实现功能

- 文本输入：支持任意武器、装备、道具描述。
- 画风选择：精致像素风、美漫粗线图标。
- 后端 Prompt 封装：自动组合用户输入、画风关键词、白底约束、透明 PNG 交付要求。
- 后端生成接口：`POST /api/generate`。
- 自定义道具兜底：无法归类到固定武器时，会生成“自定义道具 / 奥术”图标，而不是默认套成剑。
- 属性识别：支持火、冰、雷、毒、圣光、暗影、奥术。
- 变体生成：每次返回 3 个候选透明 PNG。
- 装备进化：传入升级方向后进入 Tier 2，保留基础轮廓并增加宝石、符文和属性特效。
- PNG 下载：导出透明背景 PNG，可直接导入 Unity / Godot / Cocos。

## 技术结构

```text
.
├── index.html
├── styles.css
├── app.js
├── backend
│   ├── server.py
│   ├── prompt_engine.py
│   └── mock_generator.py
└── requirements.txt
```

前端：

- `index.html`：页面结构。
- `styles.css`：响应式工作台 UI。
- `app.js`：表单交互、接口调用、兜底 Canvas 生成、下载逻辑。

后端：

- `server.py`：静态资源服务和 `/api/generate` 接口。
- `prompt_engine.py`：素材类型识别、属性识别、Prompt 封装。
- `mock_generator.py`：无依赖 PNG 生成器，用于没有真实 AI Key 时保持 Demo 可运行。

## API

请求：

```http
POST /api/generate
Content-Type: application/json
```

```json
{
  "text": "mechanical dart",
  "assetType": "auto",
  "style": "vector",
  "seed": "looty-demo",
  "upgradeText": "add lightning core",
  "variant": 0
}
```

响应：

```json
{
  "image": "data:image/png;base64,...",
  "variants": [
    { "index": 0, "image": "data:image/png;base64,..." }
  ],
  "prompt": "...",
  "assetType": "relic",
  "element": "lightning",
  "tier": 2,
  "provider": "mock"
}
```

浏览器前端会以 UTF-8 JSON 请求后端，中文输入可以正常识别。若在 PowerShell 里手写接口测试，建议先用英文样例，避免终端编码影响中文请求体。

## 后续接入真实 AI

当前 `mock_generator.py` 是为了保证评审环境可运行。真实商业版本可以在 `server.py` 的 `/api/generate` 流程中替换 provider：

1. 使用 `prompt_engine.py` 生成工业级 Prompt。
2. 调用即梦 1.5 / OpenAI / Stability / 通义万相等文生图或图生图接口。
3. 使用 `rembg` / Pillow 将白底图转为 Alpha PNG。
4. 返回透明 PNG 给前端。

这样前端交互、Prompt 封装、进化参数、变体展示和下载逻辑都可以继续复用。
