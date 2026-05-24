const providerSelect = document.querySelector("#providerSelect");
const modelInput = document.querySelector("#modelInput");
const apiKeyInput = document.querySelector("#apiKeyInput");
const promptInput = document.querySelector("#promptInput");
const assetTypeSelect = document.querySelector("#assetTypeSelect");
const styleSelect = document.querySelector("#styleSelect");
const seedInput = document.querySelector("#seedInput");
const randomBtn = document.querySelector("#randomBtn");
const variantsBtn = document.querySelector("#variantsBtn");
const generateBtn = document.querySelector("#generateBtn");
const upgradeInput = document.querySelector("#upgradeInput");
const upgradeBtn = document.querySelector("#upgradeBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const copyPromptBtn = document.querySelector("#copyPromptBtn");
const promptPreview = document.querySelector("#promptPreview");
const thinkingList = document.querySelector("#thinkingList");
const statusPill = document.querySelector("#statusPill");
const providerStatus = document.querySelector("#providerStatus");
const canvas = document.querySelector("#assetCanvas");
const ctx = canvas.getContext("2d");
const variantStrip = document.querySelector("#variantStrip");
const assetSummary = document.querySelector("#assetSummary");
const elementSummary = document.querySelector("#elementSummary");
const tierSummary = document.querySelector("#tierSummary");

const steps = {
  prompt: document.querySelector("#stepPrompt"),
  generate: document.querySelector("#stepGenerate"),
  remove: document.querySelector("#stepRemove"),
};

const DEFAULT_MODELS = {
  zhipu: "glm-image",
  dashscope: "wan2.6-t2i",
  openai: "gpt-image-1-mini",
};

const EXAMPLES = [
  { text: "方天画戟，中国长柄戟，长杆，中央枪尖，左右对称月牙刃", type: "auto", seed: "halberd-01", upgrade: "附加雷电核心" },
  { text: "龙骨匕首", type: "auto", seed: "dragon-dagger", upgrade: "增加暗影符文和紫色毒雾" },
  { text: "水晶头盔", type: "auto", seed: "crystal-helm", upgrade: "变为冰属性并增加悬浮冰晶" },
  { text: "木制盾牌", type: "shield", seed: "oak-shield", upgrade: "附加圣光纹章和金属包边" },
];

let generated = false;
let selectedVariant = 0;
let currentName = "looty-asset";
let activeUpgradeText = "";
let backendResult = null;

function sanitizeText(value, fallback = "方天画戟") {
  return (value || "").trim().replace(/\s+/g, " ") || fallback;
}

function setStatus(text, done = false, error = false) {
  statusPill.textContent = text;
  statusPill.classList.toggle("done", done);
  statusPill.classList.toggle("error", error);
}

function setStep(name, state) {
  steps[name].className = `pipeline-step ${state}`;
}

function resetSteps() {
  setStep("prompt", "active");
  setStep("generate", "");
  setStep("remove", "");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawPlaceholder(text = "等待 AI 生成") {
  clearCanvas();
  ctx.save();
  ctx.translate(256, 256);
  ctx.strokeStyle = "#63e6d4";
  ctx.fillStyle = "rgba(99, 230, 212, 0.14)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, -164);
  ctx.lineTo(42, -24);
  ctx.lineTo(112, -42);
  ctx.lineTo(48, 22);
  ctx.lineTo(72, 152);
  ctx.lineTo(0, 82);
  ctx.lineTo(-72, 152);
  ctx.lineTo(-48, 22);
  ctx.lineTo(-112, -42);
  ctx.lineTo(-42, -24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f7f3e8";
  ctx.font = "700 22px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(text, 0, 206);
  ctx.restore();
}

function buildLocalPrompt() {
  const text = sanitizeText(promptInput.value);
  const style = styleSelect.options[styleSelect.selectedIndex].textContent;
  const upgrade = activeUpgradeText ? `，升级方向：${activeUpgradeText}` : "";
  return `生成 ${text}，风格为${style}，单个游戏道具，清晰轮廓，透明 PNG，无文字、无人物、无背景${upgrade}。`;
}

function updatePromptPreview(text = buildLocalPrompt()) {
  promptPreview.textContent = text;
}

function updateThinking(items = ["等待输入后解析类型、属性与画风。"]) {
  thinkingList.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    thinkingList.append(li);
  });
}

function updateInspector(result = {}) {
  assetSummary.textContent = result.assetLabel || "自动识别";
  elementSummary.textContent = result.elementLabel || "待识别";
  tierSummary.textContent = `Tier ${result.tier || 1}${(result.tier || 1) > 1 ? " 进化" : ""}`;
}

function updateDownloadName(result = {}) {
  const base = `${result.assetLabel || "asset"}-${sanitizeText(promptInput.value)}`;
  currentName = base.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  if ((result.tier || 1) > 1) currentName += "-evolved";
}

function updateModelDefault() {
  modelInput.value = DEFAULT_MODELS[providerSelect.value] || "";
  providerStatus.textContent = `${providerSelect.options[providerSelect.selectedIndex].textContent} / 未验证`;
  providerStatus.className = "mock";
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    if (health.provider === "unconfigured") {
      providerStatus.textContent = "等待页面 Key";
      providerStatus.className = "error";
    } else {
      providerStatus.textContent = `${health.provider} / 环境变量`;
      providerStatus.className = "ok";
    }
  } catch {
    providerStatus.textContent = "后端未连接";
    providerStatus.className = "error";
  }
}

