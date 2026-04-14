import { exercises } from "../data/exercises";
import { replaceSavedSessions, type SavedSessionBundle } from "./completed-sessions";
import type {
  CompletedWorkoutSession,
  Exercise,
  SessionExercise,
  SetVariant,
  WorkoutSet,
} from "../types/workout";

type SeedExercise = {
  name: string;
  weight_kg?: number;
  sets?: number[];
  assisted_sets?: number[];
  sets_sec?: number[];
  rest_sec?: number;
};

type SeedSessionTemplate = {
  day: string;
  bodyweightKg?: number | null;
  feeling?: 1 | 2 | 3 | 4 | null;
  notes?: string | null;
  exercises: SeedExercise[];
};

const exerciseNameMap: Record<string, string> = {
  elevaciones_piernas: "leg_raises",
};

const weeklyTemplates: SeedSessionTemplate[][] = [
  [
    {
      day: "espalda_biceps",
      bodyweightKg: 72,
      feeling: 2,
      notes: "Grip felt off on the last pull-up set.",
      exercises: [
        { name: "dominadas", sets: [5, 5, 4], rest_sec: 210 },
        { name: "remo_mancuerna", weight_kg: 18, sets: [10, 9, 9], rest_sec: 150 },
        { name: "chin_ups", assisted_sets: [6, 5, 5], rest_sec: 150 },
        { name: "curl_mancuerna", weight_kg: 12, sets: [8, 8, 7], rest_sec: 90 },
        { name: "dead_hang", sets_sec: [40, 35] },
      ],
    },
    {
      day: "pecho_triceps",
      bodyweightKg: 72,
      feeling: 3,
      exercises: [
        { name: "fondos", sets: [6, 6, 5, 5], rest_sec: 180 },
        { name: "flexiones", sets: [14, 12, 11], rest_sec: 90 },
        { name: "flexiones_cerradas", sets: [8, 7], rest_sec: 90 },
        { name: "plancha", sets_sec: [55] },
        { name: "elevaciones_piernas", sets: [12, 10] },
      ],
    },
    {
      day: "hombro_core",
      bodyweightKg: 72,
      feeling: 2,
      exercises: [
        { name: "press_hombro_mancuerna", weight_kg: 12, sets: [12, 11, 10], rest_sec: 120 },
        { name: "elevaciones_laterales", weight_kg: 7, sets: [12, 11, 10], rest_sec: 90 },
        { name: "pajaros", weight_kg: 6, sets: [11, 10, 10], rest_sec: 90 },
        { name: "isometrico_lateral", weight_kg: 6, sets_sec: [35, 30] },
        { name: "leg_raises", sets: [12, 11] },
        { name: "plancha", sets_sec: [60, 60] },
      ],
    },
    {
      day: "pierna",
      bodyweightKg: 72,
      feeling: 3,
      notes: "Legs still heavy from the weekend.",
      exercises: [
        { name: "goblet_squat", weight_kg: 20, sets: [12, 12, 11], rest_sec: 120 },
        { name: "bulgaras", weight_kg: 18, sets: [10, 10, 9], rest_sec: 120 },
        { name: "rumano", weight_kg: 20, sets: [10, 10, 10], rest_sec: 120 },
        { name: "puente_gluteo", weight_kg: 20, sets: [14, 13, 12] },
      ],
    },
  ],
  [
    {
      day: "espalda_biceps",
      bodyweightKg: 72,
      feeling: 3,
      exercises: [
        { name: "dominadas", sets: [5, 5, 4], rest_sec: 210 },
        { name: "remo_mancuerna", weight_kg: 18, sets: [10, 10, 9], rest_sec: 150 },
        { name: "chin_ups", assisted_sets: [6, 6, 5], rest_sec: 150 },
        { name: "curl_mancuerna", weight_kg: 12, sets: [8, 8, 8], rest_sec: 90 },
        { name: "dead_hang", sets_sec: [42, 36] },
      ],
    },
    {
      day: "pecho_triceps",
      bodyweightKg: 72,
      feeling: 3,
      notes: "Dips felt steadier today.",
      exercises: [
        { name: "fondos", sets: [6, 6, 6, 5], rest_sec: 180 },
        { name: "flexiones", sets: [14, 12, 12], rest_sec: 90 },
        { name: "flexiones_cerradas", sets: [8, 8], rest_sec: 90 },
        { name: "plancha", sets_sec: [55] },
        { name: "elevaciones_piernas", sets: [12, 11] },
      ],
    },
    {
      day: "hombro_core",
      bodyweightKg: 72,
      feeling: 3,
      exercises: [
        { name: "press_hombro_mancuerna", weight_kg: 12, sets: [12, 12, 10], rest_sec: 120 },
        { name: "elevaciones_laterales", weight_kg: 7, sets: [12, 11, 11], rest_sec: 90 },
        { name: "pajaros", weight_kg: 6, sets: [11, 11, 10], rest_sec: 90 },
        { name: "isometrico_lateral", weight_kg: 6, sets_sec: [35, 35] },
        { name: "leg_raises", sets: [12, 12] },
        { name: "plancha", sets_sec: [60, 65] },
      ],
    },
    {
      day: "pierna",
      bodyweightKg: 72,
      feeling: 2,
      exercises: [
        { name: "goblet_squat", weight_kg: 20, sets: [12, 12, 12], rest_sec: 120 },
        { name: "bulgaras", weight_kg: 18, sets: [10, 10, 10], rest_sec: 120 },
        { name: "rumano", weight_kg: 20, sets: [10, 11, 10], rest_sec: 120 },
        { name: "puente_gluteo", weight_kg: 20, sets: [14, 14, 12] },
      ],
    },
  ],
  [
    {
      day: "espalda_biceps",
      bodyweightKg: 72,
      feeling: 3,
      exercises: [
        { name: "dominadas", sets: [6, 5, 4], rest_sec: 210 },
        { name: "remo_mancuerna", weight_kg: 18, sets: [10, 10, 10], rest_sec: 150 },
        { name: "chin_ups", assisted_sets: [6, 6, 6], rest_sec: 150 },
        { name: "curl_mancuerna", weight_kg: 12, sets: [9, 8, 8], rest_sec: 90 },
        { name: "dead_hang", sets_sec: [45, 38] },
      ],
    },
    {
      day: "pecho_triceps",
      bodyweightKg: 72,
      feeling: 3,
      exercises: [
        { name: "fondos", sets: [7, 6, 6, 5], rest_sec: 180 },
        { name: "flexiones", sets: [15, 12, 12], rest_sec: 90 },
        { name: "flexiones_cerradas", sets: [9, 8], rest_sec: 90 },
        { name: "plancha", sets_sec: [60] },
        { name: "elevaciones_piernas", sets: [13, 11] },
      ],
    },
    {
      day: "hombro_core",
      bodyweightKg: 72,
      feeling: 3,
      notes: "Press looked cleaner after warm-up.",
      exercises: [
        { name: "press_hombro_mancuerna", weight_kg: 12, sets: [13, 12, 11], rest_sec: 120 },
        { name: "elevaciones_laterales", weight_kg: 7, sets: [12, 12, 11], rest_sec: 90 },
        { name: "pajaros", weight_kg: 6, sets: [12, 11, 10], rest_sec: 90 },
        { name: "isometrico_lateral", weight_kg: 6, sets_sec: [40, 35] },
        { name: "leg_raises", sets: [13, 12] },
        { name: "plancha", sets_sec: [65, 65] },
      ],
    },
    {
      day: "pierna",
      bodyweightKg: 72,
      feeling: 3,
      exercises: [
        { name: "goblet_squat", weight_kg: 20, sets: [13, 12, 12], rest_sec: 120 },
        { name: "bulgaras", weight_kg: 20, sets: [10, 10, 10], rest_sec: 120 },
        { name: "rumano", weight_kg: 20, sets: [11, 11, 10], rest_sec: 120 },
        { name: "puente_gluteo", weight_kg: 20, sets: [15, 14, 12] },
      ],
    },
  ],
  [
    {
      day: "espalda_biceps",
      bodyweightKg: 72,
      feeling: 4,
      notes: "First week pull-ups felt clearly stronger.",
      exercises: [
        { name: "dominadas", sets: [6, 5, 5], rest_sec: 210 },
        { name: "remo_mancuerna", weight_kg: 20, sets: [9, 9, 8], rest_sec: 150 },
        { name: "chin_ups", assisted_sets: [7, 6, 6], rest_sec: 150 },
        { name: "curl_mancuerna", weight_kg: 12, sets: [9, 9, 8], rest_sec: 90 },
        { name: "dead_hang", sets_sec: [45, 40] },
      ],
    },
    {
      day: "pecho_triceps",
      bodyweightKg: 72,
      feeling: 3,
      exercises: [
        { name: "fondos", sets: [7, 6, 6, 6], rest_sec: 180 },
        { name: "flexiones", sets: [15, 13, 12], rest_sec: 90 },
        { name: "flexiones_cerradas", sets: [9, 8], rest_sec: 90 },
        { name: "plancha", sets_sec: [60] },
        { name: "elevaciones_piernas", sets: [13, 12] },
      ],
    },
    {
      day: "hombro_core",
      bodyweightKg: 72,
      feeling: 4,
      exercises: [
        { name: "press_hombro_mancuerna", weight_kg: 13, sets: [11, 10, 10], rest_sec: 120 },
        { name: "elevaciones_laterales", weight_kg: 7, sets: [13, 12, 11], rest_sec: 90 },
        { name: "pajaros", weight_kg: 6, sets: [12, 11, 11], rest_sec: 90 },
        { name: "isometrico_lateral", weight_kg: 6, sets_sec: [40, 35] },
        { name: "leg_raises", sets: [14, 12] },
        { name: "plancha", sets_sec: [70, 65] },
      ],
    },
    {
      day: "pierna",
      bodyweightKg: 72,
      feeling: 3,
      exercises: [
        { name: "goblet_squat", weight_kg: 22, sets: [12, 12, 11], rest_sec: 150 },
        { name: "bulgaras", weight_kg: 20, sets: [10, 10, 10], rest_sec: 120 },
        { name: "rumano", weight_kg: 22, sets: [10, 10, 10], rest_sec: 120 },
        { name: "puente_gluteo", weight_kg: 22, sets: [14, 13, 12] },
      ],
    },
  ],
  [
    {
      day: "espalda_biceps",
      bodyweightKg: 71,
      feeling: 3,
      exercises: [
        { name: "dominadas", sets: [6, 6, 5], rest_sec: 210 },
        { name: "remo_mancuerna", weight_kg: 20, sets: [10, 9, 9], rest_sec: 150 },
        { name: "chin_ups", sets: [4, 4, 4], rest_sec: 150 },
        { name: "curl_mancuerna", weight_kg: 12, sets: [9, 9, 9], rest_sec: 90 },
        { name: "dead_hang", sets_sec: [48, 42] },
      ],
    },
    {
      day: "pecho_triceps",
      bodyweightKg: 71,
      feeling: 3,
      notes: "Triceps were cooked after the close-grip sets.",
      exercises: [
        { name: "fondos", sets: [7, 7, 6, 6], rest_sec: 180 },
        { name: "flexiones", sets: [16, 13, 12], rest_sec: 90 },
        { name: "flexiones_cerradas", sets: [9, 9], rest_sec: 90 },
        { name: "plancha", sets_sec: [65] },
        { name: "elevaciones_piernas", sets: [13, 12] },
      ],
    },
    {
      day: "hombro_core",
      bodyweightKg: 71,
      feeling: 3,
      exercises: [
        { name: "press_hombro_mancuerna", weight_kg: 13, sets: [11, 11, 10], rest_sec: 120 },
        { name: "elevaciones_laterales", weight_kg: 7, sets: [13, 12, 12], rest_sec: 90 },
        { name: "pajaros", weight_kg: 6, sets: [12, 12, 11], rest_sec: 90 },
        { name: "isometrico_lateral", weight_kg: 6, sets_sec: [42, 36] },
        { name: "leg_raises", sets: [14, 13] },
        { name: "plancha", sets_sec: [70, 70] },
      ],
    },
    {
      day: "pierna",
      bodyweightKg: 71,
      feeling: 3,
      exercises: [
        { name: "goblet_squat", weight_kg: 22, sets: [12, 13, 11], rest_sec: 150 },
        { name: "bulgaras", weight_kg: 20, sets: [11, 10, 10], rest_sec: 120 },
        { name: "rumano", weight_kg: 22, sets: [10, 11, 10], rest_sec: 120 },
        { name: "puente_gluteo", weight_kg: 22, sets: [15, 13, 13] },
      ],
    },
  ],
  [
    {
      day: "espalda_biceps",
      bodyweightKg: 71,
      feeling: 4,
      exercises: [
        { name: "dominadas", sets: [6, 6, 5], rest_sec: 210 },
        { name: "remo_mancuerna", weight_kg: 20, sets: [10, 10, 9], rest_sec: 150 },
        { name: "chin_ups", sets: [5, 4, 4], rest_sec: 150 },
        { name: "curl_mancuerna", weight_kg: 13, sets: [8, 8, 7], rest_sec: 90 },
        { name: "dead_hang", sets_sec: [50, 42] },
      ],
    },
    {
      day: "pecho_triceps",
      bodyweightKg: 71,
      feeling: 4,
      exercises: [
        { name: "fondos", sets: [8, 7, 6, 6], rest_sec: 180 },
        { name: "flexiones", sets: [16, 14, 12], rest_sec: 90 },
        { name: "flexiones_cerradas", sets: [10, 9], rest_sec: 90 },
        { name: "plancha", sets_sec: [65] },
        { name: "elevaciones_piernas", sets: [14, 12] },
      ],
    },
    {
      day: "hombro_core",
      bodyweightKg: 71,
      feeling: 3,
      exercises: [
        { name: "press_hombro_mancuerna", weight_kg: 13, sets: [12, 11, 10], rest_sec: 120 },
        { name: "elevaciones_laterales", weight_kg: 7, sets: [13, 13, 12], rest_sec: 90 },
        { name: "pajaros", weight_kg: 6, sets: [12, 12, 12], rest_sec: 90 },
        { name: "isometrico_lateral", weight_kg: 6, sets_sec: [45, 38] },
        { name: "leg_raises", sets: [14, 14] },
        { name: "plancha", sets_sec: [75, 70] },
      ],
    },
    {
      day: "pierna",
      bodyweightKg: 71,
      feeling: 3,
      notes: "Squats moved well, Bulgarians still rough.",
      exercises: [
        { name: "goblet_squat", weight_kg: 22, sets: [13, 13, 12], rest_sec: 150 },
        { name: "bulgaras", weight_kg: 20, sets: [11, 11, 10], rest_sec: 120 },
        { name: "rumano", weight_kg: 22, sets: [11, 11, 10], rest_sec: 120 },
        { name: "puente_gluteo", weight_kg: 22, sets: [15, 14, 13] },
      ],
    },
  ],
  [
    {
      day: "espalda_biceps",
      bodyweightKg: 71,
      feeling: 4,
      exercises: [
        { name: "dominadas", sets: [7, 6, 5], rest_sec: 210 },
        { name: "remo_mancuerna", weight_kg: 22, sets: [9, 8, 8], rest_sec: 150 },
        { name: "chin_ups", sets: [5, 5, 4], rest_sec: 150 },
        { name: "curl_mancuerna", weight_kg: 13, sets: [8, 8, 8], rest_sec: 90 },
        { name: "dead_hang", sets_sec: [52, 45] },
      ],
    },
    {
      day: "pecho_triceps",
      bodyweightKg: 71,
      feeling: 3,
      exercises: [
        { name: "fondos", sets: [8, 7, 7, 6], rest_sec: 180 },
        { name: "flexiones", sets: [17, 14, 13], rest_sec: 90 },
        { name: "flexiones_cerradas", sets: [10, 9], rest_sec: 90 },
        { name: "plancha", sets_sec: [70] },
        { name: "elevaciones_piernas", sets: [14, 13] },
      ],
    },
    {
      day: "hombro_core",
      bodyweightKg: 71,
      feeling: 4,
      notes: "Finally hit solid sets with 13 kg press.",
      exercises: [
        { name: "press_hombro_mancuerna", weight_kg: 13, sets: [12, 12, 11], rest_sec: 120 },
        { name: "elevaciones_laterales", weight_kg: 8, sets: [10, 10, 9], rest_sec: 90 },
        { name: "pajaros", weight_kg: 6, sets: [13, 12, 12], rest_sec: 90 },
        { name: "isometrico_lateral", weight_kg: 6, sets_sec: [45, 40] },
        { name: "leg_raises", sets: [15, 14] },
        { name: "plancha", sets_sec: [75, 75] },
      ],
    },
    {
      day: "pierna",
      bodyweightKg: 71,
      feeling: 4,
      exercises: [
        { name: "goblet_squat", weight_kg: 24, sets: [11, 11, 10], rest_sec: 150 },
        { name: "bulgaras", weight_kg: 22, sets: [10, 10, 10], rest_sec: 120 },
        { name: "rumano", weight_kg: 24, sets: [10, 10, 9], rest_sec: 120 },
        { name: "puente_gluteo", weight_kg: 24, sets: [14, 13, 12] },
      ],
    },
  ],
  [
    {
      day: "espalda_biceps",
      bodyweightKg: 71,
      feeling: 4,
      notes: "Best back day in a while.",
      exercises: [
        { name: "dominadas", sets: [7, 6, 6], rest_sec: 210 },
        { name: "remo_mancuerna", weight_kg: 22, sets: [9, 9, 8], rest_sec: 150 },
        { name: "chin_ups", sets: [5, 5, 5], rest_sec: 150 },
        { name: "curl_mancuerna", weight_kg: 13, sets: [9, 8, 8], rest_sec: 90 },
        { name: "dead_hang", sets_sec: [55, 45] },
      ],
    },
    {
      day: "pecho_triceps",
      bodyweightKg: 71,
      feeling: 4,
      exercises: [
        { name: "fondos", sets: [8, 8, 7, 6], rest_sec: 180 },
        { name: "flexiones", sets: [17, 15, 13], rest_sec: 90 },
        { name: "flexiones_cerradas", sets: [10, 10], rest_sec: 90 },
        { name: "plancha", sets_sec: [75] },
        { name: "elevaciones_piernas", sets: [15, 13] },
      ],
    },
    {
      day: "hombro_core",
      bodyweightKg: 71,
      feeling: 4,
      exercises: [
        { name: "press_hombro_mancuerna", weight_kg: 13, sets: [12, 12, 12], rest_sec: 120 },
        { name: "elevaciones_laterales", weight_kg: 8, sets: [10, 10, 10], rest_sec: 90 },
        { name: "pajaros", weight_kg: 6, sets: [13, 13, 12], rest_sec: 90 },
        { name: "isometrico_lateral", weight_kg: 6, sets_sec: [50, 40] },
        { name: "leg_raises", sets: [15, 15] },
        { name: "plancha", sets_sec: [80, 75] },
      ],
    },
    {
      day: "pierna",
      bodyweightKg: 71,
      feeling: 3,
      exercises: [
        { name: "goblet_squat", weight_kg: 24, sets: [12, 11, 10], rest_sec: 150 },
        { name: "bulgaras", weight_kg: 22, sets: [10, 10, 10], rest_sec: 120 },
        { name: "rumano", weight_kg: 24, sets: [10, 10, 10], rest_sec: 120 },
        { name: "puente_gluteo", weight_kg: 24, sets: [14, 14, 12] },
      ],
    },
  ],
];

