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
const statusPill = document.querySelector("#statusPill");
const canvas = document.querySelector("#assetCanvas");
const ctx = canvas.getContext("2d");
const variantStrip = document.querySelector("#variantStrip");

const steps = {
  prompt: document.querySelector("#stepPrompt"),
  generate: document.querySelector("#stepGenerate"),
  remove: document.querySelector("#stepRemove"),
};

const STYLE_PROMPTS = {
  pixel:
    "2D indie game pixel art, 16-bit style, sharp pixels, clear silhouette, pure solid white background for background removal, no background effects, no floating particles, standalone single object.",
  vector:
    "bold outline cartoon vector prop, clean cel shading, readable game icon silhouette, pure solid white background for background removal, no background effects, no floating particles, standalone single object.",
};

const TYPE_LABELS = {
  sword: "剑",
  axe: "斧头",
  hammer: "锤子",
  staff: "法杖",
  bow: "弓",
  shield: "盾牌",
  potion: "药水",
  coin: "金币/徽章",
};

let generated = false;
let lastConfig = null;
let currentName = "looty-asset";
let selectedVariant = 0;

const EXAMPLES = [
  { text: "火焰长剑", type: "sword", seed: "ember-sword" },
  { text: "冰霜法杖", type: "staff", seed: "frost-staff" },
  { text: "雷电战锤", type: "hammer", seed: "storm-hammer" },
  { text: "毒液药水", type: "potion", seed: "toxic-potion" },
  { text: "木制盾牌", type: "shield", seed: "oak-shield" },
  { text: "圣光徽章", type: "coin", seed: "holy-badge" },
  { text: "猎人长弓", type: "bow", seed: "hunter-bow" },
  { text: "熔岩战斧", type: "axe", seed: "lava-axe" },
];

