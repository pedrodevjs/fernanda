#!/usr/bin/env node

const readline = require("node:readline");

const TICK_MS = 80;
const T_END = 45;
const WIDTH = Math.max(48, Math.min(96, Number(process.stdout.columns || 72)));
const HEIGHT = Math.max(22, Math.min(42, Number(process.stdout.rows || 30) - 2));
const USE_COLOR = !process.argv.includes("--no-color");
const ONCE = process.argv.includes("--once");
const LOOP = process.argv.includes("--loop");

const KEYS = [
  [0, 0, 0, 0, 0, 0, 0],
  [5, 0.42, 0.22, 0, 0, 0.25, 0],
  [10, 0.62, 0.42, 0, 0, 0.5, 0.35],
  [16, 0.8, 0.68, 0.5, 0, 0.72, 0.55],
  [24, 1, 1, 1, 0, 1, 1],
  [30, 1, 1, 1, 0, 1, 1],
  [39, 0.98, 0.85, 0.55, 1, 0.92, 0],
  [45, 0.98, 0.85, 0.55, 1, 0.9, 0],
];

const COLORS = {
  soil: 130,
  stem: 45,
  leaf: 43,
  petal: 213,
  light: 219,
  gold: 220,
  wilt: 137,
  white: 231,
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function noise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep(x, a, b) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function state(time) {
  const t = clamp(time / T_END, 0, 1) * T_END;
  let i = KEYS.findIndex((key) => key[0] > t) - 1;
  i = Math.max(0, Math.min(KEYS.length - 2, i));
  const u = (t - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]);
  const p0 = KEYS[Math.max(i - 1, 0)].slice(1);
  const p1 = KEYS[i].slice(1);
  const p2 = KEYS[i + 1].slice(1);
  const p3 = KEYS[Math.min(i + 2, KEYS.length - 1)].slice(1);
  return p1.map((_, n) => clamp(0.5 * (
    2 * p1[n] +
    (p2[n] - p0[n]) * u +
    (2 * p0[n] - 5 * p1[n] + 4 * p2[n] - p3[n]) * u ** 2 +
    (3 * p1[n] - p0[n] - 3 * p2[n] + p3[n]) * u ** 3
  )));
}

function put(screen, x, y, char, color = COLORS.white) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (iy >= 0 && iy < screen.length && ix >= 0 && ix < screen[0].length) {
    screen[iy][ix] = { char, color };
  }
}

function line(screen, x0, y0, x1, y1, char, color) {
  const length = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let n = 0; n <= length; n += 1) {
    const t = n / length;
    put(screen, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, char, color);
  }
}

function bezier(points, t) {
  const q = 1 - t;
  return [
    q ** 3 * points[0][0] + 3 * q ** 2 * t * points[1][0] +
      3 * q * t ** 2 * points[2][0] + t ** 3 * points[3][0],
    q ** 3 * points[0][1] + 3 * q ** 2 * t * points[1][1] +
      3 * q * t ** 2 * points[2][1] + t ** 3 * points[3][1],
  ];
}

function render(time) {
  const screen = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => ({ char: " ", color: COLORS.white })));
  const [stem, size, bloom, wilt, leaf, glow] = state(time);
  const cx = WIDTH / 2;
  const ground = HEIGHT * 0.8;
  const top = ground - HEIGHT * 0.38 * stem;
  const sway = Math.sin(time * 0.9) * stem * (1 - 0.6 * wilt) * WIDTH * 0.04;
  const points = [
    [cx, ground],
    [cx - WIDTH * 0.03 * (1 - wilt), ground - HEIGHT * 0.12],
    [cx + sway * 0.5, ground - HEIGHT * (0.28 + 0.1 * wilt)],
    [cx + sway + WIDTH * 0.08 * wilt, top],
  ];

  for (let y = Math.floor(ground); y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const grain = noise(x, y);
      if (grain < 0.22) put(screen, x, y, grain < 0.15 ? "." : ":", COLORS.soil);
    }
  }

  if (stem > 0.01) {
    for (let n = 0; n < 36 * stem; n += 1) {
      const t = n / 35;
      const [x, y] = bezier(points, t);
      line(screen, x - 1, y, x + 1, y, wilt > 0.5 ? "~" : "|", wilt > 0.45 ? COLORS.wilt : COLORS.stem);
    }
  }

  if (leaf > 0.02) {
    const leaves = [[0.35, -1], [0.47, 1], [0.61, -1], [0.7, 1]];
    for (const [t, direction] of leaves) {
      if (t > leaf * 0.85 + 0.15) continue;
      const [x, y] = bezier(points, t);
      const length = (5 + 7 * leaf) * (1 - 0.25 * wilt);
      const endX = x + direction * length * (1 - 0.5 * wilt);
      const endY = y - 2 + wilt * 3;
      line(screen, x, y, endX, endY, wilt > 0.55 ? "\\" : "-", wilt > 0.45 ? COLORS.wilt : COLORS.leaf);
      put(screen, endX, endY, wilt > 0.55 ? "v" : direction < 0 ? "<" : ">", wilt > 0.45 ? COLORS.wilt : COLORS.leaf);
    }
  }

  if (size > 0.05) {
    const [hx, hy] = points[3];
    const radiusX = 2 + size * 9;
    const radiusY = 1 + size * 4;
    const petals = wilt > 0.55 ? ["(", ")", "\\", "/"] : ["*", "o", "@", "+"];
    for (let n = 0; n < 28 * size; n += 1) {
      const angle = (n / 28) * Math.PI * 2 + wilt * 2.7;
      const wobble = 0.7 + 0.3 * Math.sin(n * 2.7);
      put(screen, hx + Math.cos(angle) * radiusX * wobble,
        hy + Math.sin(angle) * radiusY * wobble,
        petals[n % petals.length], wilt > 0.45 ? COLORS.wilt : bloom > 0.7 ? COLORS.light : COLORS.petal);
    }
    put(screen, hx, hy, bloom > 0.8 ? "@" : "o", COLORS.gold);

    if (glow > 0.02) {
      for (let n = 0; n < 8; n += 1) {
        const angle = n * Math.PI / 4 + time * 0.15;
        put(screen, hx + Math.cos(angle) * (radiusX + 2),
          hy + Math.sin(angle) * (radiusY + 1), glow > 0.5 ? "+" : ".", COLORS.light);
      }
    }
  }

  const output = screen.map((row) => row.map(({ char, color }) =>
    USE_COLOR ? `\x1b[38;5;${color}m${char}\x1b[0m` : char).join("")).join("\n");
  return `${output}\n\nPointillism Flower  t=${time.toFixed(1)}s  [Ctrl+C para sair]`;
}

function start() {
  let time = 0;
  let paused = false;
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on("keypress", (_, key) => {
    if (key?.ctrl && key.name === "c" || key?.name === "escape") finish();
    if (key?.name === "space") paused = !paused;
    if (key?.name === "r") time = 0;
  });

  function finish() {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdout.write("\x1b[0m\n");
    process.exit(0);
  }

  const timer = setInterval(() => {
    if (!paused) time += TICK_MS / 1000;
    process.stdout.write(`\x1b[2J\x1b[H${render(time)}`);
    if (ONCE || (!LOOP && time >= T_END + 1)) {
      clearInterval(timer);
      finish();
    }
  }, TICK_MS);
}

start();
