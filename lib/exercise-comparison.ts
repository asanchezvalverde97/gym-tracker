import type { SavedSessionBundle } from "./completed-sessions";
import type { SessionExercise, WorkoutSet } from "../types/workout";

export type ExerciseComparisonIndicator = "↑" | "=" | "↓";

export type ExerciseComparisonSummary = {
  metricType: "reps" | "duration";
  summaryText: string;
  primaryLabel: "Reps" | "Duration";
  primaryTotal: number;
  maxWeight: number;
};

function getBundleTime(bundle: SavedSessionBundle): number {
  return new Date(bundle.session.endedAt ?? bundle.session.startedAt).getTime();
}

function getSetWeight(set: WorkoutSet): number {
  return Math.max(
    0,
    Math.round(set.performed.weightKg ?? set.plan.weightKg ?? 0),
  );
}

function getValidSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((set) => set.skippedAt == null);
}

export function buildExerciseComparisonSummary(
  sets: WorkoutSet[],
): ExerciseComparisonSummary | null {
  const validSets = getValidSets(sets).sort((a, b) => a.setNumber - b.setNumber);

  if (validSets.length === 0) {
    return null;
  }

  if (validSets[0].metricType === "duration") {
    const durations = validSets.map((set) => Math.max(0, set.performed.durationSec ?? set.plan.durationSec ?? 0));
    const maxWeight = Math.max(...validSets.map((set) => getSetWeight(set)));

    return {
      metricType: "duration",
      summaryText: durations
        .map((duration, index) => {
          const weight = getSetWeight(validSets[index]);
          return weight > 0 ? `${weight}x${duration}s` : `${duration}s`;
        })
        .join(", "),
      primaryLabel: "Duration",
      primaryTotal: durations.reduce((total, value) => total + value, 0),
      maxWeight,
    };
  }

  const reps = validSets.map((set) => Math.max(0, set.performed.reps ?? set.plan.repsMax ?? set.plan.repsMin ?? 0));

  return {
    metricType: "reps",
    summaryText: reps
      .map((repValue, index) => `${getSetWeight(validSets[index])}x${repValue}`)
      .join(", "),
    primaryLabel: "Reps",
    primaryTotal: reps.reduce((total, value) => total + value, 0),
    maxWeight: Math.max(...validSets.map((set) => getSetWeight(set))),
  };
}

export function getComparisonIndicator(
  currentValue: number,
  previousValue: number,
): ExerciseComparisonIndicator {
  if (currentValue > previousValue) {
    return "↑";
  }

  if (currentValue < previousValue) {
    return "↓";
  }

  return "=";
}

export function findLastPreviousExerciseSummary(
  bundles: SavedSessionBundle[],
  exerciseId: string,
  options: {
    beforeTimeMs: number;
    excludeSessionId?: string | null;
  },
): ExerciseComparisonSummary | null {
  const matchingBundle = bundles
    .filter((bundle) => bundle.session.id !== options.excludeSessionId)
    .filter((bundle) => getBundleTime(bundle) < options.beforeTimeMs)
    .sort((left, right) => getBundleTime(right) - getBundleTime(left))
    .find((bundle) =>
      bundle.sessionExercises.some((sessionExercise) => sessionExercise.exerciseId === exerciseId),
    );

  if (!matchingBundle) {
    return null;
  }

  const sessionExercise = matchingBundle.sessionExercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .find((item) => item.exerciseId === exerciseId);

  if (!sessionExercise) {
    return null;
  }

  return buildExerciseComparisonSummary(
    matchingBundle.workoutSets.filter((set) => set.sessionExerciseId === sessionExercise.id),
  );
}

export function getExerciseSetsForSessionExercise(
  workoutSets: WorkoutSet[],
  sessionExerciseId: string,
): WorkoutSet[] {
  return workoutSets
    .filter((set) => set.sessionExerciseId === sessionExerciseId)
    .sort((a, b) => a.setNumber - b.setNumber);
}

export function getExerciseSetsForExerciseId(
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
  exerciseId: string,
): WorkoutSet[] {
  const sessionExercise = sessionExercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .find((item) => item.exerciseId === exerciseId);

  if (!sessionExercise) {
    return [];
  }

  return getExerciseSetsForSessionExercise(workoutSets, sessionExercise.id);
}
