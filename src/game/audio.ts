// Procedural audio via WebAudio — no external assets required.
export class AudioSys {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  volume = 0.6;
  private noiseBuf: AudioBuffer | null = null;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }
  resume() { this.ctx?.resume(); }
  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }

  private noise(duration: number, gain: number, filterFreq: number, q = 1, type: BiquadFilterType = 'lowpass', pan = 0, decay = true) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    if (decay) g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(f); f.connect(g); g.connect(p); p.connect(this.master);
    src.start(t); src.stop(t + duration + 0.05);
  }
  private tone(freq: number, duration: number, gain: number, type: OscillatorType = 'square', pan = 0, slide = 0) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(g); g.connect(p); p.connect(this.master);
    o.start(t); o.stop(t + duration + 0.02);
  }

  shoot(cls: string, distance = 0, pan = 0) {
    const att = 1 / (1 + distance * 0.06);
    switch (cls) {
      case 'pistol': this.noise(0.12, 0.5 * att, 1800, 1, 'lowpass', pan); this.tone(180, 0.08, 0.25 * att, 'square', pan, -120); break;
      case 'smg': this.noise(0.09, 0.45 * att, 2200, 1, 'lowpass', pan); this.tone(220, 0.05, 0.2 * att, 'square', pan, -150); break;
      case 'rifle': this.noise(0.16, 0.6 * att, 1400, 1, 'lowpass', pan); this.tone(120, 0.1, 0.35 * att, 'sawtooth', pan, -80); break;
      case 'sniper': this.noise(0.4, 0.8 * att, 900, 1, 'lowpass', pan); this.tone(70, 0.3, 0.5 * att, 'sawtooth', pan, -40); break;
      case 'shotgun': this.noise(0.3, 0.8 * att, 700, 1, 'lowpass', pan); this.tone(60, 0.2, 0.5 * att, 'sawtooth', pan, -30); break;
      case 'heavy': this.noise(0.14, 0.6 * att, 1200, 1, 'lowpass', pan); this.tone(100, 0.1, 0.3 * att, 'sawtooth', pan, -60); break;
      case 'knife': this.noise(0.08, 0.3, 3000, 2, 'bandpass', pan); break;
      default: this.noise(0.1, 0.4 * att, 1500, 1, 'lowpass', pan);
    }
  }
  dryFire() { this.tone(900, 0.04, 0.15, 'square'); }
  reload(stage: 0 | 1 | 2) {
    if (stage === 0) { this.noise(0.05, 0.3, 3000, 3, 'bandpass'); this.tone(400, 0.05, 0.1, 'square'); }
    else if (stage === 1) { this.noise(0.06, 0.35, 2000, 3, 'bandpass'); }
    else { this.tone(700, 0.05, 0.15, 'square', 0, 200); this.noise(0.04, 0.3, 4000, 3, 'bandpass'); }
  }
  hit(headshot: boolean) {
    if (headshot) { this.tone(1200, 0.08, 0.3, 'square', 0, -400); this.tone(1800, 0.06, 0.15, 'sine'); }
    else { this.tone(800, 0.05, 0.25, 'square', 0, -200); }
  }
  hurt() { this.noise(0.15, 0.4, 500, 1, 'lowpass'); this.tone(150, 0.15, 0.2, 'sawtooth', 0, -60); }
  kill() { this.tone(600, 0.1, 0.2, 'sine'); setTimeout(() => this.tone(900, 0.15, 0.2, 'sine'), 80); }
  footstep(pan = 0, dist = 0) { const att = 1 / (1 + dist * 0.3); this.noise(0.07, 0.12 * att, 400 + Math.random() * 200, 1, 'lowpass', pan); }
  explosion(dist = 0, pan = 0) { const att = 1 / (1 + dist * 0.03); this.noise(1.0, 1.0 * att, 300, 1, 'lowpass', pan); this.tone(50, 0.6, 0.6 * att, 'sawtooth', pan, -30); }
  flash() { this.tone(3000, 1.2, 0.3, 'sine'); this.noise(0.3, 0.5, 4000, 1, 'highpass'); }
  smokePop() { this.noise(0.6, 0.3, 1500, 1, 'bandpass'); }
  bombBeep() { this.tone(2000, 0.08, 0.25, 'square'); }
  plant() { this.tone(500, 0.1, 0.15, 'square'); this.tone(600, 0.1, 0.15, 'square'); }
  roundStart() { this.tone(523, 0.15, 0.2, 'square'); setTimeout(() => this.tone(659, 0.15, 0.2, 'square'), 150); setTimeout(() => this.tone(784, 0.25, 0.2, 'square'), 300); }
  roundWin() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 0.25, 'square'), i * 120)); }
  roundLose() { [400, 350, 300, 200].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 0.25, 'sawtooth'), i * 150)); }
  buy() { this.tone(1000, 0.05, 0.15, 'square'); setTimeout(() => this.tone(1400, 0.08, 0.15, 'square'), 60); }
  click() { this.tone(1200, 0.03, 0.08, 'square'); }
  swap() { this.noise(0.05, 0.25, 2500, 2, 'bandpass'); }
  levelUp() { [660, 880, 1100].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 0.25, 'square'), i * 70)); }
  throwPin() { this.tone(2500, 0.04, 0.12, 'square'); }
  bounce(dist = 0) { this.tone(300, 0.05, 0.15 / (1 + dist * 0.1), 'square', 0, -100); }
  land() { this.noise(0.1, 0.25, 500, 1, 'lowpass'); }
  defuseTick() { this.tone(1500, 0.03, 0.08, 'square'); }
}

export const audio = new AudioSys();
