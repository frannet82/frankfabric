// ---------------------------------------------------------------------------
// Virtual pet (Tamagotchi) state engine.
//
// This module is framework-agnostic, dependency-free, and fully SSR-safe: it
// touches no browser globals and calls no Date.now() inside its pure functions
// (the caller passes `nowMs` in), so every function is deterministic and easy
// to reason about. localStorage persistence lives in the companion module
// lib/pet/petStorage.ts.
//
// STAT DIRECTION CONVENTION (all stats are numbers clamped to [0, 100]):
//   - hunger      => this is FULLNESS. 100 = fully fed, 0 = starving. It DECAYS
//                    toward 0 over time (the pet gets hungrier as it drops).
//   - happiness   => 100 = delighted, 0 = miserable. DECAYS toward 0 over time.
//   - energy      => 100 = well-rested, 0 = exhausted. DECAYS toward 0 over time.
//   - cleanliness => 100 = spotless, 0 = filthy. DECAYS toward 0 over time.
//
// So for EVERY stat, higher is better and time pushes it downward. The mood and
// wellbeing helpers read the same convention.
// ---------------------------------------------------------------------------

/** Numeric 0..100 pet stats. Higher is always better; all decay toward 0. */
export type PetStats = {
  /** Fullness: 100 = fully fed, 0 = starving. */
  hunger: number;
  /** 100 = delighted, 0 = miserable. */
  happiness: number;
  /** 100 = well-rested, 0 = exhausted. */
  energy: number;
  /** 100 = spotless, 0 = filthy. */
  cleanliness: number;
};

/** The full persisted pet state. */
export type PetState = {
  stats: PetStats;
  /** Epoch ms of the last time decay was applied / state was written. */
  lastUpdated: number;
  /** Optional visitor-chosen name for the pet. */
  name?: string;
  /** Epoch ms the pet was first created. */
  born: number;
};

/** The four supported interactions. */
export type PetAction = "feed" | "play" | "sleep" | "clean";

/** Discrete moods, roughly ordered worst -> best. */
export type PetMood =
  | "sad"
  | "hungry"
  | "tired"
  | "dirty"
  | "content"
  | "happy";

/** A freshly-hatched pet starts happy, fed, rested, and clean. */
export const DEFAULT_STATS: PetStats = {
  hunger: 80,
  happiness: 80,
  energy: 80,
  cleanliness: 85,
};

// Per-stat decay rates in POINTS PER REAL MINUTE. Chosen so the pet noticeably
// changes over a browsing session (a few points per minute) without being
// punishing: hunger and energy drop fastest, happiness a bit slower, and
// cleanliness slowest.
const DECAY_PER_MINUTE: PetStats = {
  hunger: 3.5,
  happiness: 2.2,
  energy: 3.0,
  cleanliness: 1.4,
};

// Thresholds used by both the mood logic and the UI stat-bar colors.
export const STAT_WARN = 40; // at/below => "getting low"
export const STAT_CRIT = 20; // at/below => "critical"

/** Clamp a number into the [0, 100] stat range. */
function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Apply time-based decay for the real time elapsed between state.lastUpdated
 * and nowMs. Returns a NEW state with decayed stats (clamped to [0, 100]) and
 * lastUpdated set to nowMs. If nowMs is not after lastUpdated (clock skew,
 * first tick), the stats are returned unchanged but the timestamp advances.
 */
export function decayForElapsed(state: PetState, nowMs: number): PetState {
  const elapsedMs = nowMs - state.lastUpdated;
  if (elapsedMs <= 0) {
    return { ...state, lastUpdated: nowMs };
  }
  const minutes = elapsedMs / 60000;
  const s = state.stats;
  return {
    ...state,
    stats: {
      hunger: clamp(s.hunger - DECAY_PER_MINUTE.hunger * minutes),
      happiness: clamp(s.happiness - DECAY_PER_MINUTE.happiness * minutes),
      energy: clamp(s.energy - DECAY_PER_MINUTE.energy * minutes),
      cleanliness: clamp(s.cleanliness - DECAY_PER_MINUTE.cleanliness * minutes),
    },
    lastUpdated: nowMs,
  };
}

/**
 * Apply an interaction. Returns a NEW state with adjusted stats (all clamped).
 * The lastUpdated timestamp is left untouched here — the caller decides whether
 * to also decay/persist (typically decayForElapsed is applied first).
 *
 *   feed  => big fullness boost, small cleanliness cost (eating is messy).
 *   play  => happiness boost, but costs energy and a little fullness.
 *   sleep => big energy restore + a little happiness (a good nap feels nice).
 *   clean => big cleanliness boost + a small happiness bump (fresh & comfy).
 */
export function applyAction(state: PetState, action: PetAction): PetState {
  const s = state.stats;
  let next: PetStats;
  switch (action) {
    case "feed":
      next = {
        ...s,
        hunger: clamp(s.hunger + 34),
        cleanliness: clamp(s.cleanliness - 6),
      };
      break;
    case "play":
      next = {
        ...s,
        happiness: clamp(s.happiness + 28),
        energy: clamp(s.energy - 14),
        hunger: clamp(s.hunger - 8),
      };
      break;
    case "sleep":
      next = {
        ...s,
        energy: clamp(s.energy + 40),
        happiness: clamp(s.happiness + 6),
      };
      break;
    case "clean":
      next = {
        ...s,
        cleanliness: clamp(s.cleanliness + 45),
        happiness: clamp(s.happiness + 5),
      };
      break;
    default:
      next = { ...s };
  }
  return { ...state, stats: next };
}

/**
 * Derive a discrete mood from the stats. Priority order (first match wins):
 *   1. hungry  — fullness is critically low
 *   2. tired   — energy is critically low
 *   3. dirty   — cleanliness is critically low
 *   4. sad     — happiness is critically low, OR overall wellbeing is poor
 *   5. content — doing okay but not great
 *   6. happy   — everything is in good shape
 * Physical needs (food/sleep/cleanliness) are surfaced before the general
 * "sad" mood so the UI nudges the visitor toward the right action.
 */
export function moodFor(stats: PetStats): PetMood {
  if (stats.hunger <= STAT_CRIT) return "hungry";
  if (stats.energy <= STAT_CRIT) return "tired";
  if (stats.cleanliness <= STAT_CRIT) return "dirty";
  if (stats.happiness <= STAT_CRIT) return "sad";

  const wellbeing = overallWellbeing(stats);
  if (wellbeing <= STAT_WARN) return "sad";
  if (wellbeing >= 70 && stats.happiness >= 55) return "happy";
  return "content";
}

/** Average of the four stats, 0..100. */
export function overallWellbeing(stats: PetStats): number {
  return (
    (stats.hunger + stats.happiness + stats.energy + stats.cleanliness) / 4
  );
}
