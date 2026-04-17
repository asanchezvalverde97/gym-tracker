import type { SavedSessionBundle } from "./completed-sessions";

export function isSameLocalDay(
  left: string | null | undefined,
  right: Date,
): boolean {
  if (!left) {
    return false;
  }

  const leftDate = new Date(left);

  if (Number.isNaN(leftDate.getTime())) {
    return false;
  }

  return (
    leftDate.getFullYear() === right.getFullYear() &&
    leftDate.getMonth() === right.getMonth() &&
    leftDate.getDate() === right.getDate()
  );
}

export function formatSessionDate(value: string | null | undefined): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatSessionDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string | null {
  if (!startedAt || !endedAt) {
    return null;
  }

  const startedAtMs = new Date(startedAt).getTime();
  const endedAtMs = new Date(endedAt).getTime();

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs < startedAtMs) {
    return null;
  }

  const totalMinutes = Math.round((endedAtMs - startedAtMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

export function getCompletedExerciseCount(bundle: SavedSessionBundle): number {
  return bundle.sessionExercises.filter((sessionExercise) =>
    bundle.workoutSets.some(
      (set) =>
        set.sessionExerciseId === sessionExercise.id &&
        set.completedAt != null &&
        set.skippedAt == null,
    ),
  ).length;
}

export function getCompletedSetCount(bundle: SavedSessionBundle): number {
  return bundle.workoutSets.filter(
    (set) => set.completedAt != null && set.skippedAt == null,
  ).length;
}

export function getLatestCompletedSessionForRoutine(
  bundles: SavedSessionBundle[],
  routineId: string,
): SavedSessionBundle | null {
  return (
    bundles
      .filter((bundle) => bundle.session.routineId === routineId)
      .sort((left, right) => {
        const leftTime = new Date(left.session.endedAt ?? left.session.startedAt).getTime();
        const rightTime = new Date(right.session.endedAt ?? right.session.startedAt).getTime();

        return rightTime - leftTime;
      })[0] ?? null
  );
}

export function hasCompletedWorkoutOnDate(
  bundles: SavedSessionBundle[],
  date: Date,
): boolean {
  return bundles.some((bundle) =>
    isSameLocalDay(bundle.session.endedAt ?? bundle.session.startedAt, date),
  );
}
