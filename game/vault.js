// vault.js — the safe-cracking minigame: a sweeping needle, a green zone,
// three clean hits to open the Meridian safe. A miss is loud: it feeds the alarm.
// The dial keeps sweeping while the thief works, and the world outside keeps moving.

export const VAULT_HITS_TO_CRACK = 3;

export function makeVault() {
  return {
    hits: 0,
    cracked: false,
    // Needle position in [-1, 1]; the needle sweeps as a sine of the phase.
    phase: 0,
    speed: 2.2, // radians per second; rises with every clean hit
    zoneCenter: 0.3,
    zoneHalf: 0.28, // wider with the lockpick
    lockpickUsed: false,
  };
}

// Pick a new green zone, away from the needle's current spot.
export function newZone(vault) {
  let c = (Math.random() * 1.6 - 0.8);
  const needle = Math.sin(vault.phase);
  if (Math.abs(c - needle) < 0.45) c = needle > 0 ? c - 0.6 : c + 0.6;
  vault.zoneCenter = Math.max(-0.8, Math.min(0.8, c));
}

// Current needle position, in [-1, 1].
export function needlePosition(vault) {
  return Math.sin(vault.phase);
}

// Advance the needle. Call every frame while the minigame is open.
export function updateVault(vault, dt) {
  vault.phase += vault.speed * dt;
}

// Press the dial (Space). Returns "hit", "cracked" or "miss".
// A hit banks one clean turn and quickens the needle; a miss feeds the alarm.
export function pressVaultDial(vault) {
  const needle = needlePosition(vault);
  if (Math.abs(needle - vault.zoneCenter) <= vault.zoneHalf) {
    vault.hits += 1;
    vault.speed += 0.55;
    if (vault.hits >= VAULT_HITS_TO_CRACK) {
      vault.cracked = true;
      return "cracked";
    }
    newZone(vault);
    return "hit";
  }
  return "miss";
}

// Start a cracking attempt. With the lockpick in the kit the green zone is wider.
export function openVault(vault, hasLockpick) {
  vault.hits = 0;
  vault.phase = 0;
  vault.speed = 2.2;
  vault.zoneHalf = hasLockpick ? 0.42 : 0.28;
  vault.lockpickUsed = hasLockpick;
  newZone(vault);
}
