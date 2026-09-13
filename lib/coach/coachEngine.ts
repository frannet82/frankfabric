// Deterministic, dependency-free conversational coach engine.
//
// This is the "brain" of the Smart Fit coach trainer chatbot. It is pure
// TypeScript with NO React and NO three.js imports, so it stays build-safe (the
// site is a static export with output:'export' and no server) and is trivially
// reusable by the UI. It performs lightweight keyword/intent matching against
// the bundled workout knowledge base in workouts.ts and answers in an energetic
// Smart Fit gym-coach persona. This mirrors lib/chef/chefEngine.ts.
//
// Everything here is 100% client-side, offline, and DETERMINISTIC: the same
// inputs always produce the same output (no randomness, no I/O, no network).

import {
  allWorkouts as workouts,
  type Workout,
  type Goal,
  type Level,
  type Equipment,
} from "./workouts";

export type { Workout, Exercise, Goal, Level, Equipment } from "./workouts";

/** Who authored a chat message. */
export type ChatRole = "user" | "assistant";

/** A single turn in the conversation. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** The engine's reply plus optional quick-reply suggestion chips. */
export interface CoachResponse {
  reply: string;
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  "Suggest a workout",
  "I want to lose weight",
  "Build muscle at the gym",
  "A quick no-equipment routine",
];

const GOAL_LABELS: Record<Goal, string> = {
  "lose weight": "fat-loss",
  "build muscle": "muscle-building",
  endurance: "endurance",
  mobility: "mobility",
};

const LEVEL_LABELS: Record<Level, string> = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
};

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: "no equipment",
  home: "home kit",
  gym: "full gym",
};

// A handful of common words we ignore when matching workout names so that
// phrases like "walk me through the core crusher" still find that routine.
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "some",
  "any",
  "me",
  "please",
  "workout",
  "workouts",
  "routine",
  "routines",
  "exercise",
  "exercises",
  "for",
  "with",
  "to",
  "how",
  "do",
  "i",
  "you",
  "want",
  "need",
  "show",
  "give",
  "find",
  "of",
  "and",
  "can",
  "could",
  "would",
  "what",
  "whats",
  "is",
  "are",
  "got",
  "have",
  "my",
  "get",
  "let",
  "lets",
  "start",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}

