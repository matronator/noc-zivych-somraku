import {
  CELL,
  GRID_COLS,
  GRID_ROWS,
  GOAL_Y,
  LURE_COOLDOWN,
  LURE_COST,
  LURE_DURATION,
  LURE_RADIUS,
  MIN_CASH,
  MIN_CIGS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SHOVE_COOLDOWN,
  SHOVE_RADIUS,
  START_CASH,
  START_CIGS,
  START_X,
  START_Y,
  TIME_LIMIT,
  WORLD_H,
  WORLD_W,
  ZONES,
  ZONE_ORDER,
  zoneAt,
  type BeggarKind,
  type Demand,
  type PickupKind,
  type ZoneId,
} from "./constants";
import { buildLevel, inSafeZone, lineClear, planRun, resolveCircle, segmentFree, type Level } from "./level";

export type Phase = "title" | "playing" | "paused" | "over" | "won";
export type EndReason = "cash" | "cigs" | "time" | "won";
export type SfxName =
  | "shove"
  | "shoveHit"
  | "hit"
  | "coin"
  | "cink"
  | "throw"
  | "groan"
  | "alert"
  | "horde"
  | "power"
  | "deny"
  | "win"
  | "lose"
  | "lunge"
  | "belch"
  | "bonk"
  | "zone"
  | "boss"
  | "tick";
export type BeggarState =
  | "sleep"
  | "rise"
  | "idle"
  | "squat"
  | "wander"
  | "chase"
  | "windup"
  | "lunge"
  | "stun"
  | "lured"
  | "happy"
  | "gloat";
export type ParticleKind =
  | "dot"
  | "dust"
  | "coin"
  | "cig"
  | "star"
  | "heart"
  | "note"
  | "z"
  | "smoke"
  | "spark"
  | "feather"
  | "seed"
  | "confetti";

export interface Beggar {
  id: number;
  kind: BeggarKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kx: number;
  ky: number;
  r: number;
  speed: number;
  state: BeggarState;
  t: number;
  cd: number;
  chaseT: number;
  demand: Demand;
  amount: number;
  facing: number;
  anim: number;
  bubble: string;
  bubbleT: number;
  nextBubble: number;
  flash: number;
  alert: number;
  wanderA: number;
  wanderPause: boolean;
  lungeX: number;
  lungeY: number;
  lungeMin: number;
  coat: string;
  hat: string;
  hatType: number;
  skin: string;
  beard: boolean;
  alpha: number;
  removed: boolean;
  lying: boolean;
  lyingH: boolean;
  lureId: number;
  horde: boolean;
  stinkCD: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
  bob: number;
  taken: boolean;
}

export interface Lure {
  id: number;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  flight: number;
  life: number;
  landed: boolean;
  pulse: number;
}

export interface Cloud {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  max: number;
  seed: number;
}

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  drag: number;
  grav: number;
  glow: boolean;
}

export interface FloatText {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

export interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

export interface Pigeon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  state: "peck" | "fly";
  t: number;
  facing: number;
  peck: number;
  gone: boolean;
  tone: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kx: number;
  ky: number;
  r: number;
  facing: number;
  walk: number;
  moving: boolean;
  invuln: number;
  hitFlash: number;
  coffee: number;
  phones: number;
  stink: number;
  stinkMsg: number;
  shoveCD: number;
  lureCD: number;
  shoutT: number;
  alpha: number;
}

export interface Banner {
  id: number;
  title: string;
  sub: string;
  tone: "zone" | "horde" | "boss";
  t: number;
}

export interface Hint {
  id: number;
  text: string;
  t: number;
}

export interface Bonus {
  time: number;
  cash: number;
  cigs: number;
  clean: number;
  finish: number;
}

export interface RunStats {
  steals: number;
  shoved: number;
  thrown: number;
  bribed: number;
  picked: number;
  dodges: number;
  cashLost: number;
  cigsLost: number;
}

export interface GameState {
  level: Level;
  time: number;
  timeLeft: number;
  player: Player;
  money: number;
  cigs: number;
  score: number;
  bestY: number;
  combo: number;
  comboT: number;
  maxCombo: number;
  beggars: Beggar[];
  pickups: Pickup[];
  lures: Lure[];
  clouds: Cloud[];
  particles: Particle[];
  texts: FloatText[];
  rings: Ring[];
  pigeons: Pigeon[];
  trauma: number;
  hitStop: number;
  flashRed: number;
  flashGold: number;
  zoom: number;
  cam: { x: number; y: number; snap: boolean };
  viewW: number;
  viewH: number;
  flowDist: Uint16Array;
  flowQueue: Int32Array;
  flowTimer: number;
  flowRow0: number;
  flowRow1: number;
  hordeTriggered: boolean;
  hordeQueue: number;
  hordeTimer: number;
  spawnTimer: number;
  nextId: number;
  zone: ZoneId;
  zoneIndex: number;
  banner: Banner | null;
  bannerSeq: number;
  hint: Hint | null;
  hintSeq: number;
  hintsShown: Set<string>;
  ending: { reason: EndReason; t: number } | null;
  endReason: EndReason | null;
  goalX: number;
  goalY: number;
  events: SfxName[];
  input: { mx: number; my: number };
  stats: RunStats;
  bonus: Bonus | null;
  groanCD: number;
  passive: boolean;
  touchUI: boolean;
  attract: number;
  lastTickSecond: number;
}

export interface HudSnapshot {
  score: number;
  money: number;
  cigs: number;
  timeLeft: number;
  progress: number;
  zoneName: string;
  chapter: string;
  zoneIndex: number;
  canLure: boolean;
  threat: boolean;
  coffee: number;
  phones: number;
  stink: boolean;
  combo: number;
  low: boolean;
  banner: { id: number; title: string; sub: string; tone: Banner["tone"] } | null;
  hint: { id: number; text: string } | null;
}

export interface RunSummary {
  score: number;
  won: boolean;
  reason: EndReason;
  progress: number;
  money: number;
  cigs: number;
  timeLeft: number;
  stats: RunStats;
  maxCombo: number;
  bonus: Bonus | null;
}

const MAX_PARTICLES = 520;
const FLOW_UNREACHED = 65535;

const LINES_CASH = ["Nemáš dvacku?", "Drobnýýý...", "Dvaaacku...", "Kámo, na lístek...", "Pár korun?", "Na polívku...", "Šéfe, dvacku!", "Hodíš drobák?"];
const LINES_CIG = ["Cíííígooo...", "Nemáš cígo?", "Jedno cígo...", "Brácho, cígo!", "Šluka?", "Cígooo..."];
const LINES_TEPLAKY = ["Máš pade?", "Pade, hned!", "Čus, pade?", "Hej ty! Pade!"];
const LINES_SMRAD = ["Dvě cíga...", "Bléé... cígo...", "Dvě cíííga..."];
const LINES_BOSS = ["DEJ PADESÁT!", "PADESÁÁÁT!", "MÁŠ STOVKU?!", "STÁT, KÁMO!"];
const LINES_THANKS = ["Díky, šéfe!", "Bůh ti žehnej!", "Seš borec!", "Zdar, brácho!", "Díky, králi!"];
const LINES_SHOVED = ["?!", "Au!", "Hm?", "Tak nic...", "Nemá...", "Pff!"];
const LINES_SAFE = ["Ochranka...", "Tak nic.", "Jindy..."];
const LINES_LURE = ["MOJE!", "MOJE!!", "Pusť!", "Cink?!", "Prachy!"];
const LINES_WIN = ["Škoda...", "Příště!", "Ujel nám...", "Šťastnou cestu!"];

