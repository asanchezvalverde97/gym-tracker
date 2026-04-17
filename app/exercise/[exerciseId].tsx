import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { AppColors } from "../../constants/ui";
import { exercises } from "../../data/exercises";
import { getSavedSessions, type SavedSessionBundle } from "../../lib/completed-sessions";
import { getExerciseDisplayName } from "../../lib/display-name";
import type { WorkoutSet } from "../../types/workout";

const defaultBodyweightKg = 72;
const bodyweightExerciseIds = new Set([
  "ex_dominadas",
  "ex_chin_ups",
  "ex_fondos",
  "ex_flexiones",
  "ex_flexiones_cerradas",
  "ex_dead_hang",
  "ex_plancha",
  "ex_leg_raises",
]);

type ExerciseMetricSummary = {
  kind: "weighted-reps" | "bodyweight-reps" | "duration";
  total: number;
  bestSet: number;
  bestSetWeightKg: number | null;
  mainDisplay: string;
  referenceWeightKg: number | null;
};

type ComparisonDisplay = {
  text: string;
  tone: "positive" | "negative" | "neutral";
};

type ExerciseHistoryItem = {
  bundle: SavedSessionBundle;
  sessionExerciseId: string;
  summary: ExerciseMetricSummary;
};

function formatSessionDate(value: string | null | undefined): string {
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

function getFeelingLabel(feeling: SavedSessionBundle["session"]["feeling"]): string | null {
  switch (feeling) {
    case 1:
      return "Bad";
    case 2:
      return "Normal";
    case 3:
      return "Good";
    case 4:
      return "Very good";
    default:
      return null;
  }
}

function getComparisonTone(delta: number): "positive" | "negative" | "neutral" {
  if (delta > 0) {
    return "positive";
  }

  if (delta < 0) {
    return "negative";
  }

  return "neutral";
}

function formatSignedDelta(value: number): string {
  const roundedValue = Math.round(value);

  if (roundedValue > 0) {
    return `+${roundedValue}`;
  }

  return String(roundedValue);
}

function getValidSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((set) => set.completedAt != null && set.skippedAt == null);
}

function getExerciseSummary(
  bundle: SavedSessionBundle,
  sessionExerciseId: string,
  exerciseId: string,
): ExerciseMetricSummary | null {
  const sets = getValidSets(
    bundle.workoutSets
      .filter((set) => set.sessionExerciseId === sessionExerciseId)
      .sort((a, b) => a.setNumber - b.setNumber),
  );

  if (sets.length === 0) {
    return null;
  }

  if (sets[0].metricType === "duration") {
    const durations = sets
      .map((set) => set.performed.durationSec ?? null)
      .filter((value): value is number => value != null && Number.isFinite(value));

    if (durations.length === 0) {
      return null;
    }

    return {
      kind: "duration",
      total: durations.reduce((total, value) => total + value, 0),
      bestSet: Math.max(...durations),
      bestSetWeightKg: null,
      mainDisplay: durations.map((value) => `${value}s`).join(" / "),
      referenceWeightKg: null,
    };
  }

  const reps = sets
    .map((set) => set.performed.reps ?? null)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (reps.length === 0) {
    return null;
  }

  const isBodyweightExercise = bodyweightExerciseIds.has(exerciseId);

  if (isBodyweightExercise) {
    return {
      kind: "bodyweight-reps",
      total: reps.reduce((total, value) => total + value, 0),
      bestSet: Math.max(...reps),
      bestSetWeightKg: null,
      mainDisplay: `${reps.join("/")} reps`,
      referenceWeightKg: bundle.session.bodyweightKg ?? defaultBodyweightKg,
    };
  }

  const weightValues = sets
    .map((set) => set.performed.weightKg ?? null)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (weightValues.length > 0) {
    const weightedSets = sets.filter(
      (set) =>
        set.performed.weightKg != null &&
        set.performed.reps != null &&
        Number.isFinite(set.performed.weightKg) &&
        Number.isFinite(set.performed.reps),
    );
    const bestRepCount = Math.max(...reps);
    const uniqueWeights = Array.from(new Set(weightValues.map((value) => Math.round(value))));
    const weightDisplay = `${uniqueWeights.join("/")} kg`;

    return {
      kind: "weighted-reps",
      total: reps.reduce((total, value) => total + value, 0),
      bestSet: bestRepCount,
      bestSetWeightKg: Math.max(
        ...weightedSets
          .filter((set) => (set.performed.reps ?? 0) === bestRepCount)
          .map((set) => set.performed.weightKg ?? 0),
      ),
      mainDisplay: `${weightDisplay} · ${reps.join("/")}`,
      referenceWeightKg: weightValues.reduce((total, value) => total + value, 0) / weightValues.length,
    };
  }

  return {
    kind: "bodyweight-reps",
    total: reps.reduce((total, value) => total + value, 0),
    bestSet: Math.max(...reps),
    bestSetWeightKg: null,
    mainDisplay: `${reps.join("/")} reps`,
    referenceWeightKg: null,
  };
}

