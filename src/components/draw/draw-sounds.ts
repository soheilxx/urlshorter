/**
 * Soundeffekte der Gewinnziehung – vollständig per Web Audio synthetisiert
 * (keine fremden Audiodateien). Start erst nach Nutzeraktion (Autoplay-Regeln).
 * Alle Methoden sind fehlertolerant: ohne AudioContext passiert nichts.
 */
type Ctx = AudioContext;

export class DrawSynth {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private suspenseNodes: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  enabled = true;

  private ensure(): Ctx | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.28;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Muss aus einer Nutzeraktion heraus aufgerufen werden (Autoplay-Policy). */
  unlock() {
    this.ensure();
  }

  private tone(
    freq: number,
    opts: {
      type?: OscillatorType;
      at?: number;
      duration?: number;
      gain?: number;
      attack?: number;
      release?: number;
      slideTo?: number;
    } = {},
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    const t0 = ctx.currentTime + (opts.at ?? 0);
    const dur = opts.duration ?? 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    const peak = opts.gain ?? 0.5;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + (opts.release ?? 0.04));
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + (opts.release ?? 0.04) + 0.02);
  }

  private noise(at = 0, duration = 0.03, gain = 0.25, highpass = 1800) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(ctx.currentTime + at);
  }

  /** Walzen-Tick (je Symbolwechsel), Tonhöhe sinkt mit abnehmender Geschwindigkeit. */
  tick(speed = 1) {
    this.noise(0, 0.018, 0.16, 2600);
    this.tone(520 + 380 * Math.min(1, speed), { type: "square", duration: 0.018, gain: 0.08 });
  }

  /** Walze rastet ein. */
  reelStop(index: number) {
    this.noise(0, 0.05, 0.4, 600);
    this.tone(150 - index * 12, { type: "sine", duration: 0.14, gain: 0.6, slideTo: 70 });
    this.tone(880 + index * 110, { type: "triangle", at: 0.02, duration: 0.08, gain: 0.18 });
  }

  /** Zwei Walzen gleich: kurzer Hinweis-Chime. */
  match() {
    this.tone(988, { type: "square", duration: 0.09, gain: 0.22 });
    this.tone(1319, { type: "square", at: 0.1, duration: 0.14, gain: 0.22 });
  }

  /** Spannungston vor der letzten Walze (steigend, mit Tremolo). Stoppt mit stopSuspense(). */
  startSuspense(durationMs: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    this.stopSuspense();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = "sawtooth";
    const t0 = ctx.currentTime;
    const t1 = t0 + durationMs / 1000;
    osc.frequency.setValueAtTime(196, t0);
    osc.frequency.exponentialRampToValueAtTime(392, t1);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.2);
    lfo.type = "square";
    lfo.frequency.setValueAtTime(6, t0);
    lfo.frequency.linearRampToValueAtTime(16, t1);
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t1 + 0.3);
    lfo.stop(t1 + 0.3);
    this.suspenseNodes = { osc, gain, lfo };
  }

  stopSuspense() {
    const ctx = this.ctx;
    const nodes = this.suspenseNodes;
    if (!ctx || !nodes) return;
    try {
      nodes.gain.gain.cancelScheduledValues(ctx.currentTime);
      nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, ctx.currentTime);
      nodes.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      nodes.osc.stop(ctx.currentTime + 0.1);
      nodes.lfo.stop(ctx.currentTime + 0.1);
    } catch {
      /* bereits gestoppt */
    }
    this.suspenseNodes = null;
  }

  /** „TRIPLE CHANCE“-Jingle: dreimal aufsteigendes Arpeggio (Automaten-Stil). */
  tripleChance() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let round = 0; round < 3; round++) {
      const base = round * 0.42;
      notes.forEach((f, i) =>
        this.tone(f * (1 + round * 0.06), {
          type: "square",
          at: base + i * 0.085,
          duration: 0.09,
          gain: 0.26,
        }),
      );
      this.noise(base, 0.02, 0.1, 3000);
    }
  }

  /** Gewinn-Fanfare: Akkordfolge + Glitzer. */
  fanfare() {
    const chords: Array<[number[], number]> = [
      [[523.25, 659.25, 783.99], 0],
      [[698.46, 880, 1046.5], 0.28],
      [[783.99, 987.77, 1174.66], 0.56],
      [[1046.5, 1318.51, 1567.98], 0.84],
    ];
    for (const [freqs, at] of chords) {
      for (const f of freqs) {
        this.tone(f, {
          type: "triangle",
          at,
          duration: 0.3,
          gain: 0.22,
          attack: 0.01,
          release: 0.2,
        });
        this.tone(f / 2, { type: "sine", at, duration: 0.3, gain: 0.12, release: 0.2 });
      }
    }
    for (let i = 0; i < 10; i++) {
      this.tone(1800 + Math.random() * 1800, {
        type: "sine",
        at: 1.1 + i * 0.07,
        duration: 0.05,
        gain: 0.1,
      });
    }
  }

  /** Lampenlauf-Klick. */
  lamp() {
    this.tone(2400, { type: "square", duration: 0.012, gain: 0.05 });
  }

  /** Start-Knopf. */
  start() {
    this.tone(330, { type: "square", duration: 0.06, gain: 0.25 });
    this.tone(494, { type: "square", at: 0.07, duration: 0.09, gain: 0.25 });
  }

  /** Fehler / nichts zu ziehen. */
  error() {
    this.tone(220, { type: "sawtooth", duration: 0.18, gain: 0.2, slideTo: 110 });
  }
}
