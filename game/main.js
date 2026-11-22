// main.js — Meridian Midnight: a top-down heist game.
// The thief crosses the Meridian Gallery, cracks the vault safe, pockets what
// they can carry, and slips out to the getaway van before the alarm or the dawn
// ends the night. Guards patrol with vision cones, cameras sweep the halls,
// and the air duct offers a slow, unseen way through.
//
// Play it: WASD / arrows to move, Shift to sneak, E to work the safe,
// 1 smoke pellet, 2 camera jammer, Space in the safe dial, R restart, P pause.
// Mouse or touch: click/tap where the thief should go; the buttons under the
// canvas do the rest.
//
// Photo mode (?shot=cover|vault|getaway|caught) stages a real frame of the
// game for screenshots. Self-test mode (?selftest=win|lose) plays the game
// through its own update loop with scripted inputs and reports the result.

import { LEVEL } from "./level.js";
import {
  makeGuard,
  makeCamera,
  updateGuard,
  updateCamera,
  detectionPressure,
  guardTouching,
  ALARM_DECAY_PER_SEC,
} from "./guards.js";
import {
  makePlayer,
  updatePlayer,
  useSmoke,
  useJammer,
  collectLoot,
  nearVault,
  onExit,
  JAMMER_SCORE_COST,
} from "./player.js";
import { makeVault, updateVault, pressVaultDial, openVault, VAULT_HITS_TO_CRACK } from "./vault.js";
import {
  drawFloor,
  drawDuct,
  drawWallsAndCover,
  drawExit,
  drawLoot,
  drawVault,
  drawGuards,
  drawCameras,
  drawSmoke,
  drawPlayer,
  drawVaultDial,
} from "./render.js";
import {
  makeAudio,
  soundPickup,
  soundDialHit,
  soundDialMiss,
  soundCracked,
  soundCaught,
  soundWin,
  soundSmoke,
  setAlarmDrone,
  stopAlarmDrone,
  blip,
} from "./audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

const ALARM_MISS_PENALTY = 12; // a missed dial press feeds the alarm
const GHOST_BONUS = 200; // win with the peak alarm under 50

const game = {
  state: "menu", // menu | playing | vault | paused | caught | win | timeout
  now: 0,
  timeLeft: LEVEL.timeLimitSec,
  alarm: 0,
  peakAlarm: 0,
  player: makePlayer(),
  guards: LEVEL.guards.map(makeGuard),
  cameras: LEVEL.cameras.map(makeCamera),
  vault: makeVault(),
  smokes: [],
  jammerUntil: 0,
  message: "",
  messageUntil: 0,
  input: { up: false, down: false, left: false, right: false, sneak: false },
  audio: makeAudio(),
  shot: null,
  selftest: null,
  endReason: "",
};

