import { MIN_CASH, MIN_CIGS, START_Y, WORLD_H, WORLD_W, ZONES, zoneAt, type ZoneId } from "./constants";
import type { Beggar, GameState, Lure, Particle, Phase, Pigeon, Player } from "./engine";
import {
  mulberry32,
  type CircleObstacle,
  type Decal,
  type Level,
  type LightSource,
  type Obstacle,
  type RectObstacle,
} from "./level";

const TAU = Math.PI * 2;
const CHUNK_H = 320;
const PAD = 2;
const MAX_CHUNK_RES = 1.75;
export const FONT = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", Arial, sans-serif';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.arc(x, y, Math.max(0.1, r), 0, TAU);
  g.fill();
}

function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  g.fill();
}

function hash(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const shadeCache = new Map<string, string>();
function shade(hex: string, amount: number) {
  const key = hex + amount;
  const cached = shadeCache.get(key);
  if (cached) return cached;
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => clamp(Math.round(c + (amount > 0 ? (255 - c) * amount : c * amount)), 0, 255);
  const out = `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  shadeCache.set(key, out);
  return out;
}

function makeRadialSprite(size: number, stops: Array<[number, string]>) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function makeConeSprite() {
  const w = 256;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return c;
  const layers: Array<[number, number]> = [
    [0.62, 0.24],
    [0.47, 0.36],
    [0.34, 0.46],
  ];
  for (const [ang, alpha] of layers) {
    const grad = g.createRadialGradient(0, h / 2, 0, 0, h / 2, w);
    grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.7})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.arc(0, h / 2, w, -ang, ang);
    g.closePath();
    g.fill();
  }
  return c;
}

function darknessAt(y: number) {
  for (let i = 0; i < ZONES.length - 1; i += 1) {
    const boundary = ZONES[i].y1;
    if (Math.abs(y - boundary) < 150) {
      const t = clamp((y - (boundary - 150)) / 300, 0, 1);
      const s = t * t * (3 - 2 * t);
      return ZONES[i].darkness + (ZONES[i + 1].darkness - ZONES[i].darkness) * s;
    }
  }
  return zoneAt(y).darkness;
}

function lightLevel(light: LightSource, now: number) {
  if (!light.flicker) return 1;
  const n = Math.sin(now * 13 + light.y * 0.07) + Math.sin(now * 31.7 + light.x) * 0.8;
  const slow = Math.sin(now * 0.9 + light.y);
  if (slow > 0.55 && n > 0.3) return 0.1;
  return 0.85 + Math.sin(now * 50 + light.y) * 0.1;
}

/* ═════════════════════════ Renderer ═════════════════════════ */

export class Renderer {
  width = 1;
  height = 1;
  dpr = 1;
  scale = 1;
  private ctx: CanvasRenderingContext2D;
  private level: Level;
  private chunks = new Map<number, HTMLCanvasElement>();
  private chunkRes = 1;
  private chunkX0 = 0;
  private chunkX1 = WORLD_W;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D | null;
  private glow: HTMLCanvasElement;
  private cone: HTMLCanvasElement;
  private warm: HTMLCanvasElement;
  private cool: HTMLCanvasElement;
  private vignette: HTMLCanvasElement;
  private redVignette: HTMLCanvasElement;
  private guards: CircleObstacle[];
  private lightBands = new Map<number, LightSource[]>();
  private visibleLightList: LightSource[] = [];
  private maxLightRadius = 0;

  constructor(ctx: CanvasRenderingContext2D, level: Level) {
    this.ctx = ctx;
    this.level = level;
    this.lightCanvas = document.createElement("canvas");
    this.lightCtx = this.lightCanvas.getContext("2d");
    this.glow = makeRadialSprite(128, [
      [0, "rgba(0,0,0,1)"],
      [0.45, "rgba(0,0,0,0.72)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    this.cone = makeConeSprite();
    this.warm = makeRadialSprite(128, [
      [0, "rgba(255,176,90,0.9)"],
      [0.5, "rgba(255,150,70,0.35)"],
      [1, "rgba(255,140,60,0)"],
    ]);
    this.cool = makeRadialSprite(128, [
      [0, "rgba(150,210,255,0.9)"],
      [0.5, "rgba(120,190,255,0.3)"],
      [1, "rgba(120,190,255,0)"],
    ]);
    this.vignette = makeRadialSprite(256, [
      [0, "rgba(0,0,0,0)"],
      [0.6, "rgba(0,0,0,0)"],
      [1, "rgba(0,0,0,0.62)"],
    ]);
    this.redVignette = makeRadialSprite(256, [
      [0, "rgba(200,20,20,0)"],
      [0.55, "rgba(200,20,20,0)"],
      [1, "rgba(215,25,30,0.78)"],
    ]);
    this.guards = level.obstacles.filter((o): o is CircleObstacle => o.shape === "circle" && o.type === "guard");

    // Lights are static. Bucket them by their center's vertical chunk so the
    // frame loop only visits lights that could contribute to the viewport.
    for (const light of level.lights) {
      this.maxLightRadius = Math.max(this.maxLightRadius, light.r);
      const i = Math.floor(light.y / CHUNK_H);
      const bucket = this.lightBands.get(i);
      if (bucket) bucket.push(light);
      else this.lightBands.set(i, [light]);
    }
  }

  resize(width: number, height: number, dpr: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = dpr;
    this.scale = Math.min(this.width / 470, this.height / 600);
    const lw = Math.max(1, Math.ceil(this.width / 3));
    const lh = Math.max(1, Math.ceil(this.height / 3));
    if (this.lightCanvas.width !== lw || this.lightCanvas.height !== lh) {
      this.lightCanvas.width = lw;
      this.lightCanvas.height = lh;
    }
    const res = Math.min(MAX_CHUNK_RES, this.scale * dpr * 1.05);
    const viewW = this.width / this.scale;
    const need = Math.max(0, (viewW - WORLD_W) / 2);
    const margin = Math.min(500, Math.ceil((need + (need > 0 ? 60 : 30)) / 20) * 20);
    if (Math.abs(res - this.chunkRes) / this.chunkRes > 0.12 || -margin !== this.chunkX0) {
      this.chunkRes = res;
      this.chunkX0 = -margin;
      this.chunkX1 = WORLD_W + margin;
      this.invalidate();
    }
  }

  get viewW() {
    return this.width / this.scale;
  }

  get viewH() {
    return this.height / this.scale;
  }

  invalidate() {
    for (const c of this.chunks.values()) {
      c.width = 0;
      c.height = 0;
    }
    this.chunks.clear();
  }

  screenToWorld(sx: number, sy: number, game: GameState) {
    const s = this.scale * game.zoom;
    return { x: game.cam.x + sx / s, y: game.cam.y + sy / s };
  }

  private getChunk(i: number) {
    const cached = this.chunks.get(i);
    if (cached) return cached;
    const wWorld = this.chunkX1 - this.chunkX0;
    const hWorld = CHUNK_H + PAD * 2;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(wWorld * this.chunkRes));
    c.height = Math.max(1, Math.ceil(hWorld * this.chunkRes));
    const g = c.getContext("2d");
    if (g) {
      g.scale(c.width / wWorld, c.height / hWorld);
      const top = i * CHUNK_H - PAD;
      g.translate(-this.chunkX0, -top);
      drawStatic(g, this.level, top, top + hWorld, this.chunkX0, this.chunkX1, i);
    }
    this.chunks.set(i, c);
    return c;
  }

  private drawChunks(ctx: CanvasRenderingContext2D, y0: number, y1: number) {
    const last = Math.ceil(WORLD_H / CHUNK_H) - 1;
    const i0 = clamp(Math.floor(y0 / CHUNK_H), 0, last);
    const i1 = clamp(Math.floor(y1 / CHUNK_H), 0, last);
    for (let i = i0; i <= i1; i += 1) {
      const c = this.getChunk(i);
      ctx.drawImage(c, this.chunkX0, i * CHUNK_H - PAD, this.chunkX1 - this.chunkX0, CHUNK_H + PAD * 2);
    }
    if (i0 - 1 >= 0 && !this.chunks.has(i0 - 1)) this.getChunk(i0 - 1);
    else if (i1 + 1 <= last && !this.chunks.has(i1 + 1)) this.getChunk(i1 + 1);
    const pinnedFrom = Math.floor((START_Y - 820) / CHUNK_H);
    for (const [key, c] of this.chunks) {
      if ((key < i0 - 2 || key > i1 + 2) && key < pinnedFrom) {
        c.width = 0;
        c.height = 0;
        this.chunks.delete(key);
      }
    }
  }

  private visibleLights(y0: number, y1: number) {
    const i0 = Math.floor((y0 - this.maxLightRadius) / CHUNK_H);
    const i1 = Math.floor((y1 + this.maxLightRadius) / CHUNK_H);
    const out = this.visibleLightList;
    out.length = 0;
    for (let i = i0; i <= i1; i += 1) {
      const bucket = this.lightBands.get(i);
      if (!bucket) continue;
      for (const light of bucket) out.push(light);
    }
    return out;
  }

  render(game: GameState, phase: Phase, now: number) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const s = this.scale * game.zoom;
    const shake = game.trauma * game.trauma;
    const sx = shake * 16 * (Math.sin(now * 37.1) * 0.6 + Math.sin(now * 61.7) * 0.4);
    const sy = shake * 16 * (Math.sin(now * 43.3 + 1.3) * 0.6 + Math.sin(now * 71.9) * 0.4);
    const rot = shake * 0.035 * Math.sin(now * 29.3 + 2.1);
    const cam = game.cam;
    const vx0 = cam.x;
    const vy0 = cam.y;
    const vx1 = cam.x + W / s;
    const vy1 = cam.y + H / s;
    const visibleLights = this.visibleLights(vy0, vy1);
    const applyWorld = (g: CanvasRenderingContext2D) => {
      g.translate(W / 2, H / 2);
      g.rotate(rot);
      g.translate(-W / 2 + sx, -H / 2 + sy);
      g.scale(s, s);
      g.translate(-cam.x, -cam.y);
    };

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#06080c";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    applyWorld(ctx);
    this.drawChunks(ctx, vy0 - 40, vy1 + 40);
    drawGroundFx(ctx, game, now, vx0, vy0, vx1, vy1);
    drawPickups(ctx, game, now, vy0, vy1);
    drawActors(ctx, game, now, this.guards, vx0 - 60, vy0 - 90, vx1 + 60, vy1 + 90);
    glowParticles.length = 0;
    drawParticles(ctx, game.particles, false, vx0, vy0, vx1, vy1, glowParticles);
    ctx.restore();

    // Darkness mask with light holes, rendered at low resolution.
    const lc = this.lightCtx;
    if (lc) {
      const lw = this.lightCanvas.width;
      const lh = this.lightCanvas.height;
      const m = lw / W;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = "source-over";
      lc.globalAlpha = 1;
      lc.clearRect(0, 0, lw, lh);
      lc.fillStyle = `rgba(4, 7, 16, ${darknessAt(cam.y + (H / s) * 0.55)})`;
      lc.fillRect(0, 0, lw, lh);
      lc.globalCompositeOperation = "destination-out";
      lc.setTransform(m, 0, 0, m, 0, 0);
      applyWorld(lc);
      for (const light of visibleLights) {
        if (light.x + light.r < vx0 || light.x - light.r > vx1 || light.y + light.r < vy0 || light.y - light.r > vy1) continue;
        const a = lightLevel(light, now);
        if (a <= 0.02) continue;
        lc.globalAlpha = a;
        lc.drawImage(this.glow, light.x - light.r, light.y - light.r, light.r * 2, light.r * 2);
      }
      const p = game.player;
      lc.globalAlpha = 0.9;
      lc.drawImage(this.glow, p.x - 105, p.y - 105, 210, 210);
      lc.save();
      lc.translate(p.x, p.y);
      lc.rotate(p.facing);
      lc.globalAlpha = 1;
      lc.drawImage(this.cone, 4, -190, 380, 380);
      lc.restore();
      for (const l of game.lures) {
        lc.globalAlpha = 0.75;
        lc.drawImage(this.glow, l.x - 55, l.y - l.z - 55, 110, 110);
      }
      for (const it of game.pickups) {
        if (it.y < vy0 - 40 || it.y > vy1 + 40) continue;
        lc.globalAlpha = 0.5;
        lc.drawImage(this.glow, it.x - 38, it.y - 38, 76, 76);
      }
      if (vy0 < 320) {
        for (const goal of this.level.goals) {
          lc.globalAlpha = 0.95;
          lc.drawImage(this.glow, goal.x + goal.w / 2 - 120, goal.y + 24 - 120, 240, 240);
        }
      }
      lc.globalCompositeOperation = "source-over";
      lc.globalAlpha = 1;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.drawImage(this.lightCanvas, 0, 0, W, H);
    }

    ctx.save();
    applyWorld(ctx);
    ctx.globalCompositeOperation = "lighter";
    for (const light of visibleLights) {
      if (light.tint === "none") continue;
      const r = light.r * 0.8;
      if (light.x + r < vx0 || light.x - r > vx1 || light.y + r < vy0 || light.y - r > vy1) continue;
      const a = lightLevel(light, now);
      if (a < 0.05) continue;
      ctx.globalAlpha = (light.tint === "warm" ? 0.2 : 0.09) * a;
      ctx.drawImage(light.tint === "warm" ? this.warm : this.cool, light.x - r, light.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    drawGlowLayer(ctx, game, this.level.goals, visibleLights, now, vx0, vy0, vx1, vy1);
    ctx.restore();

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rot);
    ctx.translate(-W / 2 + sx, -H / 2 + sy);
    drawScreenLabels(ctx, game, s, W, H);
    ctx.restore();

    drawScreenFx(ctx, game, phase, W, H, now, this.vignette, this.redVignette);
  }
}

/* ═════════════════════════ static world ═════════════════════════ */

function drawStatic(
  g: CanvasRenderingContext2D,
  level: Level,
  y0: number,
  y1: number,
  x0: number,
  x1: number,
  chunkIndex: number,
) {
  const rng = mulberry32(9001 + chunkIndex * 7919);
  for (const zone of ZONES) {
    const top = Math.max(y0, zone.y0);
    const bottom = Math.min(y1, zone.y1);
    if (bottom <= top) continue;
    drawOutside(g, zone.id, x0, top, x1, bottom);
    drawGround(g, zone.id, top, bottom, rng);
  }
  if (y1 > 3400) drawPaths(g, level, y0, y1);
  for (const d of level.decals) {
    if (!d.top && d.y + d.h + 110 > y0 && d.y - 110 < y1) drawDecal(g, d);
  }
  for (const o of level.obstacles) {
    const top = o.shape === "rect" ? o.y : o.y - o.r * 1.6;
    const bottom = o.shape === "rect" ? o.y + o.h : o.y + o.r * 1.6;
    if (bottom + 24 < y0 || top - 24 > y1) continue;
    drawObstacle(g, o, level);
  }
  for (const d of level.decals) {
    if (d.top && d.y + d.h + 110 > y0 && d.y - 110 < y1) drawDecal(g, d);
  }
}

function drawOutside(g: CanvasRenderingContext2D, zone: ZoneId, x0: number, top: number, x1: number, bottom: number) {
  if (x0 >= 0) return;
  const h = bottom - top;
  const sides: Array<[number, number, boolean]> = [
    [x0, 0, true],
    [WORLD_W, x1, false],
  ];
  for (const [a, b, left] of sides) {
    const w = b - a;
    if (w <= 0) continue;
    if (zone === "park" || zone === "plaza") {
      g.fillStyle = "#1b1f23";
      g.fillRect(a, top, w, h);
      const sw = 40;
      g.fillStyle = "#33373b";
      g.fillRect(left ? -sw : WORLD_W, top, sw, h);
      g.fillStyle = "#4b4f53";
      g.fillRect(left ? -sw - 3 : WORLD_W + sw, top, 3, h);
      const lx = left ? -sw - 95 : WORLD_W + sw + 95;
      g.fillStyle = "rgba(230,230,210,0.3)";
      for (let y = Math.floor(top / 64) * 64; y < bottom; y += 64) g.fillRect(lx - 2, y, 4, 32);
    } else if (zone === "hall") {
      g.fillStyle = "#14181d";
      g.fillRect(a, top, w, h);
      g.strokeStyle = "rgba(255,255,255,0.035)";
      g.lineWidth = 1;
      g.beginPath();
      for (let y = Math.floor(top / 48) * 48; y < bottom; y += 48) {
        g.moveTo(a, y);
        g.lineTo(b, y);
      }
      g.stroke();
    } else if (zone === "tunnel") {
      g.fillStyle = "#0c0f12";
      g.fillRect(a, top, w, h);
    } else {
      g.fillStyle = "#4b4f52";
      g.fillRect(a, top, w, h);
    }
  }
}

function drawGround(g: CanvasRenderingContext2D, zone: ZoneId, top: number, bottom: number, rng: () => number) {
  const W = WORLD_W;
  const h = bottom - top;
  if (zone === "park") {
    g.fillStyle = "#2c5236";
    g.fillRect(0, top, W, h);
    const n = Math.floor((h * W) / 650);
    for (let i = 0; i < n; i += 1) {
      const x = rng() * W;
      const y = top + rng() * h;
      const c = rng();
      g.fillStyle = c < 0.4 ? "#264a30" : c < 0.75 ? "#34603f" : c < 0.97 ? "#3d6b48" : "#8a9a5a";
      g.fillRect(x, y, 2 + rng() * 3, 2 + rng() * 2);
    }
    for (let i = 0; i < n / 45; i += 1) {
      g.fillStyle = rng() < 0.5 ? "#d8d3a8" : "#c98fb0";
      disc(g, rng() * W, top + rng() * h, 1.5);
    }
  } else if (zone === "plaza") {
    g.fillStyle = "#6b675e";
    g.fillRect(0, top, W, h);
    const size = 36;
    for (let i = 0; i < 46; i += 1) {
      const tx = Math.floor((rng() * W) / size) * size;
      const ty = Math.floor((top + rng() * h) / size) * size;
      g.fillStyle = rng() < 0.5 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.07)";
      g.fillRect(tx + 1, ty + 1, size - 2, size - 2);
    }
    g.strokeStyle = "rgba(38,36,32,0.38)";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let x = 0; x <= W; x += size) {
      g.moveTo(x, top);
      g.lineTo(x, bottom);
    }
    for (let y = Math.ceil(top / size) * size; y <= bottom; y += size) {
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    g.stroke();
  } else if (zone === "hall") {
    const size = 60;
    for (let y = Math.floor(top / size) * size; y < bottom; y += size) {
      for (let x = 0; x < W; x += size) {
        g.fillStyle = (x / size + y / size) % 2 === 0 ? "#aba697" : "#9d988b";
        g.fillRect(x, y, size, size);
      }
    }
    g.strokeStyle = "rgba(255,255,255,0.05)";
    g.lineWidth = 14;
    g.beginPath();
    for (let x = -400; x < W + 400; x += 170) {
      g.moveTo(x, top);
      g.lineTo(x + h * 0.6, bottom);
    }
    g.stroke();
  } else if (zone === "tunnel") {
    g.fillStyle = "#4a5357";
    g.fillRect(0, top, W, h);
    g.strokeStyle = "rgba(0,0,0,0.2)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x += 30) {
      g.moveTo(x, top);
      g.lineTo(x, bottom);
    }
    for (let y = Math.ceil(top / 30) * 30; y <= bottom; y += 30) {
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    g.stroke();
    for (let i = 0; i < 20; i += 1) {
      g.fillStyle = "rgba(0,0,0,0.12)";
      oval(g, rng() * W, top + rng() * h, 6 + rng() * 14, 3 + rng() * 6);
    }
  } else {
    g.fillStyle = "#6c6f71";
    g.fillRect(0, top, W, h);
    g.strokeStyle = "rgba(0,0,0,0.16)";
    g.lineWidth = 1.5;
    g.beginPath();
    for (let x = 0; x <= W; x += 80) {
      g.moveTo(x, top);
      g.lineTo(x, bottom);
    }
    for (let y = Math.ceil(top / 80) * 80; y <= bottom; y += 80) {
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    g.stroke();
  }
}

function strokePath(g: CanvasRenderingContext2D, points: Array<[number, number]>, width: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.stroke();
}

function drawPaths(g: CanvasRenderingContext2D, level: Level, y0: number, y1: number) {
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const path of level.paths) strokePath(g, path.points, path.width + 10, "#3d392f");
  for (const ring of level.rings) {
    g.strokeStyle = "#3d392f";
    g.lineWidth = ring.width + 10;
    g.beginPath();
    g.arc(ring.x, ring.y, ring.r, 0, TAU);
    g.stroke();
  }
  for (const path of level.paths) strokePath(g, path.points, path.width, "#8a8370");
  for (const ring of level.rings) {
    g.strokeStyle = "#8a8370";
    g.lineWidth = ring.width;
    g.beginPath();
    g.arc(ring.x, ring.y, ring.r, 0, TAU);
    g.stroke();
  }
  for (const path of level.paths) strokePath(g, path.points, path.width * 0.5, "rgba(255,255,255,0.05)");
  const colors = ["#9c9582", "#6f6a5a", "#a8a18c", "#77715f"];
  level.paths.forEach((path, pi) => {
    const rng = mulberry32(500 + pi);
    for (let s = 0; s < path.points.length - 1; s += 1) {
      const [ax, ay] = path.points[s];
      const [bx, by] = path.points[s + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const count = Math.floor(len / 5);
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      const inRange = Math.max(ay, by) + 60 > y0 && Math.min(ay, by) - 60 < y1;
      for (let i = 0; i < count; i += 1) {
        const t = rng();
        const off = (rng() - 0.5) * path.width * 0.9;
        const c = colors[Math.floor(rng() * colors.length)];
        if (!inRange) continue;
        g.fillStyle = c;
        g.fillRect(ax + ux * len * t - uy * off, ay + uy * len * t + ux * off, 1.8, 1.8);
      }
    }
  });
  g.lineCap = "butt";
}

function drawDecal(g: CanvasRenderingContext2D, d: Decal) {
  g.textAlign = "center";
  g.textBaseline = "middle";
  switch (d.type) {
    case "stairs": {
      g.fillStyle = "#43484c";
      g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = "#565c61";
      if (d.dir === "up") {
        for (let y = d.y + 4; y < d.y + d.h; y += 11) g.fillRect(d.x, y, d.w, 4);
        g.fillStyle = "#d9a82a";
        g.fillRect(d.x, d.y, d.w, 5);
      } else {
        for (let x = d.x + 4; x < d.x + d.w; x += 11) g.fillRect(x, d.y, 4, d.h);
        g.fillStyle = "#d9a82a";
        g.fillRect(d.dir === "left" ? d.x : d.x + d.w - 5, d.y, 5, d.h);
      }
      if (d.text) {
        g.font = `800 13px ${FONT}`;
        const tw = g.measureText(d.text).width + 14;
        g.fillStyle = "rgba(10,14,18,0.8)";
        roundRect(g, d.x + d.w / 2 - tw / 2, d.y + d.h / 2 - 11, tw, 22, 4);
        g.fill();
        g.fillStyle = "#e9eef2";
        g.fillText(d.text, d.x + d.w / 2, d.y + d.h / 2 + 1);
      }
      break;
    }
    case "tactile":
      g.fillStyle = "#b8942c";
      g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = "#d8b444";
      if (d.w > d.h) {
        for (let x = d.x + 4; x < d.x + d.w; x += 8) disc(g, x, d.y + d.h / 2, 1.3);
      } else {
        for (let y = d.y + 4; y < d.y + d.h; y += 8) disc(g, d.x + d.w / 2, y, 1.3);
      }
      break;
    case "safety":
      g.fillStyle = "#e0b429";
      g.fillRect(d.x, d.y, d.w, d.h * 0.6);
      g.fillStyle = "#efefef";
      g.fillRect(d.x, d.y + d.h * 0.72, d.w, d.h * 0.28);
      break;
    case "emblem": {
      const r = d.w / 2;
      g.fillStyle = "#8c877b";
      disc(g, d.x, d.y, r);
      g.fillStyle = "#b3ad9f";
      disc(g, d.x, d.y, r * 0.88);
      g.fillStyle = "#7d786d";
      disc(g, d.x, d.y, r * 0.7);
      g.strokeStyle = "#b3ad9f";
      g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU;
        g.moveTo(d.x + Math.cos(a) * r * 0.3, d.y + Math.sin(a) * r * 0.3);
        g.lineTo(d.x + Math.cos(a) * r * 0.7, d.y + Math.sin(a) * r * 0.7);
      }
      g.stroke();
      g.fillStyle = "#c8c1b0";
      disc(g, d.x, d.y, r * 0.32);
      g.fillStyle = "#4a463f";
      g.font = `800 12px ${FONT}`;
      g.fillText(d.text ?? "", d.x, d.y + 1);
      break;
    }
    case "arrow":
      g.fillStyle = "rgba(255,255,255,0.26)";
      g.fillRect(d.x - 8, d.y - 12, 16, 40);
      g.beginPath();
      g.moveTo(d.x - 22, d.y - 10);
      g.lineTo(d.x + 22, d.y - 10);
      g.lineTo(d.x, d.y - 38);
      g.closePath();
      g.fill();
      if (d.text) {
        g.font = `800 13px ${FONT}`;
        g.fillText(d.text, d.x, d.y + 44);
      }
      break;
    case "text":
      g.fillStyle = d.color ?? "#ffffff";
      g.font = `800 ${d.size ?? 16}px ${FONT}`;
      g.fillText(d.text ?? "", d.x, d.y);
      break;
    case "puddle":
      g.fillStyle = "rgba(28,44,58,0.55)";
      oval(g, d.x, d.y, d.w / 2, d.h / 2);
      g.strokeStyle = "rgba(160,200,220,0.28)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(d.x - d.w * 0.1, d.y - d.h * 0.1, d.w * 0.3, d.h * 0.22, 0, Math.PI * 1.1, Math.PI * 1.8);
      g.stroke();
      break;
    case "manhole":
      g.fillStyle = "#2c2c2c";
      disc(g, d.x, d.y, d.w / 2);
      g.strokeStyle = "#454545";
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = -2; i <= 2; i += 1) {
        g.moveTo(d.x - d.w * 0.4, d.y + i * 4);
        g.lineTo(d.x + d.w * 0.4, d.y + i * 4);
      }
      g.stroke();
      break;
    case "flowerbed": {
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      g.fillStyle = "#3a2a1f";
      oval(g, cx, cy, d.w / 2, d.h / 2);
      const flowers = ["#d95a7a", "#e8d36a", "#e8e0f0", "#b07ad9"];
      for (let i = 0; i < 26; i += 1) {
        const fx = cx + (hash(i, d.x) - 0.5) * d.w * 0.82;
        const fy = cy + (hash(d.y, i) - 0.5) * d.h * 0.7;
        g.fillStyle = "#3d6b3f";
        disc(g, fx + 1.5, fy + 1.5, 2.4);
        g.fillStyle = flowers[i % flowers.length];
        disc(g, fx, fy, 2);
      }
      break;
    }
    case "paving":
      g.fillStyle = "#56534d";
      g.fillRect(d.x, d.y, d.w, d.h);
      g.strokeStyle = "rgba(0,0,0,0.25)";
      g.lineWidth = 1;
      g.beginPath();
      for (let x = Math.ceil(d.x / 30) * 30; x < d.x + d.w; x += 30) {
        g.moveTo(x, d.y);
        g.lineTo(x, d.y + d.h);
      }
      g.moveTo(d.x, d.y + d.h / 2);
      g.lineTo(d.x + d.w, d.y + d.h / 2);
      g.stroke();
      g.fillStyle = "#8a877f";
      g.fillRect(d.x, d.y, d.w, 4);
      break;
    case "doormat":
      g.fillStyle = "#2b2622";
      g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = "#3a332d";
      for (let x = d.x + 4; x < d.x + d.w; x += 8) g.fillRect(x, d.y + 3, 4, d.h - 6);
      break;
  }
}

const TREE_PAL = [
  ["#1d3b27", "#27502f", "#35663c", "#4b7d4a"],
  ["#223b2a", "#2d5236", "#3f6a45", "#5a8656"],
  ["#1b3524", "#284a31", "#3a5f3e", "#4f7a4d"],
];
const BUSH_PAL = [
  ["#2a4a2c", "#355c35", "#4a7442", "#6a9258"],
  ["#2d4630", "#3a5a3a", "#51734a", "#6f8f5c"],
  ["#27452f", "#33573a", "#476e45", "#628a55"],
];
const PRODUCTS = ["#e05a47", "#f2c14e", "#5fb0e8", "#8bd17c", "#f29bd0", "#f4f1e6", "#b58bf0"];
const glowParticles: Particle[] = [];

function drawObstacle(g: CanvasRenderingContext2D, o: Obstacle, level: Level) {
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (o.shape === "circle") {
    switch (o.type) {
      case "tree":
      case "bush": {
        const bush = o.type === "bush";
        const R = o.r * (bush ? 1.3 : 1.45);
        const pal = (bush ? BUSH_PAL : TREE_PAL)[o.variant % 3];
        g.fillStyle = "rgba(0,0,0,0.3)";
        oval(g, o.x + R * 0.18, o.y + R * 0.24, R * 1.02, R * 0.9);
        g.fillStyle = pal[0];
        disc(g, o.x, o.y, R);
        const lobes = bush ? 5 : 7;
        const seed = hash(o.x, o.y) * TAU;
        g.fillStyle = pal[1];
        for (let i = 0; i < lobes; i += 1) {
          const a = seed + (i / lobes) * TAU;
          disc(g, o.x + Math.cos(a) * R * 0.52, o.y + Math.sin(a) * R * 0.52, R * 0.46);
        }
        g.fillStyle = pal[2];
        disc(g, o.x - R * 0.2, o.y - R * 0.24, R * 0.46);
        g.fillStyle = pal[3];
        disc(g, o.x - R * 0.3, o.y - R * 0.34, R * 0.2);
        break;
      }
      case "lamp":
        g.fillStyle = "rgba(0,0,0,0.35)";
        disc(g, o.x + 2, o.y + 3, o.r + 1.5);
        g.fillStyle = "#2c3339";
        disc(g, o.x, o.y, o.r);
        g.fillStyle = "#4a545c";
        disc(g, o.x - 1.5, o.y - 1.5, o.r * 0.45);
        break;
      case "fountain":
        g.fillStyle = "rgba(0,0,0,0.3)";
        disc(g, o.x + 4, o.y + 6, o.r + 4);
        g.fillStyle = "#8f8a80";
        disc(g, o.x, o.y, o.r);
        g.fillStyle = "#6f6a61";
        disc(g, o.x, o.y, o.r * 0.9);
        g.fillStyle = "#24505a";
        disc(g, o.x, o.y, o.r * 0.84);
        g.strokeStyle = "rgba(170,220,230,0.25)";
        g.lineWidth = 1.5;
        for (const f of [0.35, 0.52, 0.7]) {
          g.beginPath();
          g.arc(o.x, o.y, o.r * f, 0, TAU);
          g.stroke();
        }
        g.fillStyle = "#6e7c78";
        disc(g, o.x, o.y, o.r * 0.24);
        g.fillStyle = "#93a49e";
        disc(g, o.x - 3, o.y - 3, o.r * 0.11);
        break;
      case "bin":
        g.fillStyle = "rgba(0,0,0,0.3)";
        disc(g, o.x + 2, o.y + 3, o.r);
        g.fillStyle = "#2e4a3a";
        disc(g, o.x, o.y, o.r);
        g.fillStyle = "#18271f";
        disc(g, o.x, o.y, o.r * 0.62);
        g.fillStyle = "#ddd5bd";
        g.fillRect(o.x - 2, o.y - 3, 5, 4);
        break;
      case "bollard":
        g.fillStyle = "rgba(0,0,0,0.3)";
        disc(g, o.x + 2, o.y + 3, o.r);
        g.fillStyle = "#26292c";
        disc(g, o.x, o.y, o.r);
        g.fillStyle = "#5a5f63";
        disc(g, o.x - 1.5, o.y - 1.5, o.r * 0.4);
        break;
      case "column":
        g.fillStyle = "rgba(0,0,0,0.25)";
        disc(g, o.x + 5, o.y + 6, o.r + 2);
        g.fillStyle = "#77746d";
        disc(g, o.x, o.y, o.r);
        g.fillStyle = "#8f8b83";
        disc(g, o.x, o.y, o.r * 0.8);
        g.fillStyle = "#a9a59c";
        disc(g, o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.33);
        g.strokeStyle = ["#d73c5b", "#2f6db4", "#c79a2a"][Math.floor(hash(o.x, o.y) * 3)];
        g.lineWidth = 4;
        g.beginPath();
        g.arc(o.x, o.y, o.r - 2, 0.3, 1.9);
        g.stroke();
        break;
      case "pillar":
        g.fillStyle = "rgba(0,0,0,0.3)";
        disc(g, o.x + 4, o.y + 5, o.r + 1);
        g.fillStyle = "#555d66";
        disc(g, o.x, o.y, o.r);
        g.fillStyle = "#7d8791";
        disc(g, o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.38);
        break;
      case "planter": {
        g.fillStyle = "rgba(0,0,0,0.3)";
        disc(g, o.x + 3, o.y + 4, o.r);
        g.fillStyle = "#6b4a35";
        disc(g, o.x, o.y, o.r);
        g.fillStyle = "#3a2a1e";
        disc(g, o.x, o.y, o.r * 0.8);
        g.fillStyle = "#3e6e3c";
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * TAU + o.variant;
          disc(g, o.x + Math.cos(a) * o.r * 0.38, o.y + Math.sin(a) * o.r * 0.38, o.r * 0.34);
        }
        g.fillStyle = ["#e46a8c", "#f0d25a", "#f2ecf8", "#b784e6"][o.variant % 4];
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * TAU + o.variant * 2;
          disc(g, o.x + Math.cos(a) * o.r * 0.45, o.y + Math.sin(a) * o.r * 0.45, 2.2);
        }
        break;
      }
      case "info":
        g.fillStyle = "rgba(0,0,0,0.3)";
        disc(g, o.x + 3, o.y + 4, o.r);
        g.fillStyle = "#1f5fa8";
        disc(g, o.x, o.y, o.r);
        g.fillStyle = "#ffffff";
        g.font = `800 ${Math.round(o.r * 1.2)}px ${FONT}`;
        g.fillText("i", o.x, o.y + 1);
        break;
      case "guard":
        break;
    }
    return;
  }
  drawRectObstacle(g, o, level);
}

function drawRectObstacle(g: CanvasRenderingContext2D, o: RectObstacle, level: Level) {
  switch (o.type) {
    case "wall": {
      g.fillStyle = "#20262a";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.strokeStyle = "rgba(255,255,255,0.035)";
      g.lineWidth = 1;
      g.beginPath();
      for (let x = Math.ceil(o.x / 26) * 26; x < o.x + o.w; x += 26) {
        g.moveTo(x, o.y);
        g.lineTo(x, o.y + o.h);
      }
      for (let y = Math.ceil(o.y / 26) * 26; y < o.y + o.h; y += 26) {
        g.moveTo(o.x, y);
        g.lineTo(o.x + o.w, y);
      }
      g.stroke();
      g.strokeStyle = "#5a6970";
      g.lineWidth = 3;
      g.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);
      if (o.h > 300) {
        const tags = ["NEMÁM!", "SOMR ZONE", "28 KORUN POZDĚJI", "BÉĎA 4EVER", "CÍGO?"];
        const tagColors = ["#ff5fa2", "#7ef0c8", "#ffd65a", "#9ab8ff", "#b6ff3b"];
        const idx = Math.floor(hash(o.x + 3, o.y) * tags.length);
        g.save();
        g.translate(o.x + o.w / 2, o.y + o.h / 2);
        g.rotate(-Math.PI / 2 + (hash(o.y, o.x) - 0.5) * 0.3);
        g.font = `800 28px ${FONT}`;
        g.globalAlpha = 0.5;
        g.fillStyle = tagColors[idx];
        g.fillText(tags[idx], 0, 0);
        g.restore();
      }
      break;
    }
    case "stairwall":
      g.fillStyle = "#383d41";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.strokeStyle = "rgba(255,255,255,0.04)";
      g.lineWidth = 2;
      g.beginPath();
      for (let x = o.x - o.h; x < o.x + o.w; x += 18) {
        g.moveTo(x, o.y + o.h);
        g.lineTo(x + o.h, o.y);
      }
      g.stroke();
      g.strokeStyle = "#565d62";
      g.lineWidth = 3;
      g.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);
      break;
    case "facade":
      g.fillStyle = "#b39c72";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = "#8f7a55";
      g.fillRect(o.x, o.y, o.w, 8);
      g.fillStyle = "#cdb88c";
      g.fillRect(o.x, o.y + o.h - 10, o.w, 10);
      for (let x = o.x + 12; x < o.x + o.w - 18; x += 28) {
        g.fillStyle = "#5e4f38";
        roundRect(g, x, o.y + 16, 16, 24, 7);
        g.fill();
        g.fillStyle = "rgba(255,206,120,0.6)";
        roundRect(g, x + 3, o.y + 20, 10, 17, 5);
        g.fill();
      }
      break;
    case "bench":
    case "benchV": {
      const horizontal = o.w >= o.h;
      g.fillStyle = "rgba(0,0,0,0.28)";
      g.fillRect(o.x + 3, o.y + 4, o.w, o.h);
      g.fillStyle = "#23272b";
      if (horizontal) {
        g.fillRect(o.x, o.y - 1, 4, o.h + 2);
        g.fillRect(o.x + o.w - 4, o.y - 1, 4, o.h + 2);
      } else {
        g.fillRect(o.x - 1, o.y, o.w + 2, 4);
        g.fillRect(o.x - 1, o.y + o.h - 4, o.w + 2, 4);
      }
      for (let i = 0; i < 3; i += 1) {
        g.fillStyle = i % 2 ? "#8c5f3c" : "#9e6d46";
        if (horizontal) g.fillRect(o.x + 3, o.y + (i * o.h) / 3 + 0.5, o.w - 6, o.h / 3 - 1.2);
        else g.fillRect(o.x + (i * o.w) / 3 + 0.5, o.y + 3, o.w / 3 - 1.2, o.h - 6);
      }
      break;
    }
    case "hedge":
      g.fillStyle = "rgba(0,0,0,0.3)";
      roundRect(g, o.x + 3, o.y + 5, o.w, o.h, 8);
      g.fill();
      g.fillStyle = "#23452b";
      roundRect(g, o.x, o.y, o.w, o.h, 8);
      g.fill();
      g.fillStyle = "#2f5a37";
      roundRect(g, o.x + 3, o.y + 2, o.w - 6, o.h * 0.55, 6);
      g.fill();
      g.fillStyle = "rgba(130,180,110,0.25)";
      for (let i = 0; i < o.w / 7; i += 1) disc(g, o.x + hash(i, o.y) * o.w, o.y + 3 + hash(o.x, i) * (o.h - 6), 1.5);
      break;
    case "kiosk":
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(o.x + 4, o.y + 6, o.w, o.h);
      for (let x = o.x; x < o.x + o.w; x += 12) {
        g.fillStyle = Math.floor((x - o.x) / 12) % 2 ? "#efe6d2" : (o.color ?? "#b8342c");
        g.fillRect(x, o.y, Math.min(12, o.x + o.w - x), o.h - 14);
      }
      g.fillStyle = "#6b4a35";
      g.fillRect(o.x - 3, o.y + o.h - 14, o.w + 6, 14);
      g.fillStyle = "#1a1512";
      roundRect(g, o.x + 12, o.y + 13, o.w - 24, 20, 3);
      g.fill();
      g.fillStyle = "#ffd65a";
      g.font = `800 14px ${FONT}`;
      g.fillText(o.label ?? "", o.x + o.w / 2, o.y + 24);
      break;
    case "shop": {
      g.fillStyle = "#23282d";
      g.fillRect(o.x, o.y, o.w, o.h);
      const aw = 18;
      const right = o.side === "right";
      const px0 = right ? o.x + 8 : o.x + aw + 8;
      const px1 = right ? o.x + o.w - aw - 8 : o.x + o.w - 8;
      const r = mulberry32(Math.floor(o.y * 7 + o.x));
      for (let y = o.y + 16; y < o.y + o.h - 8; y += 16) {
        g.fillStyle = "#3a4148";
        g.fillRect(px0, y, px1 - px0, 3);
        for (let x = px0 + 2; x < px1 - 4; x += 6) {
          if (r() < 0.8) {
            g.fillStyle = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
            g.fillRect(x, y - 7, 4, 7);
          }
        }
      }
      const ax = right ? o.x + o.w - aw : o.x;
      for (let y = o.y; y < o.y + o.h; y += 14) {
        g.fillStyle = Math.floor((y - o.y) / 14) % 2 ? "#efe6d2" : (o.color ?? "#888");
        g.fillRect(ax, y, aw, Math.min(14, o.y + o.h - y));
      }
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(right ? o.x + o.w : o.x - 8, o.y, 8, o.h);
      const pw = px1 - px0;
      g.fillStyle = "#0f1215";
      roundRect(g, px0, o.y + o.h / 2 - 15, pw, 30, 4);
      g.fill();
      g.strokeStyle = o.color ?? "#888";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = shade(o.color ?? "#888888", 0.35);
      g.font = `800 15px ${FONT}`;
      g.fillText(o.label ?? "", px0 + pw / 2, o.y + o.h / 2 + 1);
      break;
    }
    case "board": {
      g.fillStyle = "#15181c";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = "#07090b";
      g.fillRect(o.x + 8, o.y + 5, o.w - 16, o.h - 10);
      g.textAlign = "left";
      g.font = `800 10px ${FONT}`;
      g.fillStyle = "#ffd98a";
      g.fillText(o.label ?? "", o.x + 14, o.y + 13);
      const rows =
        o.label === "ODJEZDY"
          ? [
              ["R 1017", "BRNO", "00:17", "3"],
              ["Os 2517", "KOLÍN", "00:24", "1"],
            ]
          : [
              ["Ex 142", "OSTRAVA", "00:09", "5"],
              ["R 894", "PLZEŇ", "00:21", "2"],
            ];
      g.font = `700 10px ${FONT}`;
      g.fillStyle = "#ffb547";
      rows.forEach((row, i) => {
        const y = o.y + 25 + i * 11;
        g.fillText(row[0], o.x + 14, y);
        g.fillText(row[1], o.x + 64, y);
        g.fillText(row[2], o.x + 150, y);
        g.fillText(row[3], o.x + 196, y);
      });
      g.textAlign = "center";
      break;
    }
    case "machine":
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(o.x + 3, o.y + 4, o.w, o.h);
      g.fillStyle = "#b8322a";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = "#9fd0ff";
      g.fillRect(o.x + 5, o.y + 4, o.w - 10, 8);
      g.fillStyle = "#1a1a1a";
      g.fillRect(o.x + 8, o.y + o.h - 7, o.w - 16, 3);
      break;
    case "vending":
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(o.x + 3, o.y + 5, o.w, o.h);
      g.fillStyle = o.color ?? "#2d6aa8";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = "rgba(205,232,255,0.78)";
      g.fillRect(o.x + 5, o.y + 5, o.w - 10, o.h * 0.55);
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          g.fillStyle = PRODUCTS[(row * 3 + col + Math.floor(o.x)) % PRODUCTS.length];
          g.fillRect(o.x + 8 + col * ((o.w - 16) / 3), o.y + 9 + row * 9, 5, 6);
        }
      }
      g.fillStyle = "#ffffff";
      g.font = `800 8px ${FONT}`;
      g.fillText(o.label ?? "", o.x + o.w / 2, o.y + o.h - 10);
      break;
    case "train": {
      const car = 218;
      const period = 230;
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(o.x, o.y + o.h - 2, o.w, 10);
      for (let x = o.x + 6; x < o.x + o.w; x += period) {
        const w = Math.min(car, o.x + o.w - x);
        if (w <= 10) continue;
        g.fillStyle = "#c9ced4";
        roundRect(g, x, o.y, w, o.h, 10);
        g.fill();
        g.fillStyle = "#b3b9c0";
        g.fillRect(x + 8, o.y + 12, w - 16, o.h - 46);
        g.fillStyle = "#8d949c";
        for (let v = x + 26; v < x + w - 40; v += 58) g.fillRect(v, o.y + 22, 28, 10);
        g.fillStyle = "#1f3f73";
        g.fillRect(x, o.y + o.h - 31, w, 23);
        for (let wx = x + 12; wx < x + w - 22; wx += 30) {
          g.fillStyle = "#101a28";
          g.fillRect(wx, o.y + o.h - 28, 22, 16);
          g.fillStyle = "rgba(255,214,140,0.85)";
          g.fillRect(wx + 2, o.y + o.h - 26, 18, 12);
        }
        g.fillStyle = "#e8eaec";
        g.fillRect(x, o.y + o.h - 8, w, 8);
      }
      for (const goal of level.goals) {
        const dx = goal.x + goal.w / 2;
        g.fillStyle = "#e9c046";
        g.fillRect(dx - 25, o.y + o.h - 36, 50, 36);
        g.fillStyle = "#2b3a4a";
        g.fillRect(dx - 21, o.y + o.h - 32, 19, 32);
        g.fillRect(dx + 2, o.y + o.h - 32, 19, 32);
        g.fillStyle = "rgba(255,232,160,0.95)";
        g.fillRect(dx - 18, o.y + o.h - 28, 13, 12);
        g.fillRect(dx + 5, o.y + o.h - 28, 13, 12);
      }
      g.fillStyle = "rgba(38,50,72,0.6)";
      g.font = `800 18px ${FONT}`;
      for (const lx of [180, 640]) g.fillText(o.label ?? "", lx, o.y + 44);
      break;
    }
    case "tram": {
      g.fillStyle = "#26292c";
      g.fillRect(o.x, o.y + 6, o.w, 40);
      g.fillStyle = "#6b6f73";
      g.fillRect(o.x, o.y + 14, o.w, 3);
      g.fillRect(o.x, o.y + 36, o.w, 3);
      for (let x = -200; x < WORLD_W + 200; x += 300) {
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(x + 4, o.y + 6, 262, 46);
        g.fillStyle = "#c7162b";
        roundRect(g, x, o.y + 2, 262, 46, 12);
        g.fill();
        g.fillStyle = "#efe6d2";
        g.fillRect(x + 10, o.y + 13, 242, 14);
        g.fillStyle = "#3a3f44";
        g.fillRect(x + 112, o.y + 16, 40, 8);
        for (let wx = x + 16; wx < x + 246; wx += 26) {
          g.fillStyle = "#1a2230";
          g.fillRect(wx, o.y + 3, 18, 8);
          g.fillStyle = "rgba(255,220,150,0.85)";
          g.fillRect(wx + 2, o.y + 4, 14, 5);
        }
        g.fillStyle = "#ffffff";
        g.font = `800 14px ${FONT}`;
        g.fillText(o.label ?? "", x + 24, o.y + 37);
      }
      break;
    }
  }
}

/* ═════════════════════════ dynamic world ═════════════════════════ */

function drawGroundFx(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  now: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (const z of game.level.safeZones) {
    if (z.x + z.r < x0 || z.x - z.r > x1 || z.y + z.r < y0 || z.y - z.r > y1) continue;
    ctx.fillStyle = "rgba(90,160,255,0.08)";
    disc(ctx, z.x, z.y, z.r);
    ctx.strokeStyle = "rgba(130,190,255,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -now * 12;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(170,210,255,0.7)";
    ctx.font = `800 11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OCHRANKA · BEZPEČNO", z.x, z.y + z.r - 16);
  }
  for (const c of game.clouds) {
    if (c.x + c.r < x0 || c.x - c.r > x1 || c.y + c.r < y0 || c.y - c.r > y1) continue;
    const a = Math.min(1, c.life / 0.8) * 0.32;
    ctx.fillStyle = `rgba(140,195,70,${a})`;
    for (let i = 0; i < 4; i += 1) {
      const ang = c.seed + i * 1.7 + now * 0.6;
      disc(ctx, c.x + Math.cos(ang) * c.r * 0.35, c.y + Math.sin(ang) * c.r * 0.28, c.r * 0.62);
    }
  }
  for (const l of game.lures) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    oval(ctx, l.x, l.y + 2, 6, 3);
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, game: GameState, now: number, y0: number, y1: number) {
  for (const it of game.pickups) {
    if (it.y < y0 - 30 || it.y > y1 + 30) continue;
    const bob = Math.sin(it.bob * 4) * 3 + 6;
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    oval(ctx, it.x, it.y + 4, 8, 3.5);
    ctx.save();
    ctx.translate(it.x, it.y - bob);
    switch (it.kind) {
      case "coin": {
        ctx.scale(Math.abs(Math.cos(it.bob * 3)) * 0.75 + 0.25, 1);
        ctx.fillStyle = "#c98a1e";
        disc(ctx, 0, 0, 7.5);
        ctx.fillStyle = "#ffd65a";
        disc(ctx, 0, 0, 5.6);
        ctx.fillStyle = "#fff3c2";
        disc(ctx, -1.8, -1.8, 1.8);
        break;
      }
      case "bill":
        ctx.rotate(Math.sin(it.bob * 2) * 0.2);
        ctx.fillStyle = "#2f6f5c";
        ctx.fillRect(-12, -7, 24, 14);
        ctx.fillStyle = "#64b39a";
        ctx.fillRect(-10.5, -5.5, 21, 11);
        ctx.fillStyle = "#123a2f";
        ctx.font = `800 9px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("100", 0, 0.5);
        break;
      case "pack":
        ctx.rotate(Math.sin(it.bob * 2) * 0.15);
        ctx.fillStyle = "#f1ece2";
        ctx.fillRect(-6, -8, 12, 16);
        ctx.fillStyle = "#c8322b";
        ctx.fillRect(-6, -8, 12, 6);
        ctx.fillStyle = "#e0893a";
        ctx.fillRect(-3, -11, 2, 4);
        ctx.fillRect(1, -11, 2, 4);
        break;
      case "coffee":
        ctx.fillStyle = "#f4efe4";
        ctx.beginPath();
        ctx.moveTo(-6, -7);
        ctx.lineTo(6, -7);
        ctx.lineTo(4.5, 8);
        ctx.lineTo(-4.5, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#6b4028";
        ctx.fillRect(-7, -9, 14, 3);
        ctx.fillStyle = "#c98a3a";
        ctx.fillRect(-5, -1, 10, 4);
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = -1; i <= 1; i += 1) {
          const sx = i * 3.5;
          ctx.moveTo(sx, -11);
          ctx.quadraticCurveTo(sx + Math.sin(now * 5 + i) * 3, -15, sx, -19);
        }
        ctx.stroke();
        break;
      case "phones":
        ctx.strokeStyle = "#ff7ac4";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 2, 8, Math.PI, TAU);
        ctx.stroke();
        ctx.fillStyle = "#2b1d33";
        oval(ctx, -8, 3, 3.5, 5);
        oval(ctx, 8, 3, 3.5, 5);
        ctx.fillStyle = "#ff9ad5";
        oval(ctx, -8, 3, 2, 3.2);
        oval(ctx, 8, 3, 2, 3.2);
        break;
    }
    ctx.restore();
  }
}

const visible: Beggar[] = [];

function drawActors(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  now: number,
  guards: CircleObstacle[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (const g of game.pigeons) {
    if (!g.gone && g.state === "peck" && g.x > x0 && g.x < x1 && g.y > y0 && g.y < y1) drawPigeon(ctx, g, now);
  }
  for (const guard of guards) {
    if (guard.y > y0 && guard.y < y1) drawGuard(ctx, guard, now);
  }
  visible.length = 0;
  for (const b of game.beggars) {
    if (b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1) visible.push(b);
  }
  visible.sort((a, b) => a.y - b.y);
  const p = game.player;
  let playerDrawn = false;
  for (const b of visible) {
    if (!playerDrawn && b.y > p.y) {
      drawPlayer(ctx, p, now);
      playerDrawn = true;
    }
    drawBeggar(ctx, b, now);
  }
  if (!playerDrawn) drawPlayer(ctx, p, now);
  for (const g of game.pigeons) {
    if (!g.gone && g.state === "fly" && g.x > x0 && g.x < x1 && g.y > y0 && g.y < y1) drawPigeon(ctx, g, now);
  }
  for (const l of game.lures) drawLureCoin(ctx, l, now);
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, now: number) {
  if (p.alpha <= 0.01) return;
  const blink = p.invuln > 0 && Math.floor(now * 18) % 2 === 0;
  ctx.save();
  ctx.globalAlpha = p.alpha * (blink ? 0.4 : 1);
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  oval(ctx, 2, 5, 15, 10);
  if (p.phones > 0) {
    ctx.strokeStyle = `rgba(255,154,213,${0.4 + Math.sin(now * 10) * 0.15})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 23 + Math.sin(now * 6) * 2, 0, TAU);
    ctx.stroke();
  }
  if (p.coffee > 0) {
    ctx.strokeStyle = `rgba(255,179,71,${0.35 + Math.sin(now * 14) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, TAU);
    ctx.stroke();
  }
  ctx.rotate(p.facing + Math.PI / 2);
  const stride = p.moving ? Math.sin(p.walk * 2.2) * 6.5 : 0;
  const shout = p.shoutT > 0 ? Math.sin(((0.45 - p.shoutT) / 0.45) * Math.PI) * 0.22 : 0;
  ctx.scale(1 + shout, 1 - shout * 0.5);
  ctx.fillStyle = "#1a1d22";
  oval(ctx, -5.5, -stride + 1, 3.6, 5.5);
  oval(ctx, 5.5, stride + 1, 3.6, 5.5);
  ctx.fillStyle = "#2f5b73";
  roundRect(ctx, -9, 2, 18, 12, 4);
  ctx.fill();
  ctx.fillStyle = "#23475b";
  ctx.fillRect(-9, 6, 18, 2);
  ctx.fillStyle = "#c2402f";
  disc(ctx, -12, stride * 0.6, 4.3);
  disc(ctx, 12, -stride * 0.6, 4.3);
  ctx.fillStyle = p.hitFlash > 0 ? "#ffffff" : "#e8553f";
  oval(ctx, 0, 0, 12.5, 9);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  oval(ctx, -3, -3, 6, 3.4);
  ctx.fillStyle = "#11151b";
  roundRect(ctx, 9.5, -11 - stride * 0.4, 5, 8, 1.2);
  ctx.fill();
  ctx.fillStyle = "#e9f3ff";
  ctx.fillRect(10.3, -10.4 - stride * 0.4, 3.4, 2.2);
  ctx.fillStyle = "#e7bf98";
  disc(ctx, 0, -1, 7);
  ctx.fillStyle = "#2a2521";
  ctx.beginPath();
  ctx.arc(0, -1, 7.3, -0.15, Math.PI + 0.15);
  ctx.fill();
  ctx.fillStyle = "#d9a97f";
  disc(ctx, 0, -7.6, 1.6);
  ctx.restore();
}

function drawCart(ctx: CanvasRenderingContext2D, r: number) {
  ctx.save();
  ctx.translate(0, -r * 1.6);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(-r * 0.95 + 3, -r * 0.8 + 4, r * 1.9, r * 1.3);
  ctx.fillStyle = "rgba(170,180,190,0.18)";
  ctx.fillRect(-r * 0.95, -r * 0.8, r * 1.9, r * 1.3);
  ctx.fillStyle = "#d8d2c0";
  disc(ctx, -r * 0.35, -r * 0.2, r * 0.36);
  ctx.fillStyle = "#6b8fa8";
  disc(ctx, r * 0.35, -r * 0.35, r * 0.3);
  ctx.fillStyle = "#3f7a3a";
  ctx.fillRect(r * 0.1, r * 0.05, r * 0.5, r * 0.22);
  ctx.strokeStyle = "#aab2ba";
  ctx.lineWidth = 2;
  ctx.strokeRect(-r * 0.95, -r * 0.8, r * 1.9, r * 1.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 5; i += 1) {
    const x = -r * 0.95 + (i * r * 1.9) / 5;
    ctx.moveTo(x, -r * 0.8);
    ctx.lineTo(x, r * 0.5);
  }
  for (let i = 1; i < 3; i += 1) {
    const y = -r * 0.8 + (i * r * 1.3) / 3;
    ctx.moveTo(-r * 0.95, y);
    ctx.lineTo(r * 0.95, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "#c93a2c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, r * 0.62);
  ctx.lineTo(r * 0.95, r * 0.62);
  ctx.stroke();
  ctx.restore();
}

function drawBeggar(ctx: CanvasRenderingContext2D, b: Beggar, now: number) {
  const r = b.r;
  ctx.save();
  ctx.globalAlpha = b.alpha;
  ctx.translate(b.x, b.y);
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  oval(ctx, 2, r * 0.35, r * 1.1, r * 0.78);

  if (b.state === "sleep" || (b.state === "rise" && b.t > 0.28)) {
    ctx.rotate(b.lyingH ? 0 : Math.PI / 2);
    if (b.state === "rise") ctx.rotate(Math.sin(now * 40) * 0.08);
    ctx.fillStyle = b.coat;
    oval(ctx, 0, 0, r * 1.5, r * 0.72);
    ctx.save();
    ctx.rotate(0.08);
    ctx.fillStyle = "#d8d2c0";
    ctx.fillRect(-r * 1.0, -r * 0.62, r * 1.3, r * 1.15);
    ctx.fillStyle = "rgba(60,60,60,0.35)";
    for (let i = 0; i < 4; i += 1) ctx.fillRect(-r * 0.9, -r * 0.46 + i * r * 0.24, r * 1.0, r * 0.08);
    ctx.restore();
    ctx.fillStyle = b.skin;
    disc(ctx, r * 1.28, 0, r * 0.5);
    ctx.fillStyle = b.hat;
    ctx.beginPath();
    ctx.arc(r * 1.28, 0, r * 0.53, -Math.PI / 2, Math.PI / 2, true);
    ctx.fill();
    ctx.restore();
    return;
  }

  let scale = 1;
  if (b.state === "rise") scale = 0.82 + ((0.28 - b.t) / 0.28) * 0.18;
  else if (b.state === "windup") {
    ctx.translate(Math.sin(now * 70) * 1.6, 0);
    scale = b.kind === "boss" ? 0.95 : 0.88;
  } else if (b.state === "squat") scale = 0.86;
  ctx.rotate(b.facing + Math.PI / 2);
  ctx.scale(scale, scale);
  const moving = Math.hypot(b.vx, b.vy) > 10;
  const stride = moving
    ? Math.sin(b.anim * (b.state === "lunge" ? 22 : b.kind === "boss" ? 6 : 8)) * (b.kind === "boss" ? 7 : 5)
    : 0;
  if ((b.kind === "bedak" || b.kind === "smrad") && b.state === "chase") ctx.rotate(Math.sin(b.anim * 3.4 + b.id) * 0.14);

  ctx.fillStyle = "#2a241e";
  oval(ctx, -r * 0.42, -stride + 1, r * 0.26, r * 0.4);
  oval(ctx, r * 0.42, stride + 1, r * 0.26, r * 0.4);
  if (b.kind === "boss") drawCart(ctx, r);

  const reaching = b.state === "chase" || b.state === "windup" || b.state === "lunge" || b.state === "lured";
  const sleeve = shade(b.coat, -0.15);
  if (reaching && b.kind !== "boss") {
    for (const side of [-1, 1]) {
      const sway = side * stride * 0.3;
      ctx.fillStyle = sleeve;
      roundRect(ctx, side * r * 0.62 - r * 0.2, -r * 1.5 + sway, r * 0.4, r * 1.25, r * 0.2);
      ctx.fill();
      ctx.fillStyle = b.skin;
      disc(ctx, side * r * 0.62, -r * 1.5 + sway, r * 0.23);
    }
    if (b.kind === "bedak") {
      ctx.fillStyle = "#f2ede0";
      disc(ctx, r * 0.62, -r * 1.78 + stride * 0.3, r * 0.27);
      ctx.fillStyle = "#8a5a36";
      disc(ctx, r * 0.62, -r * 1.78 + stride * 0.3, r * 0.17);
    } else if (b.kind === "smrad") {
      ctx.fillStyle = "#c9a227";
      disc(ctx, r * 0.62, -r * 1.72, r * 0.2);
      ctx.fillStyle = "#6b8f2a";
      disc(ctx, r * 0.62, -r * 1.72, r * 0.12);
    }
  } else if (b.kind === "boss") {
    ctx.fillStyle = sleeve;
    roundRect(ctx, -r * 0.9, -r * 1.05, r * 0.36, r * 0.9, r * 0.16);
    ctx.fill();
    roundRect(ctx, r * 0.54, -r * 1.05, r * 0.36, r * 0.9, r * 0.16);
    ctx.fill();
    ctx.fillStyle = b.skin;
    disc(ctx, -r * 0.72, -r * 1.02, r * 0.18);
    disc(ctx, r * 0.72, -r * 1.02, r * 0.18);
  } else {
    ctx.fillStyle = sleeve;
    disc(ctx, -r * 0.95, stride * 0.5, r * 0.3);
    disc(ctx, r * 0.95, -stride * 0.5, r * 0.3);
  }

  ctx.fillStyle = b.flash > 0 ? "#ffffff" : b.coat;
  oval(ctx, 0, 0, r, r * 0.74);
  if (b.flash <= 0) {
    if (b.kind === "teplaky") {
      ctx.fillStyle = "#f2f2f2";
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k += 1) ctx.fillRect(side * (r * 0.6 + k * 2.2) - 0.6, -r * 0.45, 1.2, r * 0.9);
      }
    } else if (b.kind === "smrad") {
      ctx.fillStyle = "rgba(160,140,60,0.5)";
      disc(ctx, -r * 0.3, r * 0.1, r * 0.22);
      disc(ctx, r * 0.35, -r * 0.15, r * 0.16);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      oval(ctx, 0, r * 0.1, r * 0.55, r * 0.35);
    } else if (b.kind === "boss") {
      ctx.fillStyle = "#1f1916";
      ctx.fillRect(-r, -r * 0.05, r * 2, r * 0.14);
      ctx.fillStyle = "#5a4a3a";
      ctx.fillRect(-r * 0.6, r * 0.2, r * 0.35, r * 0.3);
    } else {
      ctx.fillStyle = shade(b.coat, 0.14);
      ctx.fillRect(-r * 0.5, -r * 0.1, r * 0.32, r * 0.3);
    }
  }

  const hr = r * (b.kind === "boss" ? 0.46 : 0.52);
  const hy = -r * 0.05;
  ctx.fillStyle = b.skin;
  disc(ctx, 0, hy, hr);
  if (b.beard) {
    ctx.fillStyle = "#6f675c";
    ctx.beginPath();
    ctx.arc(0, hy, hr * 1.02, Math.PI * 1.12, Math.PI * 1.88);
    ctx.lineTo(0, hy - hr * 0.1);
    ctx.fill();
  }
  if (b.hatType === 0) {
    ctx.fillStyle = b.hat;
    ctx.beginPath();
    ctx.arc(0, hy, hr * 1.06, -0.25, Math.PI + 0.25);
    ctx.fill();
    ctx.fillStyle = shade(b.hat, 0.3);
    disc(ctx, 0, hy + hr * 0.75, hr * 0.32);
  } else if (b.hatType === 1) {
    ctx.fillStyle = shade(b.coat, -0.25);
    ctx.beginPath();
    ctx.arc(0, hy, hr * 1.12, -0.1, Math.PI + 0.1);
    ctx.fill();
  } else {
    ctx.fillStyle = b.hat;
    disc(ctx, 0, hy + hr * 0.1, hr * 1.02);
    ctx.fillRect(-hr * 0.8, hy - hr * 1.45, hr * 1.6, hr * 0.7);
  }
  ctx.restore();
}

function drawGuard(ctx: CanvasRenderingContext2D, o: CircleObstacle, now: number) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  oval(ctx, 2, 5, 15, 10);
  ctx.rotate(Math.PI / 2 + Math.sin(now * 0.7) * 0.9 + Math.PI / 2);
  const breathe = 1 + Math.sin(now * 2.4) * 0.03;
  ctx.scale(breathe, breathe);
  ctx.fillStyle = "#16233a";
  disc(ctx, -12, 0, 4.4);
  disc(ctx, 12, 0, 4.4);
  ctx.fillStyle = "#1f3354";
  oval(ctx, 0, 0, 13, 9.5);
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(-11, -2, 5, 3);
  ctx.fillRect(6, -2, 5, 3);
  ctx.fillStyle = "#e0b894";
  disc(ctx, 0, -1, 7);
  ctx.fillStyle = "#152440";
  disc(ctx, 0, 0, 7.4);
  ctx.fillRect(-6, -10, 12, 5);
  ctx.fillStyle = "#c9a227";
  disc(ctx, 0, -2, 1.6);
  ctx.restore();
}

function drawPigeon(ctx: CanvasRenderingContext2D, g: Pigeon, now: number) {
  ctx.save();
  ctx.translate(g.x, g.y);
  if (g.state === "fly") {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    oval(ctx, 0, 0, 4, 2.5);
    ctx.translate(0, -g.z);
    const s = 1 + g.z / 120;
    ctx.scale(s, s);
  }
  ctx.rotate(g.facing + Math.PI / 2);
  if (g.state === "fly") {
    const flap = Math.sin(now * 32 + g.tone * 10);
    ctx.fillStyle = "#a3a9b0";
    oval(ctx, -5, 0, 6, 2.4, -0.3 - flap * 0.5);
    oval(ctx, 5, 0, 6, 2.4, 0.3 + flap * 0.5);
  }
  ctx.fillStyle = g.tone < 0.5 ? "#8d939b" : "#6f757d";
  oval(ctx, 0, 0, 3.4, 5.4);
  ctx.fillStyle = "#555a61";
  ctx.beginPath();
  ctx.moveTo(-2.4, 4);
  ctx.lineTo(2.4, 4);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4f7a6a";
  disc(ctx, 0, -3.2, 2.2);
  ctx.fillStyle = "#5e646c";
  disc(ctx, 0, -5 - (g.peck > 0 ? 1.6 : 0), 2.2);
  ctx.restore();
}

function drawLureCoin(ctx: CanvasRenderingContext2D, l: Lure, now: number) {
  ctx.save();
  ctx.translate(l.x, l.y - l.z - 3);
  if (!l.landed) ctx.scale(Math.abs(Math.cos(now * 22)) * 0.8 + 0.2, 1);
  ctx.fillStyle = "#c98a1e";
  disc(ctx, 0, 0, 5.5);
  ctx.fillStyle = "#ffd65a";
  disc(ctx, 0, 0, 4);
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const rr = i % 2 === 0 ? r : r * 0.4;
    const a = (i / 8) * TAU;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  ctx.fill();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  list: Particle[],
  glowPass: boolean,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  collectGlow?: Particle[],
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < list.length; i += 1) {
    const q = list[i];
    if (q.x < x0 - 30 || q.x > x1 + 30 || q.y < y0 - 60 || q.y > y1 + 60) continue;
    if (q.glow) {
      if (!glowPass) collectGlow?.push(q);
      continue;
    }
    if (glowPass) continue;
    const u = q.life / q.max;
    const y = q.y - q.z;
    switch (q.kind) {
      case "dust":
      case "smoke":
        ctx.globalAlpha = (q.kind === "smoke" ? 0.4 : 0.5) * u;
        ctx.fillStyle = q.color;
        disc(ctx, q.x, y, q.size * (1.6 - u * 0.6));
        break;
      case "coin":
        ctx.globalAlpha = Math.min(1, u * 2.5);
        ctx.save();
        ctx.translate(q.x, y);
        ctx.scale(Math.abs(Math.cos(q.rot)) * 0.8 + 0.2, 1);
        ctx.fillStyle = q.color;
        disc(ctx, 0, 0, q.size);
        ctx.fillStyle = "#b8860b";
        disc(ctx, 0, 0, q.size * 0.55);
        ctx.restore();
        break;
      case "cig":
        ctx.globalAlpha = Math.min(1, u * 2.5);
        ctx.save();
        ctx.translate(q.x, y);
        ctx.rotate(q.rot);
        ctx.fillStyle = "#f4efe4";
        ctx.fillRect(-q.size / 2, -1.3, q.size, 2.6);
        ctx.fillStyle = "#e0893a";
        ctx.fillRect(-q.size / 2, -1.3, q.size * 0.32, 2.6);
        ctx.restore();
        break;
      case "star":
        ctx.globalAlpha = u;
        ctx.fillStyle = q.color;
        drawStar(ctx, q.x, y, q.size * (0.5 + u * 0.5), q.rot);
        break;
      case "heart":
        ctx.globalAlpha = u;
        ctx.fillStyle = q.color;
        drawHeart(ctx, q.x, y, q.size);
        break;
      case "note":
        ctx.globalAlpha = u;
        ctx.fillStyle = q.color;
        ctx.font = `800 ${Math.round(q.size)}px ${FONT}`;
        ctx.fillText("♪", q.x, y);
        break;
      case "z":
        ctx.globalAlpha = Math.min(1, u * 1.5) * 0.85;
        ctx.fillStyle = q.color;
        ctx.font = `800 ${Math.round(q.size * (1.4 - u * 0.4))}px ${FONT}`;
        ctx.fillText("z", q.x, y);
        break;
      case "spark":
        ctx.globalAlpha = u;
        ctx.strokeStyle = q.color;
        ctx.lineWidth = q.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(q.x, y);
        ctx.lineTo(q.x - q.vx * 0.045, y - q.vy * 0.045);
        ctx.stroke();
        break;
      case "feather":
        ctx.globalAlpha = u;
        ctx.fillStyle = q.color;
        oval(ctx, q.x, y, q.size, q.size * 0.4, q.rot);
        break;
      case "seed":
        ctx.globalAlpha = u;
        ctx.fillStyle = q.color;
        oval(ctx, q.x, y, q.size, q.size * 0.6, q.rot);
        break;
      case "confetti":
        ctx.globalAlpha = Math.min(1, u * 2);
        ctx.save();
        ctx.translate(q.x, y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        ctx.restore();
        break;
      default:
        ctx.globalAlpha = u;
        ctx.fillStyle = q.color;
        disc(ctx, q.x, y, q.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGlowLayer(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  goals: Level["goals"],
  lights: LightSource[],
  now: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  ctx.globalCompositeOperation = "lighter";
  for (const light of lights) {
    if (!light.bulb || light.x < x0 - 10 || light.x > x1 + 10 || light.y < y0 - 10 || light.y > y1 + 10) continue;
    const a = lightLevel(light, now);
    ctx.fillStyle = light.tint === "cool" ? "#cfe8ff" : "#ffe2a8";
    ctx.globalAlpha = 0.9 * a;
    disc(ctx, light.x, light.y, 2.8);
    ctx.globalAlpha = 0.22 * a;
    disc(ctx, light.x, light.y, 9);
  }

  for (const b of game.beggars) {
    if (b.x < x0 - 30 || b.x > x1 + 30 || b.y < y0 - 30 || b.y > y1 + 30 || b.alpha < 0.3) continue;
    if (b.state === "sleep" || b.state === "happy" || b.state === "rise") continue;
    if (b.state === "stun") {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "#ffe27a";
      for (let i = 0; i < 3; i += 1) {
        const ang = now * 6 + (i * TAU) / 3;
        drawStar(ctx, b.x + Math.cos(ang) * b.r * 0.9, b.y - b.r * 1.1 + Math.sin(ang) * b.r * 0.35, 3.4, now * 4);
      }
      continue;
    }
    const f = b.facing;
    const fx = Math.cos(f);
    const fy = Math.sin(f);
    const hr = b.r * (b.kind === "boss" ? 0.46 : 0.52);
    const fwd = b.r * 0.05 + hr * 0.55;
    const color = b.state === "windup" || b.state === "lunge" ? "#ff4a3a" : b.state === "lured" ? "#ffd65a" : "#d7ff5a";
    for (const side of [-1, 1]) {
      const ex = b.x + fx * fwd - fy * hr * 0.38 * side;
      const ey = b.y + fy * fwd + fx * hr * 0.38 * side;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      disc(ctx, ex, ey, 1.5);
      ctx.globalAlpha = 0.3;
      disc(ctx, ex, ey, 4);
    }
  }

  if (y0 < 320) {
    for (const goal of goals) {
      const cx = goal.x + goal.w / 2;
      const pulse = 0.55 + Math.sin(now * 5) * 0.3;
      ctx.globalAlpha = pulse * 0.8;
      ctx.fillStyle = "#b6ff3b";
      ctx.fillRect(goal.x + 8, goal.y + 6, goal.w - 16, 5);
      ctx.strokeStyle = "#b6ff3b";
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k += 1) {
        const phase = (now * 28 + k * 16) % 48;
        const yy = goal.y + goal.h + 40 - phase;
        ctx.globalAlpha = Math.max(0, Math.min(1, phase / 16)) * (1 - phase / 48) * 0.9;
        ctx.beginPath();
        ctx.moveTo(cx - 10, yy + 6);
        ctx.lineTo(cx, yy - 2);
        ctx.lineTo(cx + 10, yy + 6);
        ctx.stroke();
      }
    }
  }

  for (const it of game.pickups) {
    if (it.y < y0 - 20 || it.y > y1 + 20 || it.x < x0 - 20 || it.x > x1 + 20) continue;
    const tw = (Math.sin(it.bob * 5) + 1) / 2;
    ctx.globalAlpha = 0.35 + tw * 0.5;
    ctx.fillStyle = it.kind === "phones" ? "#ff9ad5" : it.kind === "coffee" ? "#ffb347" : "#fff3c2";
    drawStar(ctx, it.x + 7, it.y - 14 - Math.sin(it.bob * 4) * 3, 2 + tw * 2.5, it.bob);
  }
  for (const l of game.lures) {
    ctx.globalAlpha = 0.5 + Math.sin(now * 12) * 0.2;
    ctx.fillStyle = "#ffd65a";
    disc(ctx, l.x, l.y - l.z - 3, 8);
  }

  ctx.globalCompositeOperation = "source-over";
  for (const b of game.beggars) {
    if (b.state !== "windup") continue;
    const len = b.kind === "boss" ? 230 : 200;
    ctx.globalAlpha = 0.5 + Math.sin(now * 30) * 0.25;
    ctx.strokeStyle = "#ff4a3a";
    ctx.lineWidth = b.kind === "boss" ? 5 : 3;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -now * 80;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + b.lungeX * len, b.y + b.lungeY * len);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const r of game.rings) {
    const u = 1 - r.life / r.max;
    const eased = 1 - (1 - u) * (1 - u);
    ctx.globalAlpha = (1 - u) * 0.9;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (1 - u * 0.6);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * eased, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawParticles(ctx, game.particles, true, x0, y0, x1, y1);
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, value: string, alpha: number, bg: string, ui: number) {
  const size = Math.round(13 * ui);
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(value).width + 14 * ui;
  const h = size + 10 * ui;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bg;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 6 * ui);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 5 * ui, y + h / 2 - 1);
  ctx.lineTo(x + 3 * ui, y + h / 2 - 1);
  ctx.lineTo(x - 3 * ui, y + h / 2 + 7 * ui);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1c1712";
  ctx.fillText(value, x, y + 1);
}

function drawScreenLabels(ctx: CanvasRenderingContext2D, game: GameState, s: number, W: number, H: number) {
  const cam = game.cam;
  const ui = clamp(Math.min(W, H) / 700, 0.85, 1.25);
  const toX = (x: number) => (x - cam.x) * s;
  const toY = (y: number) => (y - cam.y) * s;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let shown = 0;
  for (const b of game.beggars) {
    if (b.bubbleT <= 0 || !b.bubble) continue;
    const bx = toX(b.x);
    const by = toY(b.y) - (b.r * 1.5 + 14) * s - 12 * ui;
    if (bx < -80 || bx > W + 80 || by < -40 || by > H + 40) continue;
    if (shown >= 7) break;
    shown += 1;
    drawBubble(ctx, bx, by, b.bubble, Math.min(1, b.bubbleT * 4) * b.alpha, b.kind === "boss" ? "#ffd9d2" : "#f6f0e1", ui);
  }

  for (const b of game.beggars) {
    if (b.alert <= 0) continue;
    const ax = toX(b.x);
    const ay = toY(b.y) - (b.r * 1.5 + 30) * s - 14 * ui;
    if (ax < -40 || ax > W + 40 || ay < -40 || ay > H + 40) continue;
    const age = 0.9 - b.alert;
    const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.8 : 1.4 - Math.min(0.4, (age - 0.15) * 1.5);
    ctx.globalAlpha = Math.min(1, b.alert * 3);
    ctx.font = `800 ${Math.round(24 * ui * pop)}px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#1a0f0a";
    ctx.strokeText("!", ax, ay);
    ctx.fillStyle = b.state === "lured" ? "#ffd65a" : "#ff4a3a";
    ctx.fillText("!", ax, ay);
  }
  ctx.globalAlpha = 1;

  for (const b of game.beggars) {
    if (b.kind !== "boss" || b.state === "idle" || b.alpha < 0.5) continue;
    const bx = toX(b.x);
    const by = toY(b.y) + (b.r + 16) * s;
    if (bx < -80 || bx > W + 80 || by < -40 || by > H + 40) continue;
    ctx.font = `800 ${Math.round(11 * ui)}px ${FONT}`;
    const tw = ctx.measureText("VELKEJ BÉĎA").width + 12;
    ctx.fillStyle = "rgba(160,20,24,0.9)";
    roundRect(ctx, bx - tw / 2, by - 9 * ui, tw, 18 * ui, 4);
    ctx.fill();
    ctx.fillStyle = "#fff0e0";
    ctx.fillText("VELKEJ BÉĎA", bx, by + 1);
  }

  for (const t of game.texts) {
    const u = t.life / t.max;
    const age = t.max - t.life;
    const pop = age < 0.12 ? 1.55 - (age / 0.12) * 0.55 : 1;
    const tx = toX(t.x);
    const ty = toY(t.y) - t.z * s;
    const size = Math.round(t.size * ui * pop);
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.globalAlpha = Math.min(1, u * 2.5);
    ctx.lineWidth = Math.max(3, size * 0.22);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(10,8,12,0.88)";
    ctx.strokeText(t.text, tx, ty);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, tx, ty);
  }
  ctx.globalAlpha = 1;

  const p = game.player;
  for (const b of game.beggars) {
    if (!(b.state === "chase" || b.state === "windup" || b.state === "lunge")) continue;
    const bx = toX(b.x);
    const by = toY(b.y);
    if (bx > -12 && bx < W + 12 && by > -12 && by < H + 12) continue;
    const dist = Math.hypot(b.x - p.x, b.y - p.y);
    if (dist > 540) continue;
    const ang = Math.atan2(by - H / 2, bx - W / 2);
    const ex = clamp(bx, 20, W - 20);
    const ey = clamp(by, 96, H - 20);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.9 * (1 - dist / 580);
    ctx.fillStyle = b.kind === "boss" ? "#ff2a2a" : "#ff6a3c";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawScreenFx(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  phase: Phase,
  W: number,
  H: number,
  now: number,
  vignette: HTMLCanvasElement,
  redVignette: HTMLCanvasElement,
) {
  ctx.globalAlpha = 1;
  ctx.drawImage(vignette, -W * 0.08, -H * 0.08, W * 1.16, H * 1.16);
  const low = game.money - MIN_CASH <= 30 || game.cigs - MIN_CIGS <= 1;
  if (phase === "playing" && low && !game.ending) {
    const beat = Math.pow(Math.max(0, Math.sin(now * 5.2)), 12);
    ctx.globalAlpha = 0.22 + beat * 0.45;
    ctx.drawImage(redVignette, 0, 0, W, H);
  }
  if (game.flashRed > 0) {
    ctx.globalAlpha = Math.min(1, game.flashRed * 1.5);
    ctx.drawImage(redVignette, 0, 0, W, H);
    ctx.globalAlpha = game.flashRed * 0.16;
    ctx.fillStyle = "#ff2a1a";
    ctx.fillRect(0, 0, W, H);
  }
  if (game.player.stink > 0) {
    ctx.globalAlpha = 0.15 + Math.sin(now * 4) * 0.04;
    ctx.fillStyle = "#7fbf3a";
    ctx.fillRect(0, 0, W, H);
  }
  if (game.flashGold > 0) {
    ctx.globalAlpha = game.flashGold * 0.32;
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}