const COATS = ["#6b5842", "#55593f", "#4a5563", "#7a6a4c", "#5e4a45", "#4b5a45", "#76533f", "#5a5147"];
const HATS = ["#9a3a32", "#35607f", "#7b7b35", "#4a4a4a", "#8a5a2e", "#5d3f6b"];
const SKINS = ["#b9a88a", "#a9b08e", "#c2a78c", "#a4ad90", "#b59f86"];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const range = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
function angleLerp(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

let sharedLevel: Level | null = null;
export function getLevel(): Level {
  if (!sharedLevel) sharedLevel = buildLevel();
  return sharedLevel;
}

/* ───────────────────────── creation ───────────────────────── */

export function createGame(touchUI = false, seed = Math.floor(Math.random() * 1e9)): GameState {
  const level = getLevel();
  const game: GameState = {
    level,
    time: 0,
    timeLeft: TIME_LIMIT,
    player: {
      x: START_X,
      y: START_Y,
      vx: 0,
      vy: 0,
      kx: 0,
      ky: 0,
      r: PLAYER_RADIUS,
      facing: -Math.PI / 2,
      walk: 0,
      moving: false,
      invuln: 0,
      hitFlash: 0,
      coffee: 0,
      phones: 0,
      stink: 0,
      stinkMsg: 0,
      shoveCD: 0,
      lureCD: 0,
      shoutT: 0,
      alpha: 1,
    },
    money: START_CASH,
    cigs: START_CIGS,
    score: 0,
    bestY: START_Y,
    combo: 0,
    comboT: 0,
    maxCombo: 0,
    beggars: [],
    pickups: [],
    lures: [],
    clouds: [],
    particles: [],
    texts: [],
    rings: [],
    pigeons: [],
    trauma: 0,
    hitStop: 0,
    flashRed: 0,
    flashGold: 0,
    zoom: 1,
    cam: { x: 0, y: START_Y - 420, snap: true },
    viewW: 470,
    viewH: 660,
    flowDist: new Uint16Array(GRID_COLS * GRID_ROWS),
    flowQueue: new Int32Array(GRID_COLS * GRID_ROWS),
    flowTimer: 0,
    flowRow0: 0,
    flowRow1: 0,
    hordeTriggered: false,
    hordeQueue: 0,
    hordeTimer: 0,
    spawnTimer: 8,
    nextId: 1,
    zone: "park",
    zoneIndex: 0,
    banner: null,
    bannerSeq: 0,
    hint: null,
    hintSeq: 0,
    hintsShown: new Set(),
    ending: null,
    endReason: null,
    goalX: 0,
    goalY: 0,
    events: [],
    input: { mx: 0, my: 0 },
    stats: { steals: 0, shoved: 0, thrown: 0, bribed: 0, picked: 0, dodges: 0, cashLost: 0, cigsLost: 0 },
    bonus: null,
    groanCD: 0,
    passive: true,
    touchUI,
    attract: 0,
    lastTickSecond: 99,
  };
  const plan = planRun(level, seed);
  for (const s of plan.beggars) spawnBeggar(game, s.kind, s.x, s.y, { sleep: s.sleep, squat: s.squat, lyingH: s.lyingH });
  for (const p of plan.pickups) {
    game.pickups.push({ id: game.nextId++, kind: p.kind, x: p.x, y: p.y, value: p.value, bob: Math.random() * 6, taken: false });
  }
  for (const p of plan.pigeons) {
    game.pigeons.push({
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      z: 0,
      state: "peck",
      t: Math.random() * 2,
      facing: Math.random() * Math.PI * 2,
      peck: 0,
      gone: false,
      tone: Math.random(),
    });
  }
  return game;
}

export function beginRun(game: GameState) {
  game.passive = false;
  game.cam.snap = true;
  showBanner(game, "KAPITOLA 1", "SHERWOOD", "zone");
  setHint(
    game,
    game.touchUI
      ? "Táhni prstem = pohyb · NEMÁM! odstrčí somráky · 10 Kč = návnada"
      : "WASD / šipky = pohyb · MEZERNÍK = NEMÁM! · E nebo klik = hodit 10 Kč",
    5.5,
  );
}

function spawnBeggar(
  game: GameState,
  kind: BeggarKind,
  x: number,
  y: number,
  opts: { sleep?: boolean; squat?: boolean; lyingH?: boolean; horde?: boolean } = {},
): Beggar {
  const r = kind === "boss" ? 27 : kind === "smrad" ? 18 : kind === "teplaky" ? 12 : 13;
  let demand: Demand = "cash";
  let amount = 20;
  if (kind === "bedak" && Math.random() < 0.38) {
    demand = "cig";
    amount = 1;
  } else if (kind === "teplaky" || kind === "boss") {
    amount = 50;
  } else if (kind === "smrad") {
    demand = "cig";
    amount = 2;
  }
  const prog = progress01(game);
  const speed =
    kind === "bedak"
      ? opts.horde
        ? 78 + Math.random() * 16
        : (48 + Math.random() * 18) * (1 + prog * 0.22)
      : kind === "teplaky"
        ? 72
        : kind === "smrad"
          ? 40
          : 82;
  const b: Beggar = {
    id: game.nextId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    r,
    speed,
    state: opts.sleep ? "sleep" : opts.squat ? "squat" : kind === "boss" ? "idle" : "wander",
    t: Math.random() * 2,
    cd: 0.6,
    chaseT: 0,
    demand,
    amount,
    facing: Math.random() * Math.PI * 2,
    anim: Math.random() * 10,
    bubble: "",
    bubbleT: 0,
    nextBubble: 1 + Math.random() * 2,
    flash: 0,
    alert: 0,
    wanderA: Math.random() * Math.PI * 2,
    wanderPause: false,
    lungeX: 0,
    lungeY: 0,
    lungeMin: 9999,
    coat:
      kind === "teplaky"
        ? Math.random() < 0.6
          ? "#2346a0"
          : "#1f1f24"
        : kind === "smrad"
          ? "#d9d2b4"
          : kind === "boss"
            ? "#3a2f2b"
            : pick(COATS),
    hat: kind === "teplaky" ? "#1b1b1f" : kind === "boss" ? "#26211e" : pick(HATS),
    hatType: kind === "bedak" ? (Math.random() < 0.7 ? 0 : 1) : kind === "teplaky" ? 2 : 1,
    skin: pick(SKINS),
    beard: kind !== "teplaky" && Math.random() < 0.75,
    alpha: 1,
    removed: false,
    lying: !!opts.sleep,
    lyingH: !!opts.lyingH,
    lureId: -1,
    horde: !!opts.horde,
    stinkCD: 1.5,
  };
  if (kind === "boss") b.facing = Math.PI / 2;
  game.beggars.push(b);
  return b;
}

/* ───────────────────────── helpers ───────────────────────── */

export function progress01(game: GameState) {
  return clamp((START_Y - game.bestY) / (START_Y - GOAL_Y), 0, 1);
}

interface BurstOpts {
  kind?: ParticleKind;
  colors: string[];
  speed?: [number, number];
  life?: [number, number];
  size?: [number, number];
  vz?: [number, number];
  grav?: number;
  drag?: number;
  glow?: boolean;
  angle?: number;
  spread?: number;
}

function burst(game: GameState, x: number, y: number, count: number, o: BurstOpts) {
  const list = game.particles;
  for (let i = 0; i < count; i += 1) {
    if (list.length >= MAX_PARTICLES) return;
    const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2) : Math.random() * Math.PI * 2;
    const sp = range(o.speed ?? [40, 160]);
    const life = range(o.life ?? [0.4, 0.8]);
    list.push({
      kind: o.kind ?? "dot",
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      z: 0,
      vz: range(o.vz ?? [0, 0]),
      life,
      max: life,
      size: range(o.size ?? [2, 4]),
      color: o.colors[Math.floor(Math.random() * o.colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 10,
      drag: o.drag ?? 3,
      grav: o.grav ?? 0,
      glow: o.glow ?? false,
    });
  }
}

function text(game: GameState, x: number, y: number, value: string, color: string, big = false) {
  game.texts.push({ x, y, z: 0, text: value, color, life: big ? 1.3 : 0.95, max: big ? 1.3 : 0.95, size: big ? 26 : 16 });
  if (game.texts.length > 24) game.texts.shift();
}

function say(b: Beggar, line: string, duration = 1.7) {
  b.bubble = line;
  b.bubbleT = duration;
}

function showBanner(game: GameState, title: string, sub: string, tone: Banner["tone"]) {
  game.bannerSeq += 1;
  game.banner = { id: game.bannerSeq, title, sub, tone, t: tone === "zone" ? 2.8 : 3.2 };
}

function setHint(game: GameState, value: string, duration = 3.4) {
  game.hintSeq += 1;
  game.hint = { id: game.hintSeq, text: value, t: duration };
}

function hintOnce(game: GameState, key: string, value: string, duration?: number) {
  if (game.passive || game.hintsShown.has(key)) return;
  game.hintsShown.add(key);
  setHint(game, value, duration);
}

function groan(game: GameState) {
  if (game.groanCD > 0 || game.passive) return;
  game.events.push("groan");
  game.groanCD = 1.1;
}

function lineFor(b: Beggar) {
  if (b.kind === "teplaky") return pick(LINES_TEPLAKY);
  if (b.kind === "smrad") return pick(LINES_SMRAD);
  if (b.kind === "boss") return pick(LINES_BOSS);
  return b.demand === "cash" ? pick(LINES_CASH) : pick(LINES_CIG);
}

function aggroRange(b: Beggar) {
  if (b.horde) return 2200;
  if (b.kind === "teplaky") return 250;
  if (b.kind === "smrad") return 205;
  if (b.kind === "boss") return 330;
  return 225;
}

function isActiveThreat(b: Beggar) {
  return b.state === "chase" || b.state === "windup" || b.state === "lunge";
}

/* ───────────────────────── actions ───────────────────────── */

export function doShove(game: GameState) {
  const p = game.player;
  if (game.ending || game.passive) return;
  if (p.shoveCD > 0) {
    game.events.push("deny");
    return;
  }
  p.shoveCD = SHOVE_COOLDOWN;
  p.shoutT = 0.45;
  game.rings.push({ x: p.x, y: p.y, r0: 18, r1: SHOVE_RADIUS + 14, life: 0.34, max: 0.34, color: "#fff1b8", width: 7 });
  game.rings.push({ x: p.x, y: p.y, r0: 10, r1: SHOVE_RADIUS * 0.72, life: 0.24, max: 0.24, color: "#ff6b4a", width: 4 });
  text(game, p.x, p.y - 30, "NEMÁM!", "#fff4d6", true);
  burst(game, p.x, p.y, 14, { kind: "dust", colors: ["#d8d2c0", "#b9b3a2"], speed: [140, 260], life: [0.3, 0.55], size: [4, 8], drag: 5 });
  game.trauma = Math.min(1, game.trauma + 0.22);

  let hits = 0;
  for (const b of game.beggars) {
    if (b.removed || b.state === "happy") continue;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < SHOVE_RADIUS + b.r) {
      const nx = dx / d;
      const ny = dy / d;
      const falloff = 1 - (d / (SHOVE_RADIUS + b.r)) * 0.5;
      const power = (b.kind === "boss" ? 190 : b.kind === "smrad" ? 380 : 540) * falloff;
      b.kx += nx * power;
      b.ky += ny * power;
      b.state = "stun";
      b.t = b.kind === "boss" ? 0.5 : 1.2;
      b.flash = 0.14;
      b.lying = false;
      b.lureId = -1;
      if (b.kind === "boss") b.cd = Math.max(b.cd, 1.2);
      say(b, pick(LINES_SHOVED), 1.1);
      burst(game, b.x, b.y, 6, { kind: "dust", colors: ["#cfc8b4"], speed: [60, 140], life: [0.3, 0.5], size: [3, 6] });
      hits += 1;
    } else if (d < 280 && b.state === "sleep") {
      wake(game, b);
    }
  }
  scarePigeons(game, p.x, p.y, 300);

  if (hits > 0) {
    game.combo += hits;
    game.comboT = 3.2;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.stats.shoved += hits;
    const gain = 25 * hits * Math.min(8, game.combo);
    game.score += gain;
    text(game, p.x, p.y - 58, hits >= 3 ? `MEGA NEMÁM! +${gain}` : `+${gain}`, "#ffd65a", hits >= 3);
    game.hitStop = hits >= 3 ? 0.06 : 0.03;
    game.events.push("shoveHit");
  } else {
    game.events.push("shove");
  }
}

export function throwLure(game: GameState, aimX?: number, aimY?: number) {
  const p = game.player;
  if (game.ending || game.passive || p.lureCD > 0) return;
  if (game.money - LURE_COST < MIN_CASH) {
    setHint(game, `Na lístek nesahej! Pod ${MIN_CASH} Kč nic neházej.`, 2.2);
    text(game, p.x, p.y - 30, "NA LÍSTEK!", "#ff6a5a");
    game.events.push("deny");
    return;
  }
  let tx: number;
  let ty: number;
  if (aimX !== undefined && aimY !== undefined) {
    tx = aimX;
    ty = aimY;
  } else {
    const threats = game.beggars
      .filter((b) => !b.removed && isActiveThreat(b) && Math.hypot(b.x - p.x, b.y - p.y) < 340)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, 5);
    if (threats.length) {
      tx = threats.reduce((sum, b) => sum + b.x, 0) / threats.length;
      ty = threats.reduce((sum, b) => sum + b.y, 0) / threats.length;
    } else {
      tx = p.x + Math.cos(p.facing) * 200;
      ty = p.y + Math.sin(p.facing) * 200;
    }
  }
  let dx = tx - p.x;
  let dy = ty - p.y;
  let d = Math.hypot(dx, dy);
  if (d < 1) {
    dx = Math.cos(p.facing);
    dy = Math.sin(p.facing);
    d = 1;
  }
  const want = clamp(d, 90, 250);
  const landing = segmentFree(game.level, p.x, p.y, p.x + (dx / d) * want, p.y + (dy / d) * want, 8);
  game.money -= LURE_COST;
  p.lureCD = LURE_COOLDOWN;
  game.stats.thrown += 1;
  game.lures.push({
    id: game.nextId++,
    x: p.x,
    y: p.y,
    z: 0,
    sx: p.x,
    sy: p.y,
    tx: landing.x,
    ty: landing.y,
    t: 0,
    flight: 0.42,
    life: LURE_DURATION,
    landed: false,
    pulse: 0,
  });
  text(game, p.x, p.y - 30, `−${LURE_COST} Kč`, "#ffcf4a");
  hintOnce(game, "lure", "Desetikoruna = návnada. Somráci se o ni poperou a na tebe zapomenou.");
  game.events.push("throw");
}