function sanitizeText(value, fallback = "火焰长剑") {
  return value.trim().replace(/\s+/g, " ") || fallback;
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function detectType(text) {
  const lower = text.toLowerCase();
  if (/[剑刀刃]/.test(text) || /sword|blade|katana|dagger/.test(lower)) return "sword";
  if (/[斧]/.test(text) || /axe/.test(lower)) return "axe";
  if (/[锤槌]/.test(text) || /hammer|mace/.test(lower)) return "hammer";
  if (/[杖法]/.test(text) || /staff|wand/.test(lower)) return "staff";
  if (/[弓]/.test(text) || /bow/.test(lower)) return "bow";
  if (/[盾]/.test(text) || /shield/.test(lower)) return "shield";
  if (/[药瓶水剂]/.test(text) || /potion|bottle|elixir/.test(lower)) return "potion";
  if (/[金币徽章奖章]/.test(text) || /coin|badge|medal/.test(lower)) return "coin";
  return "sword";
}

function detectElement(text, upgradeText = "") {
  const joined = `${text} ${upgradeText}`.toLowerCase();
  if (/[火炎焰]/.test(joined) || /fire|flame|burn|lava/.test(joined)) return "fire";
  if (/[冰霜雪寒]/.test(joined) || /ice|frost|snow|cold/.test(joined)) return "ice";
  if (/[雷电闪]/.test(joined) || /thunder|lightning|storm/.test(joined)) return "lightning";
  if (/[毒酸腐]/.test(joined) || /poison|toxic|acid/.test(joined)) return "poison";
  if (/[圣光神]/.test(joined) || /holy|light|divine/.test(joined)) return "holy";
  return "neutral";
}

function colorSet(element, seed) {
  const random = seededRandom(seed);
  const hue = Math.floor(random() * 360);
  const base = {
    neutral: [`hsl(${hue} 62% 50%)`, `hsl(${hue} 64% 29%)`, "#f4d47a"],
    fire: ["#e24b2d", "#8f241a", "#ffb13b"],
    ice: ["#69d7ff", "#207da2", "#e8fbff"],
    lightning: ["#7c5cff", "#34226f", "#ffe45c"],
    poison: ["#62bf4f", "#256f2c", "#d8ff72"],
    holy: ["#f4d16d", "#9d7624", "#fff6bd"],
  };
  return base[element] || base.neutral;
}

function buildConfig(upgradeText = "") {
  const text = sanitizeText(promptInput.value);
  const manualType = assetTypeSelect.value;
  const type = manualType === "auto" ? detectType(text) : manualType;
  const element = detectElement(text, upgradeText);
  const style = styleSelect.value;
  const seedText = sanitizeText(seedInput.value, "looty-demo");
  const seed = hashString(`${seedText}-${type}-${style}-${selectedVariant}`);
  const colors = colorSet(element, seed);
  return { text, type, element, style, seed, colors, upgradeText };
}

function buildPrompt() {
  const config = buildConfig(upgradeInput.value);
  const typeLabel = TYPE_LABELS[config.type];
  const upgrade = sanitizeText(upgradeInput.value, "");
  const upgradeLine = upgrade ? `, upgrade direction: ${upgrade}, keep the same silhouette` : "";
  return `${config.text}, ${typeLabel}, ${STYLE_PROMPTS[config.style]}${upgradeLine}, final delivery should be a transparent PNG sprite after automatic background removal.`;
}

function updatePromptPreview() {
  promptPreview.textContent = buildPrompt();
}

function setStatus(text, done = false) {
  statusPill.textContent = text;
  statusPill.classList.toggle("done", done);
}

function setStep(name, state) {
  steps[name].className = `pipeline-step ${state}`;
}

function resetSteps() {
  setStep("prompt", "active");
  setStep("generate", "");
  setStep("remove", "");
}

function markReady() {
  setStep("prompt", "done");
  setStep("generate", "done");
  setStep("remove", "done");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function pixelRect(x, y, w, h, color, scale = 5, originX = 92, originY = 62) {
  ctx.fillStyle = color;
  ctx.fillRect(originX + x * scale, originY + y * scale, w * scale, h * scale);
}

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawGlow(config) {
  if (config.element === "neutral") return;
  const [, , glow] = config.colors;
  const random = seededRandom(config.seed + hashString(config.element));
  ctx.save();
  ctx.fillStyle = glow;
  ctx.strokeStyle = glow;
  ctx.lineWidth = config.style === "pixel" ? 0 : 7;
  for (let i = 0; i < 12; i += 1) {
    const x = 128 + random() * 256;
    const y = 78 + random() * 300;
    if (config.style === "pixel") {
      ctx.fillRect(Math.round(x / 6) * 6, Math.round(y / 6) * 6, 12, 12);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 5 + random() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPixelSword(config) {
  const [main, dark, glow] = config.colors;
  const edge = "#17191d";
  pixelRect(32, 2, 8, 42, edge);
  pixelRect(34, 4, 4, 38, "#dfe7ee");
  pixelRect(34, 4, 2, 32, "#ffffff");
  pixelRect(27, 42, 18, 6, edge);
  pixelRect(29, 43, 14, 3, main);
  pixelRect(30, 48, 12, 18, edge);
  pixelRect(32, 48, 8, 16, "#8f5837");
  pixelRect(29, 65, 14, 6, edge);
  pixelRect(31, 65, 10, 3, glow);
  pixelRect(31, 12, 10, 6, dark);
}

function drawPixelAxe(config) {
  const [main, dark, glow] = config.colors;
  const edge = "#17191d";
  pixelRect(34, 12, 7, 55, edge);
  pixelRect(36, 14, 3, 51, "#9b5b36");
  pixelRect(18, 8, 26, 18, edge);
  pixelRect(20, 10, 20, 14, main);
  pixelRect(15, 16, 10, 16, edge);
  pixelRect(17, 18, 7, 11, "#dfe7ee");
  pixelRect(41, 13, 9, 17, edge);
  pixelRect(41, 15, 7, 12, "#dfe7ee");
  pixelRect(21, 22, 18, 3, dark);
  pixelRect(32, 66, 10, 5, glow);
}

function drawPixelHammer(config) {
  const [main, dark, glow] = config.colors;
  const edge = "#17191d";
  pixelRect(31, 18, 8, 52, edge);
  pixelRect(33, 20, 4, 48, "#9b5b36");
  pixelRect(14, 5, 42, 22, edge);
  pixelRect(17, 8, 36, 16, main);
  pixelRect(19, 9, 30, 4, "#ffffff");
  pixelRect(17, 21, 36, 4, dark);
  pixelRect(11, 10, 7, 12, edge);
  pixelRect(52, 10, 7, 12, edge);
  pixelRect(30, 70, 11, 5, glow);
}

function drawPixelStaff(config) {
  const [main, dark, glow] = config.colors;
  const edge = "#17191d";
  pixelRect(34, 20, 6, 56, edge);
  pixelRect(36, 22, 2, 52, "#8c5b36");
  pixelRect(27, 4, 20, 20, edge);
  pixelRect(30, 7, 14, 14, glow);
  pixelRect(33, 10, 8, 8, "#ffffff");
  pixelRect(24, 19, 26, 6, edge);
  pixelRect(26, 20, 22, 3, main);
  pixelRect(31, 32, 12, 4, dark);
}

function drawPixelBow(config) {
  const [main, dark, glow] = config.colors;
  const edge = "#17191d";
  pixelRect(28, 4, 12, 6, edge);
  pixelRect(23, 9, 11, 10, edge);
  pixelRect(18, 18, 10, 14, edge);
  pixelRect(16, 32, 10, 18, edge);
  pixelRect(20, 50, 10, 14, edge);
  pixelRect(27, 64, 12, 6, edge);
  pixelRect(25, 12, 6, 48, main);
  pixelRect(54, 8, 2, 60, edge);
  pixelRect(51, 35, 8, 3, glow);
  pixelRect(31, 35, 22, 2, dark);
}

function drawPixelShield(config) {
  const [main, dark, glow] = config.colors;
  const edge = "#17191d";
  pixelRect(20, 4, 34, 8, edge);
  pixelRect(16, 12, 42, 28, edge);
  pixelRect(20, 40, 34, 13, edge);
  pixelRect(26, 53, 22, 10, edge);
  pixelRect(22, 9, 30, 35, main);
  pixelRect(25, 44, 24, 10, dark);
  pixelRect(32, 13, 8, 36, glow);
  pixelRect(25, 18, 24, 4, "#ffffff");
}

function drawPixelPotion(config) {
  const [main, dark, glow] = config.colors;
  const edge = "#17191d";
  pixelRect(29, 4, 15, 12, edge);
  pixelRect(32, 6, 9, 9, "#dfe7ee");
  pixelRect(24, 15, 25, 7, edge);
  pixelRect(18, 22, 37, 43, edge);
  pixelRect(21, 25, 31, 37, main);
  pixelRect(23, 45, 27, 15, dark);
  pixelRect(26, 27, 10, 8, "#ffffff");
  pixelRect(38, 34, 8, 8, glow);
}

function drawPixelCoin(config) {
  const [main, dark, glow] = config.colors;
  const edge = "#17191d";
  pixelRect(22, 8, 30, 6, edge);
  pixelRect(16, 14, 42, 12, edge);
  pixelRect(12, 26, 50, 22, edge);
  pixelRect(16, 48, 42, 12, edge);
  pixelRect(22, 60, 30, 6, edge);
  pixelRect(20, 16, 34, 42, main);
  pixelRect(25, 22, 24, 5, "#fff4b0");
  pixelRect(24, 49, 26, 5, dark);
  pixelRect(33, 30, 8, 16, glow);
}

const PIXEL_DRAWERS = {
  sword: drawPixelSword,
  axe: drawPixelAxe,
  hammer: drawPixelHammer,
  staff: drawPixelStaff,
  bow: drawPixelBow,
  shield: drawPixelShield,
  potion: drawPixelPotion,
  coin: drawPixelCoin,
};

function drawPixelAsset(config) {
  clearCanvas();
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(50, 18);
  PIXEL_DRAWERS[config.type](config);
  ctx.restore();
  drawGlow(config);
}

function vectorBase(config, drawBody) {
  clearCanvas();
  ctx.save();
  ctx.translate(256, 256);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#17191d";
  ctx.lineWidth = 16;
  drawBody();
  ctx.restore();
  drawGlow(config);
}

function drawVectorSword(config) {
  const [main, dark, glow] = config.colors;
  vectorBase(config, () => {
    ctx.rotate(-0.22);
    ctx.fillStyle = "#dfe7ee";
    ctx.beginPath();
    ctx.moveTo(0, -210);
    ctx.lineTo(35, 55);
    ctx.lineTo(0, 92);
    ctx.lineTo(-35, 55);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-8, -160);
    ctx.lineTo(-8, 35);
    ctx.stroke();
    ctx.strokeStyle = "#17191d";
    ctx.lineWidth = 15;
    ctx.fillStyle = main;
    ctx.beginPath();
    roundedRectPath(-92, 67, 184, 34, 12);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = "#9b5b36";
    ctx.beginPath();
    roundedRectPath(-24, 91, 48, 130, 16);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 76, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-62, 84);
    ctx.lineTo(62, 84);
    ctx.stroke();
  });
}

function drawVectorAxe(config) {
  const [main, dark] = config.colors;
  vectorBase(config, () => {
    ctx.rotate(-0.2);
    ctx.fillStyle = "#9b5b36";
    ctx.beginPath();
    roundedRectPath(-22, -50, 44, 260, 18);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(-120, -165);
    ctx.quadraticCurveTo(-26, -230, 70, -155);
    ctx.lineTo(38, -60);
    ctx.quadraticCurveTo(-45, -88, -120, -165);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = "#dfe7ee";
    ctx.beginPath();
    ctx.moveTo(25, -150);
    ctx.quadraticCurveTo(115, -120, 118, -25);
    ctx.quadraticCurveTo(63, -40, 30, -72);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-70, -160);
    ctx.quadraticCurveTo(-10, -185, 45, -145);
    ctx.stroke();
  });
}

function drawVectorHammer(config) {
  const [main, dark] = config.colors;
  vectorBase(config, () => {
    ctx.rotate(-0.18);
    ctx.fillStyle = "#9b5b36";
    ctx.beginPath();
    roundedRectPath(-24, -10, 48, 230, 18);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = main;
    ctx.beginPath();
    roundedRectPath(-150, -185, 300, 95, 22);
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-95, -158);
    ctx.lineTo(86, -158);
    ctx.stroke();
    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-112, -105);
    ctx.lineTo(112, -105);
    ctx.stroke();
  });
}

