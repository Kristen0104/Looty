# Looty

Looty, Make games easy.

Looty 是一个面向独立游戏开发者的 AI 2D 游戏素材生成工具。用户输入“方天画戟”“龙骨匕首”“水晶头盔”这类自然语言需求后，系统会先做类型、属性、画风解析，再封装成稳定的生图 Prompt，调用真实 AI 图片 provider 生成透明 PNG 素材。

## 现在解决了什么

- 不再把随机图案冒充 AI 结果：默认必须配置真实生图 API，离线 Mock 需要显式开启。
- 中文输入可正常识别：修复了原项目中文乱码导致的类型、属性识别失效。
- 生成不是“随机画”：后端会返回 AI 思考步骤、识别类型、属性主题、系统 Prompt 和负面约束。
- 页面更像真实产品：左侧输入需求，右侧展示透明 PNG、候选变体、AI 思考和可复制 Prompt。
- 支持装备进化：输入“附加雷电核心”等升级方向后，Prompt 会要求保留基础轮廓并叠加属性细节。

## 本地运行

安装依赖：

```bash
pip install -r requirements.txt
```

启动服务：

```bash
python backend/server.py
```

浏览器打开：

```text
http://127.0.0.1:8000
```

## 配置真实 AI 生图

现在页面左侧有“接口配置”区域，可以直接选择 provider 并输入 API Key：

- `ZhipuAI 智谱`：模型默认 `glm-image`
- `DashScope 通义万相`：模型默认 `wan2.6-t2i`
- `OpenAI Images`：模型默认 `gpt-image-1-mini`

页面里填的 Key 只会随本次请求发送给本地后端，不会写入项目文件。Provider 的显示名称无所谓，但传给后端的值必须是 `zhipu`、`dashscope` 或 `openai`。

### 页面直接使用 ZhipuAI

1. 启动后端：

```powershell
python backend/server.py
```

2. 浏览器打开 `http://127.0.0.1:8000`。
3. Provider 选择 `ZhipuAI 智谱`。
4. 模型保持 `glm-image`，或者改成你的智谱账号支持的图片模型，例如 `cogView-4-250304`。
5. 在 API Key 输入框粘贴智谱 Key。
6. 输入素材描述，点击“生成透明 PNG”。

也可以用环境变量方式：

```powershell
$env:LOOTY_IMAGE_PROVIDER="zhipu"
$env:ZHIPUAI_API_KEY="你的 ZhipuAI API Key"
$env:LOOTY_IMAGE_MODEL="glm-image"
python backend/server.py
```

### 方案 A：DashScope / 通义万相

PowerShell：

```powershell
$env:LOOTY_IMAGE_PROVIDER="dashscope"
$env:DASHSCOPE_API_KEY="你的 DashScope API Key"
$env:LOOTY_IMAGE_MODEL="wan2.6-t2i"
python backend/server.py
```

可选地区：

```powershell
$env:DASHSCOPE_REGION="cn-beijing"
```

### 方案 B：OpenAI Images API

PowerShell：

```powershell
$env:LOOTY_IMAGE_PROVIDER="openai"
$env:OPENAI_API_KEY="你的 OpenAI API Key"
$env:LOOTY_IMAGE_MODEL="gpt-image-1-mini"
python backend/server.py
```

后端会请求 OpenAI Images API，并优先要求 PNG 和透明背景输出。

## 离线演示模式

没有 API Key 时，可以显式打开 Mock：

```powershell
$env:LOOTY_ALLOW_MOCK="1"
python backend/server.py
```

Mock 只用于演示页面流程和透明 PNG 下载，不代表真实 AI 理解能力。比赛或答辩时建议使用真实 provider。

## 使用流程

1. 在“素材描述”输入具体装备，例如“方天画戟”。
2. 素材类型可以选“自动识别”，也可以手动指定“长柄武器”等类型。
3. 选择画风：美漫粗线游戏图标或精致 2D 像素风。
4. 点击“生成透明 PNG”，页面会展示 3 个候选变体。
5. 在“升级方向”输入“附加雷电核心”，点击“保留轮廓并进化”。
6. 满意后点击“下载 PNG”，得到可导入 Unity / Godot 的透明素材。

## 实现方式

项目是轻量前后端结构：

```text
.
├── index.html
├── styles.css
├── app.js
├── backend
│   ├── server.py
│   ├── prompt_engine.py
│   ├── openai_provider.py
│   ├── dashscope_provider.py
│   └── mock_generator.py
└── requirements.txt
```

核心链路：

1. 前端把用户输入、素材类型、画风、种子、升级方向提交到 `POST /api/generate`。
2. `backend/prompt_engine.py` 进行语义解析，识别素材类型和元素属性。
3. Prompt 引擎生成生产级生图 Prompt、负面约束和可展示的“AI 思考”。
4. `backend/server.py` 根据 `LOOTY_IMAGE_PROVIDER` 调用 DashScope 或 OpenAI。
5. provider 返回图片后，后端统一转为 `data:image/png;base64,...`。
6. 前端展示大图、3 个变体、生成意图、思考步骤，并支持下载 PNG。

## 开源参考方向

调研时参考了几类开源实现思路：

- OpenAI / DALL-E 简易 Web App：学习“前端表单 + 后端 provider 包装”的最小可用结构。
- Stable Diffusion / ComfyUI / Fooocus 类项目：借鉴“Prompt 模板、负面提示词、风格预设、批量候选图”的产品设计。
- PromptForge 类提示词工具：借鉴“把用户短输入转为可解释生成计划”的交互方式。

本项目没有直接复制大型项目代码，而是保留轻量架构，把关键能力落在 prompt 封装、真实 provider、可解释展示和透明 PNG 交付上。

## API 示例

请求：

```http
POST /api/generate
Content-Type: application/json
```

```json
{
  "text": "方天画戟",
  "assetType": "auto",
  "style": "vector",
  "seed": "looty-demo",
  "upgradeText": "附加雷电核心",
  "variant": 0
}
```

响应会包含：

```json
{
  "image": "data:image/png;base64,...",
  "variants": [],
  "prompt": "...",
  "assetType": "polearm",
  "assetLabel": "长柄武器",
  "element": "lightning",
  "elementLabel": "雷电属性",
  "tier": 2,
  "thinking": ["..."],
  "provider": "openai"
}
```