function getExerciseBySeedName(name: string): Exercise | null {
  const resolvedName = exerciseNameMap[name] ?? name;
  return exercises.find((exercise) => exercise.name === resolvedName) ?? null;
}

function createCompletedSet(
  sessionExerciseId: string,
  setNumber: number,
  value: number,
  metricType: Exercise["metricType"],
  variant: SetVariant,
  weightKg: number | null,
  restSecTarget: number | null,
  completedAt: string,
  createdAt: string,
): WorkoutSet {
  return {
    id: `seed_ws_${sessionExerciseId}_${setNumber}_${variant}`,
    sessionExerciseId,
    setNumber,
    metricType,
    status: "completed",
    plan: {
      repsMin: metricType === "reps" ? value : null,
      repsMax: metricType === "reps" ? value : null,
      durationSec: metricType === "duration" ? value : null,
      weightKg,
      restSec: restSecTarget,
      variant,
    },
    performed: {
      reps: metricType === "reps" ? value : null,
      durationSec: metricType === "duration" ? value : null,
      weightKg,
      feeling: null,
    },
    rest: {
      targetSec: restSecTarget,
      actualSec: restSecTarget,
      startedAt: completedAt,
      endedAt: completedAt,
    },
    createdAt,
    completedAt,
    skippedAt: null,
    variant,
    reps: metricType === "reps" ? value : null,
    durationSec: metricType === "duration" ? value : null,
    weightKg,
    restSecTarget,
    restSecActual: restSecTarget,
    feeling: null,
  };
}

