export type Exercise = 'rest' | 'squat' | 'march' | 'jacks' | 'curl';
export const EXERCISES: { id: Exercise; label: string; cue: string }[] = [
  { id: 'rest', label: 'Rest', cue: 'Choose an exercise to see a full-body demonstration.' },
  { id: 'squat', label: 'Squats', cue: 'Sit back, bend your knees, then return to standing.' },
  { id: 'march', label: 'March', cue: 'Lift one knee at a time and swing the opposite arm.' },
  { id: 'curl', label: 'Biceps curl', cue: 'Keep elbows by your sides. Curl both hands toward your shoulders, then lower slowly.' },
  { id: 'jacks', label: 'Jumping jacks', cue: 'Open your arms and feet together, then return to center.' },
];
/** Smooth repeating demonstration poses. Angles are normalized VRM local rotations. */
export function exercisePose(exercise: Exercise, seconds: number) {
  // Full repetitions: controlled squats at 2.4s, brisk jumping jacks at 1.2s.
  const period = exercise === 'jacks' ? 1.2 : exercise === 'curl' ? 2.8 : 2.4;
  const cycle = (1 - Math.cos(seconds * Math.PI * 2 / period)) / 2;
  const march = Math.sin(seconds * Math.PI * 2 / 2.4);
  const squat = exercise === 'squat' ? cycle * 0.85 : 0;
  const jack = exercise === 'jacks' ? cycle : 0;
  const leftLift = exercise === 'march' ? Math.max(0, march) * 0.9 : 0;
  const rightLift = exercise === 'march' ? Math.max(0, -march) * 0.9 : 0;
  return {
    leftThigh: -squat - leftLift, rightThigh: -squat - rightLift,
    leftKnee: 2 * squat + leftLift, rightKnee: 2 * squat + rightLift,
    ankle: -squat, spread: jack * 0.28,
    hipDrop: 0.78 * (1 - Math.cos(squat)),
    hop: jack * 0.06 + 0.78 * (1 - Math.cos(jack * 0.28)),
    armRaise: jack * 2.15,
    leftSwing: exercise === 'march' ? march * 0.45 : -squat * 0.7,
    rightSwing: exercise === 'march' ? -march * 0.45 : -squat * 0.7,
    lean: squat * 0.28,
    elbowCurl: exercise === 'curl' ? 0.18 + cycle * 2.0 : 0,
    grip: exercise === 'curl' ? 1 : 0,
  };
}
