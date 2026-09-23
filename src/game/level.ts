import {
  CELL,
  GRID_COLS,
  GRID_ROWS,
  START_X,
  START_Y,
  WORLD_H,
  WORLD_W,
  type BeggarKind,
  type PickupKind,
} from "./constants";

export type RectType =
  | "wall"
  | "facade"
  | "stairwall"
  | "bench"
  | "benchV"
  | "hedge"
  | "kiosk"
  | "shop"
  | "board"
  | "machine"
  | "vending"
  | "train"
  | "tram";

export type CircleType =
  | "tree"
  | "bush"
  | "lamp"
  | "fountain"
  | "bin"
  | "bollard"
  | "column"
  | "pillar"
  | "planter"
  | "guard"
  | "info";

export interface RectObstacle {
  shape: "rect";
  type: RectType;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  color?: string;
  side?: "left" | "right";
}

export interface CircleObstacle {
  shape: "circle";
  type: CircleType;
  x: number;
  y: number;
  r: number;
  variant: number;
}

export type Obstacle = RectObstacle | CircleObstacle;

export type DecalType =
  | "stairs"
  | "text"
  | "arrow"
  | "puddle"
  | "manhole"
  | "tactile"
  | "safety"
  | "flowerbed"
  | "emblem"
  | "paving"
  | "doormat";

export interface Decal {
  type: DecalType;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  size?: number;
  color?: string;
  dir?: "up" | "left" | "right";
  top?: boolean;
}

export interface PathLine {
  points: Array<[number, number]>;
  width: number;
}

export interface PathRing {
  x: number;
  y: number;
  r: number;
  width: number;
}

export interface LightSource {
  x: number;
  y: number;
  r: number;
  tint: "warm" | "cool" | "none";
  flicker: number;
  bulb: boolean;
}

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SafeZone {
  x: number;
  y: number;
  r: number;
}

export interface Level {
  obstacles: Obstacle[];
  decals: Decal[];
  paths: PathLine[];
  rings: PathRing[];
  lights: LightSource[];
  goals: Area[];
  safeZones: SafeZone[];
  benches: RectObstacle[];
  pigeonSpots: Point[];
  hordeSpawns: Point[];
  blocked: Uint8Array;
  bands: Obstacle[][];
}

export interface SpawnDef {
  kind: BeggarKind;
  x: number;
  y: number;
  sleep?: boolean;
  squat?: boolean;
  lyingH?: boolean;
}

export interface PickupDef {
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
}

export interface RunPlan {
  beggars: SpawnDef[];
  pickups: PickupDef[];
  pigeons: Point[];
}

const BAND = 160;
const BAND_COUNT = Math.ceil(WORLD_H / BAND) + 1;
const INFLATE = 11;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, lo: number, hi: number) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function bandIndex(y: number) {
  return clamp(Math.floor(y / BAND), 0, BAND_COUNT - 1);
}

/** Distance from a point to the obstacle surface (0 when inside). */
export function obstacleDistance(o: Obstacle, x: number, y: number): number {
  if (o.shape === "circle") return Math.max(0, Math.hypot(x - o.x, y - o.y) - o.r);
  const cx = clamp(x, o.x, o.x + o.w);
  const cy = clamp(y, o.y, o.y + o.h);
  return Math.hypot(x - cx, y - cy);
}

