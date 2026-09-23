import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import GameCanvas, { type GameActions } from "./GameCanvas";
import { Sfx } from "./game/audio";
import { LURE_COOLDOWN, LURE_COST, MIN_CASH, MIN_CIGS, SHOVE_COOLDOWN, START_CASH, START_CIGS } from "./game/constants";
import {
  beginRun,
  createGame,
  doShove,
  hudSnapshot,
  runSummary,
  throwLure,
  type EndReason,
  type GameState,
  type HudSnapshot,
  type Phase,
  type RunSummary,
} from "./game/engine";

const SCORE_KEY = "hlavak-somraci-scores-v1";
const NAME_KEY = "hlavak-somraci-name";
const MUTE_KEY = "hlavak-somraci-muted";

interface ScoreRecord {
  name: string;
  score: number;
  won: boolean;
  reason: EndReason;
  at: string;
}

interface ResultState extends RunSummary {
  rank: number;
  title: string;
  name: string;
}

type BeggarAvatar = "bedak" | "teplaky" | "smrad" | "boss";

function storageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable (private mode) — the game still runs.
  }
}

function loadRecords(): ScoreRecord[] {
  const raw = storageGet(SCORE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is ScoreRecord =>
          typeof r === "object" &&
          r !== null &&
          typeof (r as ScoreRecord).score === "number" &&
          typeof (r as ScoreRecord).name === "string" &&
          typeof (r as ScoreRecord).at === "string",
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch {
    return [];
  }
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function formatTime(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatScore(n: number) {
  return Math.max(0, Math.floor(n)).toLocaleString("cs-CZ");
}

function reasonShort(reason: EndReason) {
  if (reason === "won") return "VLAK ✓";
  if (reason === "time") return "UJEL";
  if (reason === "cigs") return "BEZ CÍG";
  return "BEZ KAČEK";
}

function rankTitle(summary: RunSummary) {
  if (!summary.won) {
    if (summary.reason === "time") return "Věčný čekatel na nástupišti";
    if (summary.progress > 0.72) return "Skoro cestující";
    if (summary.progress > 0.35) return "Oběť odbavovací haly";
    return "Nováček z tramvaje";
  }
  if (summary.score >= 5200) return "Král Hlaváku";
  if (summary.score >= 4200) return "Sherwoodský ninja";
  if (summary.score >= 3200) return "Ostřílený dojížděč";
  return "Turista s batůžkem";
}

/* ───────────────────────── small components ───────────────────────── */

function Avatar({ kind }: { kind: BeggarAvatar }) {
  const coat = kind === "teplaky" ? "#2346a0" : kind === "smrad" ? "#d9d2b4" : kind === "boss" ? "#3a2f2b" : "#6b5842";
  const hat = kind === "teplaky" ? "#1b1b1f" : kind === "boss" ? "#26211e" : "#9a3a32";
  const r = kind === "boss" ? 15 : kind === "smrad" ? 14 : 11;
  return (
    <svg viewBox="0 0 48 48" className="avatar" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#0f151c" stroke="rgba(255,255,255,0.1)" />
      {kind === "boss" && <rect x="11" y="3" width="26" height="12" rx="2" fill="none" stroke="#aab2ba" strokeWidth="1.6" />}
      {kind !== "boss" && (
        <>
          <rect x={24 - r * 0.8} y="8" width="5" height="15" rx="2.5" fill={coat} opacity="0.85" />
          <rect x={24 + r * 0.8 - 5} y="8" width="5" height="15" rx="2.5" fill={coat} opacity="0.85" />
          {kind === "bedak" && <circle cx={24 + r * 0.8 - 2.5} cy="8" r="3.2" fill="#f2ede0" />}
        </>
      )}
      <ellipse cx="24" cy="29" rx={r} ry={r * 0.74} fill={coat} />
      {kind === "teplaky" && (
        <g stroke="#f2f2f2" strokeWidth="1">
          <line x1="15" y1="25" x2="15" y2="33" />
          <line x1="17" y1="25" x2="17" y2="33" />
          <line x1="31" y1="25" x2="31" y2="33" />
          <line x1="33" y1="25" x2="33" y2="33" />
        </g>
      )}
      <circle cx="24" cy="26" r={kind === "boss" ? 7 : 6.2} fill="#b3a98c" />
      <path d={`M${24 - 6.6} 27 A6.6 6.6 0 0 1 ${24 + 6.6} 27 L${24 + 6.6} 30 L${24 - 6.6} 30 Z`} fill={hat} transform="rotate(180 24 27)" />
      <circle cx="21.4" cy="23.6" r="1.5" fill="#d7ff5a" />
      <circle cx="26.6" cy="23.6" r="1.5" fill="#d7ff5a" />
      {kind === "smrad" && (
        <g fill="#9bc25a" opacity="0.7">
          <circle cx="38" cy="14" r="3" />
          <circle cx="41" cy="20" r="2" />
        </g>
      )}
    </svg>
  );
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - start) / 950);
      setShown(Math.round(value * (1 - Math.pow(1 - u, 3))));
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{formatScore(shown)}</>;
}

function Scoreboard({ records, highlight = -1, compact = false }: { records: ScoreRecord[]; highlight?: number; compact?: boolean }) {
  return (
    <section className={`card scoreboard ${compact ? "is-compact" : ""}`} aria-label="Místní síň slávy">
      <h2>
        SÍŇ SLÁVY <span>TOP 8 · TENHLE PROHLÍŽEČ</span>
      </h2>
      {records.length === 0 ? (
        <p className="empty">Zatím nikdo. Buď první, kdo to stihne.</p>
      ) : (
        <ol>
          {records.map((r, i) => (
            <li key={`${r.at}-${i}`} className={i === highlight ? "is-new" : ""}>
              <span className="rank">{i + 1}.</span>
              <span className="who">{r.name}</span>
              <span className={`badge ${r.won ? "ok" : "ko"}`}>{reasonShort(r.reason)}</span>
              <b>{formatScore(r.score)}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CigRow({ cigs }: { cigs: number }) {
  const shown = Math.min(cigs, 12);
  return (
    <div className="cig-row" aria-label={`${cigs} cigaret, minimum ${MIN_CIGS}`}>
      {Array.from({ length: shown }, (_, i) => (
        <i key={i} className={i < MIN_CIGS ? "cig is-reserve" : "cig"} />
      ))}
      {cigs > 12 && <em>+{cigs - 12}</em>}
      {cigs === 0 && <em>0</em>}
    </div>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14M16 5v14" />
    </svg>
  );
}

const preventFocus = (e: { preventDefault: () => void }) => e.preventDefault();

/* ───────────────────────── HUD ───────────────────────── */

function Hud({
  hud,
  muted,
  onPause,
  onMute,
}: {
  hud: HudSnapshot;
  muted: boolean;
  onPause: () => void;
  onMute: () => void;
}) {
  const buffer = clamp((hud.money - MIN_CASH) / (START_CASH - MIN_CASH), 0, 1);
  const cashDanger = hud.money - MIN_CASH <= 30;
  const cigDanger = hud.cigs - MIN_CIGS <= 1;
  return (
    <div className="hud">
      <div className="hud-left">
        <div className={`hud-card pocket ${cashDanger ? "is-danger" : ""}`}>
          <div className="pocket-row">
            <span className="hud-label">KAPSA</span>
            <strong key={hud.money} className="bump">
              {hud.money}
              <small> Kč</small>
            </strong>
          </div>
          <div className="cash-bar">
            <span className={hud.money > START_CASH ? "is-over" : ""} style={{ width: `${buffer * 100}%` }} />
          </div>
          <div className="hud-sub">LÍSTEK {MIN_CASH} Kč · NESAHAT</div>
        </div>
        <div className={`hud-card cigs ${cigDanger ? "is-danger" : ""}`}>
          <div className="pocket-row">
            <span className="hud-label">CÍGA</span>
            <strong key={hud.cigs} className="bump small">
              {hud.cigs}
            </strong>
          </div>
          <CigRow cigs={hud.cigs} />
        </div>
        <div className="buffs">
          {hud.coffee > 0 && <span className="buff coffee">KAFE {Math.ceil(hud.coffee)}s</span>}
          {hud.phones > 0 && <span className="buff phones">SLUCHÁTKA {Math.ceil(hud.phones)}s</span>}
          {hud.stink && <span className="buff stink">SMRAD! POMALU</span>}
        </div>
      </div>

      <div className="hud-center">
        <div className={`clock ${hud.timeLeft <= 20 ? "is-urgent" : ""}`}>
          <span>ODJEZD 00:17</span>
          <strong>{formatTime(hud.timeLeft)}</strong>
        </div>
        <div className="route">
          <div className="route-track">
            <span style={{ width: `${hud.progress * 100}%` }} />
            {[0.25, 0.5, 0.75].map((m) => (
              <i key={m} style={{ left: `${m * 100}%` }} />
            ))}
          </div>
          <div className="route-label">
            {hud.chapter} · {hud.zoneName}
          </div>
        </div>
      </div>

      <div className="hud-right">
        <div className="hud-buttons">
          <button type="button" className="icon-btn" onMouseDown={preventFocus} onClick={onMute} aria-label={muted ? "Zapnout zvuk" : "Vypnout zvuk"}>
            <SpeakerIcon muted={muted} />
          </button>
          <button type="button" className="icon-btn" onMouseDown={preventFocus} onClick={onPause} aria-label="Pauza">
            <PauseIcon />
          </button>
        </div>
        <div className="score">
          <span>SKÓRE</span>
          <strong>{formatScore(hud.score)}</strong>
          {hud.combo > 1 && (
            <em key={hud.combo} className="combo">
              COMBO ×{Math.min(8, hud.combo)}
            </em>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── overlays ───────────────────────── */

function TitleScreen({
  records,
  name,
  touchUI,
  onName,
  onStart,
}: {
  records: ScoreRecord[];
  name: string;
  touchUI: boolean;
  onName: (value: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="overlay overlay-title">
      <div className="title-wrap">
        <div className="title-main-col">
          <p className="title-kicker">
            <i /> PRAHA HLAVNÍ NÁDRAŽÍ · 00:15 · POSLEDNÍ VLAK JEDE V 00:17
          </p>
          <h1 className="title-logo">
            <span className="logo-top">NOC ŽIVÝCH</span>
            <span className="logo-main">SOMRÁKŮ</span>
          </h1>
          <p className="title-tagline">Nechtějí tvůj mozek. Chtějí tvoje drobný.</p>

          <div className="title-actions">
            <label className="name-field">
              <span>PŘEZDÍVKA</span>
              <input
                value={name}
                maxLength={14}
                placeholder="ANONYM"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => onName(e.target.value.toUpperCase())}
              />
            </label>
            <button type="button" className="btn btn-primary btn-play" onClick={onStart}>
              HRÁT {!touchUI && <kbd>ENTER</kbd>}
            </button>
          </div>

          <section className="card mission">
            <h2>MISE</h2>
            <p>
              Proběhni <b>Sherwoodem</b>, halou a podchodem až k vlaku na <b>nástupišti 3</b>. Somráci se probouzejí, šourají se
              za tebou a somrují.
            </p>
            <div className="rule">
              <span className="rule-num">{MIN_CASH} Kč</span>
              <span className="rule-plus">+</span>
              <span className="rule-num">{MIN_CIGS} CÍGA</span>
            </div>
            <p className="rule-note">
              Začínáš s {START_CASH} Kč a {START_CIGS} cígy. O pár tě stáhnout můžou — ale pod limit nesmíš. Jinak si lístek
              nekoupíš.
            </p>
          </section>
        </div>

        <div className="title-side-col">
          <section className="card controls">
            <h2>OVLÁDÁNÍ</h2>
            {touchUI ? (
              <ul className="control-list">
                <li>
                  <kbd>PRST</kbd> táhni kdekoli po obrazovce = pohyb
                </li>
                <li>
                  <kbd className="k-red">NEMÁM!</kbd> odhodí všechny somráky kolem tebe
                </li>
                <li>
                  <kbd className="k-gold">10 Kč</kbd> hodí návnadu — somráci se o ni poperou
                </li>
              </ul>
            ) : (
              <ul className="control-list">
                <li>
                  <kbd>WASD</kbd>
                  <kbd>←↑→↓</kbd> pohyb
                </li>
                <li>
                  <kbd>MEZERNÍK</kbd> zařvat „NEMÁM!“ — odhodí somráky
                </li>
                <li>
                  <kbd>E</kbd>
                  <kbd>KLIK</kbd> hodit desetikorunu jako návnadu
                </li>
                <li>
                  <kbd>P</kbd> pauza · <kbd>M</kbd> zvuk · <kbd>R</kbd> restart
                </li>
              </ul>
            )}
          </section>

          <section className="card bestiary">
            <h2>BESTIÁŘ</h2>
            <ul>
              <li>
                <Avatar kind="bedak" />
                <div>
                  <b>Bezďák</b>
                  <span>Pomalý, ale je jich hodně. Chce dvacku nebo cígo.</span>
                </div>
              </li>
              <li>
                <Avatar kind="teplaky" />
                <div>
                  <b>Teplákář</b>
                  <span>Přikrčí se a vystřelí. Uhni do strany. Chce pade.</span>
                </div>
              </li>
              <li>
                <Avatar kind="smrad" />
                <div>
                  <b>Smraďoch</b>
                  <span>Zelený mrak tě zpomalí. Chce dvě cíga.</span>
                </div>
              </li>
              <li>
                <Avatar kind="boss" />
                <div>
                  <b>Velkej Béďa</b>
                  <span>Boss s vozíkem na nástupišti. Bere padesát.</span>
                </div>
              </li>
            </ul>
          </section>

          <Scoreboard records={records} />
        </div>
      </div>
    </div>
  );
}

function PauseScreen({
  hud,
  muted,
  onResume,
  onRestart,
  onMenu,
  onMute,
}: {
  hud: HudSnapshot;
  muted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onMute: () => void;
}) {
  return (
    <div className="overlay overlay-pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="panel">
        <p className="panel-kicker">PAUZA</p>
        <h2 id="pause-title" className="panel-title">
          Somráci počkají. Vlak ne.
        </h2>
        <div className="mini-stats">
          <div>
            <span>KAPSA</span>
            <b>{hud.money} Kč</b>
          </div>
          <div>
            <span>CÍGA</span>
            <b>{hud.cigs}</b>
          </div>
          <div>
            <span>ODJEZD ZA</span>
            <b>{formatTime(hud.timeLeft)}</b>
          </div>
        </div>
        <div className="panel-actions">
          <button type="button" className="btn btn-primary" onClick={onResume}>
            POKRAČOVAT <kbd>P</kbd>
          </button>
          <button type="button" className="btn" onClick={onRestart}>
            ZNOVU <kbd>R</kbd>
          </button>
          <button type="button" className="btn btn-ghost" onClick={onMute}>
            ZVUK: {muted ? "VYP" : "ZAP"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onMenu}>
            MENU
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  result,
  records,
  touchUI,
  onRestart,
  onMenu,
}: {
  result: ResultState;
  records: ScoreRecord[];
  touchUI: boolean;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const won = result.won;
  const headline = won ? "STIHLS TO" : result.reason === "time" ? "UJEL TI VLAK" : "VYSOMROVÁN";
  const reasonText = won
    ? "Nastupuješ do R 1017 do Brna. Somráci ti mávají z nástupiště."
    : result.reason === "cash"
      ? `Klesl jsi pod ${MIN_CASH} Kč. Na lístek to už nebude.`
      : result.reason === "cigs"
        ? `Zbylo ti míň než ${MIN_CIGS} cíga. Takhle do Brna nejedeš.`
        : "Vlak odjel v 00:17. Další jede ráno ve 4:52.";
  const bonus = result.bonus;
  return (
    <div className={`overlay overlay-result ${won ? "is-won" : "is-lost"}`} role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="died-band">
        <h2 id="result-title" className="died-text">
          {headline}
        </h2>
      </div>
      <div className="panel result-panel">
        <p className="result-reason">{reasonText}</p>
        <div className="result-score">
          <span>SKÓRE</span>
          <strong>
            <CountUp value={result.score} />
          </strong>
          {result.rank === 0 && <em>NOVÝ REKORD!</em>}
        </div>
        <p className="result-title">„{result.title}“</p>
        {won && bonus && (
          <ul className="bonus-list">
            <li>
              <span>Dojel jsi</span>
              <b>+{bonus.finish}</b>
            </li>
            <li>
              <span>Čas navíc</span>
              <b>+{bonus.time}</b>
            </li>
            <li>
              <span>Kačky nad limit</span>
              <b>+{bonus.cash}</b>
            </li>
            <li>
              <span>Cíga nad limit</span>
              <b>+{bonus.cigs}</b>
            </li>
            {bonus.clean > 0 && (
              <li className="clean">
                <span>Nikdo tě nevysomroval</span>
                <b>+{bonus.clean}</b>
              </li>
            )}
          </ul>
        )}
        <div className="result-stats">
          <div>
            <span>TRASA</span>
            <b>{Math.round(result.progress * 100)} %</b>
          </div>
          <div>
            <span>VYSOMROVÁN</span>
            <b>{result.stats.steals}×</b>
          </div>
          <div>
            <span>ODSTRČENO</span>
            <b>{result.stats.shoved}</b>
          </div>
          <div>
            <span>MAX COMBO</span>
            <b>×{Math.min(8, result.maxCombo)}</b>
          </div>
        </div>
        <div className="panel-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart}>
            ZNOVU {!touchUI && <kbd>ENTER</kbd>}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onMenu}>
            MENU
          </button>
        </div>
        <Scoreboard records={records} highlight={result.rank} compact />
      </div>
    </div>
  );
}

/* ───────────────────────── App ───────────────────────── */

export default function App() {
  const [initialTouch] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);
  const [initialGame] = useState(() => createGame(initialTouch));
  const [sfx] = useState(() => {
    const s = new Sfx();
    s.muted = storageGet(MUTE_KEY) === "1";
    return s;
  });
  const gameRef = useRef<GameState>(initialGame);
  const phaseRef = useRef<Phase>("title");
  const [phase, setPhaseState] = useState<Phase>("title");
  const [hud, setHud] = useState<HudSnapshot>(() => hudSnapshot(initialGame));
  const [records, setRecords] = useState<ScoreRecord[]>(loadRecords);
  const [name, setName] = useState(() => storageGet(NAME_KEY) ?? "");
  const [muted, setMuted] = useState(() => storageGet(MUTE_KEY) === "1");
  const [touchUI, setTouchUI] = useState(initialTouch);
  const [result, setResult] = useState<ResultState | null>(null);

  const nameRef = useRef(name);
  nameRef.current = name;
  const touchRef = useRef(touchUI);
  touchRef.current = touchUI;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const endAtRef = useRef(0);
  const shoveBtn = useRef<HTMLButtonElement>(null);
  const lureBtn = useRef<HTMLButtonElement>(null);
  const cdCache = useRef({ shove: -1, lure: -1 });

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const start = useCallback(() => {
    sfx.unlock();
    const game = createGame(touchRef.current);
    beginRun(game);
    gameRef.current = game;
    setResult(null);
    setHud(hudSnapshot(game));
    setPhase("playing");
  }, [setPhase, sfx]);

  const restart = useCallback(() => {
    const current = phaseRef.current;
    if ((current === "over" || current === "won") && performance.now() - endAtRef.current < 450) return;
    start();
  }, [start]);

  const togglePause = useCallback(() => {
    const current = phaseRef.current;
    if (current === "playing") setPhase("paused");
    else if (current === "paused") setPhase("playing");
  }, [setPhase]);

  const toMenu = useCallback(() => {
    const game = createGame(touchRef.current);
    gameRef.current = game;
    setResult(null);
    setHud(hudSnapshot(game));
    setPhase("title");
  }, [setPhase]);

  const shove = useCallback(() => {
    if (phaseRef.current === "playing") doShove(gameRef.current);
  }, []);

  const lure = useCallback((x?: number, y?: number) => {
    if (phaseRef.current === "playing") throwLure(gameRef.current, x, y);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    sfx.setMuted(next);
    storageSet(MUTE_KEY, next ? "1" : "0");
    setMuted(next);
  }, [sfx]);

  const touch = useCallback(() => {
    if (touchRef.current) return;
    touchRef.current = true;
    gameRef.current.touchUI = true;
    setTouchUI(true);
  }, []);

  const onEnd = useCallback(
    (outcome: "over" | "won") => {
      const summary = runSummary(gameRef.current);
      const playerName = (nameRef.current.trim() || "ANONYM").slice(0, 14).toUpperCase();
      const record: ScoreRecord = {
        name: playerName,
        score: summary.score,
        won: summary.won,
        reason: summary.reason,
        at: new Date().toISOString(),
      };
      const next = [...recordsRef.current, record].sort((a, b) => b.score - a.score).slice(0, 8);
      recordsRef.current = next;
      setRecords(next);
      storageSet(SCORE_KEY, JSON.stringify(next));
      endAtRef.current = performance.now();
      setResult({ ...summary, rank: next.indexOf(record), title: rankTitle(summary), name: playerName });
      setPhase(outcome);
    },
    [setPhase],
  );

  const onHud = useCallback((next: HudSnapshot) => {
    if (phaseRef.current === "playing") setHud(next);
  }, []);

  const onFrame = useCallback((game: GameState) => {
    const s = Math.round((game.player.shoveCD / SHOVE_COOLDOWN) * 100) / 100;
    const l = Math.round((game.player.lureCD / LURE_COOLDOWN) * 100) / 100;
    if (s !== cdCache.current.shove) {
      cdCache.current.shove = s;
      shoveBtn.current?.style.setProperty("--cd", String(s));
    }
    if (l !== cdCache.current.lure) {
      cdCache.current.lure = l;
      lureBtn.current?.style.setProperty("--cd", String(l));
    }
  }, []);

  const actionsRef = useRef<GameActions>({ start, restart, togglePause, toMenu, shove, lure, toggleMute, touch });
  actionsRef.current = { start, restart, togglePause, toMenu, shove, lure, toggleMute, touch };

  const onName = useCallback((value: string) => {
    setName(value);
    storageSet(NAME_KEY, value);
  }, []);

  useEffect(() => {
    cdCache.current = { shove: -1, lure: -1 };
  }, [phase, touchUI]);

  const pressShove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    sfx.unlock();
    shove();
  };
  const pressLure = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    sfx.unlock();
    lure();
  };

  const inRun = phase === "playing" || phase === "paused";

  return (
    <div className={`game-root ${touchUI ? "is-touch" : "is-desktop"} phase-${phase}`}>
      <GameCanvas
        gameRef={gameRef}
        phaseRef={phaseRef}
        actionsRef={actionsRef}
        sfx={sfx}
        onEnd={onEnd}
        onHud={onHud}
        onFrame={onFrame}
      />
      <div className="fx-scan" aria-hidden="true" />
      <div className="fx-grain" aria-hidden="true" />

      {inRun && <Hud hud={hud} muted={muted} onPause={togglePause} onMute={toggleMute} />}

      {phase === "playing" && hud.banner && (
        <div key={hud.banner.id} className={`banner banner-${hud.banner.tone}`} aria-live="polite">
          {hud.banner.tone === "zone" ? (
            <>
              <span className="banner-kicker">{hud.banner.title}</span>
              <strong className="banner-main">{hud.banner.sub}</strong>
            </>
          ) : (
            <>
              <strong className="banner-main">{hud.banner.title}</strong>
              <span className="banner-kicker">{hud.banner.sub}</span>
            </>
          )}
        </div>
      )}

      {phase === "playing" && hud.hint && (
        <div key={hud.hint.id} className="hint" aria-live="polite">
          {hud.hint.text}
        </div>
      )}

      {phase === "playing" && touchUI && (
        <div className="touch-actions">
          <button
            ref={lureBtn}
            type="button"
            className={`act act-lure ${hud.canLure ? "" : "is-off"}`}
            onPointerDown={pressLure}
            aria-label={`Hodit ${LURE_COST} Kč jako návnadu`}
          >
            <span>{LURE_COST} Kč</span>
            <small>NÁVNADA</small>
          </button>
          <button
            ref={shoveBtn}
            type="button"
            className={`act act-shove ${hud.threat ? "is-hot" : ""}`}
            onPointerDown={pressShove}
            aria-label="Zařvat NEMÁM a odstrčit somráky"
          >
            <span>NEMÁM!</span>
          </button>
        </div>
      )}

      {phase === "playing" && !touchUI && (
        <div className="key-actions" aria-hidden="true">
          <span ref={shoveBtn} className={`chip chip-shove ${hud.threat ? "is-hot" : ""}`}>
            <kbd>MEZERNÍK</kbd> NEMÁM!
          </span>
          <span ref={lureBtn} className={`chip chip-lure ${hud.canLure ? "" : "is-off"}`}>
            <kbd>E</kbd>
            <kbd>KLIK</kbd> HODIT {LURE_COST} Kč
          </span>
        </div>
      )}

      {phase === "title" && <TitleScreen records={records} name={name} touchUI={touchUI} onName={onName} onStart={start} />}

      {phase === "paused" && (
        <PauseScreen hud={hud} muted={muted} onResume={togglePause} onRestart={start} onMenu={toMenu} onMute={toggleMute} />
      )}

      {(phase === "over" || phase === "won") && result && (
        <ResultScreen result={result} records={records} touchUI={touchUI} onRestart={restart} onMenu={toMenu} />
      )}
    </div>
  );
}
