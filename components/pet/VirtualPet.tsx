"use client";

// ---------------------------------------------------------------------------
// Virtual pet — composed widget (3D Miniature Schnauzer stage + virtual-pet game UI).
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
// incremental decay on an interval. Care is given through the Care Blocks
// puzzle (components/pet/CareBlocks.tsx): every cleared block applies a
// fraction of its colour's action via applyActionScaled, then we set a
// transient `action` prop (plus a monotonic `actionNonce`)
// that PetScene turns into a ~1s one-shot reaction (cleared afterwards so it
// fires once), and persist. The nonce guarantees a repeat of the same action
// still re-arms the reaction.
//
// Accessibility: stat bars are role='progressbar' with aria-valuenow/min/max
// and labels; controls are real <button>s with hover/disabled/focus-visible
// states; the layout stacks on narrow screens.
//
// THEME: warm, cozy virtual-pet look using the `pet` Tailwind tokens.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  applyAction,
  applyActionScaled,
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
import CareBlocks, { CARE_META } from "@/components/pet/CareBlocks";
import { COLS } from "@/lib/pet/careBlocks";
import { useReducedMotion } from "@/components/three/useReducedMotion";

const PetScene = dynamic(() => import("@/components/pet/PetScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-pet-accent">
      <div className="flex flex-col items-center gap-3">
        <span className="w-7 h-7 rounded-full border-2 border-pet-accentSoft border-t-pet-accent animate-spin" />
        <span className="font-mono text-[11px] tracking-widest uppercase">
          Waking Luffy…
        </span>
      </div>
    </div>
  ),
});

// The pup's name, shown on the stage, the header and the mood line.
const PET_NAME = "Luffy";

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

  // Keep a ref to the latest state so the interval/action callbacks always read
  // and persist the freshest value without re-subscribing each tick. Updated in
  // an effect (never during render) to satisfy the react-hooks rules.
  const stateRef = useRef<PetState | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const playFeedback = useCallback(() => {
    if (!soundEnabled || typeof AudioContext === "undefined") return;
    const ctx = audioRef.current ?? new AudioContext();
    audioRef.current = ctx;
    void ctx.resume().catch(() => {});
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.24);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }, [soundEnabled]);
  useEffect(() => () => { void audioRef.current?.close(); }, []);

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
    if (action !== "sleep") playFeedback();
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
  }, [playFeedback]);

  // Care Blocks cleared one or more rows: every block is 1/COLS of its colour's
  // action (a full row of one colour = one classic button press). Clearing
  // several rows at once earns a 25% bonus per extra row.
  const [clearNote, setClearNote] = useState("");
  const onBlocksCleared = useCallback(
    (counts: Record<PetAction, number>, rows: number) => {
      const current = stateRef.current;
      if (!current) return;
      const bonus = 1 + 0.25 * (rows - 1);
      let next = decayForElapsed(current, Date.now());
      const earned: PetAction[] = [];
      (Object.keys(counts) as PetAction[]).forEach((a) => {
        if (!counts[a]) return;
        next = applyActionScaled(next, a, (counts[a] / COLS) * bonus);
        earned.push(a);
      });
      setState(next);
      savePetState(next);
      playFeedback();

      // React with the colour that contributed most.
      const top = earned.sort((x, y) => counts[y] - counts[x])[0];
      if (top) {
        setPendingAction(top);
        setActionNonce((n) => n + 1);
        if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
        actionTimerRef.current = setTimeout(() => setPendingAction(null), ACTION_HOLD_MS);
      }
      setClearNote(
        `${rows > 1 ? `${rows} rows!` : "Row cleared!"} ${earned.map((a) => `+${CARE_META[a].stat}`).join(", ")}`,
      );
    },
    [playFeedback],
  );


  // Derived values (safe defaults before the client state loads).
  const stats = state?.stats ?? {
    hunger: 0,
    happiness: 0,
    energy: 0,
    cleanliness: 0,
  };
  const mood = state ? moodFor(stats) : "content";
  const wellbeing = state ? overallWellbeing(stats) : 0;
  // The pup has a fixed name.
  const petName = PET_NAME;
  // Colour weighting for new pieces: the lower a stat, the more often its
  // colour appears (with a floor so every colour still shows up).
  const needs = useMemo(
    () =>
      ({
        feed: 115 - stats.hunger,
        play: 115 - stats.happiness,
        sleep: 115 - stats.energy,
        clean: 115 - stats.cleanliness,
      }) as Record<PetAction, number>,
    [stats.hunger, stats.happiness, stats.energy, stats.cleanliness],
  );

  return (
    <div className="absolute inset-0 z-[5] flex flex-col md:flex-row bg-pet-cream">
      {/* 3D pet stage */}
      <div className="relative md:w-[48%] w-full h-[34%] md:h-full min-h-[140px] bg-gradient-to-b from-pet-paper to-pet-mist border-b md:border-b-0 md:border-r border-pet-accentSoft">
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
        <button type="button" aria-pressed={soundEnabled} onClick={() => setSoundEnabled(value => !value)} className="absolute top-2 right-2 z-10 rounded-full bg-white/90 px-3 py-2 text-xs text-pet-ink border border-pet-accentSoft">Sound {soundEnabled ? "on" : "off"}</button>
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

        {/* Stats, with Care Blocks underneath */}
        <div className="flex flex-col gap-4">
        {/* Stat bars */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
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

        {/* Care Blocks puzzle (replaces the Feed / Play / Sleep / Clean buttons) */}
        <div className="rounded-2xl border border-pet-accentSoft bg-pet-cream/60 p-3">
          <CareBlocks needs={needs} onClear={onBlocksCleared} disabled={!state} />
          <p aria-live="polite" className="min-h-[1.4em] mt-2 font-mono text-[11px] text-pet-accent">
            {clearNote}
          </p>
        </div>
        </div>

      </div>
    </div>
  );
}
