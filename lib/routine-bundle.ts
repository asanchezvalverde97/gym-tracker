import type { Exercise, RoutineExercise } from "../types/workout";

import type { RoutineBundle } from "./routines-storage";

export function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneRoutineBundle(bundle: RoutineBundle): RoutineBundle {
  return {
    routine: { ...bundle.routine },
    routineExercises: bundle.routineExercises.map((exercise) => ({ ...exercise })),
  };
}

export function createEmptyRoutineBundle(name = ""): RoutineBundle {
  const createdAt = new Date().toISOString();
  const routineId = createId("rt");

  return {
    routine: {
      id: routineId,
      name,
      createdAt,
    },
    routineExercises: [],
  };
}

export function createRoutineExercise(
  routineId: string,
  exercise: Exercise,
  order: number,
): RoutineExercise {
  return {
    id: createId("re"),
    routineId,
    exerciseId: exercise.id,
    order,
    targetSets: 3,
    targetReps: exercise.metricType === "reps" ? 8 : null,
    targetDurationSec: exercise.metricType === "duration" ? 30 : null,
    defaultWeightKg: null,
    defaultRestSec: 90,
    defaultSetVariant: "normal",
  };
}
