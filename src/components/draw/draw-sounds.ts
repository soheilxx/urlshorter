/**
 * Synthetisierte Klangkulisse der Gewinnziehung (Web Audio, keine Fremddateien):
 * Countdown, Trommelwirbel, Walzen-Ticks und -Stopps, Herzschlag-Spannung,
 * Triple-Chance-Jingle, Fanfare, Applaus, Münzregen. Alles wird erst nach einer
 * Nutzeraktion freigeschaltet (Autoplay-Regeln der Browser).
 */
export class DrawSynth {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private suspenseTimer: number | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private get ready(): { ctx: AudioContext; master: GainNode } | null {
    if (!this.enabled || !this.ctx || !this.master) return null;
    return { ctx: this.ctx, master: this.master };
  }

  private noise(): AudioBuffer | null {
    const r = this.ready;
    if (!r) return null;
    if (!this.noiseBuffer) {
      const len = r.ctx.sampleRate * 2;
      const buf = r.ctx.createBuffer(1, len, r.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  private tone(
    freq: number,
    at: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      gain?: number;
      attack?: number;
      slideTo?: number;
      vibrato?: number;
    } = {},
  ) {
    const r = this.ready;
    if (!r) return;
    const osc = r.ctx.createOscillator();
    const g = r.ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, at);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, at + dur);
    if (opts.vibrato) {
      const lfo = r.ctx.createOscillator();
      const lfoGain = r.ctx.createGain();
      lfo.frequency.value = 6;
      lfoGain.gain.value = opts.vibrato;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur);
    }
    const peak = opts.gain ?? 0.5;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(r.master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private burst(at: number, dur: number, gain: number, filterHz = 1200, q = 0.8) {
    const r = this.ready;
    const buf = this.noise();
    if (!r || !buf) return;
    const src = r.ctx.createBufferSource();
    src.buffer = buf;
    const filter = r.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterHz;
    filter.Q.value = q;
    const g = r.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(g).connect(r.master);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  /** Startknopf: kurzer Zweiklang nach oben */
  start() {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    this.tone(440, t, 0.09, { type: "square", gain: 0.2 });
    this.tone(660, t + 0.09, 0.14, { type: "square", gain: 0.2 });
  }

  /** Countdown-Piep (3-2-1) und Startton */
  countdown(step: number) {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    if (step > 0) {
      this.tone(880, t, 0.14, { type: "square", gain: 0.25 });
    } else {
      this.tone(1320, t, 0.45, { type: "square", gain: 0.3 });
      this.tone(1760, t + 0.05, 0.4, { type: "sine", gain: 0.2 });
    }
  }

  /** Trommelwirbel mit steigender Dichte */
  drumroll(ms: number) {
    const r = this.ready;
    if (!r) return;
    const t0 = r.ctx.currentTime;
    const total = ms / 1000;
    let t = 0;
    let i = 0;
    while (t < total) {
      const p = t / total;
      this.burst(t0 + t, 0.05, 0.18 + p * 0.25, 180 + p * 120, 0.6);
      this.tone(70, t0 + t, 0.06, { type: "triangle", gain: 0.15 + p * 0.2 });
      t += 0.14 - p * 0.1;
      i++;
      if (i > 400) break;
    }
    this.burst(t0 + total, 0.5, 0.55, 300, 0.4);
    this.tone(55, t0 + total, 0.5, { type: "sine", gain: 0.5 });
  }

  /** Walzen-Tick, Tonhöhe folgt der Geschwindigkeit */
  tick(speed: number) {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    this.tone(700 + speed * 900, t, 0.03, { type: "square", gain: 0.08 });
    this.burst(t, 0.02, 0.05, 3000, 1.5);
  }

  /** Walze rastet ein: dumpfer Schlag + metallischer Klick */
  reelStop(i: number) {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    this.tone(120 - i * 15, t, 0.22, { type: "sine", gain: 0.6, slideTo: 50 });
    this.burst(t, 0.09, 0.3, 900 + i * 200, 1.2);
    this.tone(1500 + i * 250, t + 0.01, 0.08, { type: "triangle", gain: 0.12 });
  }

  /** Zwei Walzen gleich: heller Doppelklang */
  match() {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    this.tone(880, t, 0.16, { type: "triangle", gain: 0.3 });
    this.tone(1320, t + 0.14, 0.3, { type: "triangle", gain: 0.3 });
  }

  /** Herzschlag-Spannung bis zur letzten Walze */
  startSuspense(ms: number) {
    this.stopSuspense();
    const r = this.ready;
    if (!r) return;
    const started = performance.now();
    const beat = () => {
      const rr = this.ready;
      if (!rr) return;
      const elapsed = performance.now() - started;
      if (elapsed > ms) {
        this.suspenseTimer = null;
        return;
      }
      const p = Math.min(1, elapsed / ms);
      const t = rr.ctx.currentTime;
      this.tone(60, t, 0.12, { type: "sine", gain: 0.5 + p * 0.3 });
      this.tone(60, t + 0.17, 0.1, { type: "sine", gain: 0.35 + p * 0.3 });
      this.suspenseTimer = window.setTimeout(beat, 720 - p * 380);
    };
    beat();
  }

  stopSuspense() {
    if (this.suspenseTimer !== null) {
      window.clearTimeout(this.suspenseTimer);
      this.suspenseTimer = null;
    }
  }

  /** Triple Chance: Blitz-Schlag + aufsteigender Jingle */
  tripleChance() {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    this.burst(t, 0.35, 0.5, 2000, 0.3);
    this.tone(45, t, 0.5, { type: "sine", gain: 0.6 });
    const seq = [523, 659, 784, 1047, 1319, 1568, 2093];
    seq.forEach((f, i) => this.tone(f, t + 0.12 + i * 0.09, 0.35, { type: "square", gain: 0.2 }));
    seq.forEach((f, i) =>
      this.tone(f * 0.5, t + 0.12 + i * 0.09, 0.4, { type: "triangle", gain: 0.12 }),
    );
  }

  /** Große Fanfare (Blechbläser-Charakter mit Vibrato) */
  fanfare() {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    const chord = (freqs: number[], at: number, dur: number, gain: number) =>
      freqs.forEach((f) => {
        this.tone(f, at, dur, { type: "sawtooth", gain, attack: 0.03, vibrato: 4 });
        this.tone(f * 2, at, dur * 0.8, { type: "square", gain: gain * 0.25, attack: 0.03 });
      });
    chord([392, 494, 587], t, 0.28, 0.14);
    chord([392, 494, 587], t + 0.3, 0.28, 0.14);
    chord([440, 554, 659], t + 0.6, 0.28, 0.14);
    chord([523, 659, 784, 1047], t + 0.9, 1.6, 0.18);
    this.tone(1568, t + 1.2, 1.3, { type: "sine", gain: 0.12, vibrato: 8 });
    this.burst(t + 0.9, 0.6, 0.25, 4000, 0.4);
  }

  /** Applaus-Rauschen (gefiltertes Rauschen in dichten Tupfern) */
  applause(ms: number) {
    const r = this.ready;
    if (!r) return;
    const t0 = r.ctx.currentTime;
    const total = ms / 1000;
    let t = 0;
    let n = 0;
    while (t < total && n < 500) {
      const env = Math.sin((t / total) * Math.PI);
      this.burst(
        t0 + t,
        0.04 + Math.random() * 0.05,
        0.05 + env * 0.14,
        1500 + Math.random() * 2500,
        0.9,
      );
      t += 0.025 + Math.random() * 0.045;
      n++;
    }
  }

  /** Münzregen: Kaskade heller Pings */
  coins(count = 18) {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const f = 2200 + Math.random() * 2200;
      const at = t + i * 0.07 + Math.random() * 0.03;
      this.tone(f, at, 0.14, { type: "sine", gain: 0.12 });
      this.tone(f * 1.5, at, 0.08, { type: "triangle", gain: 0.05 });
    }
  }

  /** Lampenlauf-Klick */
  lamp() {
    const r = this.ready;
    if (!r) return;
    this.tone(2400, r.ctx.currentTime, 0.02, { type: "square", gain: 0.05 });
  }

  /** Overlay fliegt ein */
  whoosh() {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    this.burst(t, 0.35, 0.25, 600, 0.3);
    this.tone(200, t, 0.35, { type: "sine", gain: 0.15, slideTo: 900 });
  }

  /** Fehlerton */
  error() {
    const r = this.ready;
    if (!r) return;
    const t = r.ctx.currentTime;
    this.tone(220, t, 0.18, { type: "sawtooth", gain: 0.2 });
    this.tone(160, t + 0.2, 0.3, { type: "sawtooth", gain: 0.2 });
  }
}
