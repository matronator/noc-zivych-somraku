import type { SfxName } from "./engine";

const MASTER_VOLUME = 0.5;

export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private last = new Map<SfxName, number>();

  unlock() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate);
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.03);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, lowpass?: number) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = lowpass;
      osc.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = "bandpass", delay = 0) {
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.noiseBuffer;
    if (!ctx || !master || !buffer) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.05);
  }

  /** A formant-filtered sawtooth "uuuhhh" — the zombie moan, begging edition. */
  private groanVoice(delay = 0, pitch = 1) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const base = (78 + Math.random() * 36) * pitch;
    const dur = 0.75 + Math.random() * 0.3;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(base * 1.15, t);
    osc.frequency.linearRampToValueAtTime(base, t + dur * 0.4);
    osc.frequency.linearRampToValueAtTime(base * 0.82, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5 + Math.random() * 2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = base * 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const formant = ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.frequency.setValueAtTime(540, t);
    formant.frequency.linearRampToValueAtTime(380, t + dur);
    formant.Q.value = 3;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.12);
    gain.gain.setValueAtTime(0.18, t + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(formant);
    formant.connect(low);
    low.connect(gain);
    gain.connect(master);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  play(name: SfxName) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const minGap = name === "groan" ? 0.9 : name === "coin" ? 0.04 : name === "deny" ? 0.25 : 0.05;
    const prev = this.last.get(name) ?? -1;
    if (now - prev < minGap) return;
    this.last.set(name, now);
    switch (name) {
      case "shove":
        this.noise(0.22, 0.45, 1400, 260);
        this.tone("square", 240, 110, 0.14, 0.09, 0, 1400);
        break;
      case "shoveHit":
        this.noise(0.22, 0.45, 1400, 260);
        this.tone("square", 240, 110, 0.14, 0.09, 0, 1400);
        this.tone("sine", 150, 50, 0.2, 0.42);
        this.noise(0.1, 0.3, 300, 100, "lowpass", 0.02);
        break;
      case "hit":
        this.tone("square", 520, 240, 0.16, 0.12, 0, 2000);
        this.tone("triangle", 390, 170, 0.26, 0.16, 0.07);
        this.noise(0.09, 0.3, 500, 150, "lowpass");
        break;
      case "coin":
        this.tone("square", 1320, 1320, 0.06, 0.06, 0, 5000);
        this.tone("square", 1760, 1760, 0.14, 0.06, 0.06, 5000);
        break;
      case "cink":
        this.tone("triangle", 2350, 2300, 0.28, 0.1);
        this.tone("sine", 3520, 3500, 0.2, 0.05, 0.02);
        break;
      case "throw":
        this.noise(0.16, 0.2, 1800, 5200, "highpass");
        break;
      case "groan":
        this.groanVoice(0, 1);
        break;
      case "alert":
        this.tone("square", 880, 1320, 0.09, 0.07, 0, 3000);
        break;
      case "horde":
        this.noise(1.4, 0.35, 180, 90, "lowpass");
        for (let i = 0; i < 4; i += 1) this.groanVoice(i * 0.18, 0.85 + Math.random() * 0.35);
        break;
      case "power":
        [523, 659, 784, 1047].forEach((f, i) => this.tone("sine", f, f, 0.12, 0.12, i * 0.06));
        break;
      case "deny":
        this.tone("square", 150, 130, 0.14, 0.07, 0, 900);
        break;
      case "win":
        this.tone("sawtooth", 311, 311, 0.9, 0.09, 0, 1400);
        this.tone("sawtooth", 392, 392, 0.9, 0.07, 0, 1400);
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone("triangle", f, f, 0.18, 0.1, 0.5 + i * 0.09));
        break;
      case "lose":
        [
          [392, 370],
          [370, 349],
          [349, 330],
          [330, 262],
        ].forEach(([a, b], i) => this.tone("sawtooth", a, b, i === 3 ? 0.9 : 0.32, 0.1, i * 0.34, 900));
        break;
      case "lunge":
        this.noise(0.24, 0.3, 500, 2600);
        break;
      case "belch":
        this.tone("sawtooth", 95, 55, 0.55, 0.16, 0, 320);
        this.noise(0.5, 0.2, 260, 120, "lowpass");
        break;
      case "bonk":
        this.tone("sine", 320, 80, 0.14, 0.3);
        break;
      case "zone":
        this.tone("triangle", 660, 660, 0.1, 0.1);
        this.tone("triangle", 990, 990, 0.18, 0.1, 0.1);
        break;
      case "boss":
        this.tone("sawtooth", 70, 42, 0.9, 0.2, 0, 380);
        this.noise(0.9, 0.3, 320, 90, "lowpass");
        this.groanVoice(0.05, 0.6);
        break;
      case "tick":
        this.tone("square", 1000, 1000, 0.035, 0.05, 0, 4000);
        break;
    }
  }
}
