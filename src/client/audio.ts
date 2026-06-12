let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function unlock(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.4, glide = 0): void {
  if (!ctx || !master || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide !== 0) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(dur: number, vol: number, lowpass: number): void {
  if (!ctx || !master || ctx.state !== 'running') return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(620, 0.05, 'square', 0.12),
  good: () => {
    tone(740, 0.08, 'sine', 0.3);
    setTimeout(() => tone(1110, 0.1, 'sine', 0.25), 60);
  },
  bad: () => tone(140, 0.25, 'sawtooth', 0.3, -40),
  splash: () => noise(0.25, 0.35, 900),
  drum: (i: number) => {
    tone([220, 294, 370, 440][i % 4], 0.22, 'sine', 0.5, -30);
    noise(0.08, 0.18, 500);
  },
  gong: () => {
    tone(523, 0.8, 'triangle', 0.5, -10);
    tone(784, 0.6, 'sine', 0.3);
  },
  tick: () => tone(980, 0.05, 'square', 0.15),
  whoosh: () => noise(0.18, 0.25, 2400),
  flame: () => noise(0.3, 0.25, 1200),
  slip: () => tone(330, 0.2, 'sawtooth', 0.25, -160),
  cheer: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110));
    noise(0.7, 0.12, 3000);
  },
  sad: () => {
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.16), i * 140));
  }
};
