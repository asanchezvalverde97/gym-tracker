import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ActiveWorkoutSession, SessionExercise, WorkoutSet } from "../types/workout";

const ACTIVE_SESSION_STORAGE_KEY = "active_workout_session";

export type ActiveSessionFlowPhase = "in_set" | "rest" | "between_exercises";

export interface ActiveSessionFlowSnapshot {
  phase: ActiveSessionFlowPhase;
  currentExerciseId: string;
  currentSetId: string;
}

export interface ActiveSessionRestSnapshot {
  interpretation: "after_completed_set";
  setId: string;
  startedAt: string;
  targetDurationSec: number;
  endsAt: string | null;
}

export interface ActiveSessionBundle {
  kind: "active_session";
  session: ActiveWorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
  flow: ActiveSessionFlowSnapshot;
  rest: ActiveSessionRestSnapshot | null;
}

export async function saveActiveSession(
  bundle: ActiveSessionBundle,
): Promise<void> {
  await AsyncStorage.setItem(
    ACTIVE_SESSION_STORAGE_KEY,
    JSON.stringify(bundle),
  );
}

export async function getActiveSession(): Promise<ActiveSessionBundle | null> {
  const rawValue = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as ActiveSessionBundle;
  } catch {
    return null;
  }
}

export async function clearActiveSession(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}