/* ───────────────────────── main tick ───────────────────────── */

export function tick(game: GameState, rawDt: number): Phase | null {
  if (game.hitStop > 0) {
    game.hitStop -= rawDt;
    updateCamera(game, rawDt);
    return null;
  }
  let dt = rawDt;
  if (game.ending) {
    const ending = game.ending;
    ending.t -= rawDt;
    if (ending.reason !== "won") {
      dt = rawDt * 0.3;
      game.zoom += (1.16 - game.zoom) * (1 - Math.exp(-rawDt * 3));
    }
    if (ending.t <= 0) {
      game.endReason = ending.reason;
      return ending.reason === "won" ? "won" : "over";
    }
  }

  game.time += dt;
  if (!game.ending) {
    game.timeLeft = Math.max(0, game.timeLeft - dt);
    if (game.timeLeft <= 30) hintOnce(game, "hurry", "Vlak jede za 30 sekund! Přidej!");
    if (game.timeLeft <= 10) {
      const sec = Math.ceil(game.timeLeft);
      if (sec !== game.lastTickSecond) {
        game.lastTickSecond = sec;
        game.events.push("tick");
      }
    }
    if (game.timeLeft <= 0) endRun(game, "time");
  }

  const p = game.player;
  updatePlayer(game, dt);
  updateZone(game);
  updateFlow(game, dt);
  updateHorde(game, dt);
  updateBeggars(game, dt, p.y);
  separateBeggars(game, p.y);
  if (!game.ending) checkContacts(game);
  updateClouds(game, dt);
  updateLures(game, dt);
  updatePickups(game, dt);
  updatePigeons(game, dt, true);
  if (!game.ending) updateSpawns(game, dt);
  updateFx(game, dt);
  updateCamera(game, rawDt);
  if (!game.ending) checkGoal(game);
  return null;
}

/** Title-screen attract mode: slow camera drift, idle world. */
export function tickAmbient(game: GameState, dt: number) {
  game.passive = true;
  game.attract += dt;
  const vw = game.viewW;
  const vh = game.viewH;
  const u = (1 - Math.cos(game.attract * 0.05)) / 2;
  game.cam.y = clamp(START_Y - vh * 0.6 - u * 1500, 0, WORLD_H - vh);
  game.cam.x = vw >= WORLD_W ? (WORLD_W - vw) / 2 : clamp(START_X - vw / 2 + Math.sin(game.attract * 0.13) * 90, 0, WORLD_W - vw);
  updateBeggars(game, dt, game.cam.y + vh / 2);
  updatePigeons(game, dt, false);
  updateFx(game, dt);
}

/** After the run ended: keep the scene alive behind the result screen. */
export function tickAftermath(game: GameState, dt: number) {
  game.passive = true;
  updateBeggars(game, dt, game.player.y);
  separateBeggars(game, game.player.y);
  updatePigeons(game, dt, false);
  updateFx(game, dt);
  game.trauma = Math.max(0, game.trauma - dt * 1.4);
}

/* ───────────────────────── player ───────────────────────── */

