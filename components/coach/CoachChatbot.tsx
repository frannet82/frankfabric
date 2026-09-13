"use client";

// ---------------------------------------------------------------------------
// Coach chatbot — composed widget (3D coach avatar + chat panel).
//
// The 3D coach (components/coach/CoachScene.tsx) touches WebGL/DOM, so it is
// imported here via next/dynamic { ssr:false } with a loading fallback,
// mirroring how components/chef/ChefChatbot.tsx isolates ChefScene. That keeps
// all three.js off the static-generation path (the site is a static export
// with output:'export' and no server).
//
// The conversation is driven entirely client-side by the deterministic,
// dependency-free coach engine in lib/coach/coachEngine.ts (no server, no API
// key, no network). On send we append the user's message, compute the coach
// reply, and append it. On reply we read the text aloud with the browser Web
// Speech API and open a "speaking" window (driven by the real utterance's
// start/end events) that animates the avatar's whole-group talking motion.
//
// Accessibility: the input carries a visible-to-screen-reader label, Enter
// sends, and the message list is an aria-live region so new replies are
// announced. The layout stacks on narrow screens.
//
// THEME: bold Smart Fit gym look — high-energy yellow/black panels with magenta
// accents, using the `sf` Tailwind tokens (analogous to how ChefChatbot uses
// the cozy `ac` tokens).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { respondToMessage, type ChatMessage } from "@/lib/coach/coachEngine";
import { CoachVoice } from "@/lib/coach/coachVoice";

const CoachScene = dynamic(() => import("@/components/coach/CoachScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sf-yellow">
      <div className="flex flex-col items-center gap-3">
        <span className="w-7 h-7 rounded-full border-2 border-sf-yellow/30 border-t-sf-magenta animate-spin" />
        <span className="font-mono text-[11px] tracking-widest uppercase">
          Warming up…
        </span>
      </div>
    </div>
  ),
});

// The coach's energetic opening line and its starter suggestion chips.
const GREETING =
  "Hey champ, I'm Coach Fabric! Tell me your goal, ask me to suggest a workout, or name a routine and I'll break it down.";
const GREETING_SUGGESTIONS = [
  "Suggest a workout",
  "I want to lose weight",
  "Build muscle at the gym",
  "A quick no-equipment routine",
];

export default function CoachChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(GREETING_SUGGESTIONS);
  const [input, setInput] = useState("");
  // `speaking` opens the talking-motion window; `muted` gates all audio.
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  // Lazily-created in-browser voice (Web Speech API SpeechSynthesis). Created on
  // first send so speaking begins from a user gesture and is not blocked by
  // browser autoplay/gesture policies.
  const voiceRef = useRef<CoachVoice | null>(null);
  // Stable getter passed to the 3D scene. SpeechSynthesis exposes no live
  // amplitude, so this returns 0 and the scene uses its sine-energy fallback.
  const getLoudness = useCallback(
    () => voiceRef.current?.getLoudness() ?? 0,
    []
  );

  // Auto-scroll the transcript to the newest message.
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  // Cancel any in-flight speech and release the voice on unmount.
  useEffect(() => {
    return () => {
      voiceRef.current?.dispose();
    };
  }, []);

  // Keep the synth's mute flag in sync with UI state.
  useEffect(() => {
    voiceRef.current?.setMuted(muted);
  }, [muted]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      let reply = "";
      setMessages((prev) => {
        const history = prev;
        const withUser: ChatMessage[] = [
          ...history,
          { role: "user", content: trimmed },
        ];
        const response = respondToMessage(history, trimmed);
        reply = response.reply;
        setSuggestions(response.suggestions ?? []);
        return [...withUser, { role: "assistant", content: response.reply }];
      });

      setInput("");

      // Lazily create the voice on this user gesture, then speak (unless muted).
      if (!voiceRef.current) {
        voiceRef.current = new CoachVoice();
        voiceRef.current.setMuted(muted);
      }
      // Read the reply aloud with the browser SpeechSynthesis voice. The
      // talking-motion window is driven by the REAL utterance: open it on start,
      // close it on end (or error / cancel). When muted, speak() is a no-op and
      // neither callback fires, so the coach eases back to rest.
      voiceRef.current.speak(reply, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
      });
    },
    [muted]
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    send(input);
  };

  return (
    <div className="absolute inset-0 z-[5] flex flex-col md:flex-row bg-sf-black/90 backdrop-blur-[1px]">
      {/* 3D coach stage */}
      <div className="relative md:w-[42%] w-full h-[38%] md:h-full min-h-[120px] bg-gradient-to-b from-sf-ink to-sf-gray border-b md:border-b-0 md:border-r border-sf-yellow/40">
        <CoachScene speaking={speaking} getLoudness={getLoudness} />
        {/* Accessible mute toggle. Focusable, labeled, and reflects state. */}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? "Unmute coach voice" : "Mute coach voice"}
          title={muted ? "Unmute coach voice" : "Mute coach voice"}
          className="absolute top-2 right-2 z-10 grid place-items-center w-8 h-8 rounded-full bg-sf-black/90 border border-sf-yellow/60 text-sf-yellow shadow-sm hover:bg-sf-magenta hover:text-white focus:outline-none focus:ring-2 focus:ring-sf-yellow transition-colors"
        >
          <span aria-hidden className="text-[14px] leading-none">
            {muted ? "🔇" : "🔊"}
          </span>
        </button>
        <span className="absolute bottom-2 left-0 right-0 text-center font-mono text-[10px] tracking-widest uppercase text-sf-yellow/80 pointer-events-none">
          Coach Fabric
        </span>
      </div>

      {/* Chat panel */}
      <div className="relative flex-1 flex flex-col min-h-0 min-w-0 bg-sf-ink">
        {/* transcript */}
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-label="Coach conversation"
          className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2"
        >
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            return (
              <div
                key={index}
                className={[
                  "flex",
                  isUser ? "justify-end" : "justify-start",
                ].join(" ")}
              >
                <div
                  className={[
                    "max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap shadow-sm",
                    isUser
                      ? "bg-sf-yellow text-sf-black border border-sf-gold/70 rounded-br-sm font-medium"
                      : "bg-sf-gray text-sf-mist border border-sf-yellow/25 rounded-bl-sm",
                  ].join(" ")}
                >
                  {message.content}
                </div>
              </div>
            );
          })}
        </div>

        {/* suggestion chips */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {suggestions.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => send(chip)}
                className="font-mono text-[10.5px] tracking-wide text-sf-yellow px-2.5 py-1 rounded-full border border-sf-yellow/50 bg-sf-yellow/10 hover:bg-sf-magenta hover:text-white hover:border-sf-magenta focus:outline-none focus:ring-2 focus:ring-sf-yellow transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* composer */}
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 px-3 py-3 border-t border-sf-yellow/30 bg-sf-black/60"
        >
          <label htmlFor="coach-input" className="sr-only">
            Ask the coach about workouts
          </label>
          <input
            id="coach-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about a workout…"
            autoComplete="off"
            className="flex-1 min-w-0 rounded-full bg-sf-gray border border-sf-yellow/40 px-4 py-2 text-[12.5px] text-sf-mist placeholder:text-sf-mist/50 focus:outline-none focus:border-sf-yellow focus:ring-2 focus:ring-sf-yellow/40"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 rounded-full bg-sf-yellow text-sf-black text-[12.5px] font-bold px-4 py-2 border border-sf-gold/60 shadow-[0_4px_14px_rgba(255,242,0,0.35)] hover:-translate-y-0.5 hover:bg-sf-magenta hover:text-white focus:outline-none focus:ring-2 focus:ring-sf-yellow transition-all disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