/** Reduce a word to a rough singular form so "workouts" matches "workout". */
function singularize(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

function wordVariants(word: string): string[] {
  const singular = singularize(word);
  return singular === word ? [word] : [word, singular];
}

/** Find a workout the user named, preferring the longest exact name match. */
function findWorkoutByName(text: string): Workout | undefined {
  const normalized = normalize(text);
  const matches = workouts
    .filter((workout) => normalized.includes(normalize(workout.name)))
    .sort((a, b) => b.name.length - a.name.length);
  if (matches.length > 0) return matches[0];

  // Fall back to token overlap against workout name words.
  const tokens = tokenize(text).flatMap(wordVariants);
  let best: { workout: Workout; score: number } | undefined;
  for (const workout of workouts) {
    const nameWords = new Set(tokenize(workout.name).flatMap(wordVariants));
    const score = tokens.filter((token) => nameWords.has(token)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { workout, score };
    }
  }
  return best?.workout;
}

// ---- Intent detection cues -------------------------------------------------

const GREETING_WORDS = new Set([
  "hi",
  "hello",
  "hey",
  "yo",
  "howdy",
  "greetings",
  "hiya",
  "sup",
  "coach",
]);

const GOAL_KEYWORDS: Array<{ goal: Goal; words: string[] }> = [
  {
    goal: "lose weight",
    words: [
      "lose weight",
      "weight loss",
      "fat loss",
      "burn fat",
      "burn calories",
      "slim",
      "lean out",
      "cardio",
      "hiit",
      "get fit",
      "tone",
    ],
  },
  {
    goal: "build muscle",
    words: [
      "build muscle",
      "gain muscle",
      "muscle",
      "strength",
      "stronger",
      "bulk",
      "hypertrophy",
      "size",
      "lift",
      "get big",
      "tone up",
    ],
  },
  {
    goal: "endurance",
    words: [
      "endurance",
      "stamina",
      "cardio fitness",
      "run",
      "running",
      "5k",
      "bike",
      "cycling",
      "conditioning",
      "aerobic",
    ],
  },
  {
    goal: "mobility",
    words: [
      "mobility",
      "flexibility",
      "flexible",
      "stretch",
      "stretching",
      "recovery",
      "warm up",
      "warmup",
      "loosen",
      "stiff",
    ],
  },
];

const LEVEL_KEYWORDS: Array<{ level: Level; words: string[] }> = [
  { level: "beginner", words: ["beginner", "new", "starting", "start out", "novice", "easy", "just started"] },
  { level: "intermediate", words: ["intermediate", "some experience", "moderate"] },
  { level: "advanced", words: ["advanced", "experienced", "hard", "intense", "elite", "pro"] },
];

const EQUIPMENT_KEYWORDS: Array<{ equipment: Equipment; words: string[] }> = [
  { equipment: "gym", words: ["gym", "barbell", "machine", "machines", "cable", "weights", "dumbbell", "kettlebell"] },
  { equipment: "home", words: ["home", "at home", "living room", "band", "bands"] },
  { equipment: "none", words: ["no equipment", "no gear", "bodyweight", "no kit", "nothing", "no gym"] },
];

function detectGoal(normalized: string): Goal | undefined {
  for (const entry of GOAL_KEYWORDS) {
    if (entry.words.some((word) => normalized.includes(word))) return entry.goal;
  }
  return undefined;
}

function detectLevel(normalized: string): Level | undefined {
  for (const entry of LEVEL_KEYWORDS) {
    if (entry.words.some((word) => normalized.includes(word))) return entry.level;
  }
  return undefined;
}

function detectEquipment(normalized: string): Equipment | undefined {
  // Check the most specific cue groups first (none/home before gym) so an
  // explicit "no equipment" is not shadowed by an incidental "gym" mention.
  const order: Equipment[] = ["none", "home", "gym"];
  for (const target of order) {
    const entry = EQUIPMENT_KEYWORDS.find((e) => e.equipment === target);
    if (entry && entry.words.some((word) => normalized.includes(word))) return target;
  }
  return undefined;
}

function detectQuick(normalized: string): boolean {
  return /\b(quick|fast|short|express|no time|in a hurry|15 min|20 min)\b/.test(normalized);
}

// ---- Reply builders --------------------------------------------------------

function describeWorkout(workout: Workout): string {
  return (
    `${workout.name} is a ${LEVEL_LABELS[workout.level]} ${GOAL_LABELS[workout.goal]} routine ` +
    `(${EQUIPMENT_LABELS[workout.equipment]}) that runs about ${workout.durationMinutes} minutes and ` +
    `hits your ${workout.targetMuscles.join(", ")}. Ask me for the exercises or to walk you through it!`
  );
}

function exercisesReply(workout: Workout): string {
  const lines = workout.exercises
    .map((exercise) => {
      const load = exercise.reps
        ? `${exercise.sets} x ${exercise.reps}`
        : `${exercise.sets} x ${exercise.duration ?? ""}`.trim();
      const rest = exercise.rest && exercise.rest !== "0s" ? `, rest ${exercise.rest}` : "";
      return `- ${exercise.name}: ${load}${rest}`;
    })
    .join("\n");
  return (
    `Here's the lineup for ${workout.name} (about ${workout.durationMinutes} min):\n${lines}\n` +
    `Say "walk me through ${workout.name}" and I'll coach you rep by rep.`
  );
}

function walkthroughReply(workout: Workout): string {
  const steps = workout.exercises
    .map((exercise, index) => {
      const load = exercise.reps
        ? `${exercise.sets} sets of ${exercise.reps}`
        : `${exercise.sets} sets of ${exercise.duration ?? ""}`.trim();
      const rest = exercise.rest && exercise.rest !== "0s" ? ` Rest ${exercise.rest} between sets.` : "";
      return `${index + 1}. ${exercise.name} — ${load}.${rest}`;
    })
    .join("\n");
  const tips = workout.tips.map((tip) => `• ${tip}`).join("\n");
  return (
    `Let's crush ${workout.name}! Warm up for a few minutes, then:\n${steps}\n` +
    `Coach tips:\n${tips}\n` +
    `You've got this — leave it all on the floor!`
  );
}

/** Rank workouts against optional goal/level/equipment filters, deterministically. */
function filterWorkouts(filters: {
  goal?: Goal;
  level?: Level;
  equipment?: Equipment;
  quick?: boolean;
}): Workout[] {
  const scored = workouts
    .map((workout) => {
      let score = 0;
      if (filters.goal && workout.goal === filters.goal) score += 6;
      if (filters.level && workout.level === filters.level) score += 4;
      if (filters.equipment && workout.equipment === filters.equipment) score += 4;
      // Home routines also work for a "no equipment" request as a soft match.
      if (filters.equipment === "none" && workout.equipment === "home") score += 1;
      if (filters.quick && workout.durationMinutes <= 20) score += 3;
      return { workout, score };
    })
    .filter((entry) => entry.score > 0);

  // Deterministic ordering: score desc, then shorter session, then id asc.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.workout.durationMinutes !== b.workout.durationMinutes) {
      return a.workout.durationMinutes - b.workout.durationMinutes;
    }
    return a.workout.id < b.workout.id ? -1 : 1;
  });

  return scored.map((entry) => entry.workout);
}

