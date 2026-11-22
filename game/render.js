// render.js — everything the thief sees: the gallery floor, walls and cover,
// vision cones sweeping the room, the vault, the loot, the smoke, and the
// safe-cracking dial. One canvas, no images: every shape is drawn in code.

import { LEVEL, inDuct } from "./level.js";
import { GUARD_VIEW_RANGE, GUARD_VIEW_HALF_ANGLE, CAMERA_VIEW_HALF_ANGLE } from "./guards.js";
import { needlePosition } from "./vault.js";

function drawCone(ctx, x, y, angle, range, halfAngle, color, seen) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  const grad = ctx.createRadialGradient(x, y, 10, x, y, range);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.globalAlpha = seen ? 0.55 : 0.36;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawFloor(ctx) {
  // Dark gallery tiles with a faint checker and a warm rug down the main hall.
  for (let ty = 0; ty < 15; ty++) {
    for (let tx = 0; tx < 24; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? "#232a3a" : "#1f2534";
      ctx.fillRect(tx * 40, ty * 40, 40, 40);
    }
  }
  ctx.fillStyle = "rgba(184,134,58,0.16)";
  ctx.fillRect(360, 216, 240, 364); // hall runner
  ctx.fillStyle = "rgba(184,134,58,0.10)";
  ctx.fillRect(656, 20, 284, 340); // vault room carpet
}

export function drawDuct(ctx) {
  const d = LEVEL.duct;
  ctx.fillStyle = "#10151f";
  ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.strokeStyle = "#3a4a63";
  ctx.lineWidth = 2;
  ctx.strokeRect(d.x, d.y, d.w, d.h);
  // Vent grate slats at both openings.
  ctx.strokeStyle = "#5a6b85";
  ctx.lineWidth = 2;
  for (const gx of [112, 126, 852, 866]) {
    ctx.beginPath();
    ctx.moveTo(gx, 82);
    ctx.lineTo(gx, 96);
    ctx.stroke();
  }
  ctx.fillStyle = "#8fa3c0";
  ctx.font = "11px sans-serif";
  ctx.fillText("AIR DUCT — CRAWL, UNSEEN", 400, 62);
}

