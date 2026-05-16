import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const DEFAULT_OVERLAY = {
  scale: 42,
  bottomOffset: 180,
};
// Point this at a local PirateTok/tiktok-live-connector relay or managed API WebSocket.
// The UI only asks for a username; this client appends it as ?username=<creator>.
const TIKTOK_LIVE_WS_ENDPOINT = "ws://127.0.0.1:8081/tiktok-live";
const ALERT_DURATION_MS = 3000;
const SALES_KEYWORDS = ["sold", "buying", "ordered", "checkout", "claim"];
const HIGH_TIER_GIFTS = ["universe", "lion", "drama queen", "tiktok universe", "castle", "meteor shower", "whale diving"];
const SNAP_API_TOKEN_PLACEHOLDER = "YOUR_SNAP_CAMERA_KIT_API_TOKEN";
const SNAP_LENS_SHORTCUTS = [
  // Add production shortcuts here after creating Lenses in the Snap developer portal.
  // { name: "Beauty Lens", lensId: "YOUR_LENS_ID", groupId: "YOUR_LENS_GROUP_ID" },
];

const canvas = document.querySelector("#broadcastCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const snapCameraCanvas = document.querySelector("#snapCameraCanvas");

const slideUpload = document.querySelector("#slideUpload");
const scriptUpload = document.querySelector("#scriptUpload");
const prevSlideButton = document.querySelector("#prevSlide");
const nextSlideButton = document.querySelector("#nextSlide");
const slideCount = document.querySelector("#slideCount");
const teleprompterSlideLabel = document.querySelector("#teleprompterSlideLabel");
const teleprompterText = document.querySelector("#teleprompterText");
const scriptEditorStatus = document.querySelector("#scriptEditorStatus");
const slideScriptList = document.querySelector("#slideScriptList");
const sceneStatus = document.querySelector("#sceneStatus");
const presentationMode = document.querySelector("#presentationMode");
const fullCameraMode = document.querySelector("#fullCameraMode");
const cameraSelect = document.querySelector("#cameraSelect");
const cameraStatus = document.querySelector("#cameraStatus");
const cameraShape = document.querySelector("#cameraShape");
const cameraShapeStatus = document.querySelector("#cameraShapeStatus");
const renderStatus = document.querySelector("#renderStatus");
const tiktokStatus = document.querySelector("#tiktokStatus");
const tiktokUsername = document.querySelector("#tiktokUsername");
const connectTikTok = document.querySelector("#connectTikTok");
const disconnectTikTok = document.querySelector("#disconnectTikTok");
const testLikeAlert = document.querySelector("#testLikeAlert");
const testFollowAlert = document.querySelector("#testFollowAlert");
const testGiftAlert = document.querySelector("#testGiftAlert");
const testSoldAlert = document.querySelector("#testSoldAlert");
const productStatus = document.querySelector("#productStatus");
const productName = document.querySelector("#productName");
const productPrice = document.querySelector("#productPrice");
const productCta = document.querySelector("#productCta");
const pinProduct = document.querySelector("#pinProduct");
const clearProduct = document.querySelector("#clearProduct");
const countdownMinutes = document.querySelector("#countdownMinutes");
const startCountdown = document.querySelector("#startCountdown");
const stopCountdown = document.querySelector("#stopCountdown");
const resetCountdown = document.querySelector("#resetCountdown");
const refreshCameras = document.querySelector("#refreshCameras");
const resetOverlay = document.querySelector("#resetOverlay");
const snapStatus = document.querySelector("#snapStatus");
const snapApiToken = document.querySelector("#snapApiToken");
const lensGroupId = document.querySelector("#lensGroupId");
const loadLensGroup = document.querySelector("#loadLensGroup");
const lensSelect = document.querySelector("#lensSelect");
const lensQuickActions = document.querySelector("#lensQuickActions");
const lensId = document.querySelector("#lensId");
const applyLensButton = document.querySelector("#applyLens");
const removeLensButton = document.querySelector("#removeLens");
const overlayControls = document.querySelector("#overlayControls");
const overlayX = document.querySelector("#overlayX");
const overlayY = document.querySelector("#overlayY");
const overlayScale = document.querySelector("#overlayScale");
const overlayXValue = document.querySelector("#overlayXValue");
const overlayYValue = document.querySelector("#overlayYValue");
const overlayScaleValue = document.querySelector("#overlayScaleValue");
const likeAlertAudio = document.querySelector("#likeAlertAudio");
const followAlertAudio = document.querySelector("#followAlertAudio");
const giftAlertAudio = document.querySelector("#giftAlertAudio");

let slides = [];
let currentSlideIndex = 0;
let currentScene = "presentation";
let mediaStream = null;
let tiktokSocket = null;
let audioContext = null;
let cameraKit = null;
let snapSession = null;
let activeCameraSource = null;
const visualAlerts = [];
const celebrations = [];
const loadedLenses = new Map();
const productShowcase = {
  pinned: false,
  name: "",
  price: "",
  cta: "",
};
const countdown = {
  durationMs: 5 * 60 * 1000,
  remainingMs: 5 * 60 * 1000,
  endAt: null,
  running: false,
  visible: false,
};

const pdfjsLibReady = () =>
  new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
      return;
    }

    const timeout = window.setTimeout(() => reject(new Error("PDF.js failed to load.")), 8000);
    window.addEventListener(
      "load",
      () => {
        window.clearTimeout(timeout);
        if (!window.pdfjsLib) {
          reject(new Error("PDF.js failed to load."));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      },
      { once: true },
    );
  });

