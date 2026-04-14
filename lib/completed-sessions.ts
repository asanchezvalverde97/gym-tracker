import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  SessionExercise,
  WorkoutSession,
  WorkoutSet,
} from "../types/workout";

const COMPLETED_SESSIONS_STORAGE_KEY = "completed_workout_sessions";

export interface SavedSessionBundle {
  session: WorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
  restStartTimeMs?: number | null;
  restDurationTargetSec?: number | null;
}

async function readSavedSessionBundles(): Promise<SavedSessionBundle[]> {
  const rawValue = await AsyncStorage.getItem(COMPLETED_SESSIONS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as SavedSessionBundle[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

async function writeSavedSessionBundles(
  bundles: SavedSessionBundle[],
): Promise<void> {
  await AsyncStorage.setItem(
    COMPLETED_SESSIONS_STORAGE_KEY,
    JSON.stringify(bundles),
  );
}

export async function saveCompletedSession(
  session: WorkoutSession,
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
): Promise<void> {
  const savedBundles = await readSavedSessionBundles();
  const nextBundle: SavedSessionBundle = {
    session,
    sessionExercises,
    workoutSets,
  };
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

export async function getSavedSessions(): Promise<SavedSessionBundle[]> {
  return readSavedSessionBundles();
}

export async function getSavedSessionById(
  sessionId: string,
): Promise<SavedSessionBundle | null> {
  const savedBundles = await readSavedSessionBundles();

  return savedBundles.find((bundle) => bundle.session.id === sessionId) ?? null;
}

export async function deleteSavedSessionById(sessionId: string): Promise<void> {
  const savedBundles = await readSavedSessionBundles();
  const nextBundles = savedBundles.filter((bundle) => bundle.session.id !== sessionId);

  await writeSavedSessionBundles(nextBundles);
}

export async function replaceSavedSessions(
  bundles: SavedSessionBundle[],
): Promise<void> {
  await writeSavedSessionBundles(bundles);
}
