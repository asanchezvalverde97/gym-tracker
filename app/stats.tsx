import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { AppColors } from "../constants/ui";
import {
  getSavedSessions,
  type SavedSessionBundle,
} from "../lib/completed-sessions";
import {
  clearSeededCompletedSessions,
  importPastCompletedSessions,
  seedCompletedSessions,
} from "../lib/dev-seed-completed-sessions";

type PeriodFilter = 7 | 30 | 90 | "all";

const periodOptions: Array<{ label: string; value: PeriodFilter }> = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
  { label: "All", value: "all" },
];

function getReferenceTime(bundle: SavedSessionBundle): number {
  return new Date(bundle.session.endedAt ?? bundle.session.startedAt).getTime();
}

function getSessionsForPeriod(
  sessions: SavedSessionBundle[],
  period: PeriodFilter,
  nowMs: number,
  offsetPeriods = 0,
): SavedSessionBundle[] {
  if (period === "all") {
    return sessions;
  }

  const periodMs = period * 24 * 60 * 60 * 1000;
  const endMs = nowMs - offsetPeriods * periodMs;
  const startMs = endMs - periodMs;

  return sessions.filter((bundle) => {
    const timeMs = getReferenceTime(bundle);

    return timeMs >= startMs && timeMs < endMs;
  });
}

function getCompletedSetsCount(sessions: SavedSessionBundle[]): number {
  return sessions.reduce((total, bundle) => {
    return total + bundle.workoutSets.filter((set) => set.completedAt != null).length;
  }, 0);
}

function formatDeltaLabel(current: number, previous: number): string {
  const delta = current - previous;

  if (delta === 0) {
    return "No change";
  }

  return delta > 0 ? `+${delta}` : String(delta);
}

function getDeltaTone(current: number, previous: number): "positive" | "negative" | "neutral" {
  const delta = current - previous;

  if (delta > 0) {
    return "positive";
  }

  if (delta < 0) {
    return "negative";
  }

  return "neutral";
}

function StatCard({
  label,
  value,
  comparison,
  tone = "neutral",
}: {
  label: string;
  value: string;
  comparison?: string | null;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {comparison ? (
        <Text
          style={[
            styles.statComparison,
            tone === "positive"
              ? styles.statComparisonPositive
              : tone === "negative"
                ? styles.statComparisonNegative
                : styles.statComparisonNeutral,
          ]}
        >
          {comparison}
        </Text>
      ) : null}
    </View>
  );
}

export function StatsScreenContent({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [savedSessions, setSavedSessions] = useState<SavedSessionBundle[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>(30);

  async function loadSessions() {
    const sessions = await getSavedSessions();
    setSavedSessions(sessions);
  }

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void (async () => {
        const sessions = await getSavedSessions();

        if (isActive) {
          setSavedSessions(sessions);
        }
      })();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const nowMs = Date.now();
  const currentSessions = useMemo(
    () => getSessionsForPeriod(savedSessions, selectedPeriod, nowMs),
    [nowMs, savedSessions, selectedPeriod],
  );
  const previousSessions = useMemo(
    () =>
      selectedPeriod === "all"
        ? []
        : getSessionsForPeriod(savedSessions, selectedPeriod, nowMs, 1),
    [nowMs, savedSessions, selectedPeriod],
  );

  const totalSessions = currentSessions.length;
  const completedSets = getCompletedSetsCount(currentSessions);
  const previousTotalSessions = previousSessions.length;
  const previousCompletedSets = getCompletedSetsCount(previousSessions);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        embedded && styles.contentEmbedded,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {!embedded ? <Text style={styles.title}>Stats</Text> : null}
      {!embedded ? (
        <Text style={styles.subtitle}>Clear training totals for the selected period.</Text>
      ) : null}

      <View style={styles.filterRow}>
        {periodOptions.map((option) => {
          const isSelected = selectedPeriod === option.value;

          return (
            <Pressable
              key={option.label}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              onPress={() => setSelectedPeriod(option.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="Total sessions"
          value={String(totalSessions)}
          tone={getDeltaTone(totalSessions, previousTotalSessions)}
          comparison={
            selectedPeriod === "all"
              ? null
              : `${formatDeltaLabel(totalSessions, previousTotalSessions)} vs previous period`
          }
        />
        <StatCard
          label="Completed sets"
          value={String(completedSets)}
          tone={getDeltaTone(completedSets, previousCompletedSets)}
          comparison={
            selectedPeriod === "all"
              ? null
              : `${formatDeltaLabel(completedSets, previousCompletedSets)} vs previous period`
          }
        />
      </View>

      {__DEV__ ? (
        <View style={styles.devSection}>
          <Text style={styles.devTitle}>Development</Text>
          <View style={styles.devActions}>
            <Pressable
              style={styles.devButton}
              onPress={() => {
                void (async () => {
                  await importPastCompletedSessions();
                  await loadSessions();
                })();
              }}
            >
              <Text style={styles.devButtonText}>Import past sessions</Text>
            </Pressable>
            <Pressable
              style={styles.devButton}
              onPress={() => {
                void (async () => {
                  await seedCompletedSessions();
                  await loadSessions();
                })();
              }}
            >
              <Text style={styles.devButtonText}>Seed completed sessions</Text>
            </Pressable>
            <Pressable
              style={[styles.devButton, styles.devButtonSecondary]}
              onPress={() => {
                void (async () => {
                  await clearSeededCompletedSessions();
                  await loadSessions();
                })();
              }}
            >
              <Text style={styles.devButtonSecondaryText}>Clear seeded sessions</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function StatsScreen() {
  return <StatsScreenContent />;
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
  contentEmbedded: {
    paddingTop: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: AppColors.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    color: AppColors.mutedText,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 24,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    backgroundColor: AppColors.surface,
  },
  filterChipSelected: {
    backgroundColor: AppColors.accent,
    borderColor: AppColors.accent,
  },
  filterChipText: {
    fontSize: 14,
    color: AppColors.mutedText,
    fontWeight: "600",
  },
  filterChipTextSelected: {
    color: AppColors.accentText,
  },
  statsGrid: {
    gap: 12,
  },
  devSection: {
    marginTop: 28,
    gap: 12,
  },
  devTitle: {
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: AppColors.mutedText,
    fontWeight: "700",
  },
  devActions: {
    gap: 10,
  },
  devButton: {
    backgroundColor: AppColors.accent,
    paddingVertical: 14,
    alignItems: "center",
    marginHorizontal: -20,
  },
  devButtonSecondary: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  devButtonText: {
    color: AppColors.accentText,
    fontSize: 16,
    fontWeight: "600",
  },
  devButtonSecondaryText: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  statCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 0,
    padding: 18,
    gap: 8,
    backgroundColor: AppColors.surface,
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: AppColors.text,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 38,
    fontWeight: "800",
    color: AppColors.text,
  },
  statComparison: {
    fontSize: 14,
    fontWeight: "600",
  },
  statComparisonPositive: {
    color: AppColors.success,
  },
  statComparisonNegative: {
    color: AppColors.danger,
  },
  statComparisonNeutral: {
    color: AppColors.mutedText,
  },
});