function createSlideThumbnail(image) {
  const thumbnailCanvas = document.createElement("canvas");
  const thumbnailContext = thumbnailCanvas.getContext("2d", { alpha: false });
  thumbnailCanvas.width = 180;
  thumbnailCanvas.height = 320;

  thumbnailContext.fillStyle = "#05070a";
  thumbnailContext.fillRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(thumbnailCanvas.width / sourceWidth, thumbnailCanvas.height / sourceHeight);
  const targetWidth = sourceWidth * scale;
  const targetHeight = sourceHeight * scale;

  thumbnailContext.drawImage(
    image,
    (thumbnailCanvas.width - targetWidth) / 2,
    (thumbnailCanvas.height - targetHeight) / 2,
    targetWidth,
    targetHeight,
  );

  return thumbnailCanvas.toDataURL("image/jpeg", 0.82);
}

function getDefaultOverlayPosition(scale = DEFAULT_OVERLAY.scale) {
  const width = Math.round((CANVAS_WIDTH * scale) / 100);
  const height = Math.round((width * 9) / 16);

  return {
    x: Math.round((CANVAS_WIDTH - width) / 2),
    y: CANVAS_HEIGHT - height - DEFAULT_OVERLAY.bottomOffset,
  };
}

function updateOverlayReadouts() {
  const scale = Number(overlayScale.value);
  const width = Math.round((CANVAS_WIDTH * scale) / 100);
  const height = Math.round((width * 9) / 16);

  overlayX.max = String(CANVAS_WIDTH - width);
  overlayY.max = String(CANVAS_HEIGHT - height);
  overlayX.value = String(Math.min(Number(overlayX.value), CANVAS_WIDTH - width));
  overlayY.value = String(Math.min(Number(overlayY.value), CANVAS_HEIGHT - height));

  overlayXValue.value = `${overlayX.value} px`;
  overlayYValue.value = `${overlayY.value} px`;
  overlayScaleValue.value = `${scale}%`;
}

function resetOverlayPosition() {
  const scale = Number(overlayScale.value);
  const position = getDefaultOverlayPosition(scale);

  overlayX.value = String(position.x);
  overlayY.value = String(position.y);
  updateOverlayReadouts();
}

function setSlideStatus(message = "") {
  slideCount.textContent = slides.length ? `${currentSlideIndex + 1} / ${slides.length}` : "0 / 0";
  renderStatus.textContent = message || "9:16 · Ready";
}

function updateTeleprompter() {
  if (!slides.length) {
    teleprompterSlideLabel.textContent = "No slide";
    teleprompterText.textContent = "Upload slides, then add script text for each slide.";
    return;
  }

  const activeSlide = slides[currentSlideIndex];
  teleprompterSlideLabel.textContent = `Slide ${currentSlideIndex + 1}`;
  teleprompterText.textContent = activeSlide.script.trim() || "No script yet for this slide.";
  teleprompterText.scrollTop = 0;
}

function renderSlideScriptEditors() {
  scriptEditorStatus.textContent = `${slides.length} ${slides.length === 1 ? "slide" : "slides"}`;
  slideScriptList.innerHTML = "";

  if (!slides.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "slide-script-empty";
    emptyState.textContent = "Upload slides to create editable script notes for each visual.";
    slideScriptList.append(emptyState);
    updateTeleprompter();
    return;
  }

  slides.forEach((slide, index) => {
    const item = document.createElement("article");
    item.className = "slide-script-item";
    item.classList.toggle("is-active", index === currentSlideIndex);

    const thumbnail = document.createElement("img");
    thumbnail.className = "slide-thumb";
    thumbnail.src = slide.thumbnail;
    thumbnail.alt = `Slide ${index + 1} thumbnail`;

    const content = document.createElement("div");
    const meta = document.createElement("div");
    meta.className = "slide-script-meta";
    meta.innerHTML = `<span>Slide ${index + 1}</span><span>${slide.type.toUpperCase()}</span>`;

    const textarea = document.createElement("textarea");
    textarea.className = "script-textarea";
    textarea.placeholder = `What to say for Slide ${index + 1}`;
    textarea.value = slide.script;
    textarea.addEventListener("input", () => {
      slides[index].script = textarea.value;
      if (index === currentSlideIndex) {
        updateTeleprompter();
      }
    });

    content.append(meta, textarea);
    item.append(thumbnail, content);
    slideScriptList.append(item);
  });

  updateTeleprompter();
}