function resetGame() {
  game.state = "playing";
  game.now = 0;
  game.timeLeft = LEVEL.timeLimitSec;
  game.alarm = 0;
  game.peakAlarm = 0;
  game.player = makePlayer();
  game.guards = LEVEL.guards.map(makeGuard);
  game.cameras = LEVEL.cameras.map(makeCamera);
  game.vault = makeVault();
  game.smokes = [];
  game.jammerUntil = 0;
  game.message = "";
  game.messageUntil = 0;
  game.endReason = "";
  game.frozen = false;
  stopAlarmDrone(game.audio);
  showScreen(null);
  setObjective("Reach the vault — the safe holds the Meridian fortune.");
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function setObjective(text) {
  $("objective").textContent = text;
}

function flashMessage(text) {
  game.message = text;
  game.messageUntil = game.now + 2.5;
  $("toast").textContent = text;
}

function updateHud() {
  $("alarm-fill").style.width = `${Math.min(100, game.alarm)}%`;
  $("alarm-fill").className = game.alarm >= 75 ? "alarm-high" : game.alarm >= 45 ? "alarm-mid" : "";
  $("alarm-num").textContent = `${Math.floor(game.alarm)}%`;
  $("timer").textContent = fmtTime(game.timeLeft);
  $("timer").className = game.timeLeft <= 60 ? "timer-low" : "";
  $("score").textContent = `$${game.player.score}`;
  $("smoke-count").textContent = `Smoke ×${game.player.smokeLeft}`;
  $("jammer-count").textContent = `Jammer ×${game.player.jammerLeft} (−$${JAMMER_SCORE_COST})`;
  $("loot-count").textContent = `Loot ${game.player.lootTaken.length}/${LEVEL.loot.length}`;
  if (game.now > game.messageUntil) $("toast").textContent = "";
}

function showScreen(html) {
  const el = $("screen");
  if (!html) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.innerHTML = html;
  el.classList.remove("hidden");
}

function endScreen(title, body, extra) {
  showScreen(
    `<h1>${title}</h1><p>${body}</p>${extra || ""}` +
      `<p class="stats">Score $${game.player.score} · Loot ${game.player.lootTaken.length}/${LEVEL.loot.length} · ` +
      `Peak alarm ${Math.floor(game.peakAlarm)}% · Time left ${fmtTime(game.timeLeft)}</p>` +
      `<button id="again">Play again (R)</button>` +
      `<p class="hint">WASD move · Shift sneak · E use safe · 1 smoke · 2 jammer · Space dial</p>`,
  );
  $("again").addEventListener("click", () => resetGame());
}

function winGame() {
  const timeBonus = Math.floor(game.timeLeft) * 2;
  const ghost = game.peakAlarm < 50 ? GHOST_BONUS : 0;
  game.player.score += timeBonus + ghost;
  game.state = "win";
  game.endReason = "escaped";
  stopAlarmDrone(game.audio);
  soundWin(game.audio);
  endScreen(
    "CLEAN GETAWAY",
    `The vault is empty, the van is rolling, and nobody saw a thing. The crew splits the take in the morning.`,
    `<p class="stats">Time bonus +$${timeBonus}${ghost ? ` · Ghost bonus +$${ghost} (peak alarm under 50%)` : ""}</p>`,
  );
}

function caughtGame(reason) {
  game.state = "caught";
  game.endReason = reason;
  stopAlarmDrone(game.audio);
  soundCaught(game.audio);
  endScreen(
    "CAUGHT",
    reason === "alarm"
      ? "The alarm hit 100%. Floodlights, shouting, and the gallery doors slam shut behind you."
      : "A guard laid a hand on your shoulder. The night is over — but the gallery will still be there tomorrow.",
  );
}

function timeoutGame() {
  game.state = "timeout";
  game.endReason = "dawn";
  stopAlarmDrone(game.audio);
  endScreen(
    "DAWN BREAKS",
    "Five in the morning: the cleaners arrive, the van leaves without you, and the Meridian fortune stays in its safe.",
  );
}

function openVaultMinigame() {
  if (game.vault.cracked) return;
  openVault(game.vault, true); // the lockpick rides in the kit: a wider green zone
  game.state = "vault";
  blip(game.audio, 440, 0.08, "square", 0.08);
}

function closeVaultMinigame() {
  if (game.state === "vault") game.state = "playing";
}

function interact() {
  if (game.state !== "playing") return;
  if (nearVault(game.player)) {
    if (game.vault.cracked) {
      flashMessage("The safe is already open — grab the loot and run.");
    } else {
      openVaultMinigame();
    }
    return;
  }
  if (onExit(game.player) && !game.vault.cracked) {
    flashMessage("The vault is still locked — crack the safe first!");
  }
}

// One fixed step of the game world. The render loop and the self-test both
// drive the game through this function, so a scripted playthrough exercises
// the same code a human plays with.
function stepGame(dt) {
  if (game.state === "menu") {
    // Idle backdrop behind the title: patrols sweep, nothing else happens.
    const defs = LEVEL.guards;
    for (let i = 0; i < game.guards.length; i++) {
      updateGuard(game.guards[i], defs[i].waypoints, dt, game.player, 0);
    }
    for (const c of game.cameras) updateCamera(c, dt, game.now);
    game.now += dt;
    return;
  }
  if (game.state !== "playing" && game.state !== "vault") return;
  game.now += dt;
  game.timeLeft -= dt;
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    timeoutGame();
    return;
  }

  // Guards patrol (or chase) and cameras sweep, in both states.
  const defs = LEVEL.guards;
  for (let i = 0; i < game.guards.length; i++) {
    updateGuard(game.guards[i], defs[i].waypoints, dt, game.player, game.alarm);
  }
  for (const c of game.cameras) updateCamera(c, dt, game.now);

  // Detection pressure feeds the alarm; hiding lets it bleed off.
  const pressure = detectionPressure(game.guards, game.cameras, game.player, game.smokes, game.now);
  if (pressure > 0) {
    game.alarm = Math.min(100, game.alarm + pressure * dt);
  } else {
    game.alarm = Math.max(0, game.alarm - ALARM_DECAY_PER_SEC * dt);
  }
  game.peakAlarm = Math.max(game.peakAlarm, game.alarm);
  setAlarmDrone(game.audio, pressure > 0 ? Math.min(1, pressure / 60) : 0);

  // Smoke clouds fade.
  game.smokes = game.smokes.filter((s) => s.until > game.now);

  if (game.state === "playing") {
    updatePlayer(game.player, game.input, dt);
    const taken = collectLoot(game.player);
    for (const item of taken) {
      soundPickup(game.audio);
      flashMessage(`Pocketed ${item.label} (+$${item.value}).`);
    }
    if (game.vault.cracked && onExit(game.player)) {
      winGame();
      return;
    }
    if (game.vault.cracked) {
      setObjective("Vault open — grab the loot and reach the GETAWAY van.");
    } else if (nearVault(game.player)) {
      setObjective("At the safe — press E to crack it.");
    }
  } else {
    updateVault(game.vault, dt);
  }

  const grabber = guardTouching(game.guards, game.player);
  if (grabber) {
    caughtGame("grabbed");
    return;
  }
  if (game.alarm >= 100) {
    caughtGame("alarm");
    return;
  }
}

