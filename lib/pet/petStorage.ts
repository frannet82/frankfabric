// ---------------------------------------------------------------------------
// SSR-guarded, corruption-tolerant localStorage persistence for the virtual
// pet. All access to `window`/`localStorage` is guarded so this module is safe
// to import from client components that Next may still evaluate during static
// generation. Every read is wrapped in try/catch and shape-validated so a
// corrupt or partial payload can never throw — it just falls back to a fresh
// state.
// ---------------------------------------------------------------------------

import {
  DEFAULT_STATS,
  type PetState,
  type PetStats,
} from "./petState";

// Versioned key so a future schema change can bump the version and ignore old
// payloads instead of trying to migrate them.
const STORAGE_KEY = "frankfabric.pet.v1";

/** Build a brand-new pet state with default stats and now as birth/update. */
export function freshState(nowMs: number): PetState {
  return {
    stats: { ...DEFAULT_STATS },
    lastUpdated: nowMs,
    born: nowMs,
  };
}

/** Type guard: every stat is a finite number. */
function isValidStats(value: unknown): value is PetStats {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.hunger === "number" &&
    Number.isFinite(s.hunger) &&
    typeof s.happiness === "number" &&
    Number.isFinite(s.happiness) &&
    typeof s.energy === "number" &&
    Number.isFinite(s.energy) &&
    typeof s.cleanliness === "number" &&
    Number.isFinite(s.cleanliness)
  );
}

/** Type guard for a well-formed persisted PetState. */
function isValidState(value: unknown): value is PetState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  if (!isValidStats(s.stats)) return false;
  if (typeof s.lastUpdated !== "number" || !Number.isFinite(s.lastUpdated)) {
    return false;
  }
  if (typeof s.born !== "number" || !Number.isFinite(s.born)) return false;
  if (s.name !== undefined && typeof s.name !== "string") return false;
  return true;
}

/**
 * Load the persisted pet state. Returns null when there is no window (SSR) so
 * the caller can decide when to seed a fresh state on the client. Returns null
 * on missing/corrupt data so the caller falls back to a fresh state.
 */
export function loadPetState(): PetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist the pet state. No-op when there is no window or on any error. */
export function savePetState(state: PetState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full / disabled / private mode: silently ignore.
  }
}
