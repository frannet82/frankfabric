type Callbacks = { onStart?: () => void; onEnd?: () => void };

/** Browser speech with a word-boundary driven articulation envelope.
 * This is estimated articulation, not an audio analyser or phoneme alignment.
 */
export class SpeechVoice {
  private muted = false;
  private utterance: SpeechSynthesisUtterance | null = null;
  private finish: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private enqueue: ReturnType<typeof setTimeout> | null = null;
  private started = 0;
  private boundary = 0;
  private wordDuration = 260;
  private hasBoundary = false;
  constructor(private rate = 1) {}
  get isMuted() { return this.muted; }
  setMuted(value: boolean) { this.muted = value; if (value) this.stop(); }
  private stop() {
    if (this.enqueue) clearTimeout(this.enqueue);
    this.enqueue = null;
    const owned = !!this.utterance;
    this.finish?.();
    if (owned && typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }
  speak(text: string, callbacks: Callbacks = {}) {
    this.stop();
    if (this.muted || !text.trim()) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_]/g, ''));
    const score = (v: SpeechSynthesisVoice) =>
      (/natural|enhanced|premium|neural|google/i.test(v.name) ? 10 : 0) +
      (/samantha|daniel|alex|aria|jenny/i.test(v.name) ? 4 : 0) + (v.default ? 1 : 0);
    const voice = synth.getVoices().filter(v => /^en\b/i.test(v.lang))
      .sort((a, b) => score(b) - score(a))[0];
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-US';
    utterance.rate = this.rate;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    this.utterance = utterance;
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.started = 0;
      this.utterance = null;
      this.finish = null;
      utterance.onstart = utterance.onend = utterance.onerror = utterance.onboundary = null;
      callbacks.onEnd?.();
    };
    this.finish = finish;
    utterance.onstart = () => {
      this.started = performance.now();
      this.boundary = this.started;
      this.hasBoundary = false;
      callbacks.onStart?.();
    };
    utterance.onboundary = event => {
      if (event.name !== 'word') return;
      this.hasBoundary = true;
      this.boundary = performance.now();
      const word = utterance.text.slice(event.charIndex).match(/^\S+/)?.[0] || '';
      this.wordDuration = Math.min(650, Math.max(140, word.length * 48 / this.rate));
    };
    utterance.onend = utterance.onerror = finish;
    this.timer = setTimeout(() => { this.stop(); }, Math.max(15000, text.split(/\s+/).length * 650 + 8000));
    this.enqueue = setTimeout(() => {
      this.enqueue = null;
      if (this.utterance !== utterance) return;
      synth.resume();
      synth.speak(utterance);
    }, 30);
  }
  getLoudness() {
    if (!this.started) return 0;
    const elapsed = performance.now() - this.boundary;
    if (this.hasBoundary && elapsed > this.wordDuration) return 0;
    const t = (performance.now() - this.started) / 1000;
    const syllable = Math.max(0, Math.sin(t * 19) * 0.6 + Math.sin(t * 31 + 0.7) * 0.3);
    const envelope = this.hasBoundary ? Math.min(1, elapsed / 35) * Math.min(1, Math.max(0, (this.wordDuration - elapsed) / 65)) : 1;
    return (0.12 + syllable * 0.88) * envelope;
  }
  dispose() { this.stop(); }
}
