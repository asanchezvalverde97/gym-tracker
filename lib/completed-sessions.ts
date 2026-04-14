import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  CompletedWorkoutSession,
  SessionExercise,
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

async function readSavedSessionBundles(): Promise<CompletedSessionBundle[]> {
  const rawValue = await AsyncStorage.getItem(COMPLETED_SESSIONS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as CompletedSessionBundle[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

async function writeSavedSessionBundles(
  bundles: CompletedSessionBundle[],
): Promise<void> {
  await AsyncStorage.setItem(
    COMPLETED_SESSIONS_STORAGE_KEY,
    JSON.stringify(bundles),
  );
}

export async function saveCompletedSession(
  session: CompletedWorkoutSession,
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
): Promise<void> {
  const savedBundles = await readSavedSessionBundles();
  const nextBundle: CompletedSessionBundle = {
    kind: "completed_session",
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
