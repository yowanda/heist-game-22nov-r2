// player.js — the thief: movement with wall collision, sneaking, click-to-move,
// tools (smoke pellets and the camera jammer), and pocketing loot.
// Movement is axis-separated so the thief slides along walls instead of sticking.

import { LEVEL, pointInRect, inDuct } from "./level.js";

export const PLAYER_RADIUS = 13;
export const WALK_SPEED = 165;
export const SNEAK_SPEED = 95;
export const DUCT_SPEED_FACTOR = 0.55;
export const SMOKE_COUNT_START = 3;
export const SMOKE_DURATION_SEC = 5;
export const SMOKE_RADIUS = 90;
export const JAMMER_COUNT_START = 2;
export const JAMMER_DURATION_SEC = 8;
export const JAMMER_SCORE_COST = 100;

export function makePlayer() {
  return {
    x: LEVEL.playerStart.x,
    y: LEVEL.playerStart.y,
    radius: PLAYER_RADIUS,
    sneaking: false,
    moveTarget: null, // {x, y} set by a mouse click / tap; null while using keys
    smokeLeft: SMOKE_COUNT_START,
    jammerLeft: JAMMER_COUNT_START,
    lootTaken: [], // loot ids pocketed
    score: 0,
  };
}

// True when a circle at (x, y) with radius r overlaps any wall or cover rect.
export function collides(x, y, r) {
  for (const rect of LEVEL.walls.concat(LEVEL.cover)) {
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    if (Math.hypot(x - cx, y - cy) < r) return true;
  }
  return false;
}

// Move the thief by (dx, dy) with axis separation: try x, then y, so walls slide.
export function movePlayer(player, dx, dy) {
  const nx = player.x + dx;
  if (!collides(nx, player.y, player.radius)) player.x = nx;
  const ny = player.y + dy;
  if (!collides(player.x, ny, player.radius)) player.y = ny;
  player.x = Math.max(20 + player.radius, Math.min(LEVEL.width - 20 - player.radius, player.x));
  player.y = Math.max(20 + player.radius, Math.min(LEVEL.height - 20 - player.radius, player.y));
}

// Current speed, slowed by sneaking and by crawling through the air duct.
export function playerSpeed(player) {
  let speed = player.sneaking ? SNEAK_SPEED : WALK_SPEED;
  if (inDuct(player.x, player.y)) speed *= DUCT_SPEED_FACTOR;
  return speed;
}

// Step the thief for one frame from held keys and/or a click-to-move target.
// keys: {up, down, left, right, sneak}. Returns nothing; mutates player.
export function updatePlayer(player, keys, dt) {
  let mx = 0;
  let my = 0;
  if (keys.up) my -= 1;
  if (keys.down) my += 1;
  if (keys.left) mx -= 1;
  if (keys.right) mx += 1;
  if (mx !== 0 || my !== 0) {
    player.moveTarget = null; // keys override a click target
    const len = Math.hypot(mx, my);
    const speed = playerSpeed(player);
    movePlayer(player, (mx / len) * speed * dt, (my / len) * speed * dt);
  } else if (player.moveTarget) {
    const dx = player.moveTarget.x - player.x;
    const dy = player.moveTarget.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      player.moveTarget = null;
    } else {
      const speed = playerSpeed(player);
      const step = Math.min(dist, speed * dt);
      movePlayer(player, (dx / dist) * step, (dy / dist) * step);
    }
  }
  player.sneaking = !!keys.sneak;
}

// Throw a smoke pellet at the thief's feet. Returns the cloud or null.
export function useSmoke(player, now) {
  if (player.smokeLeft <= 0) return null;
  player.smokeLeft -= 1;
  return { x: player.x, y: player.y, r: SMOKE_RADIUS, until: now + SMOKE_DURATION_SEC };
}

// Fire the jammer: cameras go dark for a while, at a cost to the score.
// Returns the time until which cameras stay disabled, or null.
export function useJammer(player, now) {
  if (player.jammerLeft <= 0) return null;
  player.jammerLeft -= 1;
  player.score = Math.max(0, player.score - JAMMER_SCORE_COST);
  return now + JAMMER_DURATION_SEC;
}

// Pocket any loot within reach. Returns the pieces just taken.
export function collectLoot(player) {
  const taken = [];
  for (const item of LEVEL.loot) {
    if (player.lootTaken.includes(item.id)) continue;
    if (Math.hypot(item.x - player.x, item.y - player.y) < 26) {
      player.lootTaken.push(item.id);
      player.score += item.value;
      taken.push(item);
    }
  }
  return taken;
}

// True when the thief stands close enough to work the vault safe.
export function nearVault(player) {
  const v = LEVEL.vault;
  return Math.hypot(v.interactX - player.x, v.interactY - player.y) < v.interactR;
}

// True when the thief stands on the getaway door.
export function onExit(player) {
  return pointInRect(player.x, player.y, LEVEL.exit);
}
