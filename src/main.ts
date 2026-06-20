import './style.css';

const ROWS = 16;
const COLS = 16;
const TICK = 350;
// orientation 0=┘ 1=└ 2=┌ 3=┐  → CSS rotation degrees
const BASE_DEG: [number, number, number, number] = [-90, 0, 90, 180];

const up    = (i: number) => (i < COLS ? -1 : i - COLS);
const down  = (i: number) => (i > COLS * ROWS - 1 - COLS ? -1 : i + COLS);
const left  = (i: number) => (i % COLS === 0 ? -1 : i - 1);
const right = (i: number) => (i % COLS === COLS - 1 ? -1 : i + 1);

type Neighbor = { fn: (i: number) => number; o: number[] };
const CONNECTIONS: Neighbor[][] = [
  [{ fn: left,  o: [1, 2] }, { fn: up,    o: [2, 3] }],
  [{ fn: up,    o: [2, 3] }, { fn: right, o: [0, 3] }],
  [{ fn: right, o: [0, 3] }, { fn: down,  o: [0, 1] }],
  [{ fn: down,  o: [0, 1] }, { fn: left,  o: [1, 2] }],
];

function findNextRotations(
  previous: Set<number>,
  data: { orientation: number }[]
): Set<number> {
  const next = new Set<number>();
  for (const idx of previous) {
    for (const { fn, o } of CONNECTIONS[data[idx].orientation]) {
      const ni = fn(idx);
      if (ni > -1 && o.includes(data[ni].orientation)) next.add(ni);
    }
  }
  return next;
}

// ── Audio ──────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;
let clickBuffer: AudioBuffer | null = null;

async function initAudio() {
  try {
    audioCtx = new AudioContext();
    const res = await fetch("assets/click.mp3");
    clickBuffer = await audioCtx.decodeAudioData(await res.arrayBuffer());
  } catch { /* audio unavailable */ }
}

function playClick(delaySeconds = 0) {
  if (!audioCtx || !clickBuffer) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.5;
  const src = audioCtx.createBufferSource();
  src.buffer = clickBuffer;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(audioCtx.currentTime + delaySeconds);
}

// ── Animation helpers ──────────────────────────────────────────────────────

function replayAnimation(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so animation restarts
  el.classList.add(cls);
  el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
}

// ── Game ───────────────────────────────────────────────────────────────────

// Base SVG for each cell: └ shape (orientation 1, 0°)
// Arc center at top-right corner (64,0), r=32, CCW from top-center (32,0) to
// right-center (64,32). sweep=0 (CCW) ensures each pipe endpoint exits
// perpendicular to its cell edge — critical for seamless connections.
const CELL_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle class="plate" cx="32" cy="32" r="32" fill="#1e2126"/>
  <path class="pipe-shadow" d="M 32,0 A 32,32 0 0,0 64,32"/>
  <path class="arc" d="M 32,0 A 32,32 0 0,0 64,32"/>
  <path class="pipe-highlight" d="M 32,0 A 32,32 0 0,0 64,32"/>