function getAverageSummary(summaries: ExerciseMetricSummary[]): ExerciseMetricSummary | null {
  if (summaries.length === 0) {
    return null;
  }

  return {
    kind: summaries[0].kind,
    total: summaries.reduce((total, item) => total + item.total, 0) / summaries.length,
    bestSet: summaries.reduce((total, item) => total + item.bestSet, 0) / summaries.length,
    bestSetWeightKg:
      summaries.every((item) => item.bestSetWeightKg != null)
        ? summaries.reduce((total, item) => total + (item.bestSetWeightKg ?? 0), 0) /
          summaries.length
        : null,
    mainDisplay: "",
    referenceWeightKg:
      summaries.every((item) => item.referenceWeightKg != null)
        ? summaries.reduce((total, item) => total + (item.referenceWeightKg ?? 0), 0) /
          summaries.length
        : null,
  };
}

function getBestSummary(summaries: ExerciseMetricSummary[]): ExerciseMetricSummary | null {
  if (summaries.length === 0) {
    return null;
  }

  return summaries.reduce((best, item) => (item.total > best.total ? item : best));
}

function getVsLastText(
  summary: ExerciseMetricSummary,
  lastSummary: ExerciseMetricSummary | null,
): ComparisonDisplay | null {
  if (!lastSummary) {
    return null;
  }

  const repsOrDurationDelta = summary.total - lastSummary.total;

  if (summary.kind === "weighted-reps") {
    const weightDelta =
      summary.referenceWeightKg != null && lastSummary.referenceWeightKg != null
        ? summary.referenceWeightKg - lastSummary.referenceWeightKg
        : 0;
    const tone = getComparisonTone(repsOrDurationDelta !== 0 ? repsOrDurationDelta : weightDelta);
    const repsText =
      repsOrDurationDelta === 0
        ? "same total reps as last"
        : `${formatSignedDelta(repsOrDurationDelta)} total reps vs last`;
    const weightText =
      weightDelta === 0
        ? "same weight as last time"
        : `${formatSignedDelta(weightDelta)} kg vs last`;

    return {
      text: `${repsText} · ${weightText}`,
      tone,
    };
  }

  if (summary.kind === "duration") {
    return {
      text:
        repsOrDurationDelta === 0
          ? "same total time as last"
          : `${formatSignedDelta(repsOrDurationDelta)}s total vs last`,
      tone: getComparisonTone(repsOrDurationDelta),
    };
  }

  return {
    text:
      repsOrDurationDelta === 0
        ? "same total reps as last"
        : `${formatSignedDelta(repsOrDurationDelta)} total reps vs last`,
    tone: getComparisonTone(repsOrDurationDelta),
  };
}

function getVsAverageText(
  summary: ExerciseMetricSummary,
  averageSummary: ExerciseMetricSummary | null,
): ComparisonDisplay | null {
  if (!averageSummary) {
    return null;
  }

  if (summary.kind === "weighted-reps") {
    const repsDelta = summary.total - averageSummary.total;
    const weightDelta =
      summary.referenceWeightKg != null && averageSummary.referenceWeightKg != null
        ? summary.referenceWeightKg - averageSummary.referenceWeightKg
        : 0;
    const tone = getComparisonTone(repsDelta !== 0 ? repsDelta : weightDelta);
    const repsText =
      repsDelta === 0
        ? "same total reps"
        : `${formatSignedDelta(repsDelta)} total reps vs avg`;
    const weightText =
      weightDelta === 0
        ? "same weight as avg"
        : `${formatSignedDelta(weightDelta)} kg vs avg`;

    return {
      text: `${repsText} · ${weightText}`,
      tone,
    };
  }

  const delta = summary.total - averageSummary.total;

  if (summary.kind === "duration") {
    return {
      text:
        delta === 0
          ? "same total time as avg"
          : `${formatSignedDelta(delta)}s total vs avg`,
      tone: getComparisonTone(delta),
    };
  }

  return {
    text:
      delta === 0
        ? "same total reps as avg"
        : `${formatSignedDelta(delta)} total reps vs avg`,
    tone: getComparisonTone(delta),
  };
}

