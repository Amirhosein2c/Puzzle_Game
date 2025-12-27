/* ================= STATE ================= */
const board = document.getElementById("board");
const startOverlay = document.getElementById("startOverlay");
const timeEl = document.getElementById("time");
const movesEl = document.getElementById("moves");
const message = document.getElementById("message");
const resetBtn = document.getElementById("resetBtn");
const pauseBtn = document.getElementById("pauseBtn");
const cursor = document.getElementById("handCursor");
const video = document.getElementById("handVideo");

let SIZE = 3;
let tiles = [];
const currentImage = "./Argoman_Logo.png";
let paused = false;
let moves = 0;
let startTime = 0;
let timer = null;
let zCounter = 1;

/* ================= FULLSCREEN START ================= */
startOverlay.addEventListener(
  "pointerdown",
  async () => {
    startOverlay.classList.add("hidden");
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  },
  { once: true }
);

/* ================= GAME ================= */
function startGame() {
  clearInterval(timer);
  board.innerHTML = "";
  tiles = [];
  moves = 0;
  zCounter = 1;
  paused = false;
  movesEl.textContent = "0";
  message.classList.remove("show");

  const boardSize = Math.min(window.innerWidth, window.innerHeight) * 0.9;
  const tileSize = boardSize / SIZE;

  board.style.width = boardSize + "px";
  board.style.height = boardSize + "px";

  for (let i = 0; i < SIZE * SIZE; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.correct = i;
    tile.dataset.locked = "false";

    const col = i % SIZE;
    const row = Math.floor(i / SIZE);

    tile.style.width = tileSize + "px";
    tile.style.height = tileSize + "px";
    tile.style.left = col * tileSize + "px";
    tile.style.top = row * tileSize + "px";
    tile.style.backgroundImage = `url(${currentImage})`;
    tile.style.backgroundSize = `${boardSize}px ${boardSize}px`;
    tile.style.backgroundPosition = `-${col * tileSize}px -${row * tileSize}px`;

    tiles.push(tile);
    board.appendChild(tile);
  }

  setTimeout(shuffleTiles, 3000);
  startTimer();
}

function shuffleTiles() {
  tiles.forEach((tile) => {
    tile.style.left = Math.random() * (board.clientWidth - tile.clientWidth) + "px";
    tile.style.top = Math.random() * (board.clientHeight - tile.clientHeight) + "px";
    tile.style.zIndex = zCounter++;
  });
}

function startTimer() {
  startTime = performance.now();
  timer = setInterval(() => {
    if (!paused) {
      timeEl.textContent = ((performance.now() - startTime) / 1000).toFixed(1);
    }
  }, 100);
}

function handleDrop(tile, tileSize) {
  const rect = tile.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  const col = Math.round((rect.left - boardRect.left) / tileSize);
  const row = Math.round((rect.top - boardRect.top) / tileSize);
  const targetIndex = row * SIZE + col;

  moves++;
  movesEl.textContent = moves;

  if (targetIndex === +tile.dataset.correct) {
    // Snap into place
    tile.style.left = col * tileSize + "px";
    tile.style.top = row * tileSize + "px";
    tile.dataset.locked = "true";
    tile.classList.add("locked");

    // 🔑 Z-INDEX MANAGEMENT FIX
    // 1. Locked tile goes to the back
    tile.style.zIndex = 0;

    // 2. Bring ALL unlocked tiles above locked ones
    let z = 1;
    tiles.forEach((t) => {
      if (t.dataset.locked !== "true") {
        t.style.zIndex = z++;
      }
    });

    // Reset zCounter so future drags stay above everything
    zCounter = z + 1;
  }

  if (tiles.every((t) => t.dataset.locked === "true")) {
    clearInterval(timer);
    message.classList.add("show");
  }
}


/* ================= HAND TRACKING ================= */

// Cursor smoothing state
let smoothX = window.innerWidth / 2;
let smoothY = window.innerHeight / 2;
let lastX = smoothX;
let lastY = smoothY;

// Velocity smoothing params
const BASE_SMOOTH = 0.12;
const FAST_SMOOTH = 0.35;
const SPEED_THRESHOLD = 25;

// Pinch hysteresis
const PINCH_START = 0.035;
const PINCH_RELEASE = 0.055;
let pinching = false;

// Cursor fade
let cursorVisible = false;
let fadeTimeout = null;

// Grab state
let grabbedTile = null;
let grabOffsetX = 0;
let grabOffsetY = 0;

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults((results) => {
  if (!results.multiHandLandmarks.length || paused) {
    hideCursor();
    releaseGrab();
    return;
  }

  showCursor();

  const lm = results.multiHandLandmarks[0];

  // 👉 Use THUMB TIP for cursor position (more stable when pinching)
  const thumb = lm[4];
  const index = lm[8];

  // Mirror X for natural movement
  const targetX = (1 - thumb.x) * window.innerWidth;
  const targetY = thumb.y * window.innerHeight;

  // Velocity-based smoothing
  const speed = Math.hypot(targetX - lastX, targetY - lastY);
  const smoothing = speed > SPEED_THRESHOLD ? FAST_SMOOTH : BASE_SMOOTH;

  smoothX += (targetX - smoothX) * smoothing;
  smoothY += (targetY - smoothY) * smoothing;

  lastX = smoothX;
  lastY = smoothY;

  cursor.style.left = smoothX + "px";
  cursor.style.top = smoothY + "px";

  // Pinch hysteresis (index ↔ thumb)
  const pinchDist = Math.hypot(index.x - thumb.x, index.y - thumb.y);

  if (!pinching && pinchDist < PINCH_START) {
    pinching = true;
    tryGrab(smoothX, smoothY);
  } else if (pinching && pinchDist > PINCH_RELEASE) {
    pinching = false;
    releaseGrab();
  }

  cursor.classList.toggle("grabbing", pinching);

  if (grabbedTile) moveGrab(smoothX, smoothY);
});


const camera = new Camera(video, {
  onFrame: async () => await hands.send({ image: video }),
  width: 640,
  height: 480,
});

camera.start();

/* ================= CURSOR VISIBILITY ================= */
function showCursor() {
  if (cursorVisible) return;
  cursorVisible = true;
  cursor.style.display = "block";
  cursor.style.opacity = "1";
  clearTimeout(fadeTimeout);
}

function hideCursor() {
  if (!cursorVisible) return;
  clearTimeout(fadeTimeout);
  fadeTimeout = setTimeout(() => {
    cursor.style.opacity = "0";
    cursorVisible = false;
  }, 150);
}

/* ================= GRAB LOGIC ================= */
function tryGrab(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || !el.classList.contains("tile")) return;
  if (el.dataset.locked === "true") return;

  grabbedTile = el;
  grabbedTile.style.zIndex = zCounter++;
  grabOffsetX = x - grabbedTile.offsetLeft;
  grabOffsetY = y - grabbedTile.offsetTop;
}

function moveGrab(x, y) {
  grabbedTile.style.left = x - grabOffsetX + "px";
  grabbedTile.style.top = y - grabOffsetY + "px";
}

function releaseGrab() {
  if (!grabbedTile) return;
  handleDrop(grabbedTile, grabbedTile.clientWidth);
  grabbedTile = null;
}

/* ================= UI ================= */
resetBtn.onclick = startGame;
pauseBtn.onclick = () => (paused = !paused);

/* ================= START ================= */
const img = new Image();
img.onload = startGame;
img.src = currentImage;
