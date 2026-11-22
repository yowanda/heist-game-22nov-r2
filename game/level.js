// level.js — the Meridian Gallery floor plan: walls, cover, loot, vault, exit.
// One room the thief crosses, with three routes to the vault:
//   the main hall (fast, patrolled), the west corridor (medium), the air duct (slow, hidden).
// Coordinates are pixels on a 960 x 600 canvas. Walls and cover block both
// movement and line of sight.

export const LEVEL = {
  width: 960,
  height: 600,
  timeLimitSec: 300,
  // Axis-aligned walls: {x, y, w, h}. The duct is an enclosed shaft along the
  // top of the map; its only openings are two floor grates (gaps in its south wall).
  walls: [
    // Outer border.
    { x: 0, y: 0, w: 960, h: 20 },
    { x: 0, y: 580, w: 960, h: 20 },
    { x: 0, y: 0, w: 20, h: 600 },
    { x: 940, y: 0, w: 20, h: 600 },
    // North wall band above the air duct.
    { x: 20, y: 20, w: 920, h: 16 },
    // Air duct: enclosed shaft, interior y 40..80, x 100..880.
    { x: 96, y: 36, w: 4, h: 44 }, // west end cap
    { x: 880, y: 36, w: 4, h: 44 }, // east end cap
    // Duct south wall, with two grate gaps: x 100..140 and x 840..880.
    { x: 140, y: 80, w: 700, h: 4 },
    // Mid wall across the hall, door gap x 480..540.
    { x: 300, y: 200, w: 180, h: 16 },
    { x: 540, y: 200, w: 120, h: 16 },
    // Vault room west wall (x 640): door gap y 200..260, and a second gap
    // y 36..84 where the air duct passes straight through it.
    { x: 640, y: 20, w: 16, h: 16 },
    { x: 640, y: 84, w: 16, h: 116 },
    { x: 640, y: 260, w: 16, h: 100 },
    // Vault room south wall (no door; entry is the west door or the duct grate).
    { x: 656, y: 360, w: 284, h: 16 },
  ],
  // Cover: display cases and pillars. They block movement and sight, so a
  // thief can break a vision cone by ducking behind one.
  cover: [
    { x: 180, y: 300, w: 120, h: 50, kind: "case", label: "Jade Room" },
    { x: 420, y: 380, w: 120, h: 50, kind: "case", label: "Coin Room" },
    { x: 700, y: 420, w: 100, h: 50, kind: "case", label: "Relic Room" },
    { x: 300, y: 120, w: 36, h: 36, kind: "pillar", label: "" },
    { x: 560, y: 120, w: 36, h: 36, kind: "pillar", label: "" },
  ],
  // The air duct region: crawling here is slow, but no cone can see inside it.
  duct: { x: 100, y: 40, w: 780, h: 40 },
  // The vault safe, set into the vault room below the air duct.
  vault: { x: 840, y: 100, w: 72, h: 40, interactX: 860, interactY: 165, interactR: 46 },
  // Loot scattered through the gallery. Walk over a piece to pocket it.
  loot: [
    { id: "gold1", kind: "gold", x: 330, y: 450, value: 100, label: "Gold bar" },
    { id: "gold2", kind: "gold", x: 500, y: 500, value: 100, label: "Gold bar" },
    { id: "painting", kind: "painting", x: 150, y: 150, value: 200, label: "Moonlit Portrait" },
    { id: "diamond", kind: "diamond", x: 780, y: 150, value: 300, label: "Meridian Diamond" },
  ],
  vaultLootValue: 500,
  // Getaway door, bottom-left. The heist is won by reaching it after the vault is cracked.
  exit: { x: 24, y: 520, w: 56, h: 56 },
  playerStart: { x: 140, y: 540 },
  // Guards: name, patrol waypoints, patrol speed, uniform colour.
  guards: [
    {
      name: "Rook",
      waypoints: [
        { x: 240, y: 260 },
        { x: 620, y: 260 },
      ],
      speed: 55,
      color: "#3d5a80",
    },
    {
      name: "Bishop",
      waypoints: [
        { x: 300, y: 150 },
        { x: 620, y: 150 },
      ],
      speed: 48,
      color: "#5a3d80",
    },
    {
      name: "Knight",
      waypoints: [
        { x: 760, y: 400 },
        { x: 760, y: 540 },
      ],
      speed: 60,
      color: "#805a3d",
    },
  ],
  // Wall cameras: position, base aim angle (radians), sweep, range.
  cameras: [
    { id: "cam1", x: 480, y: 26, baseAngle: Math.PI / 2, sweep: 0.96, range: 210, period: 5.2 },
    { id: "cam2", x: 936, y: 300, baseAngle: Math.PI, sweep: 0.78, range: 210, period: 4.1 },
  ],
};

// All sight-blocking rectangles: walls plus cover.
export function sightBlockers() {
  return LEVEL.walls.concat(LEVEL.cover);
}

// True when point (px, py) lies inside the air duct.
export function inDuct(px, py) {
  const d = LEVEL.duct;
  return px >= d.x && px <= d.x + d.w && py >= d.y && py <= d.y + d.h;
}

// True when point (px, py) lies inside rect r.
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