function updatePlayer(game: GameState, dt: number) {
  const p = game.player;
  let ix = 0;
  let iy = 0;
  const winning = game.ending?.reason === "won";
  if (!game.ending) {
    ix = game.input.mx;
    iy = game.input.my;
    const m = Math.hypot(ix, iy);
    if (m > 1) {
      ix /= m;
      iy /= m;
    }
  } else if (winning) {
    const dx = game.goalX - p.x;
    const dy = game.goalY - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      ix = (dx / d) * 0.6;
      iy = (dy / d) * 0.6;
    }
    p.alpha = Math.max(0, p.alpha - dt * 1.1);
  }
  const mag = Math.hypot(ix, iy);
  const speed = PLAYER_SPEED * (p.coffee > 0 ? 1.38 : 1) * (p.stink > 0 ? 0.56 : 1);
  const k = 1 - Math.exp(-(mag > 0.05 ? 18 : 12) * dt);
  p.vx += (ix * speed - p.vx) * k;
  p.vy += (iy * speed - p.vy) * k;
  p.x += (p.vx + p.kx) * dt;
  p.y += (p.vy + p.ky) * dt;
  const kd = Math.exp(-7 * dt);
  p.kx *= kd;
  p.ky *= kd;
  if (!winning) resolveCircle(game.level, p, p.r);

  const sp = Math.hypot(p.vx, p.vy);
  p.moving = sp > 25;
  if (p.moving) {
    p.facing = angleLerp(p.facing, Math.atan2(p.vy, p.vx), 1 - Math.exp(-16 * dt));
    p.walk += sp * dt * 0.075;
    if (Math.random() < dt * (p.coffee > 0 ? 16 : 6)) {
      burst(game, p.x - Math.cos(p.facing) * 8, p.y - Math.sin(p.facing) * 8 + 6, 1, {
        kind: "dust",
        colors: ["#b8b19e", "#9e9885"],
        speed: [8, 30],
        life: [0.3, 0.5],
        size: [3, 5],
      });
    }
  }
  if (p.coffee > 0 && Math.random() < dt * 22) {
    burst(game, p.x, p.y, 1, { kind: "spark", colors: ["#ffb347", "#ffd27a"], speed: [20, 60], life: [0.2, 0.4], size: [2, 3], glow: true });
  }
  if (p.phones > 0 && Math.random() < dt * 5) {
    burst(game, p.x + (Math.random() - 0.5) * 24, p.y - 10, 1, {
      kind: "note",
      colors: ["#ff9ad5", "#9ae6ff", "#fff08a"],
      speed: [10, 30],
      life: [0.8, 1.2],
      size: [12, 15],
      vz: [30, 50],
      drag: 1,
      glow: true,
    });
  }

  p.invuln = Math.max(0, p.invuln - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  p.coffee = Math.max(0, p.coffee - dt);
  p.phones = Math.max(0, p.phones - dt);
  p.stink = Math.max(0, p.stink - dt);
  p.stinkMsg = Math.max(0, p.stinkMsg - dt);
  p.shoveCD = Math.max(0, p.shoveCD - dt);
  p.lureCD = Math.max(0, p.lureCD - dt);
  p.shoutT = Math.max(0, p.shoutT - dt);

  if (p.y < game.bestY) {
    game.score += (game.bestY - p.y) * 0.1;
    game.bestY = p.y;
  }
}

function updateZone(game: GameState) {
  const zone = zoneAt(game.player.y);
  game.zone = zone.id;
  const index = ZONE_ORDER.indexOf(zone.id);
  if (index <= game.zoneIndex) return;
  game.zoneIndex = index;
  showBanner(game, zone.chapter, zone.name, "zone");
  game.events.push("zone");
  game.score += 100;
  text(game, game.player.x, game.player.y - 44, "+100 NOVÁ ZÓNA", "#b6ff3b");
  if (zone.id === "plaza") hintOnce(game, "doors", "Vyber vchod, u kterého stojí nejmíň somráků.");
  if (zone.id === "hall") hintOnce(game, "safe", "Ochranka uprostřed haly = bezpečná zóna. Vlak ale nepočká!");
}

/* ───────────────────────── flow field ───────────────────────── */

function updateFlow(game: GameState, dt: number) {
  game.flowTimer -= dt;
  if (game.flowTimer > 0) return;
  game.flowTimer = 0.18;
  const dist = game.flowDist;
  const queue = game.flowQueue;
  const blocked = game.level.blocked;
  const p = game.player;
  dist.fill(FLOW_UNREACHED);
  let pc = clamp(Math.floor(p.x / CELL), 0, GRID_COLS - 1);
  let pr = clamp(Math.floor(p.y / CELL), 0, GRID_ROWS - 1);
  if (blocked[pr * GRID_COLS + pc]) {
    let found = false;
    for (let radius = 1; radius <= 2 && !found; radius += 1) {
      for (let dr = -radius; dr <= radius && !found; dr += 1) {
        for (let dc = -radius; dc <= radius && !found; dc += 1) {
          const c = pc + dc;
          const r = pr + dr;
          if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) continue;
          if (!blocked[r * GRID_COLS + c]) {
            pc = c;
            pr = r;
            found = true;
          }
        }
      }
    }
  }
  const r0 = Math.max(0, pr - 55);
  const r1 = Math.min(GRID_ROWS - 1, pr + 55);
  game.flowRow0 = r0;
  game.flowRow1 = r1;
  let head = 0;
  let tail = 0;
  const start = pr * GRID_COLS + pc;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const idx = queue[head++];
    const nd = dist[idx] + 1;
    const r = (idx / GRID_COLS) | 0;
    const c = idx - r * GRID_COLS;
    if (c > 0) {
      const n = idx - 1;
      if (!blocked[n] && dist[n] === FLOW_UNREACHED) {
        dist[n] = nd;
        queue[tail++] = n;
      }
    }
    if (c < GRID_COLS - 1) {
      const n = idx + 1;
      if (!blocked[n] && dist[n] === FLOW_UNREACHED) {
        dist[n] = nd;
        queue[tail++] = n;
      }
    }
    if (r > r0) {
      const n = idx - GRID_COLS;
      if (!blocked[n] && dist[n] === FLOW_UNREACHED) {
        dist[n] = nd;
        queue[tail++] = n;
      }
    }
    if (r < r1) {
      const n = idx + GRID_COLS;
      if (!blocked[n] && dist[n] === FLOW_UNREACHED) {
        dist[n] = nd;
        queue[tail++] = n;
      }
    }
  }
}

function flowDistAt(game: GameState, x: number, y: number) {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || c >= GRID_COLS || r < game.flowRow0 || r > game.flowRow1) return FLOW_UNREACHED;
  return game.flowDist[r * GRID_COLS + c];
}

function flowDir(game: GameState, x: number, y: number, out: { x: number; y: number }): boolean {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || c >= GRID_COLS || r < game.flowRow0 || r > game.flowRow1) return false;
  const dist = game.flowDist;
  const blocked = game.level.blocked;
  let best = dist[r * GRID_COLS + c];
  if (best === FLOW_UNREACHED) best = FLOW_UNREACHED - 1;
  let bc = -1;
  let br = -1;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= GRID_COLS || nr < game.flowRow0 || nr > game.flowRow1) continue;
      const n = nr * GRID_COLS + nc;
      if (blocked[n]) continue;
      if (dr !== 0 && dc !== 0 && (blocked[r * GRID_COLS + nc] || blocked[nr * GRID_COLS + c])) continue;
      if (dist[n] < best) {
        best = dist[n];
        bc = nc;
        br = nr;
      }
    }
  }
  if (bc < 0) return false;
  const tx = bc * CELL + CELL / 2 - x;
  const ty = br * CELL + CELL / 2 - y;
  const l = Math.hypot(tx, ty) || 1;
  out.x = tx / l;
  out.y = ty / l;
  return true;
}

/* ───────────────────────── beggars ───────────────────────── */

function wake(game: GameState, b: Beggar) {
  if (b.state !== "sleep") return;
  b.state = "rise";
  b.t = 0.55;
  b.alert = 0.9;
  say(b, "?!", 0.8);
  burst(game, b.x, b.y, 8, { kind: "dust", colors: ["#cfc8b4", "#a9a28f"], speed: [30, 90], life: [0.4, 0.7], size: [4, 7] });
  groan(game);
  hintOnce(
    game,
    "wake",
    game.touchUI ? "Somrák vstal z lavičky! Ťukni na NEMÁM!" : "Somrák vstal z lavičky! Zařvi NEMÁM! — MEZERNÍK",
  );
}