function drawVectorStaff(config) {
  const [main, dark, glow] = config.colors;
  vectorBase(config, () => {
    ctx.rotate(0.15);
    ctx.fillStyle = "#8f5b38";
    ctx.beginPath();
    roundedRectPath(-18, -85, 36, 290, 18);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -160, 64, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -160, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = main;
    ctx.beginPath();
    roundedRectPath(-70, -98, 140, 38, 14);
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, -160, 42, 0.2, Math.PI * 1.4);
    ctx.stroke();
  });
}

function drawVectorBow(config) {
  const [main, dark, glow] = config.colors;
  vectorBase(config, () => {
    ctx.strokeStyle = "#17191d";
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(-35, -190);
    ctx.bezierCurveTo(-145, -80, -145, 80, -35, 190);
    ctx.stroke();
    ctx.strokeStyle = main;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(-35, -178);
    ctx.bezierCurveTo(-118, -75, -118, 75, -35, 178);
    ctx.stroke();
    ctx.strokeStyle = "#17191d";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-35, -182);
    ctx.lineTo(-35, 182);
    ctx.stroke();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-35, 0);
    ctx.lineTo(98, 0);
    ctx.stroke();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(118, 0);
    ctx.lineTo(82, -18);
    ctx.lineTo(91, 0);
    ctx.lineTo(82, 18);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  });
}

