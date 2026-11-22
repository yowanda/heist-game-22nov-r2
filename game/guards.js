// guards.js — patrol guards and wall cameras: vision cones, line of sight,
// detection pressure on the alarm meter, and the chase that follows a loud alarm.
// A cone only counts when the thief is inside its angle and range AND a sampled
// line of sight from watcher to thief is not cut by a wall, a display case or smoke.

import { LEVEL, sightBlockers, inDuct } from "./level.js";

export const GUARD_VIEW_RANGE = 180;
export const GUARD_VIEW_HALF_ANGLE = 0.6; // radians, about 34 degrees each side
export const CAMERA_VIEW_HALF_ANGLE = 0.45;
export const DETECT_GUARD_PER_SEC = 35;
export const DETECT_GUARD_SNEAK_PER_SEC = 15;
export const DETECT_CAMERA_PER_SEC = 50;
export const DETECT_CLOSE_PER_SEC = 90; // a guard right on top of the thief
export const ALARM_DECAY_PER_SEC = 14;
export const CHASE_ALARM = 45;
export const CATCH_DISTANCE = 28;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Sampled segment test: true when nothing blocks the straight line (x1,y1)-(x2,y2).
export function hasLineOfSight(x1, y1, x2, y2, blockers) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const r of blockers) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return false;
    }
  }
  return true;
}

// True when the straight line passes through any smoke cloud.
export function blockedBySmoke(x1, y1, x2, y2, smokes) {
  for (const s of smokes) {
    // Distance from the smoke centre to the segment.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((s.x - x1) * dx + (s.y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    if (Math.hypot(s.x - cx, s.y - cy) < s.r) return true;
  }
  return false;
}

export function makeGuard(def) {
  return {
    name: def.name,
    x: def.waypoints[0].x,
    y: def.waypoints[0].y,
    targetIndex: 1,
    speed: def.speed,
    color: def.color,
    angle: 0,
    chasing: false,
    // Where the guard last saw the thief; the chase runs at this point.
    lastSeenX: 0,
    lastSeenY: 0,
    seenNow: false,
  };
}

export function makeCamera(def) {
  return {
    id: def.id,
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    range: def.range,
    period: def.period,
    angle: def.baseAngle,
    time: Math.random() * def.period,
    disabledUntil: 0,
    seenNow: false,
  };
}

// Move one guard along its patrol, or chase the thief while the alarm is loud.
export function updateGuard(guard, waypoints, dt, player, alarm) {
  guard.chasing = alarm >= CHASE_ALARM;
  let tx;
  let ty;
  let speed = guard.speed;
  if (guard.chasing) {
    tx = guard.lastSeenX;
    ty = guard.lastSeenY;
    speed = 100;
  } else {
    const wp = waypoints[guard.targetIndex];
    tx = wp.x;
    ty = wp.y;
  }
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    const step = Math.min(dist, speed * dt);
    guard.x += (dx / dist) * step;
    guard.y += (dy / dist) * step;
    guard.angle = Math.atan2(dy, dx);
  }
  if (!guard.chasing && dist <= 2) {
    guard.targetIndex = (guard.targetIndex + 1) % waypoints.length;
  }
  return guard;
}

// Sweep a camera's cone back and forth around its base angle.
export function updateCamera(camera, dt, now) {
  camera.time += dt;
  const phase = (camera.time / camera.period) * Math.PI * 2;
  camera.angle = camera.baseAngle + Math.sin(phase) * camera.sweep;
  camera.disabled = now < camera.disabledUntil;
  return camera;
}

// How much detection pressure one watcher puts on the thief this instant.
// Returns 0 when the thief is out of the cone, out of range, hidden behind
// cover or smoke, or (for cameras) jammed. The duct hides the thief outright.
function conePressure(wx, wy, angle, range, halfAngle, player, blockers, smokes, rate) {
  if (inDuct(player.x, player.y)) return 0;
  const dx = player.x - wx;
  const dy = player.y - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (dist < CATCH_DISTANCE) return DETECT_CLOSE_PER_SEC;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return 0;
  if (!hasLineOfSight(wx, wy, player.x, player.y, blockers)) return 0;
  if (blockedBySmoke(wx, wy, player.x, player.y, smokes)) return 0;
  return rate;
}

// Total alarm rise per second from every guard and camera right now.
// Also marks each watcher seenNow and records the thief's position for chases.
export function detectionPressure(guards, cameras, player, smokes, now) {
  const blockers = sightBlockers();
  let pressure = 0;
  for (const g of guards) {
    const rate = player.sneaking ? DETECT_GUARD_SNEAK_PER_SEC : DETECT_GUARD_PER_SEC;
    const p = conePressure(g.x, g.y, g.angle, GUARD_VIEW_RANGE, GUARD_VIEW_HALF_ANGLE, player, blockers, smokes, rate);
    g.seenNow = p > 0;
    if (p > 0) {
      pressure += p;
      g.lastSeenX = player.x;
      g.lastSeenY = player.y;
    }
  }
  for (const c of cameras) {
    if (c.disabled) {
      c.seenNow = false;
      continue;
    }
    const p = conePressure(c.x, c.y, c.angle, c.range, CAMERA_VIEW_HALF_ANGLE, player, blockers, smokes, DETECT_CAMERA_PER_SEC);
    c.seenNow = p > 0;
    if (p > 0) pressure += p;
  }
  return pressure;
}

// True when any guard is close enough to grab the thief.
export function guardTouching(guards, player) {
  for (const g of guards) {
    if (Math.hypot(g.x - player.x, g.y - player.y) < CATCH_DISTANCE) return g;
  }
  return null;
}