function render() {
  const t = game.now;
  const pulse = (Math.sin(t * 5) + 1) / 2;
  drawFloor(ctx);
  drawDuct(ctx);
  drawExit(ctx, game.vault.cracked, pulse);
  drawLoot(ctx, LEVEL.loot, game.player.lootTaken, t);
  drawVault(ctx, game.vault, pulse);
  drawWallsAndCover(ctx);
  drawGuards(ctx, game.guards);
  drawCameras(ctx, game.cameras, t);
  drawSmoke(ctx, game.smokes, t);
  drawPlayer(ctx, game.player, t);
  if (game.state === "vault") drawVaultDial(ctx, game.vault);
  updateHud();
}

let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (!game.frozen) stepGame(dt);
  render();
  requestAnimationFrame(frame);
}

// --- Input: keyboard, mouse click-to-move, touch, on-screen buttons ---

const KEYMAP = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  const dir = KEYMAP[e.code];
  if (dir) game.input[dir] = true;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") game.input.sneak = true;
  if (e.code === "KeyM") {
    game.audio.muted = !game.audio.muted;
    if (game.audio.muted) stopAlarmDrone(game.audio);
    flashMessage(game.audio.muted ? "Sound muted." : "Sound on.");
  }
  if (e.code === "KeyR") {
    if (game.state !== "menu") resetGame();
  }
  if (e.code === "KeyP") {
    if (game.state === "playing") {
      game.state = "paused";
      showScreen("<h1>PAUSED</h1><p>The gallery holds its breath.</p><button id='resume'>Resume (P)</button>");
      $("resume").addEventListener("click", () => {
        game.state = "playing";
        showScreen(null);
      });
    } else if (game.state === "paused") {
      game.state = "playing";
      showScreen(null);
    }
  }
  if (e.code === "KeyE") interact();
  if (e.code === "Digit1") {
    const cloud = useSmoke(game.player, game.now);
    if (cloud) {
      game.smokes.push(cloud);
      soundSmoke(game.audio);
      flashMessage("Smoke pellet — the cones can't see through it.");
    } else {
      flashMessage("No smoke pellets left.");
    }
  }
  if (e.code === "Digit2") {
    const until = useJammer(game.player, game.now);
    if (until !== null) {
      game.jammerUntil = until;
      for (const c of game.cameras) c.disabledUntil = until;
      flashMessage(`Jammer on — cameras dark for 8s (−$${JAMMER_SCORE_COST}).`);
    } else {
      flashMessage("No jammers left.");
    }
  }
  if (e.code === "Escape") closeVaultMinigame();
  if (e.code === "Space" && game.state === "vault") {
    const result = pressVaultDial(game.vault);
    if (result === "hit") {
      soundDialHit(game.audio);
      flashMessage(`Clean turn ${game.vault.hits} of ${VAULT_HITS_TO_CRACK}.`);
    } else if (result === "cracked") {
      game.player.score += LEVEL.vaultLootValue;
      game.vault.cracked = true;
      soundCracked(game.audio);
      flashMessage(`The safe swings open — the Meridian fortune (+$${LEVEL.vaultLootValue}). Get out!`);
      setObjective("Vault open — grab the loot and reach the GETAWAY van.");
      game.state = "playing";
    } else {
      game.alarm = Math.min(100, game.alarm + ALARM_MISS_PENALTY);
      soundDialMiss(game.audio);
      flashMessage("The tumbler clunks — loud. Alarm +12.");
    }
  }
});

window.addEventListener("keyup", (e) => {
  const dir = KEYMAP[e.code];
  if (dir) game.input[dir] = false;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") game.input.sneak = false;
});

function canvasPoint(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * LEVEL.width,
    y: ((clientY - r.top) / r.height) * LEVEL.height,
  };
}