function listReply(opener: string, list: Workout[]): string {
  const lines = list
    .slice(0, 4)
    .map((workout, index) => {
      return (
        `${index + 1}. ${workout.name} — ${LEVEL_LABELS[workout.level]}, ` +
        `${EQUIPMENT_LABELS[workout.equipment]}, ~${workout.durationMinutes} min.`
      );
    })
    .join("\n");
  const lead = list[0].name;
  return (
    `${opener}\n${lines}\n` +
    `I'd start you on ${lead}. Ask me for its exercises or to walk you through it!`
  );
}

function suggestionChipsFor(list: Workout[]): string[] {
  const chips: string[] = [];
  if (list[0]) {
    chips.push(`Show exercises for ${list[0].name}`);
    chips.push(`Walk me through ${list[0].name}`);
  }
  if (list[1]) chips.push(`Tell me about ${list[1].name}`);
  chips.push("Suggest something else");
  return Array.from(new Set(chips)).slice(0, 4);
}

/**
 * Deterministic workout-chat responder.
 *
 * Given the prior conversation `history` and the new `userText`, returns an
 * energetic coach-persona reply plus optional quick-reply suggestions. The same
 * inputs always produce the same output (no randomness, no I/O, no network).
 */
export function respondToMessage(
  history: ChatMessage[],
  userText: string,
): CoachResponse {
  const raw = (userText ?? "").trim();
  const normalized = normalize(raw);

  // Empty input.
  if (normalized.length === 0) {
    return {
      reply:
        "I'm fired up and ready, champ! Tell me your goal, or ask me to suggest a workout.",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const tokens = tokenize(raw);

  // Greeting (only when it's clearly a greeting, not buried in a request).
  const isGreeting =
    tokens.length > 0 && tokens.every((token) => GREETING_WORDS.has(token));
  if (isGreeting) {
    const isFirstTurn = history.every((message) => message.role !== "assistant");
    const opener = isFirstTurn
      ? "Hey there, welcome to Smart Fit! I'm Coach Fabric, your personal trainer."
      : "Back for more? Love the energy!";
    return {
      reply: `${opener} I can suggest a workout, match one to your goal or level, list the exercises, or walk you through a routine. What are we training today?`,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  // Thanks / friendly sign-off.
  if (/\b(thanks|thank you|cheers|appreciate)\b/.test(normalized)) {
    return {
      reply: "That's what I'm here for, champ! Stay consistent and come back stronger. 💪",
      suggestions: ["Suggest another workout", "A quick core routine"],
    };
  }

  // Help / capability question.
  if (/\b(help|what can you do|how does this work)\b/.test(normalized)) {
    return {
      reply:
        "I can suggest a workout, match one to your goal (lose weight, build muscle, endurance, or mobility), filter by your level or the equipment you have, list the exercises for a routine, and walk you through it step by step. Just tell me what you're after!",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const goal = detectGoal(normalized);
  const level = detectLevel(normalized);
  const equipment = detectEquipment(normalized);
  const quick = detectQuick(normalized);

  const wantsExerciseList =
    /\bexercise/.test(normalized) ||
    /\b(what.*(do|in it)|move|moves|lineup)\b/.test(normalized);
  const wantsWalkthrough =
    /\b(walk me through|walkthrough|step by step|how do i do|coach me|guide me|talk me through)\b/.test(
      normalized,
    );
  const wantsSuggest = /\b(suggest|recommend|idea|what should|anything|workout|routine|train|exercise)\b/.test(
    normalized,
  );

  const namedWorkout = findWorkoutByName(raw);

  // "Walk me through <workout>".
  if (wantsWalkthrough && namedWorkout) {
    return {
      reply: walkthroughReply(namedWorkout),
      suggestions: [`Show exercises for ${namedWorkout.name}`, "Suggest another workout"],
    };
  }

  // "Show exercises for <workout>".
  if (wantsExerciseList && namedWorkout) {
    return {
      reply: exercisesReply(namedWorkout),
      suggestions: [`Walk me through ${namedWorkout.name}`, "Suggest something else"],
    };
  }

  const hasFilter =
    goal !== undefined || level !== undefined || equipment !== undefined || quick;

  // Goal / level / equipment / quick filters -> ranked list of routines.
  if (hasFilter) {
    const list = filterWorkouts({ goal, level, equipment, quick });
    if (list.length > 0) {
      const parts: string[] = [];
      if (goal) parts.push(GOAL_LABELS[goal]);
      if (level) parts.push(LEVEL_LABELS[level]);
      if (equipment) parts.push(EQUIPMENT_LABELS[equipment]);
      if (quick) parts.push("quick");
      const descriptor = parts.length > 0 ? `${parts.join(", ")} ` : "";
      const opener = `Let's go! Here are some ${descriptor}routines I'd pick for you:`;
      return {
        reply: listReply(opener, list),
        suggestions: suggestionChipsFor(list),
      };
    }
  }

  // A workout named without a clear list/walkthrough/exercise ask: describe it.
  if (namedWorkout && !hasFilter && !wantsSuggest) {
    return {
      reply: describeWorkout(namedWorkout),
      suggestions: [
        `Show exercises for ${namedWorkout.name}`,
        `Walk me through ${namedWorkout.name}`,
      ],
    };
  }

  // Generic suggestion ask (no usable filter parsed): offer a spread.
  if (wantsSuggest) {
    const list = filterWorkouts({ quick: false });
    // No filter scored anything, so fall back to the whole corpus ordered by
    // session length then id for a deterministic, varied-looking spread.
    const spread = list.length > 0
      ? list
      : [...workouts].sort((a, b) => {
          if (a.durationMinutes !== b.durationMinutes) {
            return a.durationMinutes - b.durationMinutes;
          }
          return a.id < b.id ? -1 : 1;
        });
    return {
      reply: listReply("Here are a few workouts to get you moving:", spread),
      suggestions: suggestionChipsFor(spread),
    };
  }

  // Named a workout in some other phrasing.
  if (namedWorkout) {
    return {
      reply: describeWorkout(namedWorkout),
      suggestions: [
        `Show exercises for ${namedWorkout.name}`,
        `Walk me through ${namedWorkout.name}`,
      ],
    };
  }

  // Graceful fallback.
  return {
    reply:
      "I didn't quite catch that, but I'm ready to train! Tell me a goal like losing weight or building muscle, ask me to suggest a workout, or name a routine and I'll break it down for you.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