function rectGap(o: Obstacle, x: number, y: number, w: number, h: number) {
  if (o.shape === "circle") {
    const cx = clamp(o.x, x, x + w);
    const cy = clamp(o.y, y, y + h);
    return Math.hypot(o.x - cx, o.y - cy) - o.r;
  }
  const dx = Math.max(0, o.x - (x + w), x - (o.x + o.w));
  const dy = Math.max(0, o.y - (y + h), y - (o.y + o.h));
  return Math.hypot(dx, dy);
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function distToPath(px: number, py: number, path: PathLine) {
  let min = Infinity;
  for (let i = 0; i < path.points.length - 1; i += 1) {
    const [ax, ay] = path.points[i];
    const [bx, by] = path.points[i + 1];
    min = Math.min(min, distToSegment(px, py, ax, ay, bx, by));
  }
  return min;
}

function walkPath(
  points: Array<[number, number]>,
  step: number,
  start: number,
  fn: (x: number, y: number, nx: number, ny: number, index: number) => void,
) {
  let carry = start;
  let index = 0;
  for (let s = 0; s < points.length - 1; s += 1) {
    const [ax, ay] = points[s];
    const [bx, by] = points[s + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    let d = carry;
    while (d < len) {
      fn(ax + ux * d, ay + uy * d, -uy, ux, index);
      index += 1;
      d += step;
    }
    carry = d - len;
  }
}

const FOUNTAIN = { x: 410, y: 4450, r: 64 };
const RING = { x: 410, y: 4450, r: 116, width: 58 };

export function buildLevel(): Level {
  const rng = mulberry32(20250117);
  const obstacles: Obstacle[] = [];
  const decals: Decal[] = [];
  const lights: LightSource[] = [];
  const benches: RectObstacle[] = [];

  const rect = (type: RectType, x: number, y: number, w: number, h: number, extra: Partial<RectObstacle> = {}) => {
    const o: RectObstacle = { ...extra, shape: "rect", type, x, y, w, h };
    obstacles.push(o);
    if (type === "bench" || type === "benchV") benches.push(o);
    return o;
  };
  const circle = (type: CircleType, x: number, y: number, r: number, variant = 0) => {
    const o: CircleObstacle = { shape: "circle", type, x, y, r, variant };
    obstacles.push(o);
    return o;
  };
  const light = (x: number, y: number, r: number, tint: LightSource["tint"] = "warm", flicker = 0, bulb = true) => {
    lights.push({ x, y, r, tint, flicker, bulb });
  };
  const circleFree = (x: number, y: number, r: number, pad: number) =>
    obstacles.every((o) => obstacleDistance(o, x, y) > r + pad);
  const rectFree = (x: number, y: number, w: number, h: number, pad: number) =>
    obstacles.every((o) => rectGap(o, x, y, w, h) > pad);

  /* ───────────── PLATFORM (goal) ───────────── */
  // Cars are 218 long on a 230 period, so every goal door sits at a car centre.
  rect("train", -855, 30, 2530, 104, { label: "R 1017 BRNO" });
  const goals: Area[] = [180, 410, 640].map((cx) => ({ x: cx - 36, y: 126, w: 72, h: 46 }));
  decals.push({ type: "safety", x: -520, y: 150, w: WORLD_W + 1040, h: 10 });
  decals.push({ type: "tactile", x: -520, y: 172, w: WORLD_W + 1040, h: 8 });
  decals.push({ type: "text", x: 410, y: 505, w: 0, h: 0, text: "NÁSTUPIŠTĚ 3", size: 30, color: "rgba(255,255,255,0.2)" });
  for (const [x, y] of [
    [110, 300],
    [710, 300],
    [110, 470],
    [710, 470],
  ]) {
    circle("pillar", x, y, 15);
    light(x, y, 190, "cool");
  }
  circle("pillar", 410, 340, 17);
  light(410, 340, 210, "cool");
  rect("bench", 236, 404, 80, 16);
  rect("bench", 504, 404, 80, 16);
  rect("vending", 26, 196, 40, 58, { label: "NÁPOJE", color: "#2d6aa8" });
  rect("vending", 754, 196, 40, 58, { label: "SNACK", color: "#b0402f" });
  circle("bin", 300, 252, 9);
  circle("bin", 520, 252, 9);
  for (const goal of goals) light(goal.x + goal.w / 2, 160, 150, "warm", 0, false);
  rect("stairwall", 0, 540, 290, 110);
  rect("stairwall", 530, 540, 290, 110);
  decals.push({ type: "stairs", x: 290, y: 540, w: 240, h: 110, dir: "up" });

  /* ───────────── UNDERPASS ───────────── */
  rect("wall", 0, 650, 230, 530);
  rect("wall", 0, 1180, 100, 140);
  rect("wall", 0, 1320, 230, 320);
  rect("wall", 590, 650, 230, 170);
  rect("wall", 720, 820, 100, 140);
  rect("wall", 590, 960, 230, 680);
  decals.push({ type: "stairs", x: 100, y: 1180, w: 130, h: 140, dir: "left", text: "NÁSTUPIŠTĚ 1" });
  decals.push({ type: "stairs", x: 590, y: 820, w: 130, h: 140, dir: "right", text: "NÁSTUPIŠTĚ 2" });
  decals.push({ type: "tactile", x: 404, y: 650, w: 12, h: 990 });
  decals.push({ type: "arrow", x: 410, y: 1545, w: 60, h: 80, text: "NÁSTUPIŠTĚ 3" });
  decals.push({ type: "arrow", x: 410, y: 770, w: 60, h: 80, text: "NÁSTUPIŠTĚ 3" });
  decals.push({ type: "puddle", x: 300, y: 1262, w: 64, h: 24 });
  circle("info", 410, 1030, 22);
  circle("bin", 254, 770, 10);
  circle("bin", 566, 1130, 10);
  circle("bin", 254, 1500, 10);
  rect("vending", 540, 1380, 36, 56, { label: "FOTO", color: "#6b3fa0" });
  for (let i = 0; i < 7; i += 1) light(410, 700 + i * 140, 205, "cool", i === 2 || i === 5 ? 1 : 0);

  /* ───────────── MAIN HALL ───────────── */
  rect("board", 0, 1640, 230, 50, { label: "ODJEZDY" });
  rect("board", 590, 1640, 230, 50, { label: "PŘÍJEZDY" });
  const leftShops: Array<[string, string, number, number]> = [
    ["TRAFIKA", "#c79a2a", 1760, 150],
    ["BAGETY", "#cf5a3c", 1990, 170],
    ["WC 20 Kč", "#3d7fbd", 2240, 150],
    ["SMĚNÁRNA", "#6f9440", 2470, 180],
    ["LÉKÁRNA", "#36a178", 2730, 170],
  ];
  const rightShops: Array<[string, string, number, number]> = [
    ["POKLADNY", "#2f6db4", 1760, 170],
    ["KAFE", "#9f6a3d", 2010, 150],
    ["NONSTOP", "#d73c5b", 2240, 200],
    ["KNIHY", "#7a5ea8", 2520, 150],
    ["SUVENÝRY", "#d9822b", 2750, 150],
  ];
  for (const [label, color, y, h] of leftShops) rect("shop", 0, y, 130, h, { label, color, side: "right" });
  for (const [label, color, y, h] of rightShops) rect("shop", 690, y, 130, h, { label, color, side: "left" });
  for (const y of [1830, 2090, 2350, 2610, 2870]) {
    circle("column", 280, y, 22);
    circle("column", 540, y, 22);
  }
  rect("machine", 364, 1756, 30, 24, { label: "JÍZDENKY" });
  rect("machine", 426, 1756, 30, 24, { label: "JÍZDENKY" });
  for (const y of [2166, 2676]) {
    rect("bench", 350, y, 120, 16);
    rect("bench", 350, y + 20, 120, 16);
  }
  circle("guard", 410, 2440, 14);
  const safeZones: SafeZone[] = [{ x: 410, y: 2440, r: 100 }];
  circle("planter", 190, 2640, 18, 1);
  circle("planter", 630, 2150, 18, 2);
  circle("planter", 190, 1880, 16, 3);
  circle("planter", 630, 2900, 16, 0);
  decals.push({ type: "emblem", x: 410, y: 1985, w: 170, h: 170, text: "PRAHA HL. N." });
  decals.push({ type: "arrow", x: 410, y: 2925, w: 60, h: 80, text: "NÁSTUPIŠTĚ" });
  decals.push({ type: "arrow", x: 410, y: 1840, w: 60, h: 80, text: "PODCHOD" });
  for (let i = 0; i < 7; i += 1) {
    for (const x of [200, 410, 620]) light(x, 1760 + i * 190, 230, "cool", 0, false);
  }

  /* ───────────── FACADE ───────────── */
  rect("facade", 0, 3000, 140, 60);
  rect("facade", 240, 3000, 120, 60);
  rect("facade", 460, 3000, 120, 60);
  rect("facade", 680, 3000, 140, 60);
  for (const x of [190, 410, 630]) {
    decals.push({ type: "doormat", x: x - 46, y: 3004, w: 92, h: 52 });
    light(x, 3040, 160, "warm");
  }
  decals.push({ type: "text", x: 410, y: 3014, w: 0, h: 0, text: "HLAVNÍ NÁDRAŽÍ", size: 12, color: "#f4e3b0", top: true });

  /* ───────────── FORECOURT ───────────── */
  rect("kiosk", 96, 3176, 96, 62, { label: "PÁRKY", color: "#b8342c" });
  circle("planter", 640, 3214, 24, 1);
  circle("planter", 300, 3300, 20, 2);
  rect("bench", 470, 3170, 76, 16);
  rect("benchV", 724, 3250, 16, 70);
  for (const x of [50, 100, 280, 320, 500, 540, 720, 770]) circle("bollard", x, 3098, 7);
  for (const [x, y] of [
    [236, 3150],
    [584, 3150],
    [410, 3350],
  ]) {
    circle("lamp", x, y, 6);
    light(x, y, 195, "warm");
  }
  decals.push({ type: "manhole", x: 560, y: 3330, w: 26, h: 26 });
  decals.push({ type: "puddle", x: 196, y: 3352, w: 72, h: 26 });
  decals.push({ type: "text", x: 410, y: 3240, w: 0, h: 0, text: "PŘEDNÁDRAŽÍ", size: 22, color: "rgba(255,255,255,0.12)" });
  rect("hedge", 0, 3410, 240, 22);
  rect("hedge", 340, 3410, 140, 22);
  rect("hedge", 580, 3410, 240, 22);

  /* ───────────── PARK "SHERWOOD" ───────────── */
  rect("tram", -520, 5548, WORLD_W + 1040, 52, { label: "9" });
  decals.push({ type: "paving", x: -520, y: 5490, w: WORLD_W + 1040, h: 58 });
  decals.push({
    type: "text",
    x: 410,
    y: 5520,
    w: 0,
    h: 0,
    text: "ZASTÁVKA HLAVNÍ NÁDRAŽÍ",
    size: 15,
    color: "rgba(255,255,255,0.34)",
  });
  circle("fountain", FOUNTAIN.x, FOUNTAIN.y, FOUNTAIN.r);
  light(FOUNTAIN.x, FOUNTAIN.y, 190, "cool", 0, false);
  rect("bench", 378, 4270, 64, 16);
  rect("bench", 378, 4614, 64, 16);
  rect("benchV", 230, 4418, 16, 64);
  rect("benchV", 574, 4418, 16, 64);

  const paths: PathLine[] = [
    { points: [[410, 5560], [410, 5330], [330, 5130], [320, 4880], [410, 4640]], width: 72 },
    { points: [[410, 4330], [330, 4120], [270, 3880], [290, 3640], [290, 3425]], width: 64 },
    { points: [[430, 4335], [540, 4130], [570, 3900], [530, 3640], [530, 3425]], width: 60 },
    { points: [[320, 4880], [160, 4800], [100, 4560], [140, 4300], [330, 4125]], width: 46 },
    { points: [[330, 5130], [560, 5060], [680, 4850], [690, 4560], [600, 4330], [545, 4135]], width: 46 },
  ];
  const rings: PathRing[] = [RING];
  const offPath = (x: number, y: number, pad: number) =>
    paths.every((path) => distToPath(x, y, path) > path.width / 2 + pad) &&
    Math.abs(Math.hypot(x - RING.x, y - RING.y) - RING.r) > RING.width / 2 + pad;

  paths.forEach((path, pi) => {
    walkPath(path.points, 320, 170 + pi * 40, (x, y, nx, ny, i) => {
      const side = (i + pi) % 2 === 0 ? 1 : -1;
      const off = path.width / 2 + 22;
      const bx = x + nx * off * side;
      const by = y + ny * off * side;
      const horizontal = Math.abs(ny) > Math.abs(nx);
      const w = horizontal ? 64 : 16;
      const h = horizontal ? 16 : 64;
      const rx = bx - w / 2;
      const ry = by - h / 2;
      if (ry < 3470 || ry + h > 5470 || rx < 16 || rx + w > WORLD_W - 16) return;
      if (Math.hypot(bx - START_X, by - START_Y) < 130) return;
      if (!rectFree(rx, ry, w, h, 18) || !offPath(bx, by, 10)) return;
      rect(horizontal ? "bench" : "benchV", rx, ry, w, h);
    });
    walkPath(path.points, 250, 60 + pi * 30, (x, y, nx, ny, i) => {
      const side = (i + pi) % 2 === 0 ? -1 : 1;
      const off = path.width / 2 + 13;
      const lx = x + nx * off * side;
      const ly = y + ny * off * side;
      if (ly < 3460 || ly > 5480 || lx < 12 || lx > WORLD_W - 12) return;
      if (!circleFree(lx, ly, 6, 16) || !offPath(lx, ly, 3)) return;
      circle("lamp", lx, ly, 6);
      light(lx, ly, 200, "warm");
    });
  });

  let trees = 0;
  let bushes = 0;
  for (let i = 0; i < 1600 && (trees < 74 || bushes < 26); i += 1) {
    const bush = trees >= 74 || (bushes < 26 && rng() < 0.26);
    const r = bush ? 11 + rng() * 6 : 16 + rng() * 12;
    const x = 18 + rng() * (WORLD_W - 36);
    const y = 3480 + rng() * 1990;
    const canopy = r * (bush ? 1.3 : 1.45);
    if (y + canopy > 5486) continue;
    if (Math.hypot(x - START_X, y - START_Y) < 140 + r) continue;
    if (!offPath(x, y, r + 8)) continue;
    if (!circleFree(x, y, r, bush ? 14 : 24)) continue;
    circle(bush ? "bush" : "tree", x, y, r, Math.floor(rng() * 3));
    if (bush) bushes += 1;
    else trees += 1;
  }

  for (const [x, y, w, h] of [
    [560, 5300, 90, 40],
    [215, 4205, 70, 36],
    [612, 3705, 84, 40],
    [140, 5280, 76, 38],
  ]) {
    if (circleFree(x, y, 30, 4)) decals.push({ type: "flowerbed", x: x - w / 2, y: y - h / 2, w, h });
  }
  decals.push({ type: "puddle", x: 360, y: 4990, w: 58, h: 22 });
  decals.push({ type: "puddle", x: 520, y: 3760, w: 50, h: 20 });

  const pigeonSpots: Point[] = [
    { x: 405, y: 5290 },
    { x: 325, y: 4990 },
    { x: 420, y: 4690 },
    { x: 290, y: 3800 },
    { x: 555, y: 3960 },
    { x: 410, y: 3265 },
    { x: 600, y: 3320 },
    { x: 430, y: 2130 },
    { x: 330, y: 2530 },
    { x: 430, y: 1190 },
    { x: 300, y: 450 },
    { x: 560, y: 455 },
  ];
  const hordeSpawns: Point[] = [
    { x: 150, y: 1250 },
    { x: 670, y: 890 },
    { x: 320, y: 1705 },
    { x: 500, y: 1705 },
  ];

  const blocked = new Uint8Array(GRID_COLS * GRID_ROWS);
  for (const o of obstacles) {
    const bx0 = (o.shape === "rect" ? o.x : o.x - o.r) - INFLATE;
    const by0 = (o.shape === "rect" ? o.y : o.y - o.r) - INFLATE;
    const bx1 = (o.shape === "rect" ? o.x + o.w : o.x + o.r) + INFLATE;
    const by1 = (o.shape === "rect" ? o.y + o.h : o.y + o.r) + INFLATE;
    const c0 = Math.max(0, Math.floor(bx0 / CELL));
    const c1 = Math.min(GRID_COLS - 1, Math.floor(bx1 / CELL));
    const r0 = Math.max(0, Math.floor(by0 / CELL));
    const r1 = Math.min(GRID_ROWS - 1, Math.floor(by1 / CELL));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        if (obstacleDistance(o, c * CELL + CELL / 2, r * CELL + CELL / 2) <= INFLATE) blocked[r * GRID_COLS + c] = 1;
      }
    }
  }

  const bands: Obstacle[][] = Array.from({ length: BAND_COUNT }, () => []);
  for (const o of obstacles) {
    const top = (o.shape === "rect" ? o.y : o.y - o.r) - 40;
    const bottom = (o.shape === "rect" ? o.y + o.h : o.y + o.r) + 40;
    for (let b = bandIndex(top); b <= bandIndex(bottom); b += 1) bands[b].push(o);
  }

  return {
    obstacles,
    decals,
    paths,
    rings,
    lights,
    goals,
    safeZones,
    benches,
    pigeonSpots,
    hordeSpawns,
    blocked,
    bands,
  };
}

