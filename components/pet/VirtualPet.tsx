"use client";

// ---------------------------------------------------------------------------
// Virtual pet — composed widget (3D Miniature Schnauzer stage + Tamagotchi game UI).
//
// The 3D scene (components/pet/PetScene.tsx) touches WebGL/DOM, so it is
// imported here via next/dynamic { ssr:false } with a themed loading fallback,
// mirroring how components/coach/CoachChatbot.tsx isolates CoachScene. That
// keeps all three.js off the static-generation path (the site is a static
// export with output:'export' and no server).
//
// The game is driven entirely client-side by the pure engine in
// lib/pet/petState.ts and persisted via lib/pet/petStorage.ts (SSR-guarded
// localStorage). On mount we load the saved state (or a fresh one), apply
// decay for the real time elapsed since it was last written, then tick a small
// incremental decay on an interval. Feed / Play / Sleep / Clean call
// applyAction, set a transient `action` prop (plus a monotonic `actionNonce`)
// that PetScene turns into a ~1s one-shot reaction (cleared afterwards so it
// fires once), and persist. The nonce guarantees a repeat of the same action
// still re-arms the reaction.
//
// Accessibility: stat bars are role='progressbar' with aria-valuenow/min/max
// and labels; controls are real <button>s with hover/disabled/focus-visible
// states; the layout stacks on narrow screens.
//
// THEME: warm, cozy Tamagotchi look using the `pet` Tailwind tokens.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  applyAction,
  decayForElapsed,
  moodFor,
  overallWellbeing,
  STAT_CRIT,
  STAT_WARN,
  type PetAction,
  type PetState,
} from "@/lib/pet/petState";
import {
  freshState,
  loadPetState,
  savePetState,
} from "@/lib/pet/petStorage";
import {
  QualityProvider,
  useQuality,
} from "@/components/three/quality";
import QualityToggle from "@/components/three/QualityToggle";
import { useReducedMotion } from "@/components/three/useReducedMotion";
import { asset } from "@/lib/asset";

const PetScene = dynamic(() => import("@/components/pet/PetScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-pet-accent">
      <div className="flex flex-col items-center gap-3">
        <span className="w-7 h-7 rounded-full border-2 border-pet-accentSoft border-t-pet-accent animate-spin" />
        <span className="font-mono text-[11px] tracking-widest uppercase">
          Waking the pup…
        </span>
      </div>
    </div>
  ),
});

// Short soft "boof" played on every interaction (client-only, base-path
// prefixed via asset() so it resolves under /frankfabric/ in production).
// The scene itself plays a sharper bark in sync with the Bark animations.
const BOOF_SOUND = asset("/sounds/dog-boof.wav");

// How often we apply incremental decay + persist (ms).
const TICK_MS = 4000;
// How long the transient action prop stays set so PetScene's one-shot fires
// exactly once, then relaxes back to the ambient mood motion (ms).
const ACTION_HOLD_MS = 1000;

// Human-readable mood status lines.
const MOOD_LINE: Record<string, string> = {
  happy: "is bursting with joy!",
  content: "is doing just fine.",
  hungry: "is getting hungry — time for a snack.",
  tired: "is sleepy and needs a nap.",
  dirty: "could really use a bath.",
  sad: "is feeling a little down.",
};

type StatKey = "hunger" | "happiness" | "energy" | "cleanliness";

const STAT_META: { key: StatKey; label: string }[] = [
  { key: "hunger", label: "Fullness" },
  { key: "happiness", label: "Happiness" },
  { key: "energy", label: "Energy" },
  { key: "cleanliness", label: "Cleanliness" },
];

// Map a stat value to a `pet` token color by good/warn/crit threshold.
function statColor(value: number): string {
  if (value <= STAT_CRIT) return "bg-pet-crit";
  if (value <= STAT_WARN) return "bg-pet-warn";
  return "bg-pet-good";
}

const ACTION_META: {
  action: PetAction;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { action: "feed", label: "Feed", emoji: "🍖", color: "bg-pet-feed" },
  { action: "play", label: "Play", emoji: "🎾", color: "bg-pet-play" },
  { action: "sleep", label: "Sleep", emoji: "😴", color: "bg-pet-rest" },
  { action: "clean", label: "Clean", emoji: "🛁", color: "bg-pet-clean" },
];

