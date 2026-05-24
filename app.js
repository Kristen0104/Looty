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
const assetSummary = document.querySelector("#assetSummary");
const tierSummary = document.querySelector("#tierSummary");

const steps = {
  prompt: document.querySelector("#stepPrompt"),
  generate: document.querySelector("#stepGenerate"),
  remove: document.querySelector("#stepRemove"),
};

const TYPE_LABELS = {
  sword: "剑",
  axe: "斧头",
  hammer: "锤子",
  staff: "法杖",
  bow: "弓",
  shield: "盾牌",
  potion: "药水",
  coin: "徽章",
};

const ELEMENT_LABELS = {
  neutral: "中性",
  fire: "火属性",
  ice: "冰属性",
  lightning: "雷属性",
  poison: "毒属性",
  holy: "圣光",
  shadow: "暗影",
};

const STYLE_PROMPTS = {
  pixel:
    "premium 2D indie game pixel art icon, 32-bit readable silhouette, crisp clusters, pure solid white background for removal, no scene, standalone object",
  vector:
    "premium mobile game loot icon, bold clean outline, cel shaded metal, gem details, pure solid white background for removal, no scene, standalone object",
};

const EXAMPLES = [
  { text: "火焰长剑", type: "sword", seed: "ember-sword", upgrade: "镶嵌红宝石并附加火焰光刃" },
  { text: "冰霜法杖", type: "staff", seed: "frost-staff", upgrade: "变为冰属性并增加悬浮水晶" },
  { text: "雷电战锤", type: "hammer", seed: "storm-hammer", upgrade: "增加雷电符文和能量核心" },
  { text: "毒液药水", type: "potion", seed: "toxic-potion", upgrade: "变为毒液版本并产生气泡" },
  { text: "木制盾牌", type: "shield", seed: "oak-shield", upgrade: "附加圣光纹章和金属包边" },
  { text: "猎人长弓", type: "bow", seed: "hunter-bow", upgrade: "增加冰晶弓弦和寒霜箭头" },
  { text: "熔岩战斧", type: "axe", seed: "lava-axe", upgrade: "升级为熔岩裂纹和火焰刃" },
  { text: "暗影徽章", type: "coin", seed: "shadow-badge", upgrade: "变为暗影版本并增加紫色符文" },
];

let generated = false;
let lastConfig = null;
let selectedVariant = 0;
let currentName = "looty-asset";
let activeUpgradeText = "";

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
  if (/[金币徽章奖章]/.test(text) || /coin|badge|medal|crest/.test(lower)) return "coin";
  return "sword";
}

function detectElement(text, upgradeText = "") {
  const joined = `${text} ${upgradeText}`.toLowerCase();
  if (/[火炎焰熔岩]/.test(joined) || /fire|flame|burn|lava|ember/.test(joined)) return "fire";
  if (/[冰霜雪寒晶]/.test(joined) || /ice|frost|snow|cold|crystal/.test(joined)) return "ice";
  if (/[雷电闪风暴]/.test(joined) || /thunder|lightning|storm|electric/.test(joined)) return "lightning";
  if (/[毒酸腐液]/.test(joined) || /poison|toxic|acid|venom/.test(joined)) return "poison";
  if (/[圣光神金]/.test(joined) || /holy|light|divine|gold/.test(joined)) return "holy";
  if (/[暗影黑夜紫]/.test(joined) || /shadow|dark|void|night/.test(joined)) return "shadow";
  return "neutral";
}

