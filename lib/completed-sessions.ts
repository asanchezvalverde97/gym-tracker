import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  CompletedWorkoutSession,
  SessionExercise,
  SetFeeling,
  WorkoutSet,
} from "../types/workout";

const COMPLETED_SESSIONS_STORAGE_KEY = "completed_workout_sessions";

export interface CompletedSessionBundle {
  kind: "completed_session";
  session: CompletedWorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
}

export type SavedSessionBundle = CompletedSessionBundle;

type LegacyWorkoutSet = Partial<WorkoutSet> & {
  reps?: number | null;
  durationSec?: number | null;
  weightKg?: number | null;
  restSecTarget?: number | null;
  restSecActual?: number | null;
  feeling?: SetFeeling | null;
};

function normalizeWorkoutSet(set: WorkoutSet | LegacyWorkoutSet): WorkoutSet {
  const legacySet = set as LegacyWorkoutSet;
  const normalizedPerformed = {
    reps: set.performed?.reps ?? legacySet.reps ?? null,
    durationSec: set.performed?.durationSec ?? legacySet.durationSec ?? null,
    weightKg: set.performed?.weightKg ?? legacySet.weightKg ?? null,
    feeling: set.performed?.feeling ?? legacySet.feeling ?? null,
  };
  const normalizedRest = {
    targetSec: set.rest?.targetSec ?? legacySet.restSecTarget ?? set.plan?.restSec ?? null,
    actualSec: set.rest?.actualSec ?? legacySet.restSecActual ?? null,
    startedAt: set.rest?.startedAt ?? set.completedAt ?? null,
    endedAt: set.rest?.endedAt ?? null,
  };

  return {
    id: set.id ?? "",
    sessionExerciseId: set.sessionExerciseId ?? "",
    setNumber: set.setNumber ?? 0,
    metricType: set.metricType ?? "reps",
    status:
      set.status ??
      (set.skippedAt != null ? "skipped" : set.completedAt != null ? "completed" : "pending"),
    plan: {
      repsMin: set.plan?.repsMin ?? null,
      repsMax: set.plan?.repsMax ?? null,
      durationSec: set.plan?.durationSec ?? null,
      weightKg: set.plan?.weightKg ?? null,
      restSec: set.plan?.restSec ?? normalizedRest.targetSec,
      variant: set.plan?.variant ?? set.variant ?? "normal",
    },
    performed: normalizedPerformed,
    rest: normalizedRest,
    createdAt: set.createdAt ?? set.completedAt ?? set.skippedAt ?? new Date(0).toISOString(),
    completedAt: set.completedAt ?? null,
    skippedAt: set.skippedAt ?? null,
    variant: set.variant ?? set.plan?.variant ?? "normal",
  };
}

export function normalizeCompletedSessionBundle(
  bundle: CompletedSessionBundle,
): CompletedSessionBundle {
  return {
    kind: "completed_session",
    session: bundle.session,
    sessionExercises: bundle.sessionExercises,
    workoutSets: Array.isArray(bundle.workoutSets)
      ? bundle.workoutSets.map((set) => normalizeWorkoutSet(set))
      : [],
  };
}

async function readSavedSessionBundles(): Promise<CompletedSessionBundle[]> {
  const rawValue = await AsyncStorage.getItem(COMPLETED_SESSIONS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as CompletedSessionBundle[];
    return Array.isArray(parsedValue)
      ? parsedValue.map(normalizeCompletedSessionBundle)
      : [];
  } catch {
    return [];
  }
}

async function writeSavedSessionBundles(
  bundles: CompletedSessionBundle[],
): Promise<void> {
  await AsyncStorage.setItem(
    COMPLETED_SESSIONS_STORAGE_KEY,
    JSON.stringify(bundles.map(normalizeCompletedSessionBundle)),
  );
}

export async function saveCompletedSession(
  session: CompletedWorkoutSession,
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
): Promise<void> {
  const savedBundles = await readSavedSessionBundles();
  const nextBundle = normalizeCompletedSessionBundle({
    kind: "completed_session",
    session,
    sessionExercises,
    workoutSets,
  });
  const existingIndex = savedBundles.findIndex(
    (bundle) => bundle.session.id === session.id,
  );

  if (existingIndex >= 0) {
    savedBundles[existingIndex] = nextBundle;
  } else {
    savedBundles.unshift(nextBundle);
  }

  await writeSavedSessionBundles(savedBundles);
}

export async function getSavedSessions(): Promise<CompletedSessionBundle[]> {
  return readSavedSessionBundles();
}

export async function getSavedSessionById(
  sessionId: string,
): Promise<CompletedSessionBundle | null> {
  const savedBundles = await readSavedSessionBundles();

  return savedBundles.find((bundle) => bundle.session.id === sessionId) ?? null;
}

export async function deleteSavedSessionById(sessionId: string): Promise<void> {
  const savedBundles = await readSavedSessionBundles();
  const nextBundles = savedBundles.filter((bundle) => bundle.session.id !== sessionId);

  await writeSavedSessionBundles(nextBundles);
}

export async function replaceSavedSessions(
  bundles: CompletedSessionBundle[],
): Promise<void> {
  await writeSavedSessionBundles(bundles);
}
