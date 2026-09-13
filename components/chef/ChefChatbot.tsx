"use client";

// ---------------------------------------------------------------------------
// Chef chatbot — composed widget (3D chef avatar + chat panel).
//
// The 3D chef (components/chef/ChefScene.tsx) touches WebGL/DOM, so it is
// imported here via next/dynamic { ssr:false } with a loading fallback,
// mirroring how components/WardrobeBuilder.tsx isolates WardrobeScene. That
// keeps all three.js off the static-generation path (the site is a static
// export with output:'export' and no server).
//
// The conversation is driven entirely client-side by the deterministic,
// dependency-free recipe engine in lib/chef/chefEngine.ts (no server, no API
// key, no network). On send we append the user's message, compute the chef
// reply, and append it. On reply we open a short "speaking" window that drives
// the avatar's bone-based mouth motion.
//
// Accessibility: the input carries a visible-to-screen-reader label, Enter
// sends, and the message list is an aria-live region so new replies are
// announced. The layout fits an aspect-video card and stacks on narrow screens.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { respondToMessage, type ChatMessage } from "@/lib/chef/chefEngine";
import { ChefVoice } from "@/lib/chef/chefVoice";

const ChefScene = dynamic(() => import("@/components/chef/ChefScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-ac-brownSoft">
      <div className="flex flex-col items-center gap-3">
        <span className="w-7 h-7 rounded-full border-2 border-ac-leaf/40 border-t-ac-leafDark animate-spin" />
        <span className="font-mono text-[11px] tracking-widest uppercase">
          Warming up the kitchen…
        </span>
      </div>
    </div>
  ),
});

// The chef's friendly opening line and its starter suggestion chips.
const GREETING =
  "Hi, I'm Chef Fabric! Ask me for a recipe, tell me an ingredient you have, or ask how to cook a dish.";
const GREETING_SUGGESTIONS = [
  "Suggest a recipe",
  "Find recipes with chicken",
  "Show me something vegan",
  "How do I make lentil soup?",
];

export default function ChefChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(GREETING_SUGGESTIONS);
  const [input, setInput] = useState("");
  // `speaking` opens the mouth-motion window; `muted` gates all audio.
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lazily-created in-browser voice synth (Web Audio). Created on first send so
  // its AudioContext starts from a user gesture and is not autoplay-blocked.
  const voiceRef = useRef<ChefVoice | null>(null);
  // Stable getter passed to the 3D scene so it can read live audio loudness.
  const getLoudness = useCallback(
    () => voiceRef.current?.getLoudness() ?? 0,
    []
  );

  // Auto-scroll the transcript to the newest message.
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  // Clear pending timers and release the AudioContext on unmount.
  useEffect(() => {
    return () => {
      if (speakTimer.current) clearTimeout(speakTimer.current);
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
        voiceRef.current = new ChefVoice();
        voiceRef.current.setMuted(muted);
      }
      const spokenMs = voiceRef.current.speak(reply);
      // Open the mouth-motion window. When muted, speak() returns 0, so use a
      // fixed duration proportional to the reply so the jaw still animates.
      const windowMs =
        spokenMs > 0
          ? spokenMs + 120
          : Math.max(900, Math.min(3200, reply.length * 32));
      setSpeaking(true);
      if (speakTimer.current) clearTimeout(speakTimer.current);
      speakTimer.current = setTimeout(() => setSpeaking(false), windowMs);
    },
    [muted]
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    send(input);
  };

  return (
    <div className="absolute inset-0 z-[5] flex flex-col md:flex-row bg-ac-cream/90 backdrop-blur-[1px]">
      {/* 3D chef stage */}
      <div className="relative md:w-[42%] w-full h-[38%] md:h-full min-h-[120px] bg-gradient-to-b from-ac-sky/40 to-ac-leaf/25 border-b md:border-b-0 md:border-r border-ac-leaf/40">
        <ChefScene speaking={speaking} getLoudness={getLoudness} />
        {/* Accessible mute toggle. Focusable, labeled, and reflects state. */}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? "Unmute chef voice" : "Mute chef voice"}
          title={muted ? "Unmute chef voice" : "Mute chef voice"}
          className="absolute top-2 right-2 z-10 grid place-items-center w-8 h-8 rounded-full bg-ac-cream/90 border border-ac-leaf/50 text-ac-brown shadow-sm hover:bg-ac-sun/70 focus:outline-none focus:ring-2 focus:ring-ac-leafDark transition-colors"
        >
          <span aria-hidden className="text-[14px] leading-none">
            {muted ? "🔇" : "🔊"}
          </span>
        </button>
        <span className="absolute bottom-2 left-0 right-0 text-center font-mono text-[10px] tracking-widest uppercase text-ac-brown/80 pointer-events-none">
          Chef Fabric
        </span>
      </div>

      {/* Chat panel */}
      <div className="relative flex-1 flex flex-col min-h-0 min-w-0">
        {/* transcript */}
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-label="Chef conversation"
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
                      ? "bg-ac-sun text-ac-brown border border-ac-orange/50 rounded-br-sm"
                      : "bg-white text-ac-brown border border-ac-leaf/40 rounded-bl-sm",
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
                className="font-mono text-[10.5px] tracking-wide text-ac-moss px-2.5 py-1 rounded-full border border-ac-leaf/60 bg-ac-leaf/25 hover:bg-ac-leaf/40 hover:border-ac-leafDark focus:outline-none focus:ring-2 focus:ring-ac-leafDark transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* composer */}
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 px-3 py-3 border-t border-ac-leaf/40 bg-ac-sand/60"
        >
          <label htmlFor="chef-input" className="sr-only">
            Ask the chef about recipes
          </label>
          <input
            id="chef-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about a recipe…"
            autoComplete="off"
            className="flex-1 min-w-0 rounded-full bg-white border border-ac-leaf/50 px-4 py-2 text-[12.5px] text-ac-brown placeholder:text-ac-brownSoft/70 focus:outline-none focus:border-ac-leafDark focus:ring-2 focus:ring-ac-leafDark/40"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 rounded-full bg-ac-leaf text-ac-brown text-[12.5px] font-semibold px-4 py-2 border border-ac-leafDark/50 shadow-[0_4px_14px_rgba(95,168,90,0.35)] hover:-translate-y-0.5 hover:bg-ac-leafDark hover:text-white focus:outline-none focus:ring-2 focus:ring-ac-leafDark transition-all disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