function syncActiveSlideUi() {
  setSlideStatus();
  updateTeleprompter();
  [...slideScriptList.querySelectorAll(".slide-script-item")].forEach((item, index) => {
    item.classList.toggle("is-active", index === currentSlideIndex);
  });
}

function setScene(scene) {
  currentScene = scene;
  const isFullCamera = currentScene === "fullCamera";

  presentationMode.classList.toggle("is-active", !isFullCamera);
  fullCameraMode.classList.toggle("is-active", isFullCamera);
  sceneStatus.textContent = isFullCamera ? "Full Camera" : "Presentation";
  overlayControls.classList.toggle("is-disabled", isFullCamera);

  [overlayX, overlayY, overlayScale, resetOverlay].forEach((control) => {
    control.disabled = isFullCamera;
  });
}

function updateCameraShapeStatus() {
  cameraShapeStatus.textContent = getCameraShapeLabel();
}

function nextSlide() {
  if (!slides.length) return;
  currentSlideIndex = (currentSlideIndex + 1) % slides.length;
  syncActiveSlideUi();
}

function previousSlide() {
  if (!slides.length) return;
  currentSlideIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
  syncActiveSlideUi();
}

function drawCoverImage(image, x, y, width, height) {
  const sourceWidth = image.videoWidth || image.naturalWidth || image.width;
  const sourceHeight = image.videoHeight || image.naturalHeight || image.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, x, y, width, height);
}

function drawContainImage(image, x, y, width, height) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const targetWidth = sourceWidth * scale;
  const targetHeight = sourceHeight * scale;

  ctx.drawImage(
    image,
    x + (width - targetWidth) / 2,
    y + (height - targetHeight) / 2,
    targetWidth,
    targetHeight,
  );
}

function drawRoundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawHeartPath(x, y, width, height) {
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y + height * 0.92);
  ctx.bezierCurveTo(x + width * 0.1, y + height * 0.66, x, y + height * 0.38, x + width * 0.2, y + height * 0.18);
  ctx.bezierCurveTo(x + width * 0.36, y + height * 0.02, x + width * 0.5, y + height * 0.16, x + width / 2, y + height * 0.29);
  ctx.bezierCurveTo(x + width * 0.5, y + height * 0.16, x + width * 0.64, y + height * 0.02, x + width * 0.8, y + height * 0.18);
  ctx.bezierCurveTo(x + width, y + height * 0.38, x + width * 0.9, y + height * 0.66, x + width / 2, y + height * 0.92);
  ctx.closePath();
}

function drawCameraShapePath(x, y, width, height, shape = cameraShape.value) {
  if (shape === "circle") {
    const radius = Math.min(width, height) / 2;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }

  if (shape === "heart") {
    drawHeartPath(x, y, width, height);
    return;
  }

  if (shape === "rounded") {
    drawRoundedRect(x, y, width, height, 28);
    return;
  }

  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.closePath();
}

function getCameraShapeLabel() {
  return cameraShape.options[cameraShape.selectedIndex]?.textContent || "Square";
}

