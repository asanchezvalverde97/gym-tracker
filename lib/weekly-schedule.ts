import AsyncStorage from "@react-native-async-storage/async-storage";

const WEEKLY_SCHEDULE_STORAGE_KEY = "weekly_schedule";

export const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export type WeeklyScheduleAssignment = string | "rest";
export type WeeklySchedule = Record<WeekdayKey, WeeklyScheduleAssignment>;

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return {
    monday: "rest",
    tuesday: "rest",
    wednesday: "rest",
    thursday: "rest",
    friday: "rest",
    saturday: "rest",
    sunday: "rest",
  };
}

export function normalizeWeeklySchedule(value: unknown): WeeklySchedule {
  const fallback = createDefaultWeeklySchedule();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const parsed = value as Partial<Record<WeekdayKey, unknown>>;

  return WEEKDAY_KEYS.reduce<WeeklySchedule>((schedule, day) => {
    const assignment = parsed[day];

    schedule[day] =
      assignment === "rest" || typeof assignment === "string"
        ? assignment
        : fallback[day];

    return schedule;
  }, createDefaultWeeklySchedule());
}

export function getWeekdayKeyForDate(date: Date): WeekdayKey {
  const dayIndex = date.getDay();

  switch (dayIndex) {
    case 0:
      return "sunday";
    case 1:
      return "monday";
    case 2:
      return "tuesday";
    case 3:
      return "wednesday";
    case 4:
      return "thursday";
    case 5:
      return "friday";
    default:
      return "saturday";
  }
}

export function getAssignedRoutineIdForDate(
  schedule: WeeklySchedule,
  date: Date,
): WeeklyScheduleAssignment {
  return schedule[getWeekdayKeyForDate(date)];
}

export async function getWeeklySchedule(): Promise<WeeklySchedule> {
  const rawValue = await AsyncStorage.getItem(WEEKLY_SCHEDULE_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultWeeklySchedule();
  }

  try {
    return normalizeWeeklySchedule(JSON.parse(rawValue));
  } catch {
    return createDefaultWeeklySchedule();
  }
}

export async function saveWeeklySchedule(
  schedule: WeeklySchedule,
): Promise<void> {
  await AsyncStorage.setItem(
    WEEKLY_SCHEDULE_STORAGE_KEY,
    JSON.stringify(normalizeWeeklySchedule(schedule)),
  );
}