function aggro(game: GameState, b: Beggar) {
  b.state = "chase";
  b.alert = 0.8;
  b.chaseT = 0;
  say(b, lineFor(b));
  b.nextBubble = 2.5 + Math.random() * 3;
  groan(game);
  if (b.kind === "boss") {
    showBanner(game, "VELKEJ BÉĎA", "Hoď mu desetikorunu a proběhni kolem!", "boss");
    game.events.push("boss");
    game.trauma = Math.min(1, game.trauma + 0.4);
    say(b, "DEJ PADESÁT!", 2.2);
  } else {
    hintOnce(
      game,
      "aggro",
      game.touchUI ? "Somrák tě zmerčil! Uteč, nebo ťukni na NEMÁM!" : "Somrák tě zmerčil! Uteč, nebo MEZERNÍK = NEMÁM!",
    );
  }
}

function belch(game: GameState, b: Beggar) {
  b.stinkCD = 4.6;
  say(b, "BUÉÉÉ!", 1.2);
  game.clouds.push({ x: b.x, y: b.y, r: 14, maxR: 92, life: 3.8, max: 3.8, seed: Math.random() * 10 });
  burst(game, b.x, b.y, 16, {
    kind: "smoke",
    colors: ["#9bc25a", "#7fa84a", "#b5d36b"],
    speed: [30, 110],
    life: [0.8, 1.5],
    size: [8, 15],
    drag: 2.2,
  });
  game.events.push("belch");
}

function emitZ(game: GameState, b: Beggar) {
  if (game.particles.length >= MAX_PARTICLES) return;
  game.particles.push({
    kind: "z",
    x: b.x + 6,
    y: b.y - 6,
    vx: 8 + Math.random() * 10,
    vy: -4,
    z: 8,
    vz: 16,
    life: 1.5,
    max: 1.5,
    size: 9 + Math.random() * 4,
    color: "#d8e6ff",
    rot: 0,
    vr: 0,
    drag: 0.5,
    grav: 0,
    glow: true,
  });
}

const tmpDir = { x: 0, y: 0 };

function updateBeggars(game: GameState, dt: number, refY: number) {
  const p = game.player;
  const level = game.level;
  const safe = !game.passive && inSafeZone(level, p.x, p.y, 0);
  const canAggro = !game.passive && !game.ending;
  const won = game.ending?.reason === "won";

  for (const b of game.beggars) {
    if (b.removed) continue;
    if (b.state !== "happy" && Math.abs(b.y - refY) > 1100) continue;
    b.anim += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.alert = Math.max(0, b.alert - dt);
    b.bubbleT = Math.max(0, b.bubbleT - dt);
    b.cd = Math.max(0, b.cd - dt);
    b.stinkCD = Math.max(0, b.stinkCD - dt);
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 0.001;
    let wantX = 0;
    let wantY = 0;
    let speed = 0;
    let accel = 7;

    switch (b.state) {
      case "sleep":
        if (Math.random() < dt * 0.8) emitZ(game, b);
        if (canAggro && d < 125) wake(game, b);
        break;
      case "rise":
        b.t -= dt;
        if (b.t <= 0) {
          b.lying = false;
          if (canAggro) aggro(game, b);
          else {
            b.state = "wander";
            b.t = 1;
          }
        }
        break;
      case "squat":
        if (Math.random() < dt * 0.7) {
          burst(game, b.x + Math.cos(b.facing) * 8, b.y + Math.sin(b.facing) * 8, 1, {
            kind: "seed",
            colors: ["#2f2a22", "#4a4233"],
            speed: [30, 60],
            life: [0.4, 0.6],
            size: [2, 3],
            angle: b.facing,
            spread: 0.8,
          });
        }
        if (canAggro && !safe && d < aggroRange(b)) aggro(game, b);
        break;
      case "idle":
        if (canAggro && !safe && d < aggroRange(b)) aggro(game, b);
        break;
      case "wander":
        b.t -= dt;
        if (b.t <= 0) {
          b.t = 1.2 + Math.random() * 2.4;
          b.wanderPause = Math.random() < 0.3;
          b.wanderA += (Math.random() - 0.5) * 2.2;
        }
        if (!b.wanderPause) {
          wantX = Math.cos(b.wanderA);
          wantY = Math.sin(b.wanderA);
          speed = b.speed * 0.4;
        }
        if (canAggro && !safe && d < aggroRange(b) && (d < 90 || b.horde || lineClear(level, b.x, b.y, p.x, p.y))) {
          aggro(game, b);
        }
        break;
      case "chase": {
        if (!canAggro) {
          b.state = won ? "idle" : "wander";
          if (won) say(b, pick(LINES_WIN), 2.2);
          break;
        }
        if (safe && d < 460) {
          b.state = "wander";
          b.wanderA = Math.atan2(-dy, -dx);
          b.wanderPause = false;
          b.t = 2.6;
          say(b, pick(LINES_SAFE));
          break;
        }
        if (d > (b.horde ? 1500 : 780)) {
          b.state = "wander";
          b.t = 1;
          break;
        }
        b.chaseT += dt;
        if (d < 64 || !flowDir(game, b.x, b.y, tmpDir)) {
          tmpDir.x = dx / d;
          tmpDir.y = dy / d;
        }
        wantX = tmpDir.x;
        wantY = tmpDir.y;
        const shamble = b.kind === "bedak" || b.kind === "smrad" ? 0.72 + 0.28 * Math.sin(b.anim * 5.2 + b.id) : 1;
        speed = b.kind === "boss" ? Math.min(124, b.speed + b.chaseT * 3.5) : b.speed * shamble;
        if (b.kind === "teplaky" && b.cd <= 0 && d < 230 && d > 56 && lineClear(level, b.x, b.y, p.x, p.y)) {
          b.state = "windup";
          b.t = 0.55;
          b.lungeX = dx / d;
          b.lungeY = dy / d;
          say(b, pick(LINES_TEPLAKY), 1.2);
          game.events.push("alert");
          hintOnce(game, "lunge", "Teplákář se rozbíhá — uhni do strany!");
        } else if (b.kind === "boss" && b.cd <= 0 && d < 270 && d > 80 && lineClear(level, b.x, b.y, p.x, p.y)) {
          b.state = "windup";
          b.t = 0.8;
          b.lungeX = dx / d;
          b.lungeY = dy / d;
          say(b, "VOZÍK JEDE!", 1.2);
          game.events.push("alert");
        } else if (b.kind === "smrad" && b.stinkCD <= 0 && d < 150) {
          belch(game, b);
        }
        b.nextBubble -= dt;
        if (b.nextBubble <= 0 && d < 420) {
          say(b, lineFor(b));
          b.nextBubble = 2.6 + Math.random() * 3.6;
        }
        break;
      }
      case "windup":
        b.t -= dt;
        if (b.t > 0.22) {
          b.lungeX = dx / d;
          b.lungeY = dy / d;
        }
        b.facing = Math.atan2(b.lungeY, b.lungeX);
        if (b.t <= 0) {
          b.state = "lunge";
          b.t = b.kind === "boss" ? 0.55 : 0.36;
          b.lungeMin = 9999;
          game.events.push("lunge");
        }
        break;
      case "lunge":
        wantX = b.lungeX;
        wantY = b.lungeY;
        speed = b.kind === "boss" ? 410 : 560;
        accel = 30;
        b.lungeMin = Math.min(b.lungeMin, d);
        if (Math.random() < dt * 30) {
          burst(game, b.x, b.y + b.r * 0.5, 1, { kind: "dust", colors: ["#bdb6a3"], speed: [10, 40], life: [0.3, 0.5], size: [3, 6] });
        }
        b.t -= dt;
        if (b.t <= 0) {
          b.state = "stun";
          b.t = b.kind === "boss" ? 0.7 : 0.95;
          b.cd = b.kind === "boss" ? 3.4 : 1.7;
          if (!game.ending && b.lungeMin < 52) {
            game.score += 50;
            game.stats.dodges += 1;
            text(game, p.x, p.y - 44, "ÚHYB! +50", "#b6ff3b");
          }
        }
        break;
      case "stun":
        b.t -= dt;
        if (b.t <= 0) b.state = canAggro && d < 700 && !safe ? "chase" : "wander";
        break;
      case "lured": {
        const lure = game.lures.find((l) => l.id === b.lureId && l.life > 0);
        if (!lure) {
          b.state = "stun";
          b.t = 0.5;
          b.lureId = -1;
          break;
        }
        const lx = lure.tx - b.x;
        const ly = lure.ty - b.y;
        const ld = Math.hypot(lx, ly) || 1;
        if (ld > 26) {
          wantX = lx / ld;
          wantY = ly / ld;
          speed = b.speed * 1.6 + 24;
        } else {
          wantX = Math.cos(b.anim * 9 + b.id);
          wantY = Math.sin(b.anim * 7 + b.id);
          speed = 46;
          if (Math.random() < dt * 5) {
            burst(game, lure.tx, lure.ty, 1, { kind: "dust", colors: ["#d7cfb8", "#bfb69d"], speed: [30, 90], life: [0.3, 0.6], size: [5, 9] });
          }
          if (b.bubbleT <= 0 && Math.random() < dt * 1.2) say(b, pick(LINES_LURE), 0.9);
        }
        break;
      }
      case "happy":
        b.t -= dt;
        wantX = Math.cos(b.wanderA);
        wantY = Math.sin(b.wanderA);
        speed = 40;
        if (Math.random() < dt * 2.2) {
          burst(game, b.x, b.y - b.r, 1, {
            kind: "heart",
            colors: ["#ff6f91", "#ff9ab5"],
            speed: [5, 20],
            life: [0.8, 1.2],
            size: [5, 7],
            vz: [30, 50],
            drag: 1,
            glow: true,
          });
        }
        if (b.t < 0.8) b.alpha = Math.max(0, b.t / 0.8);
        if (b.t <= 0) b.removed = true;
        break;
      case "gloat":
        b.t -= dt;
        if (b.t <= 0) b.state = canAggro ? "chase" : "wander";
        break;
    }

    if (b.state === "sleep" || b.removed) continue;
    const k = 1 - Math.exp(-accel * dt);
    b.vx += (wantX * speed - b.vx) * k;
    b.vy += (wantY * speed - b.vy) * k;
    b.x += (b.vx + b.kx) * dt;
    b.y += (b.vy + b.ky) * dt;
    const kd = Math.exp(-6 * dt);
    b.kx *= kd;
    b.ky *= kd;
    const bumped = resolveCircle(level, b, b.r);
    if (bumped && b.state === "wander") {
      b.wanderA += Math.PI * (0.6 + Math.random() * 0.8);
      b.t = Math.min(b.t, 0.8);
    }
    if (bumped && b.state === "lunge") {
      b.state = "stun";
      b.t = 1.1;
      b.cd = 1.8;
      b.vx = 0;
      b.vy = 0;
      text(game, b.x, b.y - 30, "BONK!", "#ffd65a");
      burst(game, b.x, b.y, 8, { kind: "star", colors: ["#ffe27a", "#fff3c2"], speed: [60, 140], life: [0.3, 0.6], size: [4, 6], glow: true });
      game.events.push("bonk");
      if (d < 320) game.trauma = Math.min(1, game.trauma + 0.12);
    }
    if (b.state !== "happy") {
      for (const zone of level.safeZones) {
        const sx = b.x - zone.x;
        const sy = b.y - zone.y;
        const sd = Math.hypot(sx, sy) || 1;
        const min = zone.r + b.r;
        if (sd < min) {
          b.x = zone.x + (sx / sd) * min;
          b.y = zone.y + (sy / sd) * min;
        }
      }
    }
    if (b.state !== "windup") {
      const spd = Math.hypot(b.vx, b.vy);
      if (spd > 8) b.facing = angleLerp(b.facing, Math.atan2(b.vy, b.vx), 1 - Math.exp(-9 * dt));
    }
  }

  const list = game.beggars;
  let w = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (!list[i].removed) list[w++] = list[i];
  }
  list.length = w;
}