canvas.addEventListener("pointerdown", (e) => {
  if (game.state !== "playing") return;
  const p = canvasPoint(e.clientX, e.clientY);
  game.player.moveTarget = p;
});

function bindButton(id, fn) {
  const el = $(id);
  if (el) el.addEventListener("click", fn);
}
bindButton("btn-smoke", () => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit1" })));
bindButton("btn-jammer", () => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit2" })));
bindButton("btn-use", () => interact());
bindButton("btn-sneak", () => {
  game.input.sneak = !game.input.sneak;
  $("btn-sneak").classList.toggle("active", game.input.sneak);
});

// --- Photo mode: stage a real frame of the game for screenshots ---
// The staged frame is rendered by the same draw code as live play.

function stageShot(kind) {
  resetGame();
  game.shot = kind;
  game.frozen = true; // hold the staged frame still for the screenshot
  if (kind === "cover") {
    game.player.x = 400;
    game.player.y = 350;
    game.guards[0].x = 300;
    game.guards[0].y = 260;
    game.guards[0].angle = 0;
    game.guards[1].x = 450;
    game.guards[1].y = 150;
    game.guards[1].angle = Math.PI;
    game.guards[2].x = 760;
    game.guards[2].y = 470;
    game.guards[2].angle = -Math.PI / 2;
    game.cameras[0].angle = Math.PI / 2 + 0.5;
    game.cameras[1].angle = Math.PI - 0.4;
    game.alarm = 38;
    game.timeLeft = 222;
    setObjective("Crack the vault — the safe holds the Meridian fortune.");
  } else if (kind === "vault") {
    game.player.x = 860;
    game.player.y = 165;
    game.vault.hits = 1;
    openVault(game.vault, true);
    game.vault.hits = 1;
    game.state = "vault";
    game.alarm = 55;
    game.timeLeft = 150;
    setObjective("Crack the safe — three clean turns.");
  } else if (kind === "getaway") {
    game.player.x = 120;
    game.player.y = 500;
    game.player.moveTarget = { x: 52, y: 548 };
    game.vault.cracked = true;
    game.player.lootTaken = ["gold1", "gold2", "diamond", "painting"];
    game.player.score = 700 + LEVEL.vaultLootValue;
    game.guards[0].x = 210;
    game.guards[0].y = 480;
    game.guards[0].angle = Math.atan2(500 - 480, 120 - 210);
    game.guards[0].chasing = true;
    game.guards[0].lastSeenX = 120;
    game.guards[0].lastSeenY = 500;
    game.alarm = 82;
    game.timeLeft = 45;
    setObjective("Vault open — grab the loot and reach the GETAWAY van.");
  } else if (kind === "caught") {
    // The caught moment itself: alarm at 100, the guard on the thief,
    // the room still visible (the end screen stays off for the photo).
    game.alarm = 100;
    game.peakAlarm = 100;
    game.timeLeft = 137;
    game.player.x = 320;
    game.player.y = 260;
    game.guards[0].x = 300;
    game.guards[0].y = 260;
    game.guards[0].angle = 0;
    game.guards[0].seenNow = true;
    game.guards[0].chasing = true;
    flashMessage("CAUGHT! The alarm hit 100%.");
    setObjective("Caught — the gallery doors slam shut.");
  }
  render();
}

// --- Self-test: play the game through its own stepGame() with scripted input
// and report the result in the page, for headless verification. ---

function selftestWin() {
  const log = [];
  const dt = 1 / 60;
  const waypoints = [
    { x: 120, y: 100 }, // up the west corridor
    { x: 120, y: 60 }, // through the west grate, into the duct
    { x: 860, y: 60 }, // crawl the duct, unseen
    { x: 860, y: 165 }, // drop through the east grate, at the safe
    { x: 780, y: 150 }, // pocket the Meridian Diamond
    { x: 860, y: 60 }, // back into the duct
    { x: 120, y: 60 }, // crawl back west
    { x: 120, y: 540 }, // down the west corridor
    { x: 52, y: 548 }, // out the getaway door
  ];
  let wp = 0;
  let steps = 0;
  const maxSteps = 60 * 240;
  resetGame();
  game.audio.muted = true;
  while (steps < maxSteps && game.state !== "win" && game.state !== "caught" && game.state !== "timeout") {
    steps += 1;
    if (game.alarm > 35 && game.player.smokeLeft > 0) {
      const cloud = useSmoke(game.player, game.now);
      if (cloud) game.smokes.push(cloud);
    }
    if (game.state === "vault") {
      // Press the dial when the needle sits inside the green zone.
      const needle = Math.sin(game.vault.phase);
      if (Math.abs(needle - game.vault.zoneCenter) <= game.vault.zoneHalf - 0.03) {
        const result = pressVaultDial(game.vault);
        if (result === "cracked") {
          game.player.score += LEVEL.vaultLootValue;
          game.vault.cracked = true;
          game.state = "playing";
        }
      }
    } else if (game.state === "playing") {
      if (wp === 3 && nearVault(game.player) && !game.vault.cracked) {
        openVaultMinigame();
      } else if (wp < waypoints.length) {
        game.player.moveTarget = waypoints[wp];
        const target = waypoints[wp];
        if (Math.hypot(target.x - game.player.x, target.y - game.player.y) < 10) wp += 1;
      }
    }
    stepGame(dt);
  }
  const pass = game.state === "win";
  log.push(`state=${game.state}`, `steps=${steps}`, `wp=${wp}`, `pos=${game.player.x.toFixed(0)},${game.player.y.toFixed(0)}`, `alarm=${game.alarm.toFixed(1)}`, `peak=${game.peakAlarm.toFixed(1)}`, `score=${game.player.score}`, `loot=${game.player.lootTaken.join(",")}`, `timeLeft=${game.timeLeft.toFixed(1)}`);
  return { pass, detail: log.join(" ") };
}

function selftestLose() {
  const dt = 1 / 60;
  let steps = 0;
  const maxSteps = 60 * 120;
  resetGame();
  game.audio.muted = true;
  // Walk straight at the patrolling guard and stand in his cone.
  while (steps < maxSteps && game.state !== "caught" && game.state !== "win" && game.state !== "timeout") {
    steps += 1;
    const g = game.guards[0];
    game.player.moveTarget = { x: g.x, y: g.y };
    stepGame(dt);
  }
  const pass = game.state === "caught";
  return { pass, detail: `state=${game.state} end=${game.endReason} steps=${steps} alarm=${game.alarm.toFixed(1)}` };
}

function runSelftest(kind) {
  let result;
  try {
    result = kind === "lose" ? selftestLose() : selftestWin();
  } catch (err) {
    result = { pass: false, detail: `threw ${err.message}` };
  }
  render();
  const text = `SELFTEST ${kind.toUpperCase()} ${result.pass ? "PASS" : "FAIL"} — ${result.detail}`;
  const el = $("selftest-result");
  el.textContent = text;
  el.classList.remove("hidden");
  document.title = text;
  return result;
}

// --- Boot ---

function menuHtml() {
  return (
    `<h1>MERIDIAN MIDNIGHT</h1>` +
    `<p class="tagline">One gallery. One safe. One van idling in the dark.</p>` +
    `<p>You are the thief. Cross the Meridian Gallery, crack the vault safe, pocket the loot, and slip out the getaway door before the alarm hits 100% or dawn breaks at 05:00.</p>` +
    `<p class="controls"><b>WASD / arrows</b> move &nbsp;·&nbsp; <b>Shift</b> sneak (slower, harder to spot) &nbsp;·&nbsp; <b>click / tap</b> walk there<br>` +
    `<b>E</b> work the safe &nbsp;·&nbsp; <b>Space</b> stop the dial in the green &nbsp;·&nbsp; <b>1</b> smoke pellet &nbsp;·&nbsp; <b>2</b> camera jammer (−$100)<br>` +
    `<b>R</b> restart &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>M</b> mute</p>` +
    `<p class="routes">Three ways in: the <b>main hall</b> (fast, patrolled), the <b>west corridor</b> (quiet), the <b>air duct</b> (slow crawl, unseen). Display cases break a guard's line of sight. Cameras sweep — jam them or time them.</p>` +
    `<button id="start-btn">Start the heist</button>`
  );
}

function bindStartButton() {
  $("start-btn").addEventListener("click", () => {
    game.audio.muted = false;
    resetGame();
  });
}

const params = new URLSearchParams(window.location.search);
game.shot = params.get("shot");
game.selftest = params.get("selftest");

if (game.selftest) {
  showScreen(null);
  runSelftest(game.selftest);
} else if (game.shot) {
  showScreen(null);
  stageShot(game.shot);
} else {
  // Menu over a live, idling gallery scene behind the overlay.
  resetGame();
  game.state = "menu";
  showScreen(menuHtml());
  bindStartButton();
}

// Debug handle for headless checks: live state, never used by the game itself.
window.__heist = {
  game,
  state: () => game.state,
  alarm: () => game.alarm,
  score: () => game.player.score,
  timeLeft: () => game.timeLeft,
};

requestAnimationFrame(frame);