export function resolveCircle(level: Level, e: { x: number; y: number }, r: number): boolean {
  let hit = false;
  const list = level.bands[bandIndex(e.y)];
  for (let i = 0; i < list.length; i += 1) {
    const o = list[i];
    if (o.shape === "circle") {
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const min = r + o.r;
      if (dx > min || dx < -min || dy > min || dy < -min) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const push = min - d;
      e.x += (dx / d) * push;
      e.y += (dy / d) * push;
      hit = true;
    } else {
      if (e.x + r < o.x || e.x - r > o.x + o.w || e.y + r < o.y || e.y - r > o.y + o.h) continue;
      const cx = clamp(e.x, o.x, o.x + o.w);
      const cy = clamp(e.y, o.y, o.y + o.h);
      const dx = e.x - cx;
      const dy = e.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = r - d;
        e.x += (dx / d) * push;
        e.y += (dy / d) * push;
      } else {
        const left = e.x - o.x;
        const right = o.x + o.w - e.x;
        const top = e.y - o.y;
        const bottom = o.y + o.h - e.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) e.x = o.x - r;
        else if (m === right) e.x = o.x + o.w + r;
        else if (m === top) e.y = o.y - r;
        else e.y = o.y + o.h + r;
      }
      hit = true;
    }
  }
  if (e.x < r) {
    e.x = r;
    hit = true;
  } else if (e.x > WORLD_W - r) {
    e.x = WORLD_W - r;
    hit = true;
  }
  if (e.y < r) {
    e.y = r;
    hit = true;
  } else if (e.y > WORLD_H - r) {
    e.y = WORLD_H - r;
    hit = true;
  }
  return hit;
}