function separateBeggars(game: GameState, refY: number) {
  const list = game.beggars;
  const n = list.length;
  for (let i = 0; i < n; i += 1) {
    const a = list[i];
    if (a.state === "sleep" || Math.abs(a.y - refY) > 900) continue;
    for (let j = i + 1; j < n; j += 1) {
      const b = list[j];
      if (b.state === "sleep") continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      if (dx > min || dx < -min || dy > min || dy < -min) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) * 0.5;
      const nx = dx / d;
      const ny = dy / d;
      const wa = a.kind === "boss" ? 0.15 : 1;
      const wb = b.kind === "boss" ? 0.15 : 1;
      a.x -= nx * push * wa;
      a.y -= ny * push * wa;
      b.x += nx * push * wb;
      b.y += ny * push * wb;
    }
  }
}

function checkContacts(game: GameState) {
  const p = game.player;
  for (const b of game.beggars) {
    if (b.removed) continue;
    if (b.state === "sleep" || b.state === "rise" || b.state === "stun" || b.state === "lured" || b.state === "happy" || b.state === "gloat") {
      continue;
    }
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const min = b.r + p.r + 2;
    if (dx * dx + dy * dy > min * min) continue;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    if (p.phones > 0) {
      b.kx += nx * 380;
      b.ky += ny * 380;
      b.state = "stun";
      b.t = 0.7;
      say(b, "...?", 0.9);
      text(game, b.x, b.y - 30, "NESLYŠÍM ♪", "#ff9ad5");
      continue;
    }
    if (p.invuln > 0) {
      b.kx += nx * 120;
      b.ky += ny * 120;
      continue;
    }
    steal(game, b, nx, ny);
    if (game.ending) return;
  }
}

function steal(game: GameState, b: Beggar, nx: number, ny: number) {
  const p = game.player;
  const cash = b.demand === "cash" ? b.amount : 0;
  const cigs = b.demand === "cig" ? b.amount : 0;
  game.money -= cash;
  game.cigs -= cigs;
  game.stats.steals += 1;
  game.stats.cashLost += cash;
  game.stats.cigsLost += cigs;
  p.invuln = 1.0;
  p.hitFlash = 0.35;
  const force = b.kind === "boss" ? 680 : 360;
  p.kx -= nx * force;
  p.ky -= ny * force;
  game.trauma = Math.min(1, game.trauma + (b.kind === "boss" ? 0.75 : 0.45));
  game.hitStop = 0.075;
  game.flashRed = 0.55;
  game.combo = 0;
  game.comboT = 0;
  const count = cash ? Math.min(10, Math.ceil(cash / 6)) : cigs * 3;
  for (let i = 0; i < count; i += 1) {
    if (game.particles.length >= MAX_PARTICLES) break;
    const spread = (Math.random() - 0.5) * 0.9;
    const sp = 120 + Math.random() * 120;
    const a = Math.atan2(ny, nx) + spread;
    game.particles.push({
      kind: cash ? "coin" : "cig",
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      z: 10,
      vz: 120 + Math.random() * 90,
      life: 0.9,
      max: 0.9,
      size: cash ? 5 : 7,
      color: cash ? "#ffcf4a" : "#f4efe4",
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 18,
      drag: 1.5,
      grav: 420,
      glow: true,
    });
  }
  text(game, p.x, p.y - 34, cash ? `−${cash} Kč` : `−${cigs} ${cigs === 1 ? "cígo" : "cíga"}`, "#ff5a4f", true);
  game.events.push("hit");
  if (b.kind === "boss") {
    b.state = "gloat";
    b.t = 1.5;
    b.kx += nx * 120;
    b.ky += ny * 120;
    say(b, "MÁLO!", 1.4);
  } else {
    b.state = "happy";
    b.t = 3;
    b.wanderA = Math.atan2(ny, nx);
    say(b, pick(LINES_THANKS), 2);
  }
  if (game.money < MIN_CASH) endRun(game, "cash");
  else if (game.cigs < MIN_CIGS) endRun(game, "cigs");
  else if (game.money - MIN_CASH <= 30 || game.cigs - MIN_CIGS <= 1) {
    hintOnce(game, "low", `Pozor! Pod ${MIN_CASH} Kč nebo ${MIN_CIGS} cíga je konec.`);
  }
}

function endRun(game: GameState, reason: EndReason) {
  if (game.ending) return;
  game.ending = { reason, t: reason === "won" ? 1.45 : 1.15 };
  if (reason === "won") {
    const bonus: Bonus = {
      time: Math.ceil(game.timeLeft) * 15,
      cash: Math.max(0, game.money - MIN_CASH) * 2,
      cigs: Math.max(0, game.cigs - MIN_CIGS) * 40,
      clean: game.stats.steals === 0 ? 500 : 0,
      finish: 1000,
    };
    game.bonus = bonus;
    game.score += bonus.time + bonus.cash + bonus.cigs + bonus.clean + bonus.finish;
    game.events.push("win");
  } else {
    game.trauma = 1;
    game.events.push("lose");
  }
}

