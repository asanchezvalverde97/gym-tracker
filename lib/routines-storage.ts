import AsyncStorage from "@react-native-async-storage/async-storage";

import { routineExercises, routines } from "../data/routines";
import type { Routine, RoutineExercise, SetVariant } from "../types/workout";

const ROUTINES_STORAGE_KEY = "saved_routine_bundles";

export interface RoutineBundle {
  routine: Routine;
  routineExercises: RoutineExercise[];
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type LegacyRoutineExercise = RoutineExercise & {
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
};

function getDefaultRoutineBundles(): RoutineBundle[] {
  return routines.map((routine) => ({
    routine,
    routineExercises: routineExercises
      .filter((item) => item.routineId === routine.id)
      .sort((a, b) => a.order - b.order)
      .map((item, index) => normalizeRoutineExercise(routine.id, item, index)),
  }));
}

function normalizeRoutineExercise(
  routineId: string,
  exercise: RoutineExercise,
  index: number,
): RoutineExercise {
  const legacyExercise = exercise as LegacyRoutineExercise;

  return {
    id: exercise.id || createId("re"),
    routineId,
    exerciseId: exercise.exerciseId,
    order: index + 1,
    targetSets: exercise.targetSets ?? 3,
    targetReps:
      exercise.targetReps ??
      legacyExercise.targetRepsMax ??
      legacyExercise.targetRepsMin ??
      null,
    targetDurationSec: exercise.targetDurationSec ?? null,
    defaultWeightKg: exercise.defaultWeightKg ?? null,
    defaultRestSec: exercise.defaultRestSec ?? null,
    defaultSetVariant: (exercise.defaultSetVariant ?? "normal") as SetVariant,
  };
}

function normalizeRoutineBundle(bundle: RoutineBundle): RoutineBundle {
  const routineId = bundle.routine.id || createId("rt");
  const createdAt = bundle.routine.createdAt || new Date().toISOString();

  return {
    routine: {
      ...bundle.routine,
      id: routineId,
      createdAt,
    },
    routineExercises: bundle.routineExercises.map((exercise, index) =>
      normalizeRoutineExercise(routineId, exercise, index),
    ),
  };
}

async function readSavedRoutineBundles(): Promise<RoutineBundle[] | null> {
  const rawValue = await AsyncStorage.getItem(ROUTINES_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as RoutineBundle[];

    return Array.isArray(parsedValue)
      ? parsedValue.map(normalizeRoutineBundle)
      : null;
  } catch {
    return null;
  }
}

async function writeSavedRoutineBundles(
  bundles: RoutineBundle[],
): Promise<void> {
  await AsyncStorage.setItem(
    ROUTINES_STORAGE_KEY,
    JSON.stringify(bundles.map(normalizeRoutineBundle)),
  );
}

export async function getRoutineBundles(): Promise<RoutineBundle[]> {
  const savedBundles = await readSavedRoutineBundles();

  return savedBundles ?? getDefaultRoutineBundles();
}

export async function getRoutineBundleById(
  routineId: string,
): Promise<RoutineBundle | null> {
  const bundles = await getRoutineBundles();

  return bundles.find((bundle) => bundle.routine.id === routineId) ?? null;
}

export async function saveRoutineBundle(bundle: RoutineBundle): Promise<void> {
  const nextBundle = normalizeRoutineBundle(bundle);
  const bundles = (await readSavedRoutineBundles()) ?? getDefaultRoutineBundles();
  const existingIndex = bundles.findIndex(
    (item) => item.routine.id === nextBundle.routine.id,
  );

  if (existingIndex >= 0) {
    bundles[existingIndex] = nextBundle;
  } else {
    bundles.push(nextBundle);
  }

  await writeSavedRoutineBundles(bundles);
}

export async function deleteRoutineById(routineId: string): Promise<void> {
  const bundles = (await readSavedRoutineBundles()) ?? getDefaultRoutineBundles();
  const nextBundles = bundles.filter((bundle) => bundle.routine.id !== routineId);

  await writeSavedRoutineBundles(nextBundles);
}