export function cellBlockedAt(level: Level, x: number, y: number): boolean {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) return true;
  return level.blocked[r * GRID_COLS + c] === 1;
}

export function lineClear(level: Level, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(d / 14);
  for (let i = 2; i < steps - 1; i += 1) {
    const t = i / steps;
    if (cellBlockedAt(level, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

export function pointHitsObstacle(level: Level, x: number, y: number, pad: number): boolean {
  const list = level.bands[bandIndex(y)];
  for (const o of list) {
    if (obstacleDistance(o, x, y) < pad) return true;
  }
  return false;
}

export function segmentFree(level: Level, x0: number, y0: number, x1: number, y1: number, pad: number): Point {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(d / 8));
  let lx = x0;
  let ly = y0;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (x < pad || x > WORLD_W - pad || y < pad || y > WORLD_H - pad || pointHitsObstacle(level, x, y, pad)) break;
    lx = x;
    ly = y;
  }
  return { x: lx, y: ly };
}

export function inSafeZone(level: Level, x: number, y: number, pad = 0): boolean {
  return level.safeZones.some((zone) => Math.hypot(x - zone.x, y - zone.y) < zone.r + pad);
}

export function isFreeSpot(level: Level, x: number, y: number, r: number): boolean {
  if (x < r + 4 || x > WORLD_W - r - 4 || y < r + 4 || y > WORLD_H - r - 4) return false;
  if (pointHitsObstacle(level, x, y, r + 6)) return false;
  if (inSafeZone(level, x, y, r + 12)) return false;
  return !cellBlockedAt(level, x, y);
}

function shuffle<T>(items: T[], rng: () => number) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

export function planRun(level: Level, seed: number): RunPlan {
  const rng = mulberry32(seed);
  const beggars: SpawnDef[] = [];
  const pickups: PickupDef[] = [];

  const spot = (x0: number, x1: number, y0: number, y1: number, r = 16): Point | null => {
    for (let i = 0; i < 60; i += 1) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      if (isFreeSpot(level, x, y, r) && Math.hypot(x - START_X, y - START_Y) > 230) return { x, y };
    }
    return null;
  };
  const add = (kind: BeggarKind, x0: number, x1: number, y0: number, y1: number, squat = false) => {
    const p = spot(x0, x1, y0, y1, kind === "smrad" ? 20 : 15);
    if (p) beggars.push({ kind, x: p.x, y: p.y, squat });
  };
  const item = (kind: PickupKind, x0: number, x1: number, y0: number, y1: number, value = 0) => {
    const p = spot(x0, x1, y0, y1, 12);
    if (p) pickups.push({ kind, x: p.x, y: p.y, value });
  };
  const coin = () => (rng() < 0.3 ? 20 : 10);

  // Sherwood park — the first encounter is placed right on the main path.
  beggars.push({ kind: "bedak", x: 448, y: 5065 });
  const parkBenches = level.benches.filter((b) => b.y > 3450 && b.y < 5300);
  shuffle(parkBenches, rng);
  for (const bench of parkBenches.slice(0, 6)) {
    beggars.push({
      kind: "bedak",
      x: bench.x + bench.w / 2,
      y: bench.y + bench.h / 2,
      sleep: true,
      lyingH: bench.w > bench.h,
    });
  }
  for (let i = 0; i < 9; i += 1) add("bedak", 40, 780, 3480, 5060);
  add("teplaky", 150, 670, 4500, 4950, true);
  add("teplaky", 150, 670, 3550, 4050, true);
  add("smrad", 200, 620, 3650, 4250);

  // Forecourt
  beggars.push({ kind: "bedak", x: 190, y: 3098 }, { kind: "bedak", x: 632, y: 3104 });
  for (let i = 0; i < 3; i += 1) add("bedak", 40, 780, 3130, 3380);
  add("teplaky", 300, 700, 3150, 3380, true);

  // Main hall — the NONSTOP crowd, a stinker by the paid toilets.
  for (const [x, y] of [
    [648, 2282],
    [636, 2334],
    [652, 2388],
    [604, 2306],
    [610, 2366],
  ]) {
    beggars.push({ kind: "bedak", x, y });
  }
  beggars.push({ kind: "smrad", x: 182, y: 2318 });
  for (let i = 0; i < 7; i += 1) add("bedak", 150, 670, 1720, 2960);
  add("teplaky", 150, 670, 1750, 2300, true);
  add("teplaky", 150, 670, 2500, 2950, true);
  add("smrad", 160, 660, 1760, 2150);

  // Underpass & platform
  for (let i = 0; i < 5; i += 1) add("bedak", 250, 570, 700, 1540);
  for (let i = 0; i < 3; i += 1) add("bedak", 40, 780, 210, 500);
  beggars.push({ kind: "boss", x: 410, y: 250 });

  // Pickups
  for (let i = 0; i < 8; i += 1) item("coin", 40, 780, 3480, 5300, coin());
  item("pack", 60, 760, 3700, 5000, 2);
  item("coffee", 100, 720, 4300, 5150);
  item("phones", 100, 720, 3600, 4300);
  const leftSide = rng() < 0.5;
  item("bill", leftSide ? 24 : 700, leftSide ? 120 : 796, 3700, 4900, 100);
  for (let i = 0; i < 2; i += 1) item("coin", 40, 780, 3120, 3390, coin());
  for (let i = 0; i < 5; i += 1) item("coin", 150, 670, 1720, 2960, coin());
  item("pack", 150, 670, 1800, 2900, 2);
  item("coffee", 560, 670, 2010, 2160);
  item("phones", 150, 670, 1760, 2300);
  for (let i = 0; i < 2; i += 1) item("coin", 250, 570, 700, 1540, coin());
  item("pack", 250, 570, 700, 1500, 2);
  item("coin", 60, 760, 200, 500, 20);

  const pigeons: Point[] = [];
  for (const home of level.pigeonSpots) {
    const count = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i += 1) {
      const x = home.x + (rng() - 0.5) * 70;
      const y = home.y + (rng() - 0.5) * 50;
      if (isFreeSpot(level, x, y, 4)) pigeons.push({ x, y });
    }
  }

  return { beggars, pickups, pigeons };
}
