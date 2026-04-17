## Summary

- Added a focused helper for finding the last previous completed occurrence of an exercise by exact `exerciseId`.
- Added exercise-level `Last / Reps-or-Duration / Weight` comparison to the active session screen.
- Added the same last-previous-exercise comparison to completed session detail cards.
- Kept the logic simple: exact exercise match only, previous occurrence only, separate primary-metric and weight arrows, `New` when no prior history exists.

---

## lib/exercise-comparison.ts

### CHANGED CODE

```ts
export type ExerciseComparisonIndicator = "↑" | "=" | "↓";

export type ExerciseComparisonSummary = {
  metricType: "reps" | "duration";
  summaryText: string;
  primaryLabel: "Reps" | "Duration";
  primaryTotal: number;
  maxWeight: number;
};
```

```ts
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
```

```ts
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
```

```ts
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
```

### ADDED CODE

```ts
export function getExerciseSetsForSessionExercise(
  workoutSets: WorkoutSet[],
  sessionExerciseId: string,
): WorkoutSet[] {
  return workoutSets
    .filter((set) => set.sessionExerciseId === sessionExerciseId)
    .sort((a, b) => a.setNumber - b.setNumber);
}
```

### REMOVED CODE

```ts
```

---

## app/session.tsx

### CHANGED CODE

```ts
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
```

```ts
import {
  getSavedSessions,
  saveCompletedSession,
  type SavedSessionBundle,
} from "../lib/completed-sessions";
import {
  buildExerciseComparisonSummary,
  findLastPreviousExerciseSummary,
  getComparisonIndicator,
  getExerciseSetsForSessionExercise,
} from "../lib/exercise-comparison";
```

```ts
const [historyBundles, setHistoryBundles] = useState<SavedSessionBundle[]>([]);
```

```ts
useFocusEffect(
  useCallback(() => {
    let isActive = true;

    void (async () => {
      const savedBundles = await getSavedSessions();

      if (isActive) {
        setHistoryBundles(savedBundles);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []),
);
```

```ts
const currentExerciseSets = getExerciseSetsForSessionExercise(
  flowState.workoutSets,
  currentExercise.id,
).map((set) =>
  set.id === currentSet.id
    ? {
        ...set,
        plan: {
          ...set.plan,
          repsMax: currentSet.metricType === "reps" ? mainValue : set.plan.repsMax,
          repsMin: currentSet.metricType === "reps" ? mainValue : set.plan.repsMin,
          durationSec:
            currentSet.metricType === "duration" ? mainValue : set.plan.durationSec,
          weightKg: currentWeightValue === 0 ? null : currentWeightValue,
          restSec: currentRestValue,
        },
        performed: {
          ...set.performed,
          reps: currentSet.metricType === "reps" ? mainValue : set.performed.reps,
          durationSec:
            currentSet.metricType === "duration" ? mainValue : set.performed.durationSec,
          weightKg: currentWeightValue === 0 ? null : currentWeightValue,
        },
        rest: {
          ...set.rest,
          targetSec: currentRestValue,
        },
      }
    : set,
);
const currentExerciseComparison = buildExerciseComparisonSummary(currentExerciseSets);
const previousExerciseComparison = findLastPreviousExerciseSummary(
  historyBundles,
  currentExercise.exerciseId,
  {
    beforeTimeMs: new Date(session?.startedAt ?? Date.now()).getTime(),
    excludeSessionId: session?.id ?? null,
  },
);
```

```tsx
<View style={styles.exerciseComparisonCard}>
  {previousExerciseComparison && currentExerciseComparison ? (
    <>
      <Text style={styles.exerciseComparisonLast}>
        Last: {previousExerciseComparison.summaryText}
      </Text>
      <View style={styles.exerciseComparisonMetaRow}>
        <Text style={styles.exerciseComparisonMetaText}>
          {currentExerciseComparison.primaryLabel}:{" "}
          {getComparisonIndicator(
            currentExerciseComparison.primaryTotal,
            previousExerciseComparison.primaryTotal,
          )}
        </Text>
        <Text style={styles.exerciseComparisonMetaText}>
          Weight:{" "}
          {getComparisonIndicator(
            currentExerciseComparison.maxWeight,
            previousExerciseComparison.maxWeight,
          )}
        </Text>
      </View>
    </>
  ) : (
    <Text style={styles.exerciseComparisonNew}>New</Text>
  )}
</View>
```

```ts
  exerciseComparisonCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 12,
  },
  exerciseComparisonLast: {
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.text,
    fontWeight: "600",
  },
  exerciseComparisonMetaRow: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  exerciseComparisonMetaText: {
    fontSize: 12,
    color: AppColors.mutedText,
    fontWeight: "700",
  },
  exerciseComparisonNew: {
    fontSize: 13,
    color: AppColors.mutedText,
    fontWeight: "700",
  },
```

### ADDED CODE

```tsx
<Text style={styles.exerciseComparisonNew}>New</Text>
```

### REMOVED CODE

```ts
```

---

## app/history/[sessionId].tsx

### CHANGED CODE

```ts
import {
  buildExerciseComparisonSummary,
  findLastPreviousExerciseSummary,
  getComparisonIndicator,
} from "../../lib/exercise-comparison";
```

```ts
const comparisonSummary = buildExerciseComparisonSummary(sets);
const previousSummary = findLastPreviousExerciseSummary(
  historyBundles,
  sessionExercise.exerciseId,
  {
    beforeTimeMs: new Date(
      bundle.session.endedAt ?? bundle.session.startedAt,
    ).getTime(),
    excludeSessionId: bundle.session.id,
  },
);
```

```tsx
{comparisonSummary ? (
  <View style={styles.progressCard}>
    <Text style={styles.progressLabel}>Progress</Text>
    {previousSummary ? (
      <>
        <Text style={styles.progressValue}>
          Last: {previousSummary.summaryText}
        </Text>
        <View style={styles.progressIndicatorRow}>
          <Text style={styles.progressIndicatorText}>
            {comparisonSummary.primaryLabel}:{" "}
            {getComparisonIndicator(
              comparisonSummary.primaryTotal,
              previousSummary.primaryTotal,
            )}
          </Text>
          <Text style={styles.progressIndicatorText}>
            Weight:{" "}
            {getComparisonIndicator(
              comparisonSummary.maxWeight,
              previousSummary.maxWeight,
            )}
          </Text>
        </View>
      </>
    ) : (
      <Text style={styles.progressValue}>New</Text>
    )}
  </View>
) : null}
```

### ADDED CODE

```tsx
<View style={styles.progressIndicatorRow}>
  <Text style={styles.progressIndicatorText}>Reps: ↑</Text>
  <Text style={styles.progressIndicatorText}>Weight: =</Text>
</View>
```

### REMOVED CODE

```tsx
<Text style={styles.progressValue}>{summary.mainDisplay}</Text>
<Text style={styles.progressMeta}>{formatBestSetText(summary)}</Text>
<View style={styles.progressRow}>...</View>
```
