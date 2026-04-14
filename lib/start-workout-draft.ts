import AsyncStorage from "@react-native-async-storage/async-storage";

import type { RoutineBundle } from "./routines-storage";

const START_WORKOUT_DRAFT_KEY = "start_workout_draft";

export interface StartWorkoutDraft extends RoutineBundle {
  id: string;
}

export async function saveStartWorkoutDraft(
  draft: StartWorkoutDraft,
): Promise<void> {
  await AsyncStorage.setItem(START_WORKOUT_DRAFT_KEY, JSON.stringify(draft));
}

export async function getStartWorkoutDraft(
  draftId: string,
): Promise<StartWorkoutDraft | null> {
  const rawValue = await AsyncStorage.getItem(START_WORKOUT_DRAFT_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as StartWorkoutDraft;
    return parsedValue?.id === draftId ? parsedValue : null;
  } catch {
    return null;
  }
}

export async function clearStartWorkoutDraft(): Promise<void> {
  await AsyncStorage.removeItem(START_WORKOUT_DRAFT_KEY);
}
