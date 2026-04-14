import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_SETTINGS_STORAGE_KEY = "user_settings";

export interface UserSettings {
  bodyweightKg: number | null;
}

const defaultUserSettings: UserSettings = {
  bodyweightKg: null,
};

export async function getUserSettings(): Promise<UserSettings> {
  const rawValue = await AsyncStorage.getItem(USER_SETTINGS_STORAGE_KEY);

  if (!rawValue) {
    return defaultUserSettings;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<UserSettings>;

    return {
      bodyweightKg:
        typeof parsedValue.bodyweightKg === "number"
          ? parsedValue.bodyweightKg
          : null,
    };
  } catch {
    return defaultUserSettings;
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  await AsyncStorage.setItem(
    USER_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      bodyweightKg: settings.bodyweightKg,
    }),
  );
}
