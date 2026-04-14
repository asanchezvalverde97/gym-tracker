import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { AppColors } from "../../constants/ui";
import {
  getSavedSessionById,
  getSavedSessions,
  type SavedSessionBundle,
} from "../../lib/completed-sessions";
import {
  formatWorkoutDisplayName,
  getExerciseDisplayName,
} from "../../lib/display-name";
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

function formatDuration(
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

function getSetFeelingLabel(feeling: WorkoutSet["feeling"]): string | null {
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

function formatSetMetric(set: WorkoutSet): string {
  if (set.metricType === "duration") {
    return `${set.durationSec ?? 0}s`;
  }

  if (set.weightKg != null && Number.isFinite(set.weightKg)) {
    return `${set.weightKg} kg x ${set.reps ?? 0}`;
  }

  return `${set.reps ?? 0} reps`;
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
      .map((set) => set.durationSec ?? null)
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
    .map((set) => set.reps ?? null)
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
    .map((set) => set.weightKg ?? null)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (weightValues.length > 0) {
    const weightedSets = sets.filter(
      (set) => set.weightKg != null && set.reps != null && Number.isFinite(set.weightKg) && Number.isFinite(set.reps),
    );
    const uniqueWeights = Array.from(new Set(weightValues.map((value) => Math.round(value))));
    const weightDisplay = `${uniqueWeights.join("/")} kg`;

    return {
      kind: "weighted-reps",
      total: reps.reduce((total, value) => total + value, 0),
      bestSet: Math.max(...reps),
      bestSetWeightKg: Math.max(
        ...weightedSets
          .filter((set) => (set.reps ?? 0) === Math.max(...reps))
          .map((set) => set.weightKg ?? 0),
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

function getHistoricalSummaries(
  bundles: SavedSessionBundle[],
  currentBundle: SavedSessionBundle,
  exerciseId: string,
): ExerciseMetricSummary[] {
  return bundles
    .filter((bundle) => bundle.session.id !== currentBundle.session.id)
    .filter((bundle) => {
      const bundleTime = new Date(bundle.session.endedAt ?? bundle.session.startedAt).getTime();
      const currentTime = new Date(
        currentBundle.session.endedAt ?? currentBundle.session.startedAt,
      ).getTime();

      return bundleTime < currentTime;
    })
    .map((bundle) => {
      const sessionExercise = bundle.sessionExercises
        .slice()
        .sort((a, b) => a.order - b.order)
        .find((item) => item.exerciseId === exerciseId);

      if (!sessionExercise) {
        return null;
      }

      return getExerciseSummary(bundle, sessionExercise.id, exerciseId);
    })
    .filter((summary): summary is ExerciseMetricSummary => summary != null);
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
      delta === 0
        ? "same total reps"
        : `${formatSignedDelta(delta)} total reps vs best`;
    const weightText =
      weightDelta === 0
        ? "same weight"
        : `${formatSignedDelta(weightDelta)} kg vs best`;

    return {
      text: `${repsText} · ${weightText}`,
      tone,
    };
  }

  if (summary.kind === "duration") {
    return {
      text:
        delta === 0
          ? "matches best total"
          : `${formatSignedDelta(delta)}s vs best`,
      tone: getComparisonTone(delta),
    };
  }

  return {
    text:
      delta === 0
        ? "matches best total"
        : `${formatSignedDelta(delta)} total reps vs best`,
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

function formatExportSummary(
  bundle: SavedSessionBundle,
  sessionExerciseId: string,
  exerciseId: string,
): string | null {
  const summary = getExerciseSummary(bundle, sessionExerciseId, exerciseId);

  if (!summary) {
    return null;
  }

  return summary.mainDisplay;
}

function formatExportSetLine(set: WorkoutSet): string | null {
  if (set.completedAt == null || set.skippedAt != null) {
    return null;
  }

  if (set.metricType === "duration") {
    return `Set ${set.setNumber}: ${set.durationSec ?? 0}s`;
  }

  if (set.weightKg != null && Number.isFinite(set.weightKg)) {
    return `Set ${set.setNumber}: ${set.weightKg} kg x ${set.reps ?? 0}`;
  }

  return `Set ${set.setNumber}: ${set.reps ?? 0} reps`;
}

function buildSessionExportText(bundle: SavedSessionBundle): string {
  const duration = formatDuration(bundle.session.startedAt, bundle.session.endedAt);
  const feelingLabel = getFeelingLabel(bundle.session.feeling);
  const lines: string[] = [
    bundle.session.name,
    `Date: ${formatSessionDate(bundle.session.endedAt ?? bundle.session.startedAt)}`,
  ];

  if (duration) {
    lines.push(`Duration: ${duration}`);
  }

  if (feelingLabel) {
    lines.push(`Feeling: ${feelingLabel}`);
  }

  if (bundle.session.notes?.trim()) {
    lines.push(`Notes: ${bundle.session.notes.trim()}`);
  }

  for (const sessionExercise of bundle.sessionExercises
    .slice()
    .sort((a, b) => a.order - b.order)) {
    const summary = formatExportSummary(
      bundle,
      sessionExercise.id,
      sessionExercise.exerciseId,
    );
    const setLines = bundle.workoutSets
      .filter((set) => set.sessionExerciseId === sessionExercise.id)
      .sort((a, b) => a.setNumber - b.setNumber)
      .map(formatExportSetLine)
      .filter((line): line is string => line != null);

    lines.push("");
    lines.push(getExerciseDisplayName(sessionExercise.exerciseId));

    if (summary) {
      lines.push(summary);
    }

    lines.push(...setLines);
  }

  return lines.join("\n");
}

export default function HistoryDetailScreen() {
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const [bundle, setBundle] = useState<SavedSessionBundle | null>(null);
  const [historyBundles, setHistoryBundles] = useState<SavedSessionBundle[]>([]);
  const [copyMessage, setCopyMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadBundle() {
        if (!sessionId) {
          if (isActive) {
            setBundle(null);
            setHistoryBundles([]);
          }
          return;
        }

        const [savedBundle, savedBundles] = await Promise.all([
          getSavedSessionById(sessionId),
          getSavedSessions(),
        ]);

        if (isActive) {
          setBundle(savedBundle);
          setHistoryBundles(savedBundles);
        }
      }

      void loadBundle();

      return () => {
        isActive = false;
      };
    }, [sessionId]),
  );

  if (!bundle) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Session not found.</Text>
      </View>
    );
  }

  const duration = formatDuration(
    bundle.session.startedAt,
    bundle.session.endedAt,
  );
  const feelingLabel = getFeelingLabel(bundle.session.feeling);

  async function handleCopySession() {
    if (!bundle) {
      return;
    }

    await Clipboard.setStringAsync(buildSessionExportText(bundle));
    setCopyMessage("Copied to clipboard");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{formatWorkoutDisplayName(bundle.session.name)}</Text>
      <Text style={styles.sessionDate}>
        {formatSessionDate(bundle.session.endedAt ?? bundle.session.startedAt)}
      </Text>
      <View style={styles.sessionMetaRow}>
        {duration ? <Text style={styles.metaText}>{duration}</Text> : null}
        {feelingLabel ? <Text style={styles.metaText}>{feelingLabel}</Text> : null}
      </View>
      {bundle.session.notes ? <Text style={styles.notesText}>{bundle.session.notes}</Text> : null}
      <Pressable style={styles.copyButton} onPress={handleCopySession}>
        <Text style={styles.copyButtonText}>Copy session</Text>
      </Pressable>
      {copyMessage ? <Text style={styles.copyMessage}>{copyMessage}</Text> : null}

      <View style={styles.exerciseList}>
        {bundle.sessionExercises
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((sessionExercise) => {
            const sets = bundle.workoutSets
              .filter((set) => set.sessionExerciseId === sessionExercise.id)
              .sort((a, b) => a.setNumber - b.setNumber);
            const summary = getExerciseSummary(
              bundle,
              sessionExercise.id,
              sessionExercise.exerciseId,
            );
            const historicalSummaries = getHistoricalSummaries(
              historyBundles,
              bundle,
              sessionExercise.exerciseId,
            ).filter((item) => item.kind === summary?.kind);
            const lastSummary = historicalSummaries[0] ?? null;
            const averageSummary = getAverageSummary(historicalSummaries.slice(0, 5));
            const bestSummary = getBestSummary(historicalSummaries);
            const vsLast = summary ? getVsLastText(summary, lastSummary) : null;
            const vsAverage = summary ? getVsAverageText(summary, averageSummary) : null;
            const vsBest = summary ? getVsBestText(summary, bestSummary) : null;

            return (
              <Pressable
                key={sessionExercise.id}
                style={styles.exerciseCard}
                onPress={() => router.push(`/exercise/${sessionExercise.exerciseId}`)}
              >
                <Text style={styles.exerciseName}>
                  {getExerciseDisplayName(sessionExercise.exerciseId)}
                </Text>

                {summary ? (
                  <View style={styles.progressCard}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressValue}>{summary.mainDisplay}</Text>
                    <Text style={styles.progressMeta}>{formatBestSetText(summary)}</Text>

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

                <View style={styles.setList}>
                  {sets.map((set) => {
                    const setFeelingLabel = getSetFeelingLabel(set.feeling);
                    const isSkipped = set.skippedAt != null;

                    return (
                      <View
                        key={set.id}
                        style={[styles.setRow, isSkipped ? styles.setRowSkipped : styles.setRowCompleted]}
                      >
                        <View style={styles.setRowMain}>
                          <Text style={styles.setNumber}>Set {set.setNumber}</Text>
                          <Text style={styles.setText}>{formatSetMetric(set)}</Text>
                          {setFeelingLabel ? (
                            <Text style={styles.setMeta}>{setFeelingLabel}</Text>
                          ) : null}
                        </View>
                        <View style={[styles.badge, isSkipped ? styles.badgeSkipped : styles.badgeCompleted]}>
                          <Text
                            style={[
                              styles.badgeText,
                              isSkipped ? styles.badgeTextSkipped : styles.badgeTextCompleted,
                            ]}
                          >
                            {isSkipped ? "Skipped" : "Completed"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
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
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: AppColors.background,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: AppColors.text,
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  sessionMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  metaText: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    color: AppColors.text,
    marginTop: 14,
  },
  copyButton: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    backgroundColor: AppColors.surface,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: AppColors.text,
  },
  copyMessage: {
    marginTop: 8,
    fontSize: 13,
    color: AppColors.mutedText,
  },
  exerciseList: {
    gap: 14,
    marginTop: 28,
  },
  exerciseCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    backgroundColor: AppColors.surface,
  },
  exerciseName: {
    fontSize: 19,
    fontWeight: "700",
    color: AppColors.text,
  },
  progressCard: {
    borderRadius: 16,
    backgroundColor: AppColors.surfaceMuted,
    padding: 14,
    gap: 8,
  },
  progressLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: AppColors.mutedText,
    fontWeight: "700",
  },
  progressValue: {
    fontSize: 28,
    fontWeight: "800",
    color: AppColors.text,
  },
  progressMeta: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  progressRow: {
    gap: 4,
  },
  progressRowLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: AppColors.mutedText,
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
    color: AppColors.mutedText,
  },
  setList: {
    gap: 8,
  },
  setRow: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  setRowCompleted: {
    backgroundColor: AppColors.surfaceMuted,
  },
  setRowSkipped: {
    backgroundColor: AppColors.dangerSoft,
  },
  setRowMain: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  setNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.text,
  },
  setText: {
    fontSize: 14,
    color: AppColors.text,
  },
  setMeta: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeCompleted: {
    backgroundColor: AppColors.accentSoft,
  },
  badgeSkipped: {
    backgroundColor: AppColors.dangerSoft,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTextCompleted: {
    color: AppColors.success,
  },
  badgeTextSkipped: {
    color: AppColors.danger,
  },
  emptyText: {
    fontSize: 16,
    color: AppColors.mutedText,
  },
});
