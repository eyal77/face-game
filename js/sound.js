// Retro sound effects synthesized with the Web Audio API (no audio files).
const MUTE_KEY = "face-runner-muted";

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = readMuted();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Browsers only allow audio after a user gesture; call this from click/keydown. */
export function unlockAudio() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Preference just won't persist.
  }
  return muted;
}

function tone({ type = "square", from, to, duration, volume, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noise({ duration, volume, filterFrom, filterTo }) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFrom, t);
  filter.frequency.exponentialRampToValueAtTime(filterTo, t + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + duration);
}

const effects = {
  jump: () => tone({ from: 280, to: 720, duration: 0.16, volume: 0.18 }),
  shoot: () => tone({ from: 1100, to: 220, duration: 0.09, volume: 0.1 }),
  hit: () => {
    noise({ duration: 0.35, volume: 0.45, filterFrom: 4000, filterTo: 150 });
    tone({ type: "triangle", from: 220, to: 45, duration: 0.3, volume: 0.35 });
  },
  block: () => tone({ from: 1500, to: 1100, duration: 0.05, volume: 0.06 }),
  hurt: () => {
    tone({ type: "sawtooth", from: 420, to: 90, duration: 0.35, volume: 0.22 });
    noise({ duration: 0.15, volume: 0.2, filterFrom: 1500, filterTo: 300 });
  },
};

export function play(name) {
  if (!ctx || muted || ctx.state !== "running") return;
  effects[name]?.();
}
