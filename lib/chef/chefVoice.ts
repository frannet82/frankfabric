// ---------------------------------------------------------------------------
// Chef voice — plays a recorded MP3 voice line while the reply is displayed.
//
// AUDIO SOURCE: the chef's voice is a fixed recording shipped as a static
// asset, public/audio/chef-voice.mp3 (resolved through asset() so it carries
// the GitHub Pages base path). Playback goes through a single HTMLAudioElement
// created lazily on the client. This replaces the previous Web Speech API
// (window.speechSynthesis) approach.
//
// FIXED-RECORDING TRADEOFF: because the MP3 is one fixed recording, speak(text)
// does NOT synthesize the reply words — it plays the SAME recorded line every
// time. The `text` argument is used only to decide WHETHER to play (a non-empty
// reply opens the speaking window); it is never spoken. The speaking window is
// therefore driven by the REAL audio duration, opening on actual playback start
// and closing on 'ended'/'error'/cancel/stop. So "speaks the actual words"
// becomes "plays the recorded voice line while the reply is displayed".
//
// LIVE LOUDNESS: unlike SpeechSynthesis (which exposes no amplitude), the
// MediaElement is routed through a Web Audio graph
// (AudioContext -> MediaElementAudioSourceNode(audioEl) -> AnalyserNode ->
// destination) so getLoudness() returns a REAL smoothed 0..1 RMS amplitude
// while the clip plays. This lets the chef's jaw track the actual voice (the
// scene already prefers loudness over its sine fallback). getLoudness() returns
// 0 when idle or muted. If AudioContext is unavailable the audio still plays and
// getLoudness() falls back to 0 (the scene then uses its sine wobble).
//
// ROBUSTNESS (kept in spirit from the old wrapper): anti-overlap (a new clip
// stops the previous one first), a single-shot finish() so onEnd fires exactly
// once per play, and a caught play() promise rejection routed through onEnd so a
// blocked autoplay never wedges the speaking window. speak() is only ever called
// from the user's send gesture, so browser autoplay policy allows playback; we
// resume() the AudioContext inside that gesture as well.
//
// All of this is fully client-side and static-export safe: nothing touches
// window/Audio at module load — the element and audio graph are created lazily
// on first speak() (guarded by typeof window / typeof Audio).
// ---------------------------------------------------------------------------

import { asset } from "@/lib/asset";

type SpeakCallbacks = {
  // Fired when playback actually begins (mouth-motion window opens).
  onStart?: () => void;
  // Fired when playback ends, is canceled, or errors (mouth-motion window closes).
  onEnd?: () => void;
};

const CHEF_VOICE_SRC = "/audio/chef-voice.mp3";

export class ChefVoice {
  private muted = false;
  // The HTMLAudioElement, created lazily on the client on first speak().
  private audio: HTMLAudioElement | null = null;
  // Web Audio graph for real loudness. Created lazily alongside the element.
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  // True once the analyser graph could not be built, so we stop retrying and
  // just play the audio with getLoudness() -> 0.
  private analyserUnavailable = false;
  // Smoothed loudness, eased toward the raw RMS each read for a stable jaw.
  private smoothedLoudness = 0;
  // Whether a clip is currently playing (gates getLoudness()).
  private playing = false;
  // finish() bound to the in-flight play, so a superseding play can detach it.
  private currentFinish: (() => void) | null = null;

  constructor() {
    // Nothing to prime — the element and audio graph are created lazily on the
    // first speak() call (which happens inside a user gesture), keeping module
    // load side-effect free and static-export / SSR safe.
  }

