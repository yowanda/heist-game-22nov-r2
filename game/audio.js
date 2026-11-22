// audio.js — all sound is synthesized with WebAudio: no audio files, no network.
// A tiny synth: short blips for pickups, clicks for the safe dial, a rising
// alarm drone while the thief is seen, and a sting for being caught.

export function makeAudio() {
  return {
    ctx: null,
    muted: false,
    alarmNodes: null,
  };
}

function ensureContext(audio) {
  if (!audio.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
  }
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  return audio.ctx;
}

// One short tone: frequency, duration in seconds, waveform, volume.
export function blip(audio, freq, dur, type, vol) {
  if (audio.muted) return;
  const ctx = ensureContext(audio);
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

export function soundPickup(audio) {
  blip(audio, 880, 0.12, "sine", 0.14);
  setTimeout(() => blip(audio, 1320, 0.16, "sine", 0.12), 70);
}

export function soundDialHit(audio) {
  blip(audio, 520, 0.08, "square", 0.08);
}

export function soundDialMiss(audio) {
  blip(audio, 160, 0.25, "sawtooth", 0.12);
}

export function soundCracked(audio) {
  blip(audio, 523, 0.15, "sine", 0.14);
  setTimeout(() => blip(audio, 659, 0.15, "sine", 0.14), 120);
  setTimeout(() => blip(audio, 784, 0.3, "sine", 0.14), 240);
}

export function soundCaught(audio) {
  blip(audio, 220, 0.4, "sawtooth", 0.16);
  setTimeout(() => blip(audio, 110, 0.6, "sawtooth", 0.16), 180);
}

export function soundWin(audio) {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => setTimeout(() => blip(audio, n, 0.25, "sine", 0.14), i * 130));
}

export function soundSmoke(audio) {
  blip(audio, 300, 0.3, "sine", 0.06);
}

// A low pulsing drone while the thief is inside a vision cone.
// Call every frame with the current exposure (0..1); 0 silences it.
export function setAlarmDrone(audio, exposure) {
  if (audio.muted || exposure <= 0) {
    stopAlarmDrone(audio);
    return;
  }
  const ctx = ensureContext(audio);
  if (!ctx) return;
  if (!audio.alarmNodes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 98;
    lfo.type = "sine";
    lfo.frequency.value = 6;
    lfoGain.gain.value = 0.05;
    gain.gain.value = 0;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    lfo.start();
    audio.alarmNodes = { osc, gain, lfo };
  }
  const target = 0.02 + exposure * 0.05;
  audio.alarmNodes.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
}

export function stopAlarmDrone(audio) {
  if (!audio.alarmNodes) return;
  try {
    audio.alarmNodes.osc.stop();
    audio.alarmNodes.lfo.stop();
  } catch (e) {
    /* already stopped */
  }
  audio.alarmNodes = null;
}