function checkGoal(game: GameState) {
  const p = game.player;
  if (p.y > 240) return;
  for (const g of game.level.goals) {
    const cx = clamp(p.x, g.x, g.x + g.w);
    const cy = clamp(p.y, g.y, g.y + g.h);
    if (Math.hypot(p.x - cx, p.y - cy) >= p.r) continue;
    game.goalX = g.x + g.w / 2;
    game.goalY = g.y + 6;
    endRun(game, "won");
    game.flashGold = 0.7;
    burst(game, game.goalX, g.y + g.h, 46, {
      kind: "confetti",
      colors: ["#b6ff3b", "#ffd65a", "#ff6b4a", "#7fd8ff", "#ff9ad5"],
      speed: [120, 320],
      life: [0.9, 1.6],
      size: [4, 7],
      vz: [80, 200],
      grav: 260,
      drag: 1.6,
      glow: true,
    });
    text(game, game.goalX, g.y + g.h - 20, "NASTUPUJ!", "#b6ff3b", true);
    return;
  }
}

/* ───────────────────────── world systems ───────────────────────── */

function updateHorde(game: GameState, dt: number) {
  const p = game.player;
  if (!game.hordeTriggered && p.y < 1560 && !game.ending) {
    game.hordeTriggered = true;
    game.hordeQueue = 16;
    game.hordeTimer = 0.5;
    showBanner(game, "SOMRÁCKÁ HORDA!", "Utíkej na nástupiště!", "horde");
    game.events.push("horde");
    game.trauma = Math.min(1, game.trauma + 0.5);
  }
  if (game.hordeQueue <= 0 || game.ending) return;
  game.hordeTimer -= dt;
  if (game.hordeTimer > 0) return;
  game.hordeTimer = 0.3;
  game.hordeQueue -= 1;
  const options = game.level.hordeSpawns.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) > 200);
  const s = options.length ? pick(options) : pick(game.level.hordeSpawns);
  const b = spawnBeggar(game, "bedak", s.x + (Math.random() - 0.5) * 40, s.y + (Math.random() - 0.5) * 40, { horde: true });
  b.state = "chase";
  b.alert = 0.6;
  burst(game, b.x, b.y, 6, { kind: "dust", colors: ["#b9b29f", "#8f8a7a"], speed: [30, 90], life: [0.4, 0.7], size: [5, 9] });
}

function updateSpawns(game: GameState, dt: number) {
  if (game.time < 7) return;
  game.spawnTimer -= dt;
  if (game.spawnTimer > 0) return;
  const prog = progress01(game);
  game.spawnTimer = (5.2 - prog * 2.6) * (0.75 + Math.random() * 0.5);
  const p = game.player;
  if (p.y < 660) return;
  let near = 0;
  for (const b of game.beggars) {
    if (b.state !== "happy" && Math.abs(b.y - p.y) < 700 && Math.abs(b.x - p.x) < 700) near += 1;
  }
  if (near >= 12 + prog * 10) return;
  const count = game.zone === "hall" || game.zone === "tunnel" ? 2 : 1;
  for (let n = 0; n < count; n += 1) {
    for (let tries = 0; tries < 14; tries += 1) {
      const a = Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.5;
      const dist = Math.max(game.viewW, game.viewH) * 0.55 + 60 + Math.random() * 140;
      const x = p.x + Math.cos(a) * dist;
      const y = p.y + Math.sin(a) * dist;
      if (x < 30 || x > WORLD_W - 30 || y < 680 || y > WORLD_H - 90) continue;
      if (x > game.cam.x - 40 && x < game.cam.x + game.viewW + 40 && y > game.cam.y - 40 && y < game.cam.y + game.viewH + 40) continue;
      if (flowDistAt(game, x, y) >= FLOW_UNREACHED) continue;
      if (inSafeZone(game.level, x, y, 30)) continue;
      const b = spawnBeggar(game, "bedak", x, y);
      if (flowDistAt(game, x, y) * CELL < 650) b.state = "chase";
      break;
    }
  }
}

function updateClouds(game: GameState, dt: number) {
  const p = game.player;
  let inside = false;
  for (const c of game.clouds) {
    c.life -= dt;
    c.r += (c.maxR - c.r) * (1 - Math.exp(-5 * dt));
    if (c.life > 0.3 && Math.hypot(p.x - c.x, p.y - c.y) < c.r * 0.9) inside = true;
    if (Math.random() < dt * 5 && game.particles.length < MAX_PARTICLES) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * c.r;
      burst(game, c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, 1, {
        kind: "smoke",
        colors: ["#9bc25a", "#b5d36b"],
        speed: [5, 20],
        life: [0.8, 1.3],
        size: [6, 11],
        drag: 1,
      });
    }
  }
  if (game.clouds.some((c) => c.life <= 0)) game.clouds = game.clouds.filter((c) => c.life > 0);
  if (inside && !game.ending) {
    if (p.stink <= 0 && p.stinkMsg <= 0) {
      text(game, p.x, p.y - 40, "FUJ!", "#b6ff3b");
      p.stinkMsg = 2.5;
      hintOnce(game, "stink", "Smraďoch tě zpomalil. Drž se dál od zeleného mraku!");
    }
    p.stink = 0.3;
  }
}

function attract(game: GameState, lure: Lure) {
  for (const b of game.beggars) {
    if (b.removed || b.state === "happy" || b.state === "sleep" || b.state === "rise" || b.state === "lunge" || b.state === "lured") {
      continue;
    }
    if (Math.hypot(b.x - lure.tx, b.y - lure.ty) < LURE_RADIUS) {
      b.state = "lured";
      b.lureId = lure.id;
      b.alert = 0.5;
      if (Math.random() < 0.6) say(b, pick(LINES_LURE), 1);
    }
  }
}

function resolveLure(game: GameState, lure: Lure) {
  let winner: Beggar | null = null;
  let best = 64;
  for (const b of game.beggars) {
    if (b.state !== "lured" || b.lureId !== lure.id) continue;
    const d = Math.hypot(b.x - lure.tx, b.y - lure.ty);
    if (d < best) {
      best = d;
      winner = b;
    }
  }
  for (const b of game.beggars) {
    if (b.state !== "lured" || b.lureId !== lure.id) continue;
    b.lureId = -1;
    if (b === winner && b.kind !== "boss") {
      b.state = "happy";
      b.t = 3;
      b.wanderA = Math.random() * Math.PI * 2;
      say(b, "Moje! Díky!", 1.6);
      game.score += 40;
      game.stats.bribed += 1;
      text(game, b.x, b.y - 30, "+40 NÁVNADA", "#ffd65a");
    } else if (b === winner) {
      b.state = "gloat";
      b.t = 1.2;
      say(b, "DESET?! MÁLO!", 1.4);
    } else {
      b.state = "stun";
      b.t = 0.6;
      say(b, pick(["Sakra!", "Hmpf.", "Příště..."]), 1);
    }
  }
  burst(game, lure.tx, lure.ty, 8, { kind: "dust", colors: ["#d7cfb8"], speed: [40, 110], life: [0.3, 0.6], size: [5, 9] });
}

function updateLures(game: GameState, dt: number) {
  for (const l of game.lures) {
    if (!l.landed) {
      l.t += dt;
      const u = Math.min(1, l.t / l.flight);
      l.x = l.sx + (l.tx - l.sx) * u;
      l.y = l.sy + (l.ty - l.sy) * u;
      l.z = Math.sin(u * Math.PI) * 55;
      if (u >= 1) {
        l.landed = true;
        l.z = 0;
        burst(game, l.tx, l.ty, 12, { kind: "spark", colors: ["#ffd65a", "#fff3c2"], speed: [60, 180], life: [0.25, 0.5], size: [2, 3], glow: true });
        game.rings.push({ x: l.tx, y: l.ty, r0: 6, r1: 70, life: 0.45, max: 0.45, color: "#ffd65a", width: 4 });
        text(game, l.tx, l.ty - 16, "CINK!", "#ffd65a");
        game.events.push("cink");
        attract(game, l);
      }
      continue;
    }
    l.life -= dt;
    l.pulse -= dt;
    if (l.pulse <= 0) {
      l.pulse = 0.55;
      game.rings.push({ x: l.tx, y: l.ty, r0: 8, r1: 58, life: 0.5, max: 0.5, color: "#ffd65a", width: 3 });
      attract(game, l);
    }
    if (l.life <= 0) resolveLure(game, l);
  }
  if (game.lures.some((l) => l.life <= 0)) game.lures = game.lures.filter((l) => l.life > 0);
}