  /** Whether audio is currently muted. */
  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      // Silence anything in flight immediately and close its window.
      this.stop();
    }
  }

  /**
   * Lazily create the HTMLAudioElement pointing at the recorded MP3. Guards
   * typeof window / typeof Audio so it never runs during SSR / static export.
   * Returns null when audio is unavailable (the caller then no-ops gracefully).
   */
  private ensureAudio(): HTMLAudioElement | null {
    if (this.audio) return this.audio;
    if (typeof window === "undefined" || typeof Audio === "undefined") {
      return null;
    }
    const el = new Audio(asset(CHEF_VOICE_SRC));
    // Same-origin static file, so no crossOrigin needed. Preload metadata so the
    // clip is ready to start promptly on the send gesture.
    el.preload = "auto";
    this.audio = el;
    return el;
  }

  /**
   * Lazily build the Web Audio graph so getLoudness() can read real amplitude:
   * AudioContext -> MediaElementAudioSourceNode(audioEl) -> AnalyserNode ->
   * destination (the destination hop keeps the audio audible). If the API is
   * missing or graph creation throws, mark it unavailable and let the audio play
   * with getLoudness() -> 0.
   */
  private ensureAnalyser(el: HTMLAudioElement): void {
    if (this.analyser || this.analyserUnavailable) return;
    if (typeof window === "undefined") {
      this.analyserUnavailable = true;
      return;
    }
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) {
      this.analyserUnavailable = true;
      return;
    }
    try {
      const ctx = new Ctx();
      // A MediaElementAudioSourceNode can only be created once per element; the
      // element is reused for every play, so this graph is built exactly once.
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      this.audioCtx = ctx;
      this.sourceNode = source;
      this.analyser = analyser;
      this.timeData = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    } catch {
      // Some browsers throw if the element is tainted / already sourced. Fall
      // back to silent-loudness but keep audio playing.
      this.analyserUnavailable = true;
      this.analyser = null;
      this.timeData = null;
    }
  }

  /**
   * Stop any in-flight playback and close the mouth-motion window. Pauses the
   * element, resets to the start, detaches the in-flight finish handler, and
   * clears the playing flag / smoothed loudness. Does NOT fire onEnd itself
   * unless a finish handler is still attached (so an explicit stop closes the
   * window exactly once).
   */
  private stop(): void {
    const finish = this.currentFinish;
    this.currentFinish = null;
    const el = this.audio;
    if (el) {
      el.onplaying = null;
      el.onended = null;
      el.onerror = null;
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    this.playing = false;
    this.smoothedLoudness = 0;
    // Fire the pending onEnd exactly once so the speaking window closes.
    if (finish) finish();
  }

  /**
   * Play the recorded chef voice line while the reply is displayed. If muted,
   * no-op (fires no callbacks). Otherwise stops any currently-playing clip first
   * (anti-overlap), then plays the MP3 from the start. onStart fires on real
   * playback start ('playing'); onEnd fires on 'ended'/'error'/cancel/stop.
   *
   * NOTE: `text` is NOT synthesized — the MP3 is a fixed recording. `text` only
   * gates playback: a non-empty reply plays the line; an empty one does nothing.
   */
  speak(text: string, callbacks: SpeakCallbacks = {}): void {
    if (this.muted) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // Never overlap: stop the previous clip and close its window first.
    this.stop();

    const el = this.ensureAudio();
    const { onStart, onEnd } = callbacks;

    // Graceful degradation: no HTMLAudioElement (SSR / very old browser). Open a
    // short timed window so the avatar still animates, and never throw.
    if (!el) {
      onStart?.();
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
      const finishFallback = () => {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      };
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null;
        if (this.currentFinish === finishFallback) this.currentFinish = null;
        onEnd?.();
      }, 1200);
      this.currentFinish = finishFallback;
      return;
    }

    // Wire the real-loudness graph (best effort) before playing.
    this.ensureAnalyser(el);
    // Resume the AudioContext inside this user gesture (autoplay policy).
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      void this.audioCtx.resume().catch(() => {});
    }

    // finish() runs exactly once per play: closes the window, resets flags, and
    // fires onEnd. Detaching happens via currentFinish so a superseding play or
    // an explicit stop() cannot double-fire it.
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (this.currentFinish === finish) this.currentFinish = null;
      this.playing = false;
      this.smoothedLoudness = 0;
      el.onplaying = null;
      el.onended = null;
      el.onerror = null;
      onEnd?.();
    };
    this.currentFinish = finish;

    el.onplaying = () => {
      this.playing = true;
      onStart?.();
    };
    el.onended = finish;
    el.onerror = finish;

    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }

    // play() returns a promise that rejects if the browser blocks playback.
    // Route the rejection through finish() so a blocked play never wedges the
    // speaking window.
    const playPromise = el.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch(() => finish());
    }
  }

  /**
   * Real smoothed 0..1 loudness from the AnalyserNode's time-domain data while a
   * clip plays. Returns 0 when idle, muted, or when the Web Audio graph is
   * unavailable (the scene then uses its sine fallback).
   */
  getLoudness(): number {
    if (this.muted || !this.playing) return 0;
    const analyser = this.analyser;
    const data = this.timeData;
    if (!analyser || !data) return 0;
    analyser.getByteTimeDomainData(data);
    // RMS around the 128 mid-point, normalized to ~0..1.
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    // Scale up a touch so speech (which rarely hits full-scale) drives a lively
    // jaw, and clamp to 0..1.
    const level = Math.min(1, rms * 2.2);
    // Ease toward the new level for a stable, non-jittery motion.
    this.smoothedLoudness += (level - this.smoothedLoudness) * 0.5;
    return this.smoothedLoudness;
  }

  /**
   * Stop playback, tear down the audio graph and listeners, close the
   * AudioContext, and release the element. Safe to call multiple times.
   */
  dispose(): void {
    this.stop();
    const el = this.audio;
    if (el) {
      el.onplaying = null;
      el.onended = null;
      el.onerror = null;
      try {
        el.pause();
      } catch {
        /* ignore */
      }
      // Drop the source so the element can be GC'd.
      try {
        el.removeAttribute("src");
        el.load();
      } catch {
        /* ignore */
      }
    }
    try {
      this.sourceNode?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.analyser?.disconnect();
    } catch {
      /* ignore */
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      void this.audioCtx.close().catch(() => {});
    }
    this.audio = null;
    this.sourceNode = null;
    this.analyser = null;
    this.timeData = null;
    this.audioCtx = null;
  }
}