// Wraps the widget in the shared QualityProvider so its stage and the shared
// QualityToggle read/write the SAME quality tier (components/three/quality.ts).
export default function VirtualPet() {
  return (
    <QualityProvider>
      <VirtualPetInner />
    </QualityProvider>
  );
}

function VirtualPetInner() {
  const { quality } = useQuality();
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<PetState | null>(null);
  // Transient one-shot action passed to the 3D scene (null when idle).
  const [pendingAction, setPendingAction] = useState<PetAction | null>(null);
  // Monotonic counter bumped on every doAction call. PetScene re-arms its
  // one-shot reaction on this nonce, so clicking the SAME action twice inside
  // the ACTION_HOLD_MS window still re-fires the animation (the action string
  // alone would compare equal and silently skip the second reaction).
  const [actionNonce, setActionNonce] = useState(0);
  const [nameDraft, setNameDraft] = useState("");

  // Keep a ref to the latest state so the interval/action callbacks always read
  // and persist the freshest value without re-subscribing each tick. Updated in
  // an effect (never during render) to satisfy the react-hooks rules.
  const stateRef = useRef<PetState | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cached HTMLAudioElement for the interaction "boof". Lazily created on first
  // user interaction so nothing is constructed during static prerender (there
  // is no Audio on the server) and no sound ever plays on page load.
  const boofRef = useRef<HTMLAudioElement | null>(null);

  // Play the short "boof" on interaction. Client-only and defensive:
  // lazy-create the element on first use, guard for a missing Audio ctor,
  // rewind so rapid repeats retrigger, and swallow the autoplay-rejection
  // promise so a blocked play() never throws.
  const playBoof = useCallback(() => {
    if (typeof window === "undefined" || typeof Audio === "undefined") return;
    let audio = boofRef.current;
    if (!audio) {
      audio = new Audio(BOOF_SOUND);
      audio.preload = "auto";
      boofRef.current = audio;
    }
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers throw if currentTime is set before metadata loads; ignore.
    }
    const played = audio.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => {
        /* autoplay/interaction policy rejection: safe to ignore */
      });
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // On mount (client only): load persisted state or seed a fresh one, then
  // immediately apply decay for the real time elapsed since it was written.
  // This is a legitimate external-system sync (localStorage -> React) and must
  // run on the client only (window is undefined during static prerender), so
  // the initial setState here is intentional.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const loaded = loadPetState() ?? freshState(now);
    const decayed = decayForElapsed(loaded, now);
    savePetState(decayed);
    /* eslint-disable react-hooks/set-state-in-effect */
    setNameDraft(decayed.name ?? "");
    setState(decayed);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Incremental decay tick + persist. SSR-guarded; cleaned up on unmount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      const next = decayForElapsed(current, Date.now());
      setState(next);
      savePetState(next);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Clear any pending action timer on unmount.
  useEffect(() => {
    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, []);

  const doAction = useCallback((action: PetAction) => {
    const current = stateRef.current;
    if (!current) return;
    // "Boof" on every interaction (Feed/Play/Sleep/Clean button and pet click,
    // which routes through doAction("play")). Fired here so it only ever plays
    // on a real user interaction, never on load.
    playBoof();
    const now = Date.now();
    // Decay for elapsed time first, then apply the action so the numbers stay
    // consistent with the clock.
    const decayed = decayForElapsed(current, now);
    const next = applyAction(decayed, action);
    setState(next);
    savePetState(next);

    // Fire the transient one-shot reaction, then clear it so it plays once.
    // Bump the nonce so PetScene re-arms even when `action` is unchanged (same
    // action clicked twice inside the hold window).
    setPendingAction(action);
    setActionNonce((n) => n + 1);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => {
      setPendingAction(null);
    }, ACTION_HOLD_MS);
  }, [playBoof]);

  const commitName = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const trimmed = nameDraft.trim().slice(0, 24);
    const next: PetState = { ...current, name: trimmed || undefined };
    setState(next);
    savePetState(next);
  }, [nameDraft]);

  // Derived values (safe defaults before the client state loads).
  const stats = state?.stats ?? {
    hunger: 0,
    happiness: 0,
    energy: 0,
    cleanliness: 0,
  };
  const mood = state ? moodFor(stats) : "content";
  const wellbeing = state ? overallWellbeing(stats) : 0;
  const petName = state?.name?.trim() || "Your schnauzer";

  return (
    <div className="absolute inset-0 z-[5] flex flex-col md:flex-row bg-pet-cream">
      {/* 3D pet stage */}
      <div className="relative md:w-[48%] w-full h-[42%] md:h-full min-h-[140px] bg-gradient-to-b from-pet-paper to-pet-mist border-b md:border-b-0 md:border-r border-pet-accentSoft">
        <PetScene
          mood={mood}
          action={pendingAction}
          actionNonce={actionNonce}
          wellbeing={wellbeing}
          quality={quality}
          onPetClick={() => doAction("play")}
          reducedMotion={reducedMotion}
        />
        {/* Shared High/Fast render-quality control, placed unobtrusively in the
            stage's top-left. Same control across all four scenes. */}
        <QualityToggle className="absolute top-2 left-2 z-10" />
        <span className="absolute bottom-2 left-0 right-0 text-center font-mono text-[10px] tracking-widest uppercase text-pet-inkSoft pointer-events-none">
          {petName}
        </span>
      </div>

      {/* Game panel */}
      <div className="relative flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto bg-pet-paper px-4 py-4 gap-4">
        {/* Header: name + mood status */}
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg text-pet-ink leading-tight">
            {petName}
          </h2>
          <p
            aria-live="polite"
            className="font-mono text-[12px] text-pet-inkSoft"
          >
            {petName} {MOOD_LINE[mood] ?? "is here."}
          </p>
        </div>

        {/* Stat bars */}
        <div className="flex flex-col gap-3">
          {STAT_META.map(({ key, label }) => {
            const value = Math.round(stats[key]);
            return (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-mono text-[11px] text-pet-inkSoft">
                  <span className="uppercase tracking-wide">{label}</span>
                  <span className="tabular-nums text-pet-ink">{value}</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label}: ${value} of 100`}
                  className="h-3 w-full rounded-full bg-pet-mist overflow-hidden"
                >
                  <div
                    className={[
                      "h-full rounded-full transition-all duration-500",
                      statColor(value),
                    ].join(" ")}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          {ACTION_META.map(({ action, label, emoji, color }) => {
            // Disable Feed when already full; other actions stay available.
            const disabled =
              !state || (action === "feed" && stats.hunger >= 99);
            return (
              <button
                key={action}
                type="button"
                onClick={() => doAction(action)}
                disabled={disabled}
                className={[
                  "flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-white text-[13px] font-semibold shadow-sm",
                  "hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pet-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pet-paper",
                  "transition-all disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed",
                  color,
                ].join(" ")}
              >
                <span aria-hidden className="text-[15px] leading-none">
                  {emoji}
                </span>
                {label}
              </button>
            );
          })}
        </div>

        {/* Name the pet */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            commitName();
          }}
          className="mt-auto flex items-center gap-2 pt-2 border-t border-pet-mist"
        >
          <label htmlFor="pet-name" className="sr-only">
            Name your pet
          </label>
          <input
            id="pet-name"
            type="text"
            value={nameDraft}
            maxLength={24}
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder="Name your pet…"
            autoComplete="off"
            disabled={!state}
            className="flex-1 min-w-0 rounded-full bg-pet-cream border border-pet-accentSoft px-4 py-2 text-[12.5px] text-pet-ink placeholder:text-pet-inkSoft/60 focus:outline-none focus:border-pet-accent focus:ring-2 focus:ring-pet-accent/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!state}
            className="shrink-0 rounded-full bg-pet-accent text-white text-[12.5px] font-semibold px-4 py-2 shadow-sm hover:-translate-y-0.5 hover:bg-pet-feed focus:outline-none focus-visible:ring-2 focus-visible:ring-pet-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pet-paper transition-all disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
}
