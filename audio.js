const PITCH_TABLE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 7, 5, 2];
const SILENT = /[，。！？、；：,.!?~～…—\s\n]/;

function hash(code) {
  let h = (code * 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

export class Voice {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.dest = dest;
    this.enabled = true;
  }

  speak(ch) {
    if (!this.enabled || SILENT.test(ch)) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const h = hash((ch.codePointAt(0) || 0) + 1);
    const semis = PITCH_TABLE[h % PITCH_TABLE.length];
    const f0 = 300 * Math.pow(2, semis / 12) * (h % 7 === 0 ? 2 : 1);
    const dur = 0.078;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f0 * 1.16, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + dur);

    const formant = ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.frequency.value = f0 * 2.0;
    formant.Q.value = 4.2;

    const body = ctx.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = 2800;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.3, t + 0.009);
    env.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(formant).connect(body).connect(env).connect(this.dest);
    osc.start(t);
    osc.stop(t + dur + 0.012);
  }

  chime(freq = 1046) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [mul, gain] of [[1, 0.2], [1.5, 0.09]]) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq * mul;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(env).connect(this.dest);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  }

  fanfare() {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    [1046, 1318, 1568, 2093].forEach((f, i) => {
      const t = t0 + i * 0.075;
      const osc = ctx.createOscillator();
      const shimmer = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      shimmer.type = "sine";
      shimmer.frequency.value = f * 2.02;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.26, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
      osc.connect(env);
      shimmer.connect(env);
      env.connect(this.dest);
      osc.start(t);
      shimmer.start(t);
      osc.stop(t + 0.75);
      shimmer.stop(t + 0.75);
    });
  }
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const ROOT = 261.63;

export class Bgm {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.dest = dest;
    this.step = 0;
    this.timer = 0;
  }

  noteAt(i) {
    const pattern = [0, 3, 1, 4, 2, 5, 3, 6, 4, 7, 5, 8, 6, 9, 7, 5];
    return ROOT * Math.pow(2, SCALE[pattern[i % pattern.length]] / 12);
  }

  tick() {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    const f = this.noteAt(this.step);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;

    const soft = ctx.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 1500;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.075, t + 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);

    osc.connect(soft).connect(env).connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.66);

    if (this.step % 4 === 0) {
      const bass = ctx.createOscillator();
      const benv = ctx.createGain();
      bass.type = "sine";
      bass.frequency.value = f / 4;
      benv.gain.setValueAtTime(0.0001, t);
      benv.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
      benv.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      bass.connect(benv).connect(this.dest);
      bass.start(t);
      bass.stop(t + 1.15);
    }
    this.step += 1;
  }

  start() {
    if (this.timer) return;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 330);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = 0;
  }
}

let shared = null;

export function audio() {
  if (shared) return shared;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const verb = ctx.createConvolver();
  const rate = ctx.sampleRate;
  const impulse = ctx.createBuffer(2, rate * 1.1, rate);
  for (let c = 0; c < 2; c += 1) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3.2);
    }
  }
  verb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.16;
  master.connect(ctx.destination);
  master.connect(verb).connect(wet).connect(ctx.destination);
  shared = { ctx, master, voice: new Voice(ctx, master), bgm: new Bgm(ctx, master) };
  return shared;
}

export async function unlockAudio() {
  const a = audio();
  if (a.ctx.state === "suspended") await a.ctx.resume();
  return a;
}