function palette(element, seed) {
  const random = seededRandom(seed);
  const hue = Math.floor(random() * 360);
  const sets = {
    neutral: {
      main: `hsl(${hue} 60% 54%)`,
      dark: `hsl(${hue} 62% 28%)`,
      light: `hsl(${hue} 84% 74%)`,
      glow: "#f8d77c",
      metal: "#d8e0ea",
      metalDark: "#677483",
    },
    fire: { main: "#f05a32", dark: "#8f1f16", light: "#ffcf68", glow: "#ff9d2f", metal: "#e9d1b2", metalDark: "#80513b" },
    ice: { main: "#61d8ff", dark: "#1d6f9d", light: "#e8fbff", glow: "#b8f4ff", metal: "#eaf8ff", metalDark: "#5b8ca3" },
    lightning: { main: "#7f63ff", dark: "#35206f", light: "#fff06a", glow: "#ffe85c", metal: "#e0dcff", metalDark: "#62559b" },
    poison: { main: "#69cf53", dark: "#246b31", light: "#d9ff76", glow: "#baff62", metal: "#d7e9c5", metalDark: "#587642" },
    holy: { main: "#f4c95d", dark: "#8f6421", light: "#fff3b6", glow: "#fff0a6", metal: "#fff0c4", metalDark: "#9c7a38" },
    shadow: { main: "#7b5cff", dark: "#22133f", light: "#cfbdff", glow: "#a98cff", metal: "#cabbe8", metalDark: "#4c3d65" },
  };
  return sets[element] || sets.neutral;
}

function upgradeTier(upgradeText) {
  return sanitizeText(upgradeText, "") ? 2 : 1;
}

function buildConfig(upgradeText = "") {
  const text = sanitizeText(promptInput.value);
  const manualType = assetTypeSelect.value;
  const type = manualType === "auto" ? detectType(text) : manualType;
  const style = styleSelect.value;
  const element = detectElement(text, upgradeText);
  const seedText = sanitizeText(seedInput.value, "looty-demo");
  const tier = upgradeTier(upgradeText);
  const seed = hashString(`${seedText}-${type}-${style}-${selectedVariant}`);
  return {
    text,
    type,
    style,
    element,
    tier,
    seed,
    colors: palette(element, seed),
    upgradeText: sanitizeText(upgradeText, ""),
  };
}

function buildPrompt() {
  const config = buildConfig(activeUpgradeText);
  const upgrade = config.upgradeText ? `, image-to-image upgrade: ${config.upgradeText}, preserve original silhouette, add richer gem, rune and VFX details` : "";
  return `${config.text}, ${TYPE_LABELS[config.type]}, ${STYLE_PROMPTS[config.style]}${upgrade}, final transparent PNG sprite after automatic background removal.`;
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

function clearCanvas(targetCtx = ctx) {
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
}

function withCanvas(targetCtx, draw) {
  targetCtx.save();
  draw();
  targetCtx.restore();
}

function roundedRect(targetCtx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  targetCtx.moveTo(x + radius, y);
  targetCtx.lineTo(x + w - radius, y);
  targetCtx.quadraticCurveTo(x + w, y, x + w, y + radius);
  targetCtx.lineTo(x + w, y + h - radius);
  targetCtx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  targetCtx.lineTo(x + radius, y + h);
  targetCtx.quadraticCurveTo(x, y + h, x, y + h - radius);
  targetCtx.lineTo(x, y + radius);
  targetCtx.quadraticCurveTo(x, y, x + radius, y);
}

function makeGradient(targetCtx, x0, y0, x1, y1, stops) {
  const gradient = targetCtx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([stop, color]) => gradient.addColorStop(stop, color));
  return gradient;
}

function drawPath(targetCtx, fill, stroke = "#111722", width = 12) {
  targetCtx.fillStyle = fill;
  targetCtx.strokeStyle = stroke;
  targetCtx.lineWidth = width;
  targetCtx.lineJoin = "round";
  targetCtx.lineCap = "round";
  targetCtx.stroke();
  targetCtx.fill();
}

