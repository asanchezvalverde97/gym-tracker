import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SavedSessionBundle } from "./completed-sessions";

const ACTIVE_SESSION_STORAGE_KEY = "active_workout_session";

export async function saveActiveSession(
  bundle: SavedSessionBundle,
): Promise<void> {
  await AsyncStorage.setItem(
    ACTIVE_SESSION_STORAGE_KEY,
    JSON.stringify(bundle),
  );
}

export async function getActiveSession(): Promise<SavedSessionBundle | null> {
  const rawValue = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as SavedSessionBundle;
  } catch {
    return null;
  }
}

export async function clearActiveSession(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}
