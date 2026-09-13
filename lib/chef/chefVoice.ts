// ---------------------------------------------------------------------------
// Chef voice — reads the reply text aloud with the browser Web Speech API.
//
// AUDIO SOURCE / LICENSE: There is NO audio file and no server-side TTS. The
// speech is produced entirely in the browser by the Web Speech API
// (window.speechSynthesis + SpeechSynthesisUtterance), so nothing ships as a
// binary asset, nothing is downloaded, and there is nothing to license. This is
// fully client-side and static-export safe. Because speak() is only ever called
// from the user's send gesture, browser autoplay/gesture policies do not block
// it.
//
// speak(text) utters the ACTUAL reply words. Any previous utterance is canceled
// first so replies never overlap. When muted, nothing is spoken and any ongoing
// utterance is canceled.
//
// MOUTH MOTION: SpeechSynthesis does not expose an audio-amplitude stream, so
// there is no live loudness to drive the jaw. getLoudness() therefore always
// returns 0 and the 3D scene falls back to its smooth sine wobble while
// speaking. The "speaking window" is driven by real utterance start/end events
// via the onStart/onEnd callbacks passed to speak(), so the mouth moves exactly
// while the words are spoken and stops the instant speech ends. On browsers
// lacking SpeechSynthesis we still open a short timed speaking window (estimated
// from word count) so the jaw animates and no error is thrown.
// ---------------------------------------------------------------------------

type SpeakCallbacks = {
  // Fired when speech actually begins (mouth-motion window opens).
  onStart?: () => void;
  // Fired when speech ends, is canceled, or errors (mouth-motion window closes).
  onEnd?: () => void;
};

export class ChefVoice {
  private muted = false;
  // The utterance currently in flight, so we can detach handlers if superseded.
  private current: SpeechSynthesisUtterance | null = null;
  // Fallback timer id when SpeechSynthesis is unavailable.
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether audio is currently muted. */
  get isMuted(): boolean {
    return this.muted;
  }

  private get synth(): SpeechSynthesis | null {
    if (typeof window === "undefined") return null;
    return window.speechSynthesis ?? null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      // Silence anything in flight immediately and close its window.
      this.stop();
    }
  }

  /** Cancel any in-flight speech/timer and close the mouth-motion window. */
  private stop(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.current) {
      // Detach so the cancel's onend does not re-fire the caller's onEnd twice.
      this.current.onstart = null;
      this.current.onend = null;
      this.current.onerror = null;
      this.current = null;
    }
    this.synth?.cancel();
  }

  /**
   * Prefer an already-available English voice. Never gate speaking on this:
   * getVoices() can be empty until the async 'voiceschanged' event fires, in
   * which case the utterance simply uses the platform default voice.
   */
  private pickEnglishVoice(): SpeechSynthesisVoice | null {
    const synth = this.synth;
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;
    return (
      voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ?? null
    );
  }

  /**
   * Speak the reply text aloud. Cancels any in-progress utterance first, then
   * reads `text` with the browser SpeechSynthesis voice. Fires onStart when
   * speech begins and onEnd when it finishes (or errors / is canceled), so the
   * caller can open/close the mouth-motion window against the REAL speech
   * duration. Does nothing (and does not fire callbacks) when muted.
   */
  speak(text: string, callbacks: SpeakCallbacks = {}): void {
    if (this.muted) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // Never overlap replies.
    this.stop();

    const { onStart, onEnd } = callbacks;
    const synth = this.synth;

    // Graceful degradation: no SpeechSynthesis (e.g. some older browsers). Open
    // a short timed window estimated from word count (~180 wpm) so the jaw still
    // animates, and never throw.
    if (
      !synth ||
      typeof window === "undefined" ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      const words = trimmed.split(/\s+/).length;
      const ms = Math.max(900, Math.min(6000, (words / 180) * 60000));
      onStart?.();
      this.fallbackTimer = setTimeout(() => {
        this.fallbackTimer = null;
        onEnd?.();
      }, ms);
      return;
    }

    const utter = new SpeechSynthesisUtterance(trimmed);
    utter.rate = 1;
    utter.pitch = 1.1; // a touch bright/playful for the chef
    utter.volume = 1;
    const voice = this.pickEnglishVoice();
    if (voice) utter.voice = voice;

    utter.onstart = () => {
      onStart?.();
    };
    const finish = () => {
      if (this.current === utter) this.current = null;
      onEnd?.();
    };
    utter.onend = finish;
    utter.onerror = finish;

    this.current = utter;
    synth.speak(utter);
  }

  /**
   * SpeechSynthesis exposes no live amplitude, so loudness is always 0 and the
   * 3D scene falls back to a sine-wobble jaw while speaking. Kept for API
   * compatibility with the scene's optional getLoudness prop.
   */
  getLoudness(): number {
    return 0;
  }

  dispose(): void {
    this.stop();
  }
}
