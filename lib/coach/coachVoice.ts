// ---------------------------------------------------------------------------
// Coach voice — reads the reply text aloud with the browser Web Speech API.
//
// AUDIO SOURCE / LICENSE: There is NO audio file and no server-side TTS. The
// speech is produced entirely in the browser by the Web Speech API
// (window.speechSynthesis + SpeechSynthesisUtterance), so nothing ships as a
// binary asset, nothing is downloaded, and there is nothing to license. This is
// fully client-side and static-export safe. Because speak() is only ever called
// from the user's send gesture, browser autoplay/gesture policies do not block
// it. This mirrors lib/chef/chefVoice.ts with the SAME robustness mitigations.
//
// speak(text) utters the ACTUAL reply words. Any previous utterance is canceled
// first so replies never overlap. When muted, nothing is spoken and any ongoing
// utterance is canceled.
//
// STUCK-ENGINE BUG ("only the first reply is spoken"): Chrome's SpeechSynthesis
// can be left in a paused/stuck state so that subsequent speak() calls are
// queued but never spoken. This wrapper applies several mitigations so EVERY
// reply is spoken and onStart/onEnd fire every time (the group talking motion
// depends on that):
//   1. stop() only calls cancel() when the synth is actually speaking/pending —
//      an unconditional cancel() on an idle engine can itself wedge it — and
//      calls resume() afterwards because cancel() can leave Chrome paused.
//   2. speak() defers the synth.speak(utter) to a 0-timeout after the cancel so
//      the cancel fully settles before the new utterance is enqueued (enqueuing
//      in the same tick as a cancel is a known trigger of the stuck state), and
//      calls resume() defensively before speaking in case the engine was paused.
//   3. The in-flight utterance is retained on this.current (not just a local
//      that could be GC'd mid-speech — a dropped utterance fires no onend and
//      wedges the queue), and a single-shot finish() handler (onend + onerror,
//      including Chrome's benign 'canceled'/'interrupted' errors) always resets
//      state so the next reply can speak.
//   4. A watchdog timer force-finishes the utterance if neither onend nor
//      onerror fires within a generous bound, so a silently-dropped utterance
//      can never permanently wedge the queue.
//
// VOICE CHARACTER: the coach should sound like an ENERGETIC gym trainer — a
// clear, upbeat English speaker. The reply text is always English. Voice
// selection priority (see pickVoice):
//   1. a clear English (en-*) voice, preferring a bright/common one by name
//      (Google US/UK English, Samantha, Zira, Aria, Jenny, Guy, Daniel);
//   2. any en-* voice;
//   3. the platform default (utter.voice left unset).
// We NEVER gate speaking on voice availability: getVoices() can be empty until
// the async 'voiceschanged' event fires, so if no preferred voice exists yet we
// speak with the default and still fire onStart/onEnd. We also listen for
// 'voiceschanged' to refresh the cached pick. The energetic timbre comes from
// livelier utterance params: a slightly quick rate (1.05) and neutral pitch
// (1.0), distinct from the chef's low-pitch (0.7) old-Italian-man voice.
//
// MOTION: SpeechSynthesis does not expose an audio-amplitude stream, so there
// is no live loudness to drive the avatar. getLoudness() therefore always
// returns 0 and the 3D scene falls back to its smooth sine-energy wobble while
// speaking. The "speaking window" is driven by real utterance start/end events
// via the onStart/onEnd callbacks passed to speak(), so the coach moves exactly
// while the words are spoken and eases back to rest the instant speech ends. On
// browsers lacking SpeechSynthesis we still open a short timed speaking window
// (estimated from word count) so the avatar animates and no error is thrown.
// ---------------------------------------------------------------------------

type SpeakCallbacks = {
  // Fired when speech actually begins (talking-motion window opens).
  onStart?: () => void;
  // Fired when speech ends, is canceled, or errors (talking-motion window closes).
  onEnd?: () => void;
};

export class CoachVoice {
  private muted = false;
  // The utterance currently in flight, so we can detach handlers if superseded.
  private current: SpeechSynthesisUtterance | null = null;
  // Fallback timer id when SpeechSynthesis is unavailable.
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  // Deferred-speak timer: after cancel() we enqueue the next utterance on a
  // 0-timeout so the cancel fully settles first (Chrome stuck-engine bug).
  private speakTimer: ReturnType<typeof setTimeout> | null = null;
  // Safety timer: if neither onend nor onerror fires for the in-flight utterance
  // within a bound (some engines silently drop an utterance and never fire an
  // end event, wedging the queue), we force-finish so the next reply can speak.
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  // Cached preferred voice, refreshed when 'voiceschanged' fires so a
  // later-loaded English voice is picked up on subsequent replies.
  private pickedVoice: SpeechSynthesisVoice | null = null;
  // The 'voiceschanged' listener we attached, kept so dispose() can detach it.
  private voicesChangedHandler: (() => void) | null = null;