export function drawWallsAndCover(ctx) {
  for (const w of LEVEL.walls) {
    ctx.fillStyle = "#39415a";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = "#b8863a";
    if (w.h <= 20) ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
    else ctx.fillRect(w.x + w.w - 3, w.y, 3, w.h);
  }
  for (const c of LEVEL.cover) {
    if (c.kind === "case") {
      ctx.fillStyle = "#2c3e55";
      roundRect(ctx, c.x, c.y, c.w, c.h, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(140,200,235,0.35)";
      roundRect(ctx, c.x + 5, c.y + 5, c.w - 10, c.h - 10, 4);
      ctx.fill();
      ctx.strokeStyle = "#b8863a";
      ctx.lineWidth = 2;
      roundRect(ctx, c.x, c.y, c.w, c.h, 6);
      ctx.stroke();
      if (c.label) {
        ctx.fillStyle = "#c8b98a";
        ctx.font = "11px sans-serif";
        ctx.fillText(c.label, c.x + 8, c.y + c.h - 8);
      }
    } else {
      ctx.fillStyle = "#4a5468";
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = "#b8863a";
      ctx.fillRect(c.x, c.y, c.w, 4);
    }
  }
}

export function drawExit(ctx, vaultCracked, pulse) {
  const e = LEVEL.exit;
  ctx.save();
  ctx.fillStyle = vaultCracked ? `rgba(46,204,113,${0.55 + 0.35 * pulse})` : "rgba(46,204,113,0.35)";
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.fill();
  ctx.strokeStyle = "#2ecc71";
  ctx.lineWidth = 2;
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.stroke();
  ctx.fillStyle = "#eafff0";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GETAWAY", e.x + e.w / 2, e.y + e.h / 2 - 4);
  ctx.font = "16px sans-serif";
  ctx.fillText("🚐", e.x + e.w / 2, e.y + e.h / 2 + 16);
  ctx.textAlign = "left";
  ctx.restore();
}

export function drawLoot(ctx, loot, taken, time) {
  for (const item of loot) {
    if (taken.includes(item.id)) continue;
    const bob = Math.sin(time * 3 + item.x) * 2;
    const glow = 0.5 + 0.3 * Math.sin(time * 4 + item.x);
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = "#ffd76a";
    ctx.beginPath();
    ctx.arc(item.x, item.y + bob, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (item.kind === "gold") {
      ctx.fillStyle = "#f5b301";
      ctx.fillRect(item.x - 10, item.y - 6 + bob, 20, 12);
      ctx.fillStyle = "#ffd76a";
      ctx.fillRect(item.x - 10, item.y - 6 + bob, 20, 4);
    } else if (item.kind === "diamond") {
      ctx.fillStyle = "#7fe7ff";
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 12 + bob);
      ctx.lineTo(item.x + 11, item.y + bob);
      ctx.lineTo(item.x, item.y + 11 + bob);
      ctx.lineTo(item.x - 11, item.y + bob);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "#8e6fc0";
      ctx.fillRect(item.x - 12, item.y - 9 + bob, 24, 18);
      ctx.strokeStyle = "#d9c8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(item.x - 12, item.y - 9 + bob, 24, 18);
      ctx.fillStyle = "#e8dcff";
      ctx.beginPath();
      ctx.arc(item.x, item.y + bob, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(item.label, item.x, item.y + 26 + bob);
    ctx.textAlign = "left";
    ctx.restore();
  }
}

export function drawVault(ctx, vault, pulse) {
  const v = LEVEL.vault;
  ctx.save();
  ctx.fillStyle = "#5a6478";
  roundRect(ctx, v.x, v.y, v.w, v.h, 5);
  ctx.fill();
  ctx.strokeStyle = vault.cracked ? "#2ecc71" : "#ffd76a";
  ctx.lineWidth = vault.cracked ? 3 : 2 + pulse;
  roundRect(ctx, v.x, v.y, v.w, v.h, 5);
  ctx.stroke();
  ctx.fillStyle = "#2c3342";
  ctx.beginPath();
  ctx.arc(v.x + v.w / 2, v.y + v.h / 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffd76a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(v.x + v.w / 2, v.y + v.h / 2, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffe9a8";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(vault.cracked ? "OPEN" : "VAULT", v.x + v.w / 2, v.y + v.h + 14);
  ctx.textAlign = "left";
  ctx.restore();
}

export function drawGuards(ctx, guards) {
  for (const g of guards) {
    drawCone(ctx, g.x, g.y, g.angle, GUARD_VIEW_RANGE, GUARD_VIEW_HALF_ANGLE, "rgba(255,214,90,0.9)", g.seenNow);
    // Body: navy uniform, cap, flashlight dot at the facing edge.
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dfe8ff";
    ctx.fillRect(8, -4, 8, 8); // flashlight
    ctx.fillStyle = "#1c2436";
    ctx.beginPath();
    ctx.arc(-4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(g.name, g.x, g.y - 18);
    ctx.textAlign = "left";
    if (g.chasing) {
      ctx.fillStyle = "#ff5a5a";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("!", g.x + 16, g.y - 12);
    }
  }
}

export function drawCameras(ctx, cameras, now) {
  for (const c of cameras) {
    if (!c.disabled) {
      drawCone(ctx, c.x, c.y, c.angle, c.range, CAMERA_VIEW_HALF_ANGLE, "rgba(255,80,80,0.9)", c.seenNow);
    }
    ctx.save();
    ctx.fillStyle = c.disabled ? "#555" : "#222";
    ctx.fillRect(c.x - 9, c.y - 7, 18, 14);
    ctx.fillStyle = c.disabled ? "#666" : Math.floor(now * 2) % 2 === 0 ? "#ff3b30" : "#7a1010";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawSmoke(ctx, smokes, now) {
  for (const s of smokes) {
    const remain = Math.max(0, s.until - now);
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, 0.3 + remain / 8);
    ctx.fillStyle = "#b9c4d6";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(s.x - 30, s.y + 14, s.r * 0.55, 0, Math.PI * 2);
    ctx.arc(s.x + 34, s.y - 10, s.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawPlayer(ctx, player, time) {
  const inDuctNow = inDuct(player.x, player.y);
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.sneaking || inDuctNow) ctx.globalAlpha = 0.85;
  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 9, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Soft gold glow so the thief reads at a glance on the dark floor.
  ctx.fillStyle = "rgba(255,215,106,0.20)";
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI * 2);
  ctx.fill();
  // Hooded thief: dark cloak, gold trim, pale mask.
  ctx.fillStyle = "#151a26";
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffd76a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f4d8b8";
  ctx.beginPath();
  ctx.arc(0, -1, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#151a26";
  ctx.fillRect(-6, -7, 12, 4); // hood shade
  ctx.restore();
  if (player.moveTarget) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,215,106,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.moveTarget.x, player.moveTarget.y, 7 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// The safe-cracking dial, drawn over the game while the minigame is open.
export function drawVaultDial(ctx, vault) {
  const cx = LEVEL.width / 2;
  const cy = LEVEL.height / 2 - 10;
  ctx.save();
  ctx.fillStyle = "rgba(8,10,16,0.82)";
  ctx.fillRect(0, 0, LEVEL.width, LEVEL.height);
  ctx.fillStyle = "#1c2436";
  roundRect(ctx, cx - 210, cy - 150, 420, 300, 12);
  ctx.fill();
  ctx.strokeStyle = "#b8863a";
  ctx.lineWidth = 3;
  roundRect(ctx, cx - 210, cy - 150, 420, 300, 12);
  ctx.stroke();

  ctx.fillStyle = "#ffe9a8";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CRACK THE SAFE", cx, cy - 118);
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#c8d2e8";
  ctx.fillText("Press SPACE when the needle is inside the green zone", cx, cy - 94);
  ctx.fillText(`Clean turns: ${vault.hits} / 3${vault.lockpickUsed ? "  ·  lockpick fitted (wide zone)" : ""}`, cx, cy - 74);

  // Dial face.
  const R = 82;
  ctx.beginPath();
  ctx.arc(cx, cy + 20, R, 0, Math.PI * 2);
  ctx.fillStyle = "#0e1420";
  ctx.fill();
  ctx.strokeStyle = "#5a6b85";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Green zone: needle position -1..1 maps to -120..120 degrees around the top.
  const zoneA0 = (-120 + (vault.zoneCenter - vault.zoneHalf + 1) * 120) * (Math.PI / 180) - Math.PI / 2;
  const zoneA1 = (-120 + (vault.zoneCenter + vault.zoneHalf + 1) * 120) * (Math.PI / 180) - Math.PI / 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 20, R - 8, zoneA0, zoneA1);
  ctx.strokeStyle = "#2ecc71";
  ctx.lineWidth = 14;
  ctx.stroke();
  // Ticks.
  ctx.strokeStyle = "#5a6b85";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const a = (-120 + i * 30) * (Math.PI / 180) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R - 20), cy + 20 + Math.sin(a) * (R - 20));
    ctx.lineTo(cx + Math.cos(a) * (R - 26), cy + 20 + Math.sin(a) * (R - 26));
    ctx.stroke();
  }
  // Needle.
  const na = (-120 + (needlePosition(vault) + 1) * 120) * (Math.PI / 180) - Math.PI / 2;
  ctx.strokeStyle = "#ffd76a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 20);
  ctx.lineTo(cx + Math.cos(na) * (R - 14), cy + 20 + Math.sin(na) * (R - 14));
  ctx.stroke();
  ctx.fillStyle = "#ffd76a";
  ctx.beginPath();
  ctx.arc(cx, cy + 20, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8fa3c0";
  ctx.font = "12px sans-serif";
  ctx.fillText("A miss is loud: +12 alarm. ESC closes the dial.", cx, cy + 128);
  ctx.textAlign = "left";
  ctx.restore();
}