function getVsBestText(
  summary: ExerciseMetricSummary,
  bestSummary: ExerciseMetricSummary | null,
): ComparisonDisplay | null {
  if (!bestSummary) {
    return null;
  }

  const delta = summary.total - bestSummary.total;

  if (summary.kind === "weighted-reps") {
    const weightDelta =
      summary.referenceWeightKg != null && bestSummary.referenceWeightKg != null
        ? summary.referenceWeightKg - bestSummary.referenceWeightKg
        : 0;
    const tone = getComparisonTone(delta !== 0 ? delta : weightDelta);
    const repsText =
      delta === 0 ? "same total reps" : `${formatSignedDelta(delta)} total reps vs best`;
    const weightText =
      weightDelta === 0 ? "same weight" : `${formatSignedDelta(weightDelta)} kg vs best`;

    return {
      text: `${repsText} · ${weightText}`,
      tone,
    };
  }

  if (summary.kind === "duration") {
    return {
      text: delta === 0 ? "matches best total" : `${formatSignedDelta(delta)}s vs best`,
      tone: getComparisonTone(delta),
    };
  }

  return {
    text: delta === 0 ? "matches best total" : `${formatSignedDelta(delta)} total reps vs best`,
    tone: getComparisonTone(delta),
  };
}

function formatBestSetText(summary: ExerciseMetricSummary): string {
  if (summary.kind === "weighted-reps" && summary.bestSetWeightKg != null) {
    return `Best set: ${Math.round(summary.bestSetWeightKg)} kg x ${Math.round(summary.bestSet)}`;
  }

  if (summary.kind === "duration") {
    return `Best set: ${Math.round(summary.bestSet)}s`;
  }

  return `Best set: ${Math.round(summary.bestSet)} reps`;
}

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();
  const exerciseId = Array.isArray(params.exerciseId) ? params.exerciseId[0] : params.exerciseId;
  const [bundles, setBundles] = useState<SavedSessionBundle[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadBundles() {
        const savedBundles = await getSavedSessions();

        if (isActive) {
          setBundles(savedBundles);
        }
      }

      void loadBundles();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const historyItems = useMemo(() => {
    if (!exerciseId) {
      return [];
    }

    return bundles
      .map((bundle) => {
        const sessionExercise = bundle.sessionExercises
          .slice()
          .sort((a, b) => a.order - b.order)
          .find((item) => item.exerciseId === exerciseId);

        if (!sessionExercise) {
          return null;
        }

        const summary = getExerciseSummary(bundle, sessionExercise.id, exerciseId);

        if (!summary) {
          return null;
        }

        return {
          bundle,
          sessionExerciseId: sessionExercise.id,
          summary,
        } satisfies ExerciseHistoryItem;
      })
      .filter((item): item is ExerciseHistoryItem => item != null)
      .sort((a, b) => {
        const aTime = new Date(a.bundle.session.endedAt ?? a.bundle.session.startedAt).getTime();
        const bTime = new Date(b.bundle.session.endedAt ?? b.bundle.session.startedAt).getTime();

        return bTime - aTime;
      });
  }, [bundles, exerciseId]);

  if (!exerciseId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Exercise not found.</Text>
      </View>
    );
  }

  const latestItem = historyItems[0] ?? null;
  const historicalSummaries = latestItem ? historyItems.slice(1).map((item) => item.summary) : [];
  const lastSummary = historicalSummaries[0] ?? null;
  const averageSummary = getAverageSummary(historicalSummaries.slice(0, 5));
  const bestSummary = getBestSummary(historicalSummaries);
  const vsLast = latestItem ? getVsLastText(latestItem.summary, lastSummary) : null;
  const vsAverage = latestItem ? getVsAverageText(latestItem.summary, averageSummary) : null;
  const vsBest = latestItem ? getVsBestText(latestItem.summary, bestSummary) : null;
  const maxTotal = historyItems.reduce((highest, item) => Math.max(highest, item.summary.total), 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{getExerciseDisplayName(exerciseId)}</Text>

      {latestItem ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Latest</Text>
          <Text style={styles.progressValue}>{latestItem.summary.mainDisplay}</Text>
          <Text style={styles.progressMeta}>{formatBestSetText(latestItem.summary)}</Text>

          {vsLast ? (
            <View style={styles.progressRow}>
              <Text style={styles.progressRowLabel}>vs last</Text>
              <Text
                style={[
                  styles.progressRowValue,
                  vsLast.tone === "positive"
                    ? styles.progressPositive
                    : vsLast.tone === "negative"
                      ? styles.progressNegative
                      : styles.progressNeutral,
                ]}
              >
                {vsLast.text}
              </Text>
            </View>
          ) : null}

          {vsAverage ? (
            <View style={styles.progressRow}>
              <Text style={styles.progressRowLabel}>vs avg</Text>
              <Text
                style={[
                  styles.progressRowValue,
                  vsAverage.tone === "positive"
                    ? styles.progressPositive
                    : vsAverage.tone === "negative"
                      ? styles.progressNegative
                      : styles.progressNeutral,
                ]}
              >
                {vsAverage.text}
              </Text>
            </View>
          ) : null}

          {vsBest ? (
            <View style={styles.progressRow}>
              <Text style={styles.progressRowLabel}>best</Text>
              <Text
                style={[
                  styles.progressRowValue,
                  vsBest.tone === "positive"
                    ? styles.progressPositive
                    : vsBest.tone === "negative"
                      ? styles.progressNegative
                      : styles.progressNeutral,
                ]}
              >
                {vsBest.text}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {historyItems.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.sectionLabel}>History</Text>
          <View style={styles.chartBars}>
            {historyItems
              .slice()
              .reverse()
              .map((item) => {
                const barHeight = maxTotal > 0 ? Math.max(18, (item.summary.total / maxTotal) * 120) : 18;

                return (
                  <View key={item.bundle.session.id} style={styles.chartBarColumn}>
                    <View style={[styles.chartBar, { height: barHeight }]} />
                    <Text style={styles.chartBarLabel}>
                      {formatSessionDate(item.bundle.session.endedAt ?? item.bundle.session.startedAt)}
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>
      ) : null}

      <View style={styles.sessionList}>
        {historyItems.map((item) => {
          const feelingLabel = getFeelingLabel(item.bundle.session.feeling);
          const notesPreview = item.bundle.session.notes?.trim();

          return (
            <View key={item.bundle.session.id} style={styles.sessionCard}>
              <Text style={styles.sessionDate}>
                {formatSessionDate(item.bundle.session.endedAt ?? item.bundle.session.startedAt)}
              </Text>
              <Text style={styles.sessionValue}>{item.summary.mainDisplay}</Text>
              <View style={styles.sessionMetaRow}>
                {feelingLabel ? <Text style={styles.metaText}>{feelingLabel}</Text> : null}
                {notesPreview ? (
                  <Text style={styles.metaText} numberOfLines={1}>
                    {notesPreview}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 18,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: AppColors.background,
  },
  emptyText: {
    fontSize: 16,
    color: AppColors.mutedText,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: AppColors.text,
  },
  progressCard: {
    borderRadius: 18,
    backgroundColor: "#f8f8f8",
    padding: 16,
    gap: 8,
  },
  progressLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#7a7a7a",
    fontWeight: "700",
  },
  progressValue: {
    fontSize: 28,
    fontWeight: "800",
    color: AppColors.text,
  },
  progressMeta: {
    fontSize: 13,
    color: "#6f6f6f",
  },
  progressRow: {
    gap: 4,
  },
  progressRowLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#777",
    fontWeight: "700",
  },
  progressRowValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  progressPositive: {
    color: AppColors.success,
  },
  progressNegative: {
    color: AppColors.danger,
  },
  progressNeutral: {
    color: "#6f6f6f",
  },
  chartCard: {
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 18,
    padding: 16,
    gap: 14,
    backgroundColor: AppColors.surface,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#7a7a7a",
    fontWeight: "700",
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  chartBarColumn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  chartBar: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: AppColors.accent,
    opacity: 0.82,
    minHeight: 18,
  },
  chartBarLabel: {
    fontSize: 11,
    color: "#8a8a8a",
    textAlign: "center",
  },
  sessionList: {
    gap: 12,
  },
  sessionCard: {
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 18,
    padding: 16,
    gap: 8,
    backgroundColor: AppColors.surface,
  },
  sessionDate: {
    fontSize: 13,
    color: "#7a7a7a",
  },
  sessionValue: {
    fontSize: 22,
    fontWeight: "700",
    color: AppColors.text,
  },
  sessionMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaText: {
    fontSize: 13,
    color: "#8a8a8a",
  },
});