function collect(game: GameState, it: Pickup) {
  const p = game.player;
  it.taken = true;
  game.stats.picked += 1;
  let label = "";
  let color = "#ffd65a";
  let sparkColors = ["#ffd65a", "#fff3c2"];
  switch (it.kind) {
    case "coin":
      game.money += it.value;
      game.score += 20;
      label = `+${it.value} Kč`;
      game.events.push("coin");
      break;
    case "bill":
      game.money += it.value;
      game.score += 80;
      label = `+${it.value} Kč!`;
      game.flashGold = 0.3;
      game.events.push("power");
      break;
    case "pack":
      game.cigs += it.value;
      game.score += 40;
      label = `+${it.value} cíga`;
      color = "#f4efe4";
      sparkColors = ["#ffffff", "#ffb07a"];
      game.events.push("coin");
      break;
    case "coffee":
      p.coffee = 6.5;
      game.score += 40;
      label = "KOFEIN!";
      color = "#ffb347";
      sparkColors = ["#ffb347", "#ffe0a8"];
      game.flashGold = 0.25;
      game.events.push("power");
      hintOnce(game, "coffee", "Kafe z automatu: na pár vteřin běžíš jako o život.");
      break;
    case "phones":
      p.phones = 6.5;
      game.score += 40;
      label = "SLUCHÁTKA!";
      color = "#ff9ad5";
      sparkColors = ["#ff9ad5", "#9ae6ff"];
      game.flashGold = 0.25;
      game.events.push("power");
      hintOnce(game, "phones", "Sluchátka: somráky neslyšíš, takže tě nemůžou vysomrovat.");
      break;
  }
  text(game, it.x, it.y - 18, label, color, it.kind !== "coin");
  burst(game, it.x, it.y, 12, { kind: "spark", colors: sparkColors, speed: [50, 160], life: [0.25, 0.5], size: [2, 3], glow: true });
  game.rings.push({ x: it.x, y: it.y, r0: 6, r1: 34, life: 0.3, max: 0.3, color, width: 3 });
}

function updatePickups(game: GameState, dt: number) {
  const p = game.player;
  for (const it of game.pickups) {
    if (it.taken) continue;
    it.bob += dt;
    if (game.ending || game.passive) continue;
    const dx = p.x - it.x;
    const dy = p.y - it.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 90 * 90) continue;
    const d = Math.sqrt(d2) || 1;
    if (d < 72) {
      const pull = 420 * dt * (1 - d / 90);
      it.x += (dx / d) * pull;
      it.y += (dy / d) * pull;
    }
    if (d < p.r + 14) collect(game, it);
  }
  if (game.pickups.some((it) => it.taken)) game.pickups = game.pickups.filter((it) => !it.taken);
}

function flyAway(game: GameState, g: Pigeon, fx: number, fy: number) {
  g.state = "fly";
  const a = Math.atan2(g.y - fy, g.x - fx) + (Math.random() - 0.5) * 1.3;
  const sp = 190 + Math.random() * 120;
  g.vx = Math.cos(a) * sp;
  g.vy = Math.sin(a) * sp;
  g.facing = a;
  g.t = 2.4;
  burst(game, g.x, g.y, 2, { kind: "feather", colors: ["#9aa0a8", "#c9cdd2"], speed: [20, 60], life: [0.6, 1.1], size: [2, 3], drag: 2 });
}

function scarePigeons(game: GameState, x: number, y: number, radius: number) {
  for (const g of game.pigeons) {
    if (!g.gone && g.state === "peck" && Math.hypot(g.x - x, g.y - y) < radius) flyAway(game, g, x, y);
  }
}

function updatePigeons(game: GameState, dt: number, scare: boolean) {
  const p = game.player;
  const cy = game.cam.y + game.viewH / 2;
  for (const g of game.pigeons) {
    if (g.gone) continue;
    if (g.state === "peck") {
      if (Math.abs(g.y - cy) > game.viewH + 300) continue;
      g.t -= dt;
      g.peck = Math.max(0, g.peck - dt);
      if (g.t <= 0) {
        g.t = 0.5 + Math.random() * 1.6;
        if (Math.random() < 0.5) g.peck = 0.25;
        else {
          const a = Math.random() * Math.PI * 2;
          g.x += Math.cos(a) * 6;
          g.y += Math.sin(a) * 6;
          g.facing = a;
        }
      }
      if (scare && !game.passive && Math.hypot(p.x - g.x, p.y - g.y) < (p.moving ? 105 : 80)) flyAway(game, g, p.x, p.y);
    } else {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += dt * 70;
      g.t -= dt;
      if (g.t <= 0) g.gone = true;
    }
  }
}

function updateFx(game: GameState, dt: number) {
  const list = game.particles;
  let w = 0;
  for (let i = 0; i < list.length; i += 1) {
    const q = list[i];
    q.life -= dt;
    if (q.life <= 0) continue;
    const dr = Math.exp(-q.drag * dt);
    q.vx *= dr;
    q.vy *= dr;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.grav !== 0 || q.vz !== 0) {
      q.vz -= q.grav * dt;
      q.z += q.vz * dt;
      if (q.z < 0 && q.grav > 0) {
        q.z = 0;
        q.vz *= -0.35;
        q.vx *= 0.6;
        q.vy *= 0.6;
      }
    }
    q.rot += q.vr * dt;
    list[w++] = q;
  }
  list.length = w;

  const texts = game.texts;
  w = 0;
  for (let i = 0; i < texts.length; i += 1) {
    const t = texts[i];
    t.life -= dt;
    if (t.life <= 0) continue;
    t.z += dt * (18 + 40 * (t.life / t.max));
    texts[w++] = t;
  }
  texts.length = w;

  const rings = game.rings;
  w = 0;
  for (let i = 0; i < rings.length; i += 1) {
    const r = rings[i];
    r.life -= dt;
    if (r.life > 0) rings[w++] = r;
  }
  rings.length = w;

  game.flashRed = Math.max(0, game.flashRed - dt * 2.2);
  game.flashGold = Math.max(0, game.flashGold - dt * 1.8);
  if (game.comboT > 0) {
    game.comboT -= dt;
    if (game.comboT <= 0) game.combo = 0;
  }
  if (game.banner) {
    game.banner.t -= dt;
    if (game.banner.t <= 0) game.banner = null;
  }
  if (game.hint) {
    game.hint.t -= dt;
    if (game.hint.t <= 0) game.hint = null;
  }
  game.groanCD = Math.max(0, game.groanCD - dt);
}

function updateCamera(game: GameState, dt: number) {
  const p = game.player;
  const vw = game.viewW / game.zoom;
  const vh = game.viewH / game.zoom;
  let tx = p.x - vw / 2 + p.vx * 0.12;
  let ty = p.y - vh * 0.58 + p.vy * 0.1;
  tx = vw >= WORLD_W ? (WORLD_W - vw) / 2 : clamp(tx, 0, WORLD_W - vw);
  ty = clamp(ty, 0, WORLD_H - vh);
  if (game.cam.snap) {
    game.cam.x = tx;
    game.cam.y = ty;
    game.cam.snap = false;
  } else {
    const k = 1 - Math.exp(-6.5 * dt);
    game.cam.x += (tx - game.cam.x) * k;
    game.cam.y += (ty - game.cam.y) * k;
  }
  game.trauma = Math.max(0, game.trauma - dt * 1.4);
}

/* ───────────────────────── snapshots ───────────────────────── */

export function hudSnapshot(game: GameState): HudSnapshot {
  const p = game.player;
  let threat = false;
  for (const b of game.beggars) {
    if (b.state === "happy" || b.state === "sleep") continue;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const reach = SHOVE_RADIUS + b.r;
    if (dx * dx + dy * dy < reach * reach) {
      threat = true;
      break;
    }
  }
  const zone = ZONES.find((z) => z.id === game.zone) ?? ZONES[ZONES.length - 1];
  return {
    score: Math.floor(game.score),
    money: game.money,
    cigs: game.cigs,
    timeLeft: game.timeLeft,
    progress: progress01(game),
    zoneName: zone.name,
    chapter: zone.chapter,
    zoneIndex: game.zoneIndex,
    canLure: game.money - LURE_COST >= MIN_CASH,
    threat,
    coffee: p.coffee,
    phones: p.phones,
    stink: p.stink > 0,
    combo: game.comboT > 0 ? game.combo : 0,
    low: game.money - MIN_CASH <= 30 || game.cigs - MIN_CIGS <= 1,
    banner: game.banner ? { id: game.banner.id, title: game.banner.title, sub: game.banner.sub, tone: game.banner.tone } : null,
    hint: game.hint ? { id: game.hint.id, text: game.hint.text } : null,
  };
}

export function runSummary(game: GameState): RunSummary {
  return {
    score: Math.floor(game.score),
    won: game.endReason === "won",
    reason: game.endReason ?? "cash",
    progress: progress01(game),
    money: game.money,
    cigs: game.cigs,
    timeLeft: game.timeLeft,
    stats: { ...game.stats },
    maxCombo: game.maxCombo,
    bonus: game.bonus,
  };
}
