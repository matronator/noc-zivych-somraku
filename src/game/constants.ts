export const WORLD_W = 820;
export const WORLD_H = 5600;

export const START_CASH = 250;
export const MIN_CASH = 120;
export const START_CIGS = 8;
export const MIN_CIGS = 3;
export const TIME_LIMIT = 120;

export const PLAYER_RADIUS = 14;
export const PLAYER_SPEED = 190;

export const SHOVE_COOLDOWN = 1.8;
export const SHOVE_RADIUS = 120;

export const LURE_COST = 10;
export const LURE_COOLDOWN = 0.6;
export const LURE_DURATION = 3.8;
export const LURE_RADIUS = 330;

export const CELL = 20;
export const GRID_COLS = Math.ceil(WORLD_W / CELL);
export const GRID_ROWS = Math.ceil(WORLD_H / CELL);

export const START_X = 410;
export const START_Y = 5330;
export const GOAL_Y = 150;

export type BeggarKind = "bedak" | "teplaky" | "smrad" | "boss";
export type Demand = "cash" | "cig";
export type PickupKind = "coin" | "bill" | "pack" | "coffee" | "phones";
export type ZoneId = "platform" | "tunnel" | "hall" | "plaza" | "park";

export interface ZoneInfo {
  id: ZoneId;
  chapter: string;
  name: string;
  y0: number;
  y1: number;
  darkness: number;
}

/** Ordered from the top of the map (goal) to the bottom (start). */
export const ZONES: ZoneInfo[] = [
  { id: "platform", chapter: "FINÁLE", name: "NÁSTUPIŠTĚ 3", y0: 0, y1: 650, darkness: 0.5 },
  { id: "tunnel", chapter: "KAPITOLA 4", name: "PODCHOD", y0: 650, y1: 1640, darkness: 0.52 },
  { id: "hall", chapter: "KAPITOLA 3", name: "ODBAVOVACÍ HALA", y0: 1640, y1: 3060, darkness: 0.24 },
  { id: "plaza", chapter: "KAPITOLA 2", name: "PŘEDNÁDRAŽÍ", y0: 3060, y1: 3420, darkness: 0.5 },
  { id: "park", chapter: "KAPITOLA 1", name: "SHERWOOD", y0: 3420, y1: WORLD_H, darkness: 0.62 },
];

export const ZONE_ORDER: ZoneId[] = ["park", "plaza", "hall", "tunnel", "platform"];

export function zoneAt(y: number): ZoneInfo {
  for (const zone of ZONES) {
    if (y < zone.y1) return zone;
  }
  return ZONES[ZONES.length - 1];
}