async function requestBackend(upgradeText = "") {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: sanitizeText(modelInput.value, DEFAULT_MODELS[providerSelect.value]),
      allowMock: false,
      text: sanitizeText(promptInput.value),
      assetType: assetTypeSelect.value,
      style: styleSelect.value,
      seed: sanitizeText(seedInput.value, "looty-demo"),
      upgradeText,
      variant: selectedVariant,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.detail || payload.hint || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function drawImageToCanvas(src) {
  const image = new Image();
  image.onload = () => {
    clearCanvas();
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  };
  image.src = src;
}

function renderVariants(result) {
  variantStrip.innerHTML = "";
  (result.variants || []).forEach((variant) => {
    const card = document.createElement("button");
    card.className = `variant-card${variant.index === selectedVariant ? " active" : ""}`;
    card.type = "button";
    const thumb = document.createElement("img");
    thumb.src = variant.image;
    thumb.alt = `变体 ${variant.index + 1}`;
    const label = document.createElement("div");
    label.innerHTML = `<strong>变体 ${variant.index + 1}</strong><span>${result.provider} / ${result.model}</span>`;
    card.append(thumb, label);
    card.addEventListener("click", () => {
      selectedVariant = variant.index;
      runGeneration(activeUpgradeText);
    });
    variantStrip.append(card);
  });
}

function applyResult(result) {
  backendResult = result;
  drawImageToCanvas(result.image);
  updatePromptPreview(result.prompt);
  updateThinking(result.thinking || []);
  updateInspector(result);
  updateDownloadName(result);
  renderVariants(result);
}

async function runGeneration(upgradeText = "") {
  activeUpgradeText = sanitizeText(upgradeText, "");
  backendResult = null;
  generated = false;
  updatePromptPreview();
  resetSteps();
  setStatus("解析需求中");
  generateBtn.disabled = true;
  upgradeBtn.disabled = true;
  downloadBtn.disabled = true;

  await wait(160);
  setStep("prompt", "done");
  setStep("generate", "active");
  setStatus("调用真实 AI");

  try {
    const result = await requestBackend(activeUpgradeText);
    if (result.provider === "mock") throw new Error("后端返回 Mock，说明没有走真实 AI。");
    applyResult(result);
    setStep("generate", "done");
    setStep("remove", "active");
    setStatus("处理透明 PNG");
    await wait(160);
    setStep("remove", "done");
    setStatus("AI 生成完成", true);
    providerStatus.textContent = `${result.provider} / ${result.model}`;
    providerStatus.className = "ok";
    generated = true;
  } catch (error) {
    drawPlaceholder("AI 调用失败");
    variantStrip.innerHTML = "";
    updatePromptPreview(error.payload?.prompt || buildLocalPrompt());
    updateThinking(error.payload?.thinking || ["真实 AI 接口没有成功返回图片，请检查 provider、模型名、Key 和余额。"]);
    setStep("generate", "error");
    setStatus("AI 调用失败", false, true);
    providerStatus.textContent = "真实 AI 未成功";
    providerStatus.className = "error";
    window.alert(`AI 调用失败：${error.message}`);
  } finally {
    generateBtn.disabled = false;
    upgradeBtn.disabled = false;
    downloadBtn.disabled = !generated;
  }
}

function randomExample() {
  const example = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
  promptInput.value = example.text;
  assetTypeSelect.value = example.type;
  seedInput.value = example.seed;
  upgradeInput.value = example.upgrade;
  selectedVariant = 0;
  runGeneration("");
}

function downloadImage() {
  if (!generated || !backendResult?.image) return;
  const link = document.createElement("a");
  link.download = `${currentName || "looty-asset"}-transparent.png`;
  link.href = backendResult.image;
  link.click();
}

async function copyPrompt() {
  const text = backendResult?.prompt || buildLocalPrompt();
  try {
    await navigator.clipboard.writeText(text);
    copyPromptBtn.textContent = "已复制";
    window.setTimeout(() => {
      copyPromptBtn.textContent = "复制 Prompt";
    }, 1200);
  } catch {
    updatePromptPreview(text);
  }
}

[promptInput, assetTypeSelect, styleSelect, seedInput, upgradeInput, modelInput].forEach((element) => {
  element.addEventListener("input", () => updatePromptPreview());
  element.addEventListener("change", () => updatePromptPreview());
});

providerSelect.addEventListener("change", updateModelDefault);
randomBtn.addEventListener("click", randomExample);
variantsBtn.addEventListener("click", () => {
  selectedVariant = 0;
  runGeneration(activeUpgradeText);
});
generateBtn.addEventListener("click", () => {
  selectedVariant = 0;
  runGeneration("");
});
upgradeBtn.addEventListener("click", () => {
  selectedVariant = 0;
  runGeneration(sanitizeText(upgradeInput.value, "附加雷电核心"));
});
downloadBtn.addEventListener("click", downloadImage);
copyPromptBtn.addEventListener("click", copyPrompt);

drawPlaceholder();
updatePromptPreview();
updateThinking();
updateInspector({ assetLabel: "长柄武器", elementLabel: "奥术属性", tier: 1 });
checkHealth();