function drawVectorShield(config) {
  const [main, dark, glow] = config.colors;
  vectorBase(config, () => {
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(0, -190);
    ctx.quadraticCurveTo(120, -150, 118, -55);
    ctx.quadraticCurveTo(104, 92, 0, 190);
    ctx.quadraticCurveTo(-104, 92, -118, -55);
    ctx.quadraticCurveTo(-120, -150, 0, -190);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.lineTo(78, -102);
    ctx.quadraticCurveTo(67, 66, 0, 130);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = glow;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(0, -135);
    ctx.lineTo(0, 130);
    ctx.stroke();
  });
}

function drawVectorPotion(config) {
  const [main, dark, glow] = config.colors;
  vectorBase(config, () => {
    ctx.fillStyle = "#dfe7ee";
    ctx.beginPath();
    roundedRectPath(-35, -180, 70, 70, 14);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(-70, -95);
    ctx.quadraticCurveTo(-132, -25, -86, 112);
    ctx.quadraticCurveTo(0, 190, 86, 112);
    ctx.quadraticCurveTo(132, -25, 70, -95);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-75, 45);
    ctx.quadraticCurveTo(0, 82, 75, 45);
    ctx.lineTo(75, 112);
    ctx.quadraticCurveTo(0, 178, -75, 112);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(38, -8, 18, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawVectorCoin(config) {
  const [main, dark, glow] = config.colors;
  vectorBase(config, () => {
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.arc(0, 0, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 112, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(0, -72);
    ctx.lineTo(22, -20);
    ctx.lineTo(78, -16);
    ctx.lineTo(34, 18);
    ctx.lineTo(48, 72);
    ctx.lineTo(0, 42);
    ctx.lineTo(-48, 72);
    ctx.lineTo(-34, 18);
    ctx.lineTo(-78, -16);
    ctx.lineTo(-22, -20);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  });
}

const VECTOR_DRAWERS = {
  sword: drawVectorSword,
  axe: drawVectorAxe,
  hammer: drawVectorHammer,
  staff: drawVectorStaff,
  bow: drawVectorBow,
  shield: drawVectorShield,
  potion: drawVectorPotion,
  coin: drawVectorCoin,
};

function drawAsset(config) {
  if (config.style === "pixel") {
    drawPixelAsset(config);
  } else {
    VECTOR_DRAWERS[config.type](config);
  }
}

function updateDownloadName(config) {
  const safeName = `${TYPE_LABELS[config.type]}-${config.text}`
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  currentName = `${safeName || "looty-asset"}${config.upgradeText ? "-upgrade" : ""}`;
}

function cloneConfig(config, variantIndex) {
  const variantSeed = hashString(`${seedInput.value}-${config.type}-${config.style}-${variantIndex}`);
  return {
    ...config,
    seed: variantSeed,
    colors: colorSet(config.element, variantSeed),
  };
}

function drawToCanvas(targetCanvas, config) {
  const image = document.createElement("canvas");
  image.width = canvas.width;
  image.height = canvas.height;
  const imageCtx = image.getContext("2d");
  const targetCtx = targetCanvas.getContext("2d");

  clearCanvas();
  drawAsset(config);
  imageCtx.drawImage(canvas, 0, 0);

  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  targetCtx.drawImage(image, 0, 0, targetCanvas.width, targetCanvas.height);
  drawAsset(lastConfig || config);
}

function renderVariants(config) {
  variantStrip.innerHTML = "";
  for (let i = 0; i < 3; i += 1) {
    const card = document.createElement("button");
    card.className = `variant-card${i === selectedVariant ? " active" : ""}`;
    card.type = "button";
    const thumb = document.createElement("canvas");
    thumb.width = 96;
    thumb.height = 96;
    const copy = cloneConfig(config, i);
    const label = document.createElement("div");
    label.innerHTML = `<strong>变体 ${i + 1}</strong><span>${TYPE_LABELS[copy.type]} / ${copy.element}</span>`;
    card.append(thumb, label);
    card.addEventListener("click", () => {
      selectedVariant = i;
      runGeneration(config.upgradeText || "");
    });
    variantStrip.append(card);
    drawToCanvas(thumb, copy);
  }
}

async function runGeneration(upgradeText = "") {
  const config = buildConfig(upgradeText);
  lastConfig = config;
  updateDownloadName(config);
  updatePromptPreview();

  resetSteps();
  setStatus("解析需求中");
  generateBtn.disabled = true;
  upgradeBtn.disabled = true;
  downloadBtn.disabled = true;

  await wait(220);
  setStep("prompt", "done");
  setStep("generate", "active");
  setStatus(`生成${TYPE_LABELS[config.type]}轮廓`);

  await wait(300);
  drawAsset(config);
  renderVariants(config);
  setStep("generate", "done");
  setStep("remove", "active");
  setStatus("导出透明 PNG");

  await wait(220);
  setStep("remove", "done");
  setStatus("生成完成", true);
  generated = true;
  generateBtn.disabled = false;
  upgradeBtn.disabled = false;
  downloadBtn.disabled = false;
}

function renderInitialExample() {
  const config = buildConfig("");
  lastConfig = config;
  updateDownloadName(config);
  drawAsset(config);
  renderVariants(config);
  generated = true;
  markReady();
  setStatus("示例已就绪", true);
  upgradeBtn.disabled = false;
  downloadBtn.disabled = false;
}

function randomExample() {
  const example = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
  promptInput.value = example.text;
  assetTypeSelect.value = example.type;
  seedInput.value = example.seed;
  selectedVariant = 0;
  runGeneration("");
}

function generateVariants() {
  selectedVariant = 0;
  runGeneration(lastConfig?.upgradeText || "");
}

function downloadCanvas() {
  if (!generated) return;
  const link = document.createElement("a");
  link.download = `${currentName}-512-transparent.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function copyPrompt() {
  const text = buildPrompt();
  try {
    await navigator.clipboard.writeText(text);
    copyPromptBtn.textContent = "已复制";
    window.setTimeout(() => {
      copyPromptBtn.textContent = "复制 Prompt";
    }, 1200);
  } catch {
    promptPreview.textContent = text;
  }
}

[promptInput, assetTypeSelect, styleSelect, seedInput, upgradeInput].forEach((element) => {
  element.addEventListener("input", updatePromptPreview);
  element.addEventListener("change", updatePromptPreview);
});

styleSelect.addEventListener("change", () => runGeneration(lastConfig?.upgradeText || ""));
assetTypeSelect.addEventListener("change", () => runGeneration(lastConfig?.upgradeText || ""));
seedInput.addEventListener("change", () => runGeneration(lastConfig?.upgradeText || ""));
randomBtn.addEventListener("click", randomExample);
variantsBtn.addEventListener("click", generateVariants);
generateBtn.addEventListener("click", () => runGeneration(""));
upgradeBtn.addEventListener("click", () => runGeneration(sanitizeText(upgradeInput.value, "附加火焰特效")));
downloadBtn.addEventListener("click", downloadCanvas);
copyPromptBtn.addEventListener("click", copyPrompt);

updatePromptPreview();
renderInitialExample();