function truncateCanvasText(text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let clipped = text;
  while (clipped.length > 3 && ctx.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped.trim()}...`;
}

function drawEmptySlideState() {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#101722");
  gradient.addColorStop(1, "#05070a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= CANVAS_WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CANVAS_HEIGHT; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#eef3ff";
  ctx.font = "700 56px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Upload slides to begin", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 18);
  ctx.fillStyle = "#8f9caf";
  ctx.font = "400 28px Inter, system-ui, sans-serif";
  ctx.fillText("PNG, JPG, and PDF files render here at 1080 x 1920", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 34);
}

function drawSlide() {
  if (!slides.length) {
    drawEmptySlideState();
    return;
  }

  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawContainImage(slides[currentSlideIndex].image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawWebcamOverlay() {
  const scale = Number(overlayScale.value);
  const width = Math.round((CANVAS_WIDTH * scale) / 100);
  const height = Math.round((width * 9) / 16);
  const x = Number(overlayX.value);
  const y = Number(overlayY.value);
  const shape = cameraShape.value;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  drawCameraShapePath(x, y, width, height, shape);
  ctx.fillStyle = "#090d13";
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawCameraShapePath(x, y, width, height, shape);
  ctx.clip();

  if (snapSession && snapCameraCanvas.width > 0 && snapCameraCanvas.height > 0) {
    drawCoverImage(snapCameraCanvas, x, y, width, height);
  } else {
    ctx.fillStyle = "#0b1018";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#8f9caf";
    ctx.font = "600 28px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Camera preview", x + width / 2, y + height / 2 + 10);
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(124, 244, 231, 0.78)";
  ctx.lineWidth = 5;
  drawCameraShapePath(x + 2.5, y + 2.5, width - 5, height - 5, shape);
  ctx.stroke();
}

function drawFullCameraScene() {
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (snapSession && snapCameraCanvas.width > 0 && snapCameraCanvas.height > 0) {
    drawCoverImage(snapCameraCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(1, "#05070a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#eef3ff";
  ctx.font = "700 54px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Start camera preview", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
}

function drawProductShowcase() {
  if (!productShowcase.pinned) return;

  const x = 54;
  const y = 70;
  const width = CANVAS_WIDTH - 108;
  const height = 154;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  drawRoundedRect(x, y, width, height, 24);
  ctx.fillStyle = "#fff8ed";
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.fillStyle = "#c8a24a";
  drawRoundedRect(x + 22, y + 22, 8, height - 44, 4);
  ctx.fill();

  ctx.fillStyle = "#2a2118";
  ctx.font = "800 38px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(truncateCanvasText(productShowcase.name, width - 280), x + 52, y + 62);

  ctx.fillStyle = "#8a6a22";
  ctx.font = "900 42px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(truncateCanvasText(productShowcase.price, 230), x + width - 34, y + 64);

  ctx.fillStyle = "#5a4a36";
  ctx.font = "600 27px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(truncateCanvasText(productShowcase.cta, width - 96), x + 52, y + 112);

  ctx.strokeStyle = "rgba(200, 162, 74, 0.72)";
  ctx.lineWidth = 3;
  drawRoundedRect(x + 1.5, y + 1.5, width - 3, height - 3, 22);
  ctx.stroke();
  ctx.restore();
}

function getCountdownRemainingMs() {
  if (countdown.running && countdown.endAt) {
    countdown.remainingMs = Math.max(0, countdown.endAt - performance.now());
    if (countdown.remainingMs === 0) {
      countdown.running = false;
      countdown.endAt = null;
    }
  }
  return countdown.remainingMs;
}

function formatCountdown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function drawCountdownTimer() {
  if (!countdown.visible) return;
  const remainingMs = getCountdownRemainingMs();
  if (remainingMs <= 0) return;

  const label = formatCountdown(remainingMs);
  const x = CANVAS_WIDTH - 330;
  const y = productShowcase.pinned ? 246 : 70;
  const width = 276;
  const height = 82;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(x, y, width, height, 24);
  ctx.fillStyle = "rgba(14, 16, 20, 0.88)";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(200, 162, 74, 0.82)";
  ctx.lineWidth = 2.5;
  drawRoundedRect(x + 1.25, y + 1.25, width - 2.5, height - 2.5, 22);
  ctx.stroke();

  ctx.fillStyle = "#c8a24a";
  ctx.font = "800 17px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("FLASH SALE", x + 28, y + 30);

  ctx.fillStyle = "#fff8ed";
  ctx.font = "900 40px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(label, x + width - 28, y + 55);
  ctx.restore();
}

function drawVisualAlerts(timestamp) {
  for (let index = visualAlerts.length - 1; index >= 0; index -= 1) {
    const alert = visualAlerts[index];
    const elapsed = timestamp - alert.createdAt;
    if (elapsed >= ALERT_DURATION_MS) {
      visualAlerts.splice(index, 1);
      continue;
    }

    const progress = elapsed / ALERT_DURATION_MS;
    const alpha = Math.min(1, 1 - progress);
    const y = 112 + index * 104 - Math.max(0, progress - 0.72) * 54;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    drawRoundedRect(54, y, CANVAS_WIDTH - 108, 78, 22);
    ctx.fillStyle = alert.color;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#03110f";
    ctx.font = "800 30px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(alert.label, 86, y + 39);
    ctx.restore();
  }
}

function triggerCelebration(title = "Order Confirmed!", subtitle = "VIP Buyer Shoutout!") {
  const colors = ["#fff8ed", "#f7d476", "#c8a24a", "#ffffff", "#f0b84f"];
  const particles = Array.from({ length: 92 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 220 + Math.random() * 620;
    return {
      x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 80,
      y: CANVAS_HEIGHT * 0.42 + (Math.random() - 0.5) * 80,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 180,
      size: 5 + Math.random() * 12,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });

  celebrations.unshift({
    title,
    subtitle,
    createdAt: performance.now(),
    duration: 4200,
    particles,
  });
  celebrations.splice(2);
}

function drawCelebrations(timestamp) {
  for (let index = celebrations.length - 1; index >= 0; index -= 1) {
    const celebration = celebrations[index];
    const elapsed = timestamp - celebration.createdAt;
    const progress = elapsed / celebration.duration;

    if (progress >= 1) {
      celebrations.splice(index, 1);
      continue;
    }

    const alpha = progress < 0.18 ? progress / 0.18 : Math.max(0, 1 - (progress - 0.72) / 0.28);

    ctx.save();
    celebration.particles.forEach((particle) => {
      const seconds = elapsed / 1000;
      const x = particle.x + particle.vx * seconds;
      const y = particle.y + particle.vy * seconds + 520 * seconds * seconds;
      const rotation = particle.rotation + particle.spin * seconds;

      ctx.save();
      ctx.globalAlpha = alpha * Math.max(0, 1 - progress * 0.78);
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.58);
      ctx.restore();
    });

    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
    ctx.shadowBlur = 28;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff8ed";
    ctx.font = "900 64px Inter, system-ui, sans-serif";
    ctx.fillText(celebration.title, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.42);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#f7d476";
    ctx.font = "800 30px Inter, system-ui, sans-serif";
    ctx.fillText(celebration.subtitle, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.42 + 48);
    ctx.restore();
  }
}

function renderFrame() {
  const timestamp = performance.now();
  if (currentScene === "fullCamera") {
    drawFullCameraScene();
  } else {
    drawSlide();
    drawWebcamOverlay();
  }
  drawProductShowcase();
  drawCountdownTimer();
  drawVisualAlerts(timestamp);
  drawCelebrations(timestamp);
  window.requestAnimationFrame(renderFrame);
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        image,
        thumbnail: createSlideThumbnail(image),
        name: file.name,
        type: "image",
        script: "",
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load ${file.name}.`));
    };
    image.src = url;
  });
}

