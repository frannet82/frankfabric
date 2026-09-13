// Bundled workout knowledge base for the Smart Fit coach trainer chatbot.
//
// This data is self-authored for this project (no external dataset), so there
// are no third-party licensing constraints. It is intentionally small and
// dependency-free: the conversational engine (coachEngine.ts) does keyword and
// intent matching against these records entirely in the browser, which keeps
// the static export (output:'export') server-free and offline-friendly. This
// mirrors lib/chef/recipes.ts (typed records + a merged JSON side-file).

/** Primary training goal a workout is best suited for. */
export type Goal = "lose weight" | "build muscle" | "endurance" | "mobility";

/** Experience level the routine is written for. */
export type Level = "beginner" | "intermediate" | "advanced";

/** What kit the routine assumes you have access to. */
export type Equipment = "none" | "home" | "gym";

export interface Exercise {
  /** Exercise name, e.g. "Bodyweight Squat". */
  name: string;
  /** Sets to perform, e.g. "3" or "4". */
  sets: string;
  /** Reps per set OR a duration, whichever the exercise uses. */
  reps?: string;
  /** Timed duration for holds/intervals, e.g. "30s" or "5 min". */
  duration?: string;
  /** Rest between sets, e.g. "60s". */
  rest?: string;
}

export interface Workout {
  /** Stable kebab-case identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Primary training goal this routine serves. */
  goal: Goal;
  /** Experience level the routine targets. */
  level: Level;
  /** Equipment the routine assumes. */
  equipment: Equipment;
  /** Free-form tags used for retrieval (hiit, core, push, pull, etc.). */
  tags: string[];
  /** Muscle groups the routine emphasises. */
  targetMuscles: string[];
  /** Approximate session length in minutes. */
  durationMinutes: number;
  /** Ordered list of exercises. */
  exercises: Exercise[];
  /** Short coaching tips for the routine. */
  tips: string[];
}