function drawGem(targetCtx, x, y, size, colors) {
  withCanvas(targetCtx, () => {
    targetCtx.beginPath();
    targetCtx.moveTo(x, y - size);
    targetCtx.lineTo(x + size * 0.82, y - size * 0.25);
    targetCtx.lineTo(x + size * 0.56, y + size * 0.86);
    targetCtx.lineTo(x - size * 0.56, y + size * 0.86);
    targetCtx.lineTo(x - size * 0.82, y - size * 0.25);
    targetCtx.closePath();
    drawPath(targetCtx, makeGradient(targetCtx, x - size, y - size, x + size, y + size, [[0, colors.light], [0.55, colors.main], [1, colors.dark]]), "#101721", 7);
    targetCtx.fillStyle = "rgba(255,255,255,0.78)";
    targetCtx.beginPath();
    targetCtx.ellipse(x - size * 0.2, y - size * 0.28, size * 0.18, size * 0.1, -0.7, 0, Math.PI * 2);
    targetCtx.fill();
  });
}

function drawRunes(targetCtx, config, positions) {
  const { colors } = config;
  withCanvas(targetCtx, () => {
    targetCtx.strokeStyle = colors.glow;
    targetCtx.fillStyle = colors.glow;
    targetCtx.lineWidth = 5;
    positions.forEach(([x, y, s], index) => {
      targetCtx.beginPath();
      if (index % 3 === 0) {
        targetCtx.arc(x, y, s, 0, Math.PI * 2);
      } else if (index % 3 === 1) {
        targetCtx.moveTo(x - s, y + s);
        targetCtx.lineTo(x, y - s);
        targetCtx.lineTo(x + s, y + s);
      } else {
        targetCtx.moveTo(x - s, y);
        targetCtx.lineTo(x + s, y);
        targetCtx.moveTo(x, y - s);
        targetCtx.lineTo(x, y + s);
      }
      targetCtx.stroke();
    });
  });
}