async function renderPdfFile(file) {
  const pdfjsLib = await pdfjsLibReady();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const renderedPages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setSlideStatus(`Rendering ${file.name} · page ${pageNumber}/${pdf.numPages}`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const pageCanvas = document.createElement("canvas");
    const pageContext = pageCanvas.getContext("2d", { alpha: false });

    pageCanvas.width = Math.ceil(viewport.width);
    pageCanvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: pageContext, viewport }).promise;

    renderedPages.push({
      image: pageCanvas,
      thumbnail: createSlideThumbnail(pageCanvas),
      name: `${file.name} · page ${pageNumber}`,
      type: "pdf",
      script: "",
    });
  }

  return renderedPages;
}

async function handleSlideUpload(event) {
  const files = [...event.target.files];
  if (!files.length) return;

  renderStatus.textContent = "Loading slides...";
  const loadedSlides = [];

  for (const file of files) {
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        loadedSlides.push(...(await renderPdfFile(file)));
      } else if (file.type.startsWith("image/")) {
        loadedSlides.push(await loadImageFile(file));
      }
    } catch (error) {
      console.error(error);
      renderStatus.textContent = error.message;
    }
  }

  if (loadedSlides.length) {
    slides = loadedSlides;
    currentSlideIndex = 0;
    renderSlideScriptEditors();
  }

  event.target.value = "";
  syncActiveSlideUi();
}