</svg>`;

function initGame() {
  const board      = document.getElementById("board")!;
  const scoreEl    = document.getElementById("score-value")!;
  const bestEl     = document.getElementById("best-value")!;
  const scoreLine  = document.getElementById("score-line")!;
  const bestLine   = document.getElementById("best-line")!;
  const resetBtn   = document.getElementById("reset-button")!;
  const shareBtn   = document.getElementById("share-button")!;
  const flashEl    = document.getElementById("flash-overlay")!;

  // Game state: orientation (0-3) + cumulative CSS rotation degrees
  const data = Array.from({ length: ROWS * COLS }, () => ({
    orientation: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
    deg: 0,
  }));
  data.forEach(d => { d.deg = BASE_DEG[d.orientation]; });

  let score     = 0;
  let bestScore = parseInt(localStorage.getItem("bestScore") ?? "0", 10);
  let active    = false;

  bestEl.textContent = String(bestScore);

  // Build cells
  const cells: HTMLButtonElement[] = [];
  board.innerHTML = "";
  for (let i = 0; i < ROWS * COLS; i++) {
    const btn = document.createElement("button");
    btn.className = "cell";
    btn.innerHTML = CELL_SVG;
    btn.style.transform = `rotate(${data[i].deg}deg)`;
    btn.addEventListener("pointerdown", () => handleClick(i));
    board.appendChild(btn);
    cells.push(btn);
  }

  // ── Core interaction ─────────────────────────────────────────────────────

  function rotatePiece(index: number) {
    data[index].orientation = ((data[index].orientation + 1) % 4) as 0 | 1 | 2 | 3;
    data[index].deg += 90; // cumulative: always rotates forward
    cells[index].style.transform = `rotate(${data[index].deg}deg)`;
  }

  function chainActivate(index: number) {
    replayAnimation(cells[index], "chain-active");
  }

  function handleClick(startIndex: number) {
    replayAnimation(flashEl, "flash-active"); // camera flash (always fires)
    if (active) return;
    active = true;
    score = 0;

    let next = [startIndex];

    function step() {
      if (next.length === 0) {
        active = false;
        replayAnimation(scoreLine, "score-flash");
        if (score > bestScore) {
          bestScore = score;
          bestEl.textContent = String(bestScore);
          replayAnimation(bestLine, "score-flash");
          localStorage.setItem("bestScore", String(bestScore));
        }
        return;
      }

      const rotated = new Set<number>();
      for (const idx of next) {
        rotatePiece(idx);
        chainActivate(idx);
        playClick(Math.random() * (TICK / 1000));
        score++;
        scoreEl.textContent = String(score);
        rotated.add(idx);
      }

      next = Array.from(findNextRotations(rotated, data));
      setTimeout(step, TICK);
    }

    step();
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  resetBtn.addEventListener("click", () => {
    if (active) return;
    score = 0;
    scoreEl.textContent = "0";

    for (let i = 0; i < data.length; i++) {
      const orientation = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
      // Rotate via shortest path so CSS transition looks natural
      const currentMod = ((data[i].deg % 360) + 360) % 360;
      const targetMod  = ((BASE_DEG[orientation]) + 360) % 360;
      let diff = targetMod - currentMod;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      data[i].orientation = orientation;
      data[i].deg += diff;
      cells[i].style.transform = `rotate(${data[i].deg}deg)`;
    }
  });

  // ── Share ────────────────────────────────────────────────────────────────

  shareBtn.addEventListener("click", async () => {
    const url = window.location.href;
    const best = localStorage.getItem("bestScore") ?? "0";
    try { await navigator.clipboard.writeText(url); } catch { /* */ }
    if (!navigator.share) return;
    const text = best === "0"
      ? "I'm playing chain reaction! "
      : `I got ${best} in chain reaction! `;
    try { await navigator.share({ title: "Chain Reaction", text, url }); } catch { /* */ }
  });

  // ── Responsive sizing ────────────────────────────────────────────────────

  function resize() {
    const ui  = document.getElementById("ui")!;
    // visualViewport gives the actual visible area on mobile (excludes browser
    // chrome that appears/disappears on scroll), falling back to window dims.
    const vw  = window.visualViewport?.width  ?? window.innerWidth;
    const vh  = window.visualViewport?.height ?? window.innerHeight;
    const availH = vh - ui.offsetHeight - 8;
    const availW = vw - 8;
    const size   = Math.max(0, Math.min(availH, availW));
    board.style.width  = `${size}px`;
    board.style.height = `${size}px`;
  }

  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);

  // Run synchronously first — accessing offsetHeight forces a layout reflow,
  // giving us a correct size before the first paint so cells never flash large.
  resize();
  // Second pass after fonts load, in case IBM Plex Mono changes the UI bar height.
  document.fonts?.ready?.then(resize);
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initGame();
  initAudio();
});