function getWeekDayOffset(weekIndex: number, sessionIndex: number): number {
  return weekIndex * 7 + sessionIndex * 2 + 1;
}

function buildSeedBundle(
  template: SeedSessionTemplate,
  weekIndex: number,
  sessionIndex: number,
): SavedSessionBundle {
  const now = new Date();
  const daysAgo = getWeekDayOffset(weekIndex, sessionIndex);
  const endDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  endDate.setHours(18 + sessionIndex, 18, 0, 0);

  const startedAtMs =
    endDate.getTime() -
    (52 + weekIndex * 3 + sessionIndex * 5) * 60 * 1000;
  const startedAt = new Date(startedAtMs).toISOString();
  const endedAt = endDate.toISOString();
  const sessionId = `seed_session_w${weekIndex + 1}_${template.day}`;

  const sessionExercises: SessionExercise[] = [];
  const workoutSets: WorkoutSet[] = [];

  template.exercises.forEach((seedExercise, exerciseIndex) => {
    const exercise = getExerciseBySeedName(seedExercise.name);

    if (!exercise) {
      return;
    }

    const allValues = [
      ...(seedExercise.sets ?? []),
      ...(seedExercise.assisted_sets ?? []),
      ...(seedExercise.sets_sec ?? []),
    ];

    if (allValues.length === 0) {
      return;
    }

    const sessionExerciseId = `seed_se_${sessionId}_${exerciseIndex + 1}`;
    const sessionExercise: SessionExercise = {
      id: sessionExerciseId,
      sessionId,
      exerciseId: exercise.id,
      order: exerciseIndex + 1,
      targetSets: allValues.length,
      targetRepsMin: exercise.metricType === "reps" ? Math.min(...allValues) : null,
      targetRepsMax: exercise.metricType === "reps" ? Math.max(...allValues) : null,
      targetDurationSec: exercise.metricType === "duration" ? Math.max(...allValues) : null,
      defaultWeightKg: seedExercise.weight_kg ?? null,
      defaultRestSec: seedExercise.rest_sec ?? null,
    };

    sessionExercises.push(sessionExercise);

    let completedAtMs = startedAtMs + 8 * 60 * 1000 + exerciseIndex * 2 * 60 * 1000;
    const completedTimestamps = allValues.map(() => {
      completedAtMs += 5 * 60 * 1000;
      return new Date(completedAtMs).toISOString();
    });

    (seedExercise.sets ?? []).forEach((value, setIndex) => {
      workoutSets.push(
        createCompletedSet(
          sessionExerciseId,
          workoutSets.filter((set) => set.sessionExerciseId === sessionExerciseId).length + 1,
          value,
          exercise.metricType,
          "normal",
          seedExercise.weight_kg ?? null,
          seedExercise.rest_sec ?? null,
          completedTimestamps[setIndex],
          startedAt,
        ),
      );
    });

    (seedExercise.assisted_sets ?? []).forEach((value, setIndex) => {
      const offset = (seedExercise.sets ?? []).length;
      workoutSets.push(
        createCompletedSet(
          sessionExerciseId,
          workoutSets.filter((set) => set.sessionExerciseId === sessionExerciseId).length + 1,
          value,
          exercise.metricType,
          "assisted",
          seedExercise.weight_kg ?? null,
          seedExercise.rest_sec ?? null,
          completedTimestamps[offset + setIndex],
          startedAt,
        ),
      );
    });

    (seedExercise.sets_sec ?? []).forEach((value, setIndex) => {
      const offset = (seedExercise.sets ?? []).length + (seedExercise.assisted_sets ?? []).length;
      workoutSets.push(
        createCompletedSet(
          sessionExerciseId,
          workoutSets.filter((set) => set.sessionExerciseId === sessionExerciseId).length + 1,
          value,
          exercise.metricType,
          "normal",
          seedExercise.weight_kg ?? null,
          seedExercise.rest_sec ?? null,
          completedTimestamps[offset + setIndex],
          startedAt,
        ),
      );
    });
  });

  const session: CompletedWorkoutSession = {
    id: sessionId,
    kind: "completed",
    routineId: null,
    name: template.day,
    startedAt,
    endedAt,
    bodyweightKg: template.bodyweightKg ?? null,
    feeling: template.feeling ?? null,
    notes: template.notes ?? null,
    createdAt: startedAt,
  };

  return {
    kind: "completed_session",
    session,
    sessionExercises,
    workoutSets,
  };
}

export async function seedCompletedSessions(): Promise<void> {
  const bundles = weeklyTemplates.flatMap((weekTemplates, weekIndex) =>
    weekTemplates.map((template, sessionIndex) =>
      buildSeedBundle(template, weekIndex, sessionIndex),
    ),
  );

  await replaceSavedSessions(
    bundles.sort((a, b) => {
      const aTime = new Date(a.session.endedAt ?? a.session.startedAt).getTime();
      const bTime = new Date(b.session.endedAt ?? b.session.startedAt).getTime();

      return bTime - aTime;
    }),
  );
}

export async function clearSeededCompletedSessions(): Promise<void> {
  await replaceSavedSessions([]);
}