function splitScriptFile(text) {
  const paragraphChunks = text
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (paragraphChunks.length > 1) {
    return paragraphChunks;
  }

  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function handleScriptUpload(event) {
  const [file] = event.target.files;
  if (!file || !slides.length) {
    event.target.value = "";
    return;
  }

  const text = await file.text();
  const chunks = splitScriptFile(text);
  slides.forEach((slide, index) => {
    slide.script = chunks[index] || slide.script;
  });

  event.target.value = "";
  renderSlideScriptEditors();
  syncActiveSlideUi();
}

function pinCurrentProduct() {
  const name = productName.value.trim();
  const price = productPrice.value.trim();
  const cta = productCta.value.trim() || "Tap the link below to buy!";

  if (!name) {
    productStatus.textContent = "Name needed";
    return;
  }

  productShowcase.pinned = true;
  productShowcase.name = name;
  productShowcase.price = price;
  productShowcase.cta = cta;
  productStatus.textContent = "Pinned";
}

function clearCurrentProduct() {
  productShowcase.pinned = false;
  productStatus.textContent = "No product";
}

function updateCountdownDurationFromInput() {
  const minutes = Math.max(0.25, Number(countdownMinutes.value) || 5);
  countdown.durationMs = minutes * 60 * 1000;
  if (!countdown.running) {
    countdown.remainingMs = countdown.durationMs;
  }
}

function startFlashCountdown() {
  updateCountdownDurationFromInput();
  countdown.running = true;
  countdown.visible = true;
  countdown.endAt = performance.now() + countdown.remainingMs;
}

function pauseFlashCountdown() {
  getCountdownRemainingMs();
  countdown.running = false;
  countdown.endAt = null;
  countdown.visible = true;
}

function resetFlashCountdown() {
  updateCountdownDurationFromInput();
  countdown.running = false;
  countdown.endAt = null;
  countdown.remainingMs = countdown.durationMs;
  countdown.visible = false;
}

function setTikTokStatus(message) {
  tiktokStatus.textContent = message;
}

function normalizeUsername(value) {
  return value.trim().replace(/^@+/, "");
}

function getDisplayName(data = {}) {
  const user = data.user || data.userInfo || data.profile || data.sender || {};
  return (
    user.uniqueId ||
    user.username ||
    user.nickname ||
    user.displayName ||
    data.uniqueId ||
    data.username ||
    data.nickname ||
    "Someone"
  );
}

function getGiftName(data = {}) {
  const gift = data.gift || data.giftInfo || data.giftDetails || {};
  return data.giftName || gift.name || gift.giftName || gift.displayName || "gift";
}

function getChatText(data = {}) {
  return String(data.comment || data.message || data.text || data.chatText || "");
}

function isHighTierGift(giftName) {
  const normalizedGiftName = giftName.toLowerCase();
  return HIGH_TIER_GIFTS.some((gift) => normalizedGiftName.includes(gift));
}

function hasSalesKeyword(message) {
  const normalizedMessage = message.toLowerCase();
  return SALES_KEYWORDS.some((keyword) => normalizedMessage.includes(keyword));
}

function normalizeTikTokEvent(rawEvent) {
  const event = typeof rawEvent === "string" ? JSON.parse(rawEvent) : rawEvent;
  const type = String(event.event || event.type || event.eventType || event.action || "").toLowerCase();
  const data = event.data || event.payload || event;

  if (type.includes("like")) {
    return {
      type: "like",
      username: getDisplayName(data),
      message: `@${getDisplayName(data)} liked the stream`,
      speech: `${getDisplayName(data)} liked the stream, thank you!`,
    };
  }

  if (type.includes("follow")) {
    return {
      type: "follow",
      username: getDisplayName(data),
      message: `New Follower: @${getDisplayName(data)}`,
      speech: `${getDisplayName(data)} thanks for the follow!`,
    };
  }

  if (type.includes("gift")) {
    const giftName = getGiftName(data);
    return {
      type: "gift",
      username: getDisplayName(data),
      giftName,
      isHighTierGift: isHighTierGift(giftName),
      message: `Gift: @${getDisplayName(data)} sent ${giftName}`,
      speech: `Wow! ${getDisplayName(data)} sent a ${giftName}!`,
    };
  }

  const chatText = getChatText(data);
  if ((chatText && hasSalesKeyword(chatText)) || ((type.includes("chat") || type.includes("comment") || type.includes("message")) && hasSalesKeyword(chatText))) {
    return {
      type: "sale",
      username: getDisplayName(data),
      message: `Order Confirmed: @${getDisplayName(data)}`,
      speech: `${getDisplayName(data)} just confirmed an order!`,
    };
  }

  return null;
}

function getAlertAudio(type) {
  if (type === "gift" || type === "sale") return giftAlertAudio;
  if (type === "follow") return followAlertAudio;
  return likeAlertAudio;
}

function ensureAudioContext() {
  if (!audioContext) {
    const BrowserAudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new BrowserAudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(console.error);
  }
  return audioContext;
}

function playGeneratedTone(type) {
  const context = ensureAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const isBigMoment = type === "gift" || type === "sale";
  const frequency = isBigMoment ? 740 : type === "follow" ? 580 : 420;
  const duration = isBigMoment ? 0.55 : 0.22;

  oscillator.type = isBigMoment ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playAlertSound(type) {
  const audio = getAlertAudio(type);
  audio.currentTime = 0;
  audio.play().catch(() => playGeneratedTone(type));
}

function speakShoutout(text) {
  if (!window.speechSynthesis || !text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1.02;
  utterance.volume = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function queueVisualAlert(alert) {
  const color = alert.type === "gift" || alert.type === "sale" ? "#ffd166" : alert.type === "follow" ? "#7cf4e7" : "#9dff8f";
  visualAlerts.unshift({
    label: alert.message,
    color,
    createdAt: performance.now(),
  });
  visualAlerts.splice(3);
}

function handleTikTokLiveEvent(rawEvent) {
  let alert;
  try {
    alert = normalizeTikTokEvent(rawEvent);
  } catch (error) {
    console.warn("Ignored malformed TikTok event.", error);
    return;
  }

  if (!alert) return;

  playAlertSound(alert.type);
  speakShoutout(alert.speech);
  queueVisualAlert(alert);

  if (alert.type === "sale") {
    triggerCelebration("Order Confirmed!", `@${alert.username}`);
  }
  if (alert.type === "gift" && alert.isHighTierGift) {
    triggerCelebration("VIP Buyer Shoutout!", `@${alert.username} sent ${alert.giftName}`);
  }
}

function getTikTokWebSocketUrl(username) {
  const url = new URL(TIKTOK_LIVE_WS_ENDPOINT);
  url.searchParams.set("username", username);
  return url.toString();
}

function connectToTikTokLive() {
  const username = normalizeUsername(tiktokUsername.value);
  if (!username) {
    setTikTokStatus("Username needed");
    return;
  }

  disconnectFromTikTokLive();
  ensureAudioContext();
  setTikTokStatus("Connecting...");

  try {
    tiktokSocket = new WebSocket(getTikTokWebSocketUrl(username));
  } catch (error) {
    console.error(error);
    setTikTokStatus("Invalid endpoint");
    return;
  }

  tiktokSocket.addEventListener("open", () => {
    setTikTokStatus(`Live: @${username}`);
  });

  tiktokSocket.addEventListener("message", (event) => {
    handleTikTokLiveEvent(event.data);
  });

  tiktokSocket.addEventListener("close", () => {
    setTikTokStatus("Disconnected");
    tiktokSocket = null;
  });

  tiktokSocket.addEventListener("error", (event) => {
    console.error("TikTok Live WebSocket error.", event);
    setTikTokStatus("Connection error");
  });
}

function disconnectFromTikTokLive() {
  if (!tiktokSocket) return;
  tiktokSocket.close(1000, "User disconnected");
  tiktokSocket = null;
  setTikTokStatus("Disconnected");
}

function triggerTestAlert(type) {
  const sampleEvents = {
    like: { event: "like", data: { user: { uniqueId: "demo_viewer" } } },
    follow: { event: "follow", data: { user: { uniqueId: "new_fan" } } },
    gift: {
      event: "gift",
      data: { user: { uniqueId: "top_supporter" }, giftName: "TikTok Universe" },
    },
    sold: { event: "chat", data: { user: { uniqueId: "ready_buyer" }, comment: "sold, I want one!" } },
  };

  ensureAudioContext();
  handleTikTokLiveEvent(sampleEvents[type]);
}

async function listCameras(selectedDeviceId = "") {
  if (!navigator.mediaDevices?.enumerateDevices) {
    cameraSelect.innerHTML = '<option value="">Camera API unavailable</option>';
    cameraStatus.textContent = "Unavailable";
    return;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");

  cameraSelect.innerHTML = "";
  if (!cameras.length) {
    cameraSelect.append(new Option("No webcams found", ""));
    return;
  }

  cameras.forEach((camera, index) => {
    const label = camera.label || `Camera ${index + 1}`;
    cameraSelect.append(new Option(label, camera.deviceId));
  });

  if (selectedDeviceId) {
    cameraSelect.value = selectedDeviceId;
  }
}

function getSnapApiToken() {
  const token = snapApiToken.value.trim() || SNAP_API_TOKEN_PLACEHOLDER;
  if (!token || token === SNAP_API_TOKEN_PLACEHOLDER) {
    throw new Error("Add your Snap Camera Kit API token first.");
  }
  return token;
}

function setSnapStatus(message) {
  snapStatus.textContent = message;
}

function cacheLens(lens, groupId = "") {
  const id = lens.id || lens.lensId || lens.externalId || lens.name;
  if (!id) return "";
  const key = `${groupId}:${id}`;
  loadedLenses.set(key, { lens, groupId, lensId: id });
  return key;
}

function getSelectedLensRecord() {
  return loadedLenses.get(lensSelect.value);
}

async function ensureCameraKitSession() {
  if (snapSession) return snapSession;

  setSnapStatus("Booting...");
  cameraKit = await bootstrapCameraKit({
    apiToken: getSnapApiToken(),
    logger: "console",
  });

  snapSession = await cameraKit.createSession({
    liveRenderTarget: snapCameraCanvas,
  });

  snapSession.events.addEventListener("error", ({ detail }) => {
    console.error(detail.error);
    if (detail.error?.name === "LensExecutionError") {
      setSnapStatus("Lens error");
    }
  });

  setSnapStatus("Ready");
  return snapSession;
}

async function startCamera(deviceId = "") {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = "Unavailable";
    return;
  }

  try {
    const session = await ensureCameraKitSession();

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }

    cameraStatus.textContent = "Starting...";
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: false,
    });

    activeCameraSource = createMediaStreamSource(mediaStream, {
      transform: Transform2D.MirrorX,
      cameraType: "front",
    });

    await session.setSource(activeCameraSource);
    if (typeof activeCameraSource.setRenderSize === "function") {
      await activeCameraSource.setRenderSize(1280, 720);
    }
    await session.play("live");

    const activeTrack = mediaStream.getVideoTracks()[0];
    await listCameras(activeTrack?.getSettings().deviceId || deviceId);
    cameraStatus.textContent = "Live";
    setSnapStatus("Rendering");
  } catch (error) {
    console.error(error);
    cameraStatus.textContent = error.name === "NotAllowedError" ? "Blocked" : "Idle";
    setSnapStatus(error.message || "CameraKit error");
    if (error.name === "NotAllowedError") {
      cameraSelect.innerHTML = '<option value="">Camera permission needed</option>';
    }
  }
}

function renderLensShortcuts() {
  lensQuickActions.innerHTML = "";

  SNAP_LENS_SHORTCUTS.filter((shortcut) => shortcut.lensId && shortcut.groupId).forEach((shortcut) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = shortcut.name;
    button.addEventListener("click", () => {
      lensId.value = shortcut.lensId;
      lensGroupId.value = shortcut.groupId;
      applyLensByIds(shortcut.lensId, shortcut.groupId, shortcut.name).catch(console.error);
    });
    lensQuickActions.append(button);
  });
}

