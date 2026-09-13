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
// VOICE CHARACTER: the chef should sound like an OLD MAN speaking English,
// ideally with an ITALIAN accent. The reply text is always English and is
// NEVER translated. We get the Italian-accent effect by preferring an Italian
// (it-IT) SpeechSynthesis voice to read the English words. Voice selection
// priority (see pickVoice):
//   1. an Italian voice — lang it-IT / it, or a name hinting at a common
//      Italian voice (Luca, Alice, Giorgio, Paolo, Federica, Cosimo, Elsa) —
//      reading English text yields the Italian accent we want;
//   2. a MALE English voice (name hints: Daniel, Alex, Fred, Google UK English
//      Male, Microsoft David/George/Guy/Mark, or an en-* voice with a
//      male-sounding name);
//   3. any en-* voice;
//   4. the platform default (utter.voice left unset).
// We NEVER gate speaking on voice availability: getVoices() can be empty until
// the async 'voiceschanged' event fires, so if no preferred voice exists yet we
// speak with the default and still fire onStart/onEnd. We also listen for
// 'voiceschanged' to refresh the cached pick so a later-loaded Italian/male
// voice is used on subsequent replies. The old-man timbre comes from the
// utterance params: a low pitch (0.7) and a slightly slow rate (0.9).
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
  // Cached preferred voice, refreshed when 'voiceschanged' fires so a
  // later-loaded Italian/male voice is picked up on subsequent replies.
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
   * Pick the best available voice for an OLD MAN reading English, ideally with
   * an Italian accent. Priority: (1) an Italian voice (it-* lang or an Italian
   * voice-name hint) — reading the English reply gives the Italian accent;
   * (2) a male English voice (male name hint); (3) any en-* voice; (4) null so
   * the utterance uses the platform default. Never gate speaking on this:
   * getVoices() can be empty until the async 'voiceschanged' event fires, in
   * which case this returns null and the default voice is used.
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
    const isItalianLang = (v: SpeechSynthesisVoice) =>
      (v.lang ?? "").toLowerCase().startsWith("it");
    const isEnglishLang = (v: SpeechSynthesisVoice) =>
      (v.lang ?? "").toLowerCase().startsWith("en");

    // Common Italian SpeechSynthesis voice-name hints (macOS/iOS/Windows).
    const italianNameHints = [
      "luca",
      "alice",
      "giorgio",
      "paolo",
      "federica",
      "cosimo",
      "elsa",
      "italian",
      "italiano",
    ];
    // Common male-English voice-name hints across platforms.
    const maleNameHints = [
      "daniel",
      "alex",
      "fred",
      "george",
      "guy",
      "mark",
      "david",
      "male",
      "uk english male",
      "us english male",
    ];

    // (1) Italian-accent: an it-* voice, or a voice named like a known Italian
    // one. An Italian voice reading English text speaks with an Italian accent.
    const italian =
      voices.find(isItalianLang) ??
      voices.find((v) => nameHas(v, italianNameHints)) ??
      null;
    if (italian) return italian;

    // (2) A male English voice by name hint.
    const maleEnglish =
      voices.find((v) => isEnglishLang(v) && nameHas(v, maleNameHints)) ?? null;
    if (maleEnglish) return maleEnglish;

    // (3) Any English voice.
    const anyEnglish = voices.find(isEnglishLang) ?? null;
    if (anyEnglish) return anyEnglish;

    // (4) Platform default.
    return null;
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
    // OLD-MAN timbre: a low pitch and a slightly slow rate read as an elderly
    // man rather than the previous bright/young voice (pitch 1.1). Tuned by ear
    // as heuristics — adjust here to age the voice up/down.
    utter.rate = 0.9;
    utter.pitch = 0.7;
    utter.volume = 1;
    // Re-pick in case voices loaded since construction; fall back to the cached
    // pick. Never gate on availability — null just means "use the default".
    const voice = this.pickVoice() ?? this.pickedVoice;
    if (voice) {
      this.pickedVoice = voice;
      utter.voice = voice;
      // Match the utterance language to the chosen voice so the engine reads the
      // (still English) text with that voice/accent. Safe even for it-* voices:
      // the WORDS stay English, only the accent changes.
      if (voice.lang) utter.lang = voice.lang;
    }

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