  constructor() {
    // Prime the voice cache and keep it fresh. getVoices() is often empty on
    // first call and only populates after the async 'voiceschanged' event, so
    // we (re)pick on that event. Guard for environments without the API /
    // addEventListener (SSR, older browsers) — never throw.
    const synth = this.synth;
    if (synth) {
      this.pickedVoice = this.pickVoice();
      if (typeof synth.addEventListener === "function") {
        this.voicesChangedHandler = () => {
          this.pickedVoice = this.pickVoice();
        };
        synth.addEventListener("voiceschanged", this.voicesChangedHandler);
      }
    }
  }

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

  /**
   * Cancel any in-flight speech/timers and close the talking-motion window.
   *
   * STUCK-ENGINE MITIGATION: Chrome can be left in a paused/stuck state if
   * cancel() is called when nothing is actually speaking, or if a new speak()
   * follows a cancel() in the same tick — after which subsequent utterances are
   * queued but never spoken (the "only the first reply is heard" bug). So we
   * only call cancel() when the synth is genuinely speaking or has a pending
   * utterance, and we call resume() afterwards because cancel() can leave the
   * engine paused.
   */
  private stop(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.speakTimer) {
      clearTimeout(this.speakTimer);
      this.speakTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.current) {
      // Detach so the cancel's onend does not re-fire the caller's onEnd twice.
      this.current.onstart = null;
      this.current.onend = null;
      this.current.onerror = null;
      this.current = null;
    }
    const synth = this.synth;
    if (!synth) return;
    // Only cancel when there's actually something to cancel — an unconditional
    // cancel() on an idle engine is one trigger of Chrome's stuck state.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      // cancel() can leave the engine paused on Chrome; nudge it back to ready
      // so the NEXT speak() is not silently swallowed.
      synth.resume();
    }
  }

  /**
   * Pick the best available voice for an ENERGETIC English-speaking coach.
   * Priority: (1) a clear English voice, preferring a bright/common one by name
   * hint; (2) any en-* voice; (3) null so the utterance uses the platform
   * default. Never gate speaking on this: getVoices() can be empty until the
   * async 'voiceschanged' event fires, in which case this returns null and the
   * default voice is used.
   */
  private pickVoice(): SpeechSynthesisVoice | null {
    const synth = this.synth;
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;

    const nameHas = (v: SpeechSynthesisVoice, hints: string[]) => {
      const name = (v.name ?? "").toLowerCase();
      return hints.some((h) => name.includes(h));
    };
    const isEnglishLang = (v: SpeechSynthesisVoice) =>
      (v.lang ?? "").toLowerCase().startsWith("en");

    // Bright, clear English voice-name hints across platforms.
    const brightEnglishHints = [
      "google us english",
      "google uk english",
      "samantha",
      "zira",
      "aria",
      "jenny",
      "guy",
      "daniel",
      "english",
    ];

    // QUALITY PREFERENCE (issue 3): among any candidate set, prefer the most
    // natural-sounding voice and AVOID the lowest-quality fallback. Higher
    // score = better. We reward names hinting at enhanced/cloud/neural engines
    // ('google','natural','enhanced','premium','neural', plus well-known
    // high-quality OS voices) and reward remote voices (localService === false,
    // typically the higher-quality cloud voices). Robust across browsers: when
    // none of these signals exist the scores tie and we keep the first
    // candidate (today's behaviour).
    const qualityNameHints = [
      "google",
      "natural",
      "enhanced",
      "premium",
      "neural",
      "siri",
      "wavenet",
      "eloquence",
    ];
    const qualityScore = (v: SpeechSynthesisVoice) => {
      let score = 0;
      if (v.localService === false) score += 2;
      if (nameHas(v, qualityNameHints)) score += 3;
      return score;
    };
    const best = (
      candidates: SpeechSynthesisVoice[]
    ): SpeechSynthesisVoice | null => {
      let chosen: SpeechSynthesisVoice | null = null;
      let bestScore = -Infinity;
      for (const v of candidates) {
        const s = qualityScore(v);
        if (s > bestScore) {
          bestScore = s;
          chosen = v;
        }
      }
      return chosen;
    };

    // (1) A clear/bright English voice by name hint — highest-quality among them.
    const brightEnglish = best(
      voices.filter((v) => isEnglishLang(v) && nameHas(v, brightEnglishHints))
    );
    if (brightEnglish) return brightEnglish;

    // (2) Any English voice — prefer the highest-quality one so we never fall to
    // the lowest-quality en-* voice when a natural/cloud one exists.
    const anyEnglish = best(voices.filter(isEnglishLang));
    if (anyEnglish) return anyEnglish;

    // (3) Platform default.
    return null;
  }

  /**
   * Speak the reply text aloud. Cancels any in-progress utterance first, then
   * reads `text` with the browser SpeechSynthesis voice. Fires onStart when
   * speech begins and onEnd when it finishes (or errors / is canceled), so the
   * caller can open/close the talking-motion window against the REAL speech
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
    // a short timed window estimated from word count (~180 wpm) so the avatar
    // still animates, and never throw.
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
    // ENERGETIC coach timbre: a slightly quick rate and neutral pitch read as an
    // upbeat trainer, distinct from the chef's low, slow old-man voice. Tuned by
    // ear as heuristics — adjust here to raise/lower the energy.
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.volume = 1;
    // Re-pick in case voices loaded since construction; fall back to the cached
    // pick. Never gate on availability — null just means "use the default".
    const voice = this.pickVoice() ?? this.pickedVoice;
    if (voice) {
      this.pickedVoice = voice;
      utter.voice = voice;
      // Match the utterance language to the chosen voice so the engine reads the
      // English text with that voice.
      if (voice.lang) utter.lang = voice.lang;
    }

    // finish() runs exactly once per utterance, whether it ends normally, is
    // canceled/interrupted, or errors. It clears the in-flight reference and
    // fires onEnd so the talking-motion window closes and — crucially — so the
    // wrapper is never left in a state where the NEXT speak() no-ops. Note
    // Chrome fires a benign 'canceled'/'interrupted' onerror when cancel() runs;
    // routing that through finish() (rather than leaving state dangling) is what
    // lets the second, third, … reply speak.
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      // Only clear the reference if this utterance is still the current one, so
      // a superseding speak() (which already set a new this.current) is untouched.
      if (this.current === utter) this.current = null;
      onEnd?.();
    };

    utter.onstart = () => {
      onStart?.();
    };
    utter.onend = finish;
    utter.onerror = finish;

    // Retain a reference to the in-flight utterance for the whole call. Keeping
    // it on `this.current` (not just as a local that could be GC'd mid-speech,
    // which some engines treat as a dropped utterance that fires no onend and
    // wedges the queue) holds it alive until onend/onerror actually fires.
    this.current = utter;

    // Estimate a generous upper bound on the utterance's duration (~150 wpm) and
    // arm a watchdog: if neither onend nor onerror fires within that bound (a
    // silently-dropped utterance), force-finish so state resets and the next
    // reply can speak.
    const words = trimmed.split(/\s+/).length;
    const estMs = Math.max(1500, Math.min(20000, (words / 150) * 60000));
    this.watchdogTimer = setTimeout(finish, estMs + 4000);

    // Defensive resume(): if the engine was left paused (by a prior cancel or
    // an OS media event), speak() alone won't produce audio. resume() first.
    synth.resume();

    // Defer the actual enqueue to the next tick so any cancel() issued in stop()
    // above has fully settled before we speak — enqueuing in the SAME tick as a
    // cancel is a known trigger of Chrome's "queued but never spoken" state.
    this.speakTimer = setTimeout(() => {
      this.speakTimer = null;
      // If a newer speak() or stop() superseded this utterance before the tick
      // elapsed, don't enqueue the stale one.
      if (this.current !== utter) return;
      synth.resume();
      synth.speak(utter);
    }, 0);
  }

  /**
   * SpeechSynthesis exposes no live amplitude, so loudness is always 0 and the
   * 3D scene falls back to a sine-energy wobble while speaking. Kept for API
   * compatibility with the scene's optional getLoudness prop.
   */
  getLoudness(): number {
    return 0;
  }

  dispose(): void {
    this.stop();
    const synth = this.synth;
    if (
      synth &&
      this.voicesChangedHandler &&
      typeof synth.removeEventListener === "function"
    ) {
      synth.removeEventListener("voiceschanged", this.voicesChangedHandler);
    }
    this.voicesChangedHandler = null;
  }
}