async function loadLensGroupOptions() {
  const groupId = lensGroupId.value.trim();
  if (!groupId) {
    setSnapStatus("Group ID needed");
    return;
  }

  try {
    await ensureCameraKitSession();
    setSnapStatus("Loading group...");
    const { lenses } = await cameraKit.lensRepository.loadLensGroups([groupId]);

    lensSelect.innerHTML = "";
    loadedLenses.clear();

    if (!lenses.length) {
      lensSelect.append(new Option("No lenses found in this group", ""));
      setSnapStatus("No lenses");
      return;
    }

    lenses.forEach((lens, index) => {
      const key = cacheLens(lens, groupId);
      const name = lens.name || lens.displayName || `Lens ${index + 1}`;
      lensSelect.append(new Option(name, key));
    });

    setSnapStatus(`${lenses.length} loaded`);
  } catch (error) {
    console.error(error);
    setSnapStatus(error.message || "Lens group error");
  }
}

async function applyLensByIds(requestedLensId, requestedGroupId, fallbackName = "Lens") {
  if (!requestedLensId || !requestedGroupId) {
    setSnapStatus("Lens and Group IDs needed");
    return;
  }

  try {
    const session = await ensureCameraKitSession();
    setSnapStatus("Loading lens...");
    const lens = await cameraKit.lensRepository.loadLens(requestedLensId, requestedGroupId);
    const key = cacheLens(lens, requestedGroupId);

    if (key && ![...lensSelect.options].some((option) => option.value === key)) {
      lensSelect.append(new Option(lens.name || lens.displayName || fallbackName, key));
      lensSelect.value = key;
    }

    await session.applyLens(lens);
    setSnapStatus("Lens applied");
  } catch (error) {
    console.error(error);
    setSnapStatus(error.message || "Lens error");
  }
}

