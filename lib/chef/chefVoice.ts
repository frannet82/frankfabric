// ---------------------------------------------------------------------------
// Chef voice — in-browser "bork bork" mumble synthesizer (Web Audio API).
//
// AUDIO SOURCE / LICENSE: There is NO audio file. This is 100% synthesized in
// the browser at runtime with the Web Audio API (oscillators + gain envelopes
// + a lightweight band-pass "formant" filter). No binary asset ships, no clip
// is downloaded, and there is nothing to license — the sound is generated from
// code we wrote here, so it is static-export safe and license-free.
//
// The synth plays a short, playful sequence of pitched "mumble" blips (a nod to
// the Muppets' Swedish Chef "bork bork bork"). Because the AudioContext is
// created/resumed lazily on the user's first send gesture, browser autoplay
// policies do not block it.
//
// An AnalyserNode taps the output so the 3D scene can read a live 0..1
// "loudness" value (RMS of the time-domain buffer) and drive the jaw bone from
// real audio amplitude. When muted, no nodes are created and getLoudness()
// returns 0 (the scene then falls back to a sine oscillation while speaking).
// ---------------------------------------------------------------------------

type WindowWithWebkitAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export class ChefVoice {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private master: GainNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private muted = false;

  // Audible master level when unmuted. The per-blip envelopes peak at ~0.5, so
  // this leaves comfortable headroom below clipping while staying clearly heard.
  private static readonly AUDIBLE_GAIN = 0.9;

  /** Whether audio is currently muted. */
  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.master) return;
    this.master.gain.cancelScheduledValues(0);
    if (muted) {
      // Silence anything in flight immediately.
      this.master.gain.value = 0;
    } else {
      // Restore the audible level so unmuting actually produces sound.
      this.master.gain.value = ChefVoice.AUDIBLE_GAIN;
    }
  }

  /**
   * Lazily create (or resume) the AudioContext. MUST be called from a user
   * gesture (e.g. the send handler) so autoplay policies allow sound.
   */
  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      // Start at an audible level (respecting the current mute flag) so the
      // synthesized voice is actually heard; the analyser taps this node, so an
      // audible master is also what makes live-loudness jaw tracking work.
      this.master.gain.value = this.muted ? 0 : ChefVoice.AUDIBLE_GAIN;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play a short mumble sequence roughly proportional to the reply length.
   * Returns the total duration in milliseconds so the caller can time the
   * "speaking" window. Returns 0 (and plays nothing) when muted.
   */
  speak(text: string): number {
    if (this.muted) return 0;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return 0;

    // One blip per word, clamped to a pleasant range so long replies do not
    // ramble forever.
    const words = Math.max(3, Math.min(14, text.trim().split(/\s+/).length));
    const blipDur = 0.13; // seconds per blip
    const gap = 0.055; // silence between blips
    const start = ctx.currentTime + 0.02;

    for (let i = 0; i < words; i += 1) {
      const t = start + i * (blipDur + gap);
      // Playful pitch wander around a mid vowel range.
      const base = 150 + Math.sin(i * 1.7) * 40 + (i % 3) * 22;
      this.blip(ctx, this.master, t, blipDur, base);
    }

    const total = words * (blipDur + gap);
    return Math.round(total * 1000);
  }

  /** A single vowel-ish blip: a saw osc through a band-pass "formant". */
  private blip(
    ctx: AudioContext,
    dest: AudioNode,
    at: number,
    dur: number,
    freq: number
  ): void {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, at);
    // Slight upward chirp gives each blip a "spoken" bounce.
    osc.frequency.linearRampToValueAtTime(freq * 1.18, at + dur);

    const formant = ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.frequency.value = 720 + freq; // vowel-ish resonance
    formant.Q.value = 6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(formant);
    formant.connect(gain);
    gain.connect(dest);

    osc.start(at);
    osc.stop(at + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      formant.disconnect();
      gain.disconnect();
    };
  }

  /**
   * Live output loudness in 0..1 (RMS of the analyser time-domain buffer).
   * Returns 0 when there is no context (e.g. muted / not yet started) so the
   * scene can fall back to a sine oscillation.
   */
  getLoudness(): number {
    if (!this.analyser || !this.timeData) return 0;
    this.analyser.getByteTimeDomainData(this.timeData);
    let sumSq = 0;
    for (let i = 0; i < this.timeData.length; i += 1) {
      const v = (this.timeData[i] - 128) / 128; // -1..1
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / this.timeData.length);
    // Scale up a touch so a normal blip reads near ~0.6..1.0.
    return Math.min(1, rms * 3.2);
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.analyser = null;
      this.master = null;
      this.timeData = null;
    }
  }
}
