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
// reply, append it, and briefly play the avatar's "waving" animation before
// settling back to "idle".
//
// Accessibility: the input carries a visible-to-screen-reader label, Enter
// sends, and the message list is an aria-live region so new replies are
// announced. The layout fits an aspect-video card and stacks on narrow screens.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ChefAnimation } from "@/components/chef/ChefScene";
import { respondToMessage, type ChatMessage } from "@/lib/chef/chefEngine";

const ChefScene = dynamic(() => import("@/components/chef/ChefScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-[#6b7286]">
      <div className="flex flex-col items-center gap-3">
        <span className="w-7 h-7 rounded-full border-2 border-cloud-blue/30 border-t-cloud-blue animate-spin" />
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
  const [animation, setAnimation] = useState<ChefAnimation>("idle");

  const listRef = useRef<HTMLDivElement>(null);
  const waveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll the transcript to the newest message.
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  // Clear any pending wave->idle timer on unmount.
  useEffect(() => {
    return () => {
      if (waveTimer.current) clearTimeout(waveTimer.current);
    };
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setMessages((prev) => {
        const history = prev;
        const withUser: ChatMessage[] = [
          ...history,
          { role: "user", content: trimmed },
        ];
        const response = respondToMessage(history, trimmed);
        setSuggestions(response.suggestions ?? []);
        return [...withUser, { role: "assistant", content: response.reply }];
      });

      setInput("");

      // Wave briefly on reply, then return to idle.
      setAnimation("waving");
      if (waveTimer.current) clearTimeout(waveTimer.current);
      waveTimer.current = setTimeout(() => setAnimation("idle"), 2600);
    },
    []
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    send(input);
  };

  return (
    <div className="absolute inset-0 z-[5] flex flex-col md:flex-row bg-[#0d1018]/70 backdrop-blur-[1px]">
      {/* 3D chef stage */}
      <div className="relative md:w-[42%] w-full h-[38%] md:h-full min-h-[120px] border-b md:border-b-0 md:border-r border-white/[0.08]">
        <ChefScene animation={animation} />
        <span className="absolute bottom-2 left-0 right-0 text-center font-mono text-[10px] tracking-widest uppercase text-cloud-mist/70 pointer-events-none">
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
                    "max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap",
                    isUser
                      ? "bg-gradient-to-br from-cloud-blue to-cloud-violet text-white rounded-br-sm"
                      : "bg-white/[0.06] text-[#d7dbe6] border border-white/[0.08] rounded-bl-sm",
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
                className="font-mono text-[10.5px] tracking-wide text-cloud-mist px-2.5 py-1 rounded-full border border-cloud-blue/35 bg-cloud-blue/10 hover:bg-cloud-blue/20 hover:border-cloud-blue/60 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* composer */}
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 px-3 py-3 border-t border-white/[0.08] bg-black/20"
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
            className="flex-1 min-w-0 rounded-full bg-white/[0.06] border border-white/[0.12] px-4 py-2 text-[12.5px] text-[#e8eaf0] placeholder:text-[#6b7286] focus:outline-none focus:border-cloud-blue/60 focus:ring-1 focus:ring-cloud-blue/40"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 rounded-full bg-gradient-to-br from-cloud-blue to-cloud-violet text-white text-[12.5px] font-semibold px-4 py-2 shadow-[0_4px_16px_rgba(63,169,255,0.35)] hover:-translate-y-0.5 transition-transform disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