async function applySelectedLens() {
  const selectedLens = getSelectedLensRecord();
  if (selectedLens) {
    try {
      const session = await ensureCameraKitSession();
      setSnapStatus("Applying...");
      await session.applyLens(selectedLens.lens);
      setSnapStatus("Lens applied");
    } catch (error) {
      console.error(error);
      setSnapStatus(error.message || "Lens error");
    }
    return;
  }

  await applyLensByIds(lensId.value.trim(), lensGroupId.value.trim());
}

async function removeActiveLens() {
  if (!snapSession) return;

  try {
    await snapSession.removeLens();
    setSnapStatus("Lens removed");
  } catch (error) {
    console.error(error);
    setSnapStatus(error.message || "Remove failed");
  }
}

slideUpload.addEventListener("change", handleSlideUpload);
scriptUpload.addEventListener("change", handleScriptUpload);
prevSlideButton.addEventListener("click", previousSlide);
nextSlideButton.addEventListener("click", nextSlide);
presentationMode.addEventListener("click", () => setScene("presentation"));
fullCameraMode.addEventListener("click", () => setScene("fullCamera"));
cameraShape.addEventListener("change", updateCameraShapeStatus);
connectTikTok.addEventListener("click", connectToTikTokLive);
disconnectTikTok.addEventListener("click", disconnectFromTikTokLive);
testLikeAlert.addEventListener("click", () => triggerTestAlert("like"));
testFollowAlert.addEventListener("click", () => triggerTestAlert("follow"));
testGiftAlert.addEventListener("click", () => triggerTestAlert("gift"));
testSoldAlert.addEventListener("click", () => triggerTestAlert("sold"));
pinProduct.addEventListener("click", pinCurrentProduct);
clearProduct.addEventListener("click", clearCurrentProduct);
countdownMinutes.addEventListener("input", updateCountdownDurationFromInput);
startCountdown.addEventListener("click", startFlashCountdown);
stopCountdown.addEventListener("click", pauseFlashCountdown);
resetCountdown.addEventListener("click", resetFlashCountdown);
cameraSelect.addEventListener("change", () => startCamera(cameraSelect.value));
refreshCameras.addEventListener("click", () => startCamera(cameraSelect.value));
resetOverlay.addEventListener("click", resetOverlayPosition);
loadLensGroup.addEventListener("click", loadLensGroupOptions);
lensSelect.addEventListener("change", () => {
  const selectedLens = getSelectedLensRecord();
  if (!selectedLens) return;
  lensId.value = selectedLens.lensId;
  lensGroupId.value = selectedLens.groupId;
});
applyLensButton.addEventListener("click", applySelectedLens);
removeLensButton.addEventListener("click", removeActiveLens);

[overlayX, overlayY, overlayScale].forEach((control) => {
  control.addEventListener("input", updateOverlayReadouts);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    nextSlide();
  }
  if (event.key === "ArrowLeft") {
    previousSlide();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && snapSession && mediaStream) {
    snapSession.play("live").catch(console.error);
  }
});

resetOverlayPosition();
setScene("presentation");
updateCameraShapeStatus();
renderSlideScriptEditors();
syncActiveSlideUi();
listCameras().catch(console.error);
renderLensShortcuts();
renderFrame();
