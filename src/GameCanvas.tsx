import { memo, useEffect, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import type { Sfx } from "./game/audio";
import {
  getLevel,
  hudSnapshot,
  tick,
  tickAftermath,
  tickAmbient,
  type GameState,
  type HudSnapshot,
  type Phase,
} from "./game/engine";
import { Renderer } from "./game/render";

export interface GameActions {
  start: () => void;
  restart: () => void;
  togglePause: () => void;
  toMenu: () => void;
  shove: () => void;
  lure: (x?: number, y?: number) => void;
  toggleMute: () => void;
  touch: () => void;
}

interface GameCanvasProps {
  gameRef: MutableRefObject<GameState>;
  phaseRef: MutableRefObject<Phase>;
  actionsRef: MutableRefObject<GameActions>;
  sfx: Sfx;
  onEnd: (phase: "over" | "won") => void;
  onHud: (hud: HudSnapshot) => void;
  onFrame: (game: GameState) => void;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

const JOY_MAX = 52;
const JOY_DEAD = 6;

function GameCanvas({ gameRef, phaseRef, actionsRef, sfx, onEnd, onHud, onFrame }: GameCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const joy = useRef({ id: -1, ox: 0, oy: 0, vx: 0, vy: 0, active: false });
  const callbacks = useRef({ onEnd, onHud, onFrame });
  callbacks.current = { onEnd, onHud, onFrame };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    const renderer = new Renderer(ctx, getLevel());
    rendererRef.current = renderer;
    const keys = new Set<string>();
    let raf = 0;
    let last = 0;
    let lastHud = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      renderer.resize(rect.width, rect.height, dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const onFontsLoaded = () => renderer.invalidate();
    document.fonts?.ready.then(onFontsLoaded).catch(() => undefined);
    document.fonts?.addEventListener?.("loadingdone", onFontsLoaded);

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const game = gameRef.current;
      const phase = phaseRef.current;
      game.viewW = renderer.viewW;
      game.viewH = renderer.viewH;

      let mx = 0;
      let my = 0;
      for (const code of keys) {
        const v = MOVE_KEYS[code];
        if (v) {
          mx += v[0];
          my += v[1];
        }
      }
      const len = Math.hypot(mx, my);
      if (len > 1) {
        mx /= len;
        my /= len;
      }
      if (joy.current.active) {
        mx += joy.current.vx;
        my += joy.current.vy;
      }
      game.input.mx = mx;
      game.input.my = my;

      if (phase === "playing") {
        const outcome = tick(game, dt);
        if (outcome === "over" || outcome === "won") callbacks.current.onEnd(outcome);
      } else if (phase === "title") {
        tickAmbient(game, dt);
      } else if (phase === "over" || phase === "won") {
        tickAftermath(game, dt);
      }
      if (game.events.length) {
        for (const e of game.events) sfx.play(e);
        game.events.length = 0;
      }
      renderer.render(game, phaseRef.current, now / 1000);
      callbacks.current.onFrame(game);
      if (now - lastHud > 80) {
        lastHud = now;
        callbacks.current.onHud(hudSnapshot(game));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const tag = target?.tagName;
      const a = actionsRef.current;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.code === "Enter" || e.code === "NumpadEnter") {
          e.preventDefault();
          sfx.unlock();
          target?.blur();
          a.start();
        }
        return;
      }
      if (tag === "BUTTON" && (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")) return;
      sfx.unlock();
      const phase = phaseRef.current;
      if (MOVE_KEYS[e.code]) {
        keys.add(e.code);
        if (phase === "playing") e.preventDefault();
        return;
      }
      if (e.repeat) {
        if (e.code === "Space") e.preventDefault();
        return;
      }
      switch (e.code) {
        case "Space":
        case "KeyJ":
          e.preventDefault();
          if (phase === "playing") a.shove();
          else if (phase === "title") a.start();
          break;
        case "KeyE":
        case "KeyK":
        case "ShiftLeft":
        case "ShiftRight":
          if (phase === "playing") {
            e.preventDefault();
            a.lure();
          }
          break;
        case "KeyP":
        case "Escape":
          if (phase === "playing" || phase === "paused") {
            e.preventDefault();
            a.togglePause();
          }
          break;
        case "Enter":
        case "NumpadEnter":
          e.preventDefault();
          if (phase === "title") a.start();
          else if (phase === "paused") a.togglePause();
          else if (phase === "over" || phase === "won") a.restart();
          break;
        case "KeyR":
          if (phase === "over" || phase === "won" || phase === "paused") {
            e.preventDefault();
            a.restart();
          }
          break;
        case "KeyM":
          a.toggleMute();
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };
    const onBlur = () => keys.clear();
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === "playing") actionsRef.current.togglePause();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.fonts?.removeEventListener?.("loadingdone", onFontsLoaded);
      renderer.invalidate();
      rendererRef.current = null;
    };
  }, [actionsRef, gameRef, phaseRef, sfx]);

  const placeBase = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const base = baseRef.current;
    if (!stage || !base) return;
    const rect = stage.getBoundingClientRect();
    base.style.left = `${clientX - rect.left}px`;
    base.style.top = `${clientY - rect.top}px`;
  };

  const setKnob = (dx: number, dy: number, show: boolean) => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;
    base.style.opacity = show ? "1" : "0";
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    sfx.unlock();
    if (e.pointerType === "mouse") {
      if (e.button !== 0 || phaseRef.current !== "playing") return;
      const renderer = rendererRef.current;
      const stage = stageRef.current;
      if (!renderer || !stage) return;
      const rect = stage.getBoundingClientRect();
      const world = renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top, gameRef.current);
      actionsRef.current.lure(world.x, world.y);
      return;
    }
    actionsRef.current.touch();
    if (phaseRef.current !== "playing") return;
    const j = joy.current;
    if (j.active) return;
    j.active = true;
    j.id = e.pointerId;
    j.ox = e.clientX;
    j.oy = e.clientY;
    j.vx = 0;
    j.vy = 0;
    placeBase(e.clientX, e.clientY);
    setKnob(0, 0, true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const j = joy.current;
    if (!j.active || e.pointerId !== j.id) return;
    let dx = e.clientX - j.ox;
    let dy = e.clientY - j.oy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_MAX) {
      const over = len - JOY_MAX;
      j.ox += (dx / len) * over;
      j.oy += (dy / len) * over;
      dx = e.clientX - j.ox;
      dy = e.clientY - j.oy;
      placeBase(j.ox, j.oy);
    }
    const l = Math.hypot(dx, dy);
    if (l < JOY_DEAD) {
      j.vx = 0;
      j.vy = 0;
    } else {
      const m = Math.min(1, (l - JOY_DEAD) / ((JOY_MAX - JOY_DEAD) * 0.7));
      j.vx = (dx / l) * m;
      j.vy = (dy / l) * m;
    }
    setKnob(dx, dy, true);
  };

  const endJoy = (e: ReactPointerEvent<HTMLDivElement>) => {
    const j = joy.current;
    if (e.pointerId !== j.id) return;
    j.active = false;
    j.id = -1;
    j.vx = 0;
    j.vy = 0;
    setKnob(0, 0, false);
  };

  return (
    <div
      ref={stageRef}
      className="stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endJoy}
      onPointerCancel={endJoy}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        aria-label="Noc živých somráků: shora viděný park, hala a podchod pražského hlavního nádraží plný somráků."
      />
      <div ref={baseRef} className="joy-base" aria-hidden="true">
        <div ref={knobRef} className="joy-knob" />
      </div>
    </div>
  );
}

export default memo(GameCanvas);