export const workouts: Workout[] = [
  {
    id: "full-body-kickstart",
    name: "Full-Body Kickstart",
    goal: "lose weight",
    level: "beginner",
    equipment: "none",
    tags: ["full-body", "bodyweight", "beginner", "fat-loss", "circuit"],
    targetMuscles: ["legs", "chest", "core", "back"],
    durationMinutes: 25,
    exercises: [
      { name: "March in Place", sets: "1", duration: "3 min", rest: "0s" },
      { name: "Bodyweight Squat", sets: "3", reps: "12", rest: "45s" },
      { name: "Incline Push-Up", sets: "3", reps: "10", rest: "45s" },
      { name: "Glute Bridge", sets: "3", reps: "15", rest: "45s" },
      { name: "Standing Knee Raise", sets: "3", reps: "20", rest: "45s" },
      { name: "Plank Hold", sets: "3", duration: "20s", rest: "45s" },
    ],
    tips: [
      "Move at a steady pace and keep breathing — never hold your breath under effort.",
      "If a push-up on the floor is tough, raise your hands onto a bench or wall.",
      "Consistency beats intensity when you are starting out; aim for three sessions a week.",
    ],
  },
  {
    id: "hiit-fat-burner",
    name: "HIIT Fat Burner",
    goal: "lose weight",
    level: "intermediate",
    equipment: "none",
    tags: ["hiit", "cardio", "fat-loss", "bodyweight", "interval"],
    targetMuscles: ["full-body", "core", "legs"],
    durationMinutes: 20,
    exercises: [
      { name: "Jumping Jacks", sets: "4", duration: "40s", rest: "20s" },
      { name: "High Knees", sets: "4", duration: "40s", rest: "20s" },
      { name: "Burpees", sets: "4", duration: "40s", rest: "20s" },
      { name: "Mountain Climbers", sets: "4", duration: "40s", rest: "20s" },
      { name: "Squat Jumps", sets: "4", duration: "40s", rest: "20s" },
    ],
    tips: [
      "Go all-out for the work interval, then fully recover in the rest — that contrast is the point.",
      "Scale burpees to a step-back if your heart rate spikes too high.",
      "Finish with two minutes of easy walking to bring your pulse down gradually.",
    ],
  },
  {
    id: "gym-strength-builder",
    name: "Gym Strength Builder",
    goal: "build muscle",
    level: "intermediate",
    equipment: "gym",
    tags: ["strength", "hypertrophy", "gym", "barbell", "push-pull-legs"],
    targetMuscles: ["legs", "back", "chest", "shoulders"],
    durationMinutes: 55,
    exercises: [
      { name: "Barbell Back Squat", sets: "4", reps: "6-8", rest: "120s" },
      { name: "Bench Press", sets: "4", reps: "6-8", rest: "120s" },
      { name: "Bent-Over Row", sets: "4", reps: "8-10", rest: "90s" },
      { name: "Overhead Press", sets: "3", reps: "8-10", rest: "90s" },
      { name: "Romanian Deadlift", sets: "3", reps: "8-10", rest: "90s" },
    ],
    tips: [
      "Warm up each big lift with two lighter ramp-up sets before your working weight.",
      "Add a little weight or one rep each week — progressive overload drives muscle growth.",
      "Keep one or two reps in reserve on every set so your form stays crisp.",
    ],
  },
  {
    id: "home-dumbbell-hypertrophy",
    name: "Home Dumbbell Hypertrophy",
    goal: "build muscle",
    level: "beginner",
    equipment: "home",
    tags: ["strength", "hypertrophy", "dumbbell", "home", "full-body"],
    targetMuscles: ["chest", "back", "legs", "arms"],
    durationMinutes: 40,
    exercises: [
      { name: "Goblet Squat", sets: "3", reps: "12", rest: "75s" },
      { name: "Dumbbell Floor Press", sets: "3", reps: "12", rest: "75s" },
      { name: "One-Arm Dumbbell Row", sets: "3", reps: "12 each", rest: "75s" },
      { name: "Dumbbell Romanian Deadlift", sets: "3", reps: "12", rest: "75s" },
      { name: "Dumbbell Curl to Press", sets: "3", reps: "10", rest: "60s" },
    ],
    tips: [
      "Pick a weight where the last two reps feel genuinely hard but still clean.",
      "Control the lowering phase for two seconds — that is where a lot of growth happens.",
      "Two full-body sessions a week with a rest day between is plenty to start.",
    ],
  },
  {
    id: "advanced-push-day",
    name: "Advanced Push Day",
    goal: "build muscle",
    level: "advanced",
    equipment: "gym",
    tags: ["strength", "push", "chest", "shoulders", "triceps", "gym"],
    targetMuscles: ["chest", "shoulders", "triceps"],
    durationMinutes: 60,
    exercises: [
      { name: "Incline Barbell Press", sets: "5", reps: "5", rest: "150s" },
      { name: "Weighted Dip", sets: "4", reps: "8", rest: "120s" },
      { name: "Seated Dumbbell Shoulder Press", sets: "4", reps: "10", rest: "90s" },
      { name: "Cable Fly", sets: "3", reps: "15", rest: "60s" },
      { name: "Overhead Triceps Extension", sets: "3", reps: "12", rest: "60s" },
    ],
    tips: [
      "Save the heavy pressing for the top of the session when you are freshest.",
      "Push the last set of isolation moves close to failure for a strong pump.",
      "Rotate your heavy press exercise every four to six weeks to keep progressing.",
    ],
  },
  {
    id: "5k-run-builder",
    name: "5K Run Builder",
    goal: "endurance",
    level: "beginner",
    equipment: "none",
    tags: ["cardio", "running", "endurance", "interval", "outdoor"],
    targetMuscles: ["legs", "heart", "core"],
    durationMinutes: 35,
    exercises: [
      { name: "Brisk Walk Warm-Up", sets: "1", duration: "5 min", rest: "0s" },
      { name: "Easy Jog", sets: "6", duration: "3 min", rest: "90s walk" },
      { name: "Steady Walk Recovery", sets: "6", duration: "90s", rest: "0s" },
      { name: "Cool-Down Walk", sets: "1", duration: "5 min", rest: "0s" },
    ],
    tips: [
      "Run at a pace where you could still hold a short conversation — that is your easy zone.",
      "Add 30 seconds to each jog interval every week as your base improves.",
      "Rest days are training too; recovery is when your endurance actually builds.",
    ],
  },
  {
    id: "endurance-bike-intervals",
    name: "Endurance Bike Intervals",
    goal: "endurance",
    level: "intermediate",
    equipment: "gym",
    tags: ["cardio", "cycling", "endurance", "interval", "gym"],
    targetMuscles: ["legs", "heart"],
    durationMinutes: 45,
    exercises: [
      { name: "Easy Spin Warm-Up", sets: "1", duration: "8 min", rest: "0s" },
      { name: "Tempo Interval", sets: "5", duration: "4 min", rest: "2 min easy" },
      { name: "Standing Climb", sets: "3", duration: "1 min", rest: "2 min easy" },
      { name: "Easy Spin Cool-Down", sets: "1", duration: "6 min", rest: "0s" },
    ],
    tips: [
      "Hold your tempo intervals at a hard-but-sustainable effort, not a sprint.",
      "Keep a smooth pedal cadence around 85 to 95 rpm on the flats.",
      "Hydrate every ten minutes — endurance work quietly drains your fluids.",
    ],
  },
  {
    id: "core-crusher",
    name: "Core Crusher",
    goal: "build muscle",
    level: "intermediate",
    equipment: "none",
    tags: ["core", "abs", "bodyweight", "stability"],
    targetMuscles: ["core", "abs", "obliques"],
    durationMinutes: 15,
    exercises: [
      { name: "Plank Hold", sets: "3", duration: "45s", rest: "30s" },
      { name: "Dead Bug", sets: "3", reps: "12 each", rest: "30s" },
      { name: "Bicycle Crunch", sets: "3", reps: "20", rest: "30s" },
      { name: "Side Plank", sets: "3", duration: "30s each", rest: "30s" },
      { name: "Hollow Body Hold", sets: "3", duration: "20s", rest: "30s" },
    ],
    tips: [
      "Brace your core as if bracing for a light punch — that is the tension you want.",
      "Quality over speed: slow, controlled reps hit the deep core muscles harder.",
      "Keep your lower back gently pressed down on the floor moves to protect it.",
    ],
  },
  {
    id: "morning-mobility-flow",
    name: "Morning Mobility Flow",
    goal: "mobility",
    level: "beginner",
    equipment: "none",
    tags: ["mobility", "stretch", "warm-up", "recovery", "flexibility"],
    targetMuscles: ["hips", "spine", "shoulders"],
    durationMinutes: 12,
    exercises: [
      { name: "Cat-Cow", sets: "1", reps: "10", rest: "0s" },
      { name: "World's Greatest Stretch", sets: "1", reps: "5 each", rest: "0s" },
      { name: "Hip Circles", sets: "1", reps: "8 each", rest: "0s" },
      { name: "Thoracic Rotation", sets: "1", reps: "8 each", rest: "0s" },
      { name: "Standing Forward Fold", sets: "1", duration: "45s", rest: "0s" },
    ],
    tips: [
      "Move slowly and breathe into each position — never force a stretch.",
      "This flow is perfect right after waking or before a heavier session.",
      "Stop at gentle tension, never sharp pain; mobility improves week over week.",
    ],
  },
  {
    id: "hip-shoulder-mobility",
    name: "Hip & Shoulder Mobility",
    goal: "mobility",
    level: "intermediate",
    equipment: "home",
    tags: ["mobility", "stretch", "flexibility", "recovery", "band"],
    targetMuscles: ["hips", "shoulders", "ankles"],
    durationMinutes: 18,
    exercises: [
      { name: "Deep Squat Hold", sets: "3", duration: "30s", rest: "30s" },
      { name: "Band Shoulder Dislocate", sets: "3", reps: "10", rest: "30s" },
      { name: "90/90 Hip Switch", sets: "3", reps: "8 each", rest: "30s" },
      { name: "Ankle Rock", sets: "3", reps: "10 each", rest: "30s" },
      { name: "Wall Angel", sets: "3", reps: "10", rest: "30s" },
    ],
    tips: [
      "Use a light band or towel for the shoulder work and keep the arms long.",
      "Sink a little deeper into each hold as the tissue warms up.",
      "Do this on rest days to speed recovery and keep your joints happy.",
    ],
  },
  {
    id: "lower-body-power",
    name: "Lower-Body Power",
    goal: "build muscle",
    level: "advanced",
    equipment: "gym",
    tags: ["strength", "legs", "power", "gym", "barbell"],
    targetMuscles: ["quads", "hamstrings", "glutes"],
    durationMinutes: 55,
    exercises: [
      { name: "Barbell Front Squat", sets: "5", reps: "4", rest: "150s" },
      { name: "Deadlift", sets: "4", reps: "3", rest: "180s" },
      { name: "Walking Lunge", sets: "3", reps: "10 each", rest: "90s" },
      { name: "Hip Thrust", sets: "3", reps: "8", rest: "90s" },
      { name: "Standing Calf Raise", sets: "4", reps: "15", rest: "60s" },
    ],
    tips: [
      "Set your brace before every heavy rep and keep the bar path over mid-foot.",
      "Leave the near-maximal singles for the deadlift and stop if speed drops off.",
      "Fuel this session well — heavy leg work demands both carbs and recovery sleep.",
    ],
  },
  {
    id: "lunch-break-cardio",
    name: "Lunch-Break Cardio",
    goal: "lose weight",
    level: "beginner",
    equipment: "home",
    tags: ["cardio", "fat-loss", "low-impact", "home", "quick"],
    targetMuscles: ["full-body", "heart", "legs"],
    durationMinutes: 18,
    exercises: [
      { name: "March in Place", sets: "1", duration: "2 min", rest: "0s" },
      { name: "Step Touch", sets: "3", duration: "60s", rest: "30s" },
      { name: "Low-Impact Jumping Jack", sets: "3", duration: "45s", rest: "30s" },
      { name: "Standing Oblique Crunch", sets: "3", reps: "15 each", rest: "30s" },
      { name: "Calf Raise", sets: "3", reps: "20", rest: "30s" },
    ],
    tips: [
      "Keep it low-impact if you are near neighbours or short on space.",
      "A brisk 18 minutes at lunch adds up fast across a working week.",
      "Pair this with a short walk afterward for extra easy calorie burn.",
    ],
  },
];

// Additional self-authored workouts live in data/workouts.json so the corpus
// can grow without bloating this module. The JSON is imported directly
// (tsconfig enables resolveJsonModule) and given a Workout[] type via a narrow
// assertion. No `any` is introduced and the static export stays server-free.
import workoutsJson from "@/data/workouts.json";

const bundledWorkouts = workoutsJson as Workout[];

/**
 * The full workout corpus: the curated workouts above merged with the bundled
 * JSON workouts, de-duplicated by id. Entries defined in this module win on an
 * id collision as a safety net. This is the single source the coach chatbot
 * reads from so it can offer every available routine.
 */
export const allWorkouts: Workout[] = (() => {
  const byId = new Map<string, Workout>();
  for (const workout of [...workouts, ...bundledWorkouts]) {
    if (!byId.has(workout.id)) byId.set(workout.id, workout);
  }
  return Array.from(byId.values());
})();