function drawVfx(targetCtx, config) {
  if (config.element === "neutral" && config.tier === 1) return;
  const random = seededRandom(config.seed + 9981 + config.tier);
  const count = config.tier > 1 ? 26 : 16;
  withCanvas(targetCtx, () => {
    targetCtx.globalCompositeOperation = "lighter";
    targetCtx.strokeStyle = config.colors.glow;
    targetCtx.fillStyle = config.colors.glow;
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 105 + random() * 118;
      const x = 256 + Math.cos(angle) * radius;
      const y = 256 + Math.sin(angle) * radius;
      const size = 4 + random() * (config.tier > 1 ? 12 : 7);
      if (config.style === "pixel") {
        const px = Math.round(x / 8) * 8;
        const py = Math.round(y / 8) * 8;
        targetCtx.fillRect(px, py, Math.round(size / 2) * 2, Math.round(size / 2) * 2);
      } else if (config.element === "lightning") {
        targetCtx.lineWidth = 4;
        targetCtx.beginPath();
        targetCtx.moveTo(x, y);
        targetCtx.lineTo(x + 14 - random() * 28, y + 20 - random() * 40);
        targetCtx.lineTo(x + 28 - random() * 56, y + 34 - random() * 68);
        targetCtx.stroke();
      } else {
        targetCtx.beginPath();
        targetCtx.arc(x, y, size, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }
  });
}

function drawHalo(targetCtx, config) {
  if (config.tier < 2) return;
  withCanvas(targetCtx, () => {
    targetCtx.globalCompositeOperation = "lighter";
    targetCtx.strokeStyle = config.colors.glow;
    targetCtx.lineWidth = 8;
    targetCtx.setLineDash([20, 16]);
    targetCtx.beginPath();
    targetCtx.ellipse(256, 266, 172, 66, -0.18, 0, Math.PI * 2);
    targetCtx.stroke();
    targetCtx.setLineDash([]);
  });
}

function pixelate(targetCtx) {
  const source = document.createElement("canvas");
  source.width = 128;
  source.height = 128;
  const sourceCtx = source.getContext("2d");
  sourceCtx.imageSmoothingEnabled = true;
  sourceCtx.drawImage(targetCtx.canvas, 0, 0, 128, 128);
  clearCanvas(targetCtx);
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(source, 0, 0, 512, 512);
  targetCtx.imageSmoothingEnabled = true;
}

function drawSword(targetCtx, config) {
  const c = config.colors;
  withCanvas(targetCtx, () => {
    targetCtx.translate(256, 258);
    targetCtx.rotate(-0.28);
    targetCtx.beginPath();
    targetCtx.moveTo(0, -216);
    targetCtx.lineTo(44, 42);
    targetCtx.lineTo(0, 96);
    targetCtx.lineTo(-44, 42);
    targetCtx.closePath();
    drawPath(targetCtx, makeGradient(targetCtx, -38, -216, 42, 82, [[0, "#ffffff"], [0.3, c.metal], [0.7, c.light], [1, c.metalDark]]), "#101721", 15);
    targetCtx.strokeStyle = "rgba(255,255,255,0.72)";
    targetCtx.lineWidth = 7;
    targetCtx.beginPath();
    targetCtx.moveTo(-12, -170);
    targetCtx.lineTo(-7, 26);
    targetCtx.stroke();
    targetCtx.beginPath();
    roundedRect(targetCtx, -108, 82, 216, 38, 13);
    drawPath(targetCtx, makeGradient(targetCtx, -108, 82, 108, 120, [[0, c.dark], [0.5, c.main], [1, c.dark]]), "#101721", 13);
    targetCtx.beginPath();
    roundedRect(targetCtx, -28, 112, 56, 124, 18);
    drawPath(targetCtx, makeGradient(targetCtx, -28, 112, 28, 236, [[0, "#9b6239"], [1, "#4d2f22"]]), "#101721", 12);
    drawGem(targetCtx, 0, 100, config.tier > 1 ? 25 : 18, c);
    if (config.tier > 1) drawRunes(targetCtx, config, [[0, -94, 8], [0, -28, 7], [-52, 103, 6], [52, 103, 6]]);
  });
}

function drawAxe(targetCtx, config) {
  const c = config.colors;
  withCanvas(targetCtx, () => {
    targetCtx.translate(256, 260);
    targetCtx.rotate(-0.22);
    targetCtx.beginPath();
    roundedRect(targetCtx, -24, -58, 48, 276, 18);
    drawPath(targetCtx, makeGradient(targetCtx, 0, -58, 0, 218, [[0, "#b5773f"], [1, "#4e3325"]]), "#101721", 13);
    targetCtx.beginPath();
    targetCtx.moveTo(-142, -170);
    targetCtx.quadraticCurveTo(-28, -250, 86, -158);
    targetCtx.lineTo(56, -48);
    targetCtx.quadraticCurveTo(-52, -76, -142, -170);
    targetCtx.closePath();
    drawPath(targetCtx, makeGradient(targetCtx, -142, -225, 86, -48, [[0, c.light], [0.45, c.main], [1, c.dark]]), "#101721", 15);
    targetCtx.beginPath();
    targetCtx.moveTo(34, -158);
    targetCtx.quadraticCurveTo(142, -122, 142, -12);
    targetCtx.quadraticCurveTo(74, -26, 36, -70);
    targetCtx.closePath();
    drawPath(targetCtx, makeGradient(targetCtx, 34, -158, 142, -12, [[0, "#ffffff"], [0.45, c.metal], [1, c.metalDark]]), "#101721", 13);
    drawGem(targetCtx, 3, -80, config.tier > 1 ? 22 : 16, c);
    if (config.tier > 1) drawRunes(targetCtx, config, [[-55, -155, 7], [4, -10, 6], [4, 74, 6]]);
  });
}

function drawHammer(targetCtx, config) {
  const c = config.colors;
  withCanvas(targetCtx, () => {
    targetCtx.translate(256, 258);
    targetCtx.rotate(-0.16);
    targetCtx.beginPath();
    roundedRect(targetCtx, -25, -12, 50, 238, 17);
    drawPath(targetCtx, makeGradient(targetCtx, 0, -12, 0, 226, [[0, "#b5773f"], [1, "#4b3226"]]), "#101721", 13);
    targetCtx.beginPath();
    roundedRect(targetCtx, -158, -192, 316, 104, 23);
    drawPath(targetCtx, makeGradient(targetCtx, -158, -192, 158, -88, [[0, c.metal], [0.48, c.main], [1, c.dark]]), "#101721", 15);
    targetCtx.strokeStyle = "rgba(255,255,255,0.65)";
    targetCtx.lineWidth = 8;
    targetCtx.beginPath();
    targetCtx.moveTo(-104, -160);
    targetCtx.lineTo(98, -160);
    targetCtx.stroke();
    drawGem(targetCtx, 0, -102, config.tier > 1 ? 25 : 18, c);
    if (config.tier > 1) drawRunes(targetCtx, config, [[-92, -138, 7], [92, -138, 7], [0, 54, 6]]);
  });
}

function drawStaff(targetCtx, config) {
  const c = config.colors;
  withCanvas(targetCtx, () => {
    targetCtx.translate(256, 262);
    targetCtx.rotate(0.15);
    targetCtx.beginPath();
    roundedRect(targetCtx, -19, -72, 38, 280, 18);
    drawPath(targetCtx, makeGradient(targetCtx, 0, -72, 0, 208, [[0, "#a66d39"], [1, "#4b3023"]]), "#101721", 12);
    targetCtx.beginPath();
    targetCtx.arc(0, -164, config.tier > 1 ? 76 : 62, 0, Math.PI * 2);
    drawPath(targetCtx, makeGradient(targetCtx, -70, -224, 70, -104, [[0, c.light], [0.5, c.main], [1, c.dark]]), "#101721", 14);
    targetCtx.beginPath();
    targetCtx.arc(0, -164, 28, 0, Math.PI * 2);
    targetCtx.fillStyle = "rgba(255,255,255,0.78)";
    targetCtx.fill();
    targetCtx.beginPath();
    roundedRect(targetCtx, -78, -94, 156, 40, 14);
    drawPath(targetCtx, makeGradient(targetCtx, -78, -94, 78, -54, [[0, c.dark], [0.5, c.main], [1, c.dark]]), "#101721", 11);
    if (config.tier > 1) drawRunes(targetCtx, config, [[-38, -164, 7], [38, -164, 7], [0, 20, 6], [0, 92, 6]]);
  });
}

function drawBow(targetCtx, config) {
  const c = config.colors;
  withCanvas(targetCtx, () => {
    targetCtx.translate(256, 256);
    targetCtx.strokeStyle = "#101721";
    targetCtx.lineWidth = 22;
    targetCtx.lineCap = "round";
    targetCtx.beginPath();
    targetCtx.moveTo(-38, -196);
    targetCtx.bezierCurveTo(-154, -90, -154, 90, -38, 196);
    targetCtx.stroke();
    targetCtx.strokeStyle = c.main;
    targetCtx.lineWidth = 14;
    targetCtx.beginPath();
    targetCtx.moveTo(-39, -180);
    targetCtx.bezierCurveTo(-122, -78, -122, 78, -39, 180);
    targetCtx.stroke();
    targetCtx.strokeStyle = c.light;
    targetCtx.lineWidth = 5;
    targetCtx.beginPath();
    targetCtx.moveTo(-38, -184);
    targetCtx.lineTo(-38, 184);
    targetCtx.stroke();
    targetCtx.strokeStyle = "#101721";
    targetCtx.lineWidth = 13;
    targetCtx.beginPath();
    targetCtx.moveTo(-35, 0);
    targetCtx.lineTo(112, 0);
    targetCtx.stroke();
    targetCtx.fillStyle = c.glow;
    targetCtx.beginPath();
    targetCtx.moveTo(134, 0);
    targetCtx.lineTo(92, -21);
    targetCtx.lineTo(103, 0);
    targetCtx.lineTo(92, 21);
    targetCtx.closePath();
    targetCtx.stroke();
    targetCtx.fill();
    drawGem(targetCtx, -40, 0, config.tier > 1 ? 20 : 14, c);
    if (config.tier > 1) drawRunes(targetCtx, config, [[-88, -92, 6], [-88, 92, 6], [68, 0, 5]]);
  });
}

function drawShield(targetCtx, config) {
  const c = config.colors;
  withCanvas(targetCtx, () => {
    targetCtx.translate(256, 260);
    targetCtx.beginPath();
    targetCtx.moveTo(0, -198);
    targetCtx.quadraticCurveTo(132, -158, 130, -50);
    targetCtx.quadraticCurveTo(108, 102, 0, 194);
    targetCtx.quadraticCurveTo(-108, 102, -130, -50);
    targetCtx.quadraticCurveTo(-132, -158, 0, -198);
    targetCtx.closePath();
    drawPath(targetCtx, makeGradient(targetCtx, -110, -188, 110, 178, [[0, c.light], [0.46, c.main], [1, c.dark]]), "#101721", 15);
    targetCtx.fillStyle = "rgba(0,0,0,0.18)";
    targetCtx.beginPath();
    targetCtx.moveTo(0, -158);
    targetCtx.lineTo(86, -108);
    targetCtx.quadraticCurveTo(70, 70, 0, 138);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.strokeStyle = c.glow;
    targetCtx.lineWidth = 14;
    targetCtx.beginPath();
    targetCtx.moveTo(0, -134);
    targetCtx.lineTo(0, 124);
    targetCtx.stroke();
    drawGem(targetCtx, 0, -34, config.tier > 1 ? 26 : 18, c);
    if (config.tier > 1) drawRunes(targetCtx, config, [[-58, -42, 7], [58, -42, 7], [-34, 70, 6], [34, 70, 6]]);
  });
}

function drawPotion(targetCtx, config) {
  const c = config.colors;
  withCanvas(targetCtx, () => {
    targetCtx.translate(256, 258);
    targetCtx.beginPath();
    roundedRect(targetCtx, -40, -190, 80, 76, 16);
    drawPath(targetCtx, makeGradient(targetCtx, -40, -190, 40, -114, [[0, "#ffffff"], [1, c.metal]]), "#101721", 12);
    targetCtx.beginPath();
    targetCtx.moveTo(-76, -100);
    targetCtx.quadraticCurveTo(-144, -24, -94, 126);
    targetCtx.quadraticCurveTo(0, 202, 94, 126);
    targetCtx.quadraticCurveTo(144, -24, 76, -100);
    targetCtx.closePath();
    drawPath(targetCtx, makeGradient(targetCtx, -94, -100, 94, 190, [[0, c.light], [0.42, c.main], [1, c.dark]]), "#101721", 14);
    targetCtx.fillStyle = "rgba(255,255,255,0.5)";
    targetCtx.beginPath();
    targetCtx.ellipse(-38, -18, 22, 36, -0.45, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.fillStyle = "rgba(0,0,0,0.16)";
    targetCtx.beginPath();
    targetCtx.moveTo(-78, 50);
    targetCtx.quadraticCurveTo(0, 90, 78, 50);
    targetCtx.lineTo(78, 122);
    targetCtx.quadraticCurveTo(0, 180, -78, 122);
    targetCtx.closePath();
    targetCtx.fill();
    if (config.tier > 1) drawRunes(targetCtx, config, [[-28, 28, 7], [34, -14, 6], [24, 82, 5]]);
  });
}

function drawCoin(targetCtx, config) {
  const c = config.colors;
  withCanvas(targetCtx, () => {
    targetCtx.translate(256, 256);
    targetCtx.beginPath();
    targetCtx.arc(0, 0, 154, 0, Math.PI * 2);
    drawPath(targetCtx, makeGradient(targetCtx, -120, -120, 120, 120, [[0, c.light], [0.48, c.main], [1, c.dark]]), "#101721", 15);
    targetCtx.strokeStyle = "rgba(0,0,0,0.28)";
    targetCtx.lineWidth = 18;
    targetCtx.beginPath();
    targetCtx.arc(0, 0, 112, 0, Math.PI * 2);
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.moveTo(0, -82);
    targetCtx.lineTo(24, -24);
    targetCtx.lineTo(86, -18);
    targetCtx.lineTo(38, 20);
    targetCtx.lineTo(52, 80);
    targetCtx.lineTo(0, 48);
    targetCtx.lineTo(-52, 80);
    targetCtx.lineTo(-38, 20);
    targetCtx.lineTo(-86, -18);
    targetCtx.lineTo(-24, -24);
    targetCtx.closePath();
    drawPath(targetCtx, c.glow, "#101721", 10);
    if (config.tier > 1) drawRunes(targetCtx, config, [[-78, -76, 6], [78, -76, 6], [-80, 72, 6], [80, 72, 6]]);
  });
}

const DRAWERS = {
  sword: drawSword,
  axe: drawAxe,
  hammer: drawHammer,
  staff: drawStaff,
  bow: drawBow,
  shield: drawShield,
  potion: drawPotion,
  coin: drawCoin,
};

function drawAsset(targetCtx, config) {
  clearCanvas(targetCtx);
  targetCtx.imageSmoothingEnabled = true;
  drawHalo(targetCtx, config);
  drawVfx(targetCtx, config);
  DRAWERS[config.type](targetCtx, config);
  if (config.tier > 1) drawVfx(targetCtx, config);
  if (config.style === "pixel") pixelate(targetCtx);
}

function updateDownloadName(config) {
  const safeName = `${TYPE_LABELS[config.type]}-${config.text}`
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  currentName = `${safeName || "looty-asset"}${config.tier > 1 ? "-evolved" : ""}`;
}

function updateInspector(config) {
  assetSummary.textContent = `${TYPE_LABELS[config.type]} / ${ELEMENT_LABELS[config.element]}`;
  tierSummary.textContent = `Tier ${config.tier}${config.tier > 1 ? " 进化" : ""}`;
}

function cloneConfig(config, variantIndex) {
  const variantSeed = hashString(`${seedInput.value}-${config.type}-${config.style}-${variantIndex}`);
  return {
    ...config,
    seed: variantSeed,
    colors: palette(config.element, variantSeed),
  };
}

function drawThumbnail(targetCanvas, config) {
  const targetCtx = targetCanvas.getContext("2d");
  const image = document.createElement("canvas");
  image.width = 512;
  image.height = 512;
  drawAsset(image.getContext("2d"), config);
  clearCanvas(targetCtx);
  targetCtx.drawImage(image, 0, 0, targetCanvas.width, targetCanvas.height);
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
    label.innerHTML = `<strong>变体 ${i + 1}</strong><span>${ELEMENT_LABELS[copy.element]} / Tier ${copy.tier}</span>`;
    card.append(thumb, label);
    card.addEventListener("click", () => {
      selectedVariant = i;
      runGeneration(config.upgradeText || "");
    });
    variantStrip.append(card);
    drawThumbnail(thumb, copy);
  }
}

async function runGeneration(upgradeText = "") {
  activeUpgradeText = upgradeText;
  const config = buildConfig(upgradeText);
  lastConfig = config;
  updateDownloadName(config);
  updatePromptPreview();
  updateInspector(config);

  resetSteps();
  setStatus("解析需求中");
  generateBtn.disabled = true;
  upgradeBtn.disabled = true;
  downloadBtn.disabled = true;

  await wait(180);
  setStep("prompt", "done");
  setStep("generate", "active");
  setStatus(config.tier > 1 ? "生成进化部件" : "生成图标轮廓");

  await wait(280);
  drawAsset(ctx, config);
  renderVariants(config);
  setStep("generate", "done");
  setStep("remove", "active");
  setStatus("处理透明通道");

  await wait(180);
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
  updateInspector(config);
  drawAsset(ctx, config);
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
  upgradeInput.value = example.upgrade;
  selectedVariant = 0;
  activeUpgradeText = "";
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
  element.addEventListener("input", () => {
    if (element === upgradeInput) activeUpgradeText = "";
    updatePromptPreview();
  });
  element.addEventListener("change", () => {
    if (element === upgradeInput) activeUpgradeText = "";
    updatePromptPreview();
  });
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
