import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../constants/ui";
import { getSavedSessions } from "../lib/completed-sessions";
import { formatRoutineDisplayName } from "../lib/display-name";
import {
  getRoutineBundles,
  type RoutineBundle,
} from "../lib/routines-storage";
import { hasCompletedWorkoutOnDate } from "../lib/session-overview";
import {
  getAssignedRoutineIdForDate,
  getWeeklySchedule,
} from "../lib/weekly-schedule";

export default function StartWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const [routineBundles, setRoutineBundles] = useState<RoutineBundle[]>([]);
  const [scheduledRoutineId, setScheduledRoutineId] = useState<string | null>(null);
  const [hasTrainedToday, setHasTrainedToday] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadRoutines() {
        const [bundles, schedule, savedSessions] = await Promise.all([
          getRoutineBundles(),
          getWeeklySchedule(),
          getSavedSessions(),
        ]);
        const todaysAssignment = getAssignedRoutineIdForDate(schedule, new Date());

        if (isActive) {
          setRoutineBundles(bundles);
          setScheduledRoutineId(todaysAssignment === "rest" ? null : todaysAssignment);
          setHasTrainedToday(hasCompletedWorkoutOnDate(savedSessions, new Date()));
        }
      }

      void loadRoutines();

      return () => {
        isActive = false;
      };
    }, []),
  );

  function handleSelectRoutine(routineId: string) {
    router.push({
      pathname: "/start-workout-confirm",
      params: { routineId },
    });
  }

  function handleStartFromScratch() {
    router.push({
      pathname: "/start-workout-confirm",
      params: { mode: "scratch" },
    });
  }

  const scheduledBundle =
    scheduledRoutineId != null
      ? routineBundles.find((bundle) => bundle.routine.id === scheduledRoutineId) ?? null
      : null;
  const remainingBundles = routineBundles.filter(
    (bundle) => bundle.routine.id !== scheduledRoutineId,
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.listArea}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Choose routine</Text>

        {hasTrainedToday ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Already trained today</Text>
            <Text style={styles.infoCardText}>
              You can still start another workout if you want.
            </Text>
          </View>
        ) : null}

        {scheduledBundle ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scheduled for today</Text>
            <Pressable
              style={[styles.tile, styles.tileScheduled]}
              onPress={() => handleSelectRoutine(scheduledBundle.routine.id)}
            >
              <Feather name="sun" size={20} color={AppColors.text} />
              <Text style={styles.tileText}>
                {formatRoutineDisplayName(scheduledBundle.routine.name)}
              </Text>
              <Text style={styles.scheduledNote}>Today&apos;s routine</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start another way</Text>
          <View style={styles.grid}>
            <Pressable style={[styles.tile, styles.tileAccent]} onPress={handleStartFromScratch}>
              <Feather name="plus" size={22} color={AppColors.accentText} />
              <Text style={styles.tileAccentText}>Start from scratch</Text>
            </Pressable>

            {remainingBundles.map((bundle) => (
              <Pressable
                key={bundle.routine.id}
                style={styles.tile}
                onPress={() => handleSelectRoutine(bundle.routine.id)}
              >
                <Feather name="layers" size={20} color={AppColors.text} />
                <Text style={styles.tileText}>
                  {formatRoutineDisplayName(bundle.routine.name)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  listArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: AppColors.text,
    marginBottom: 20,
  },
  section: {
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  infoCard: {
    marginBottom: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surfaceMuted,
    gap: 4,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AppColors.text,
  },
  infoCardText: {
    fontSize: 14,
    color: AppColors.mutedText,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    width: "48%",
    minHeight: 112,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 14,
    justifyContent: "space-between",
    backgroundColor: AppColors.surface,
  },
  tileAccent: {
    backgroundColor: AppColors.accent,
    borderColor: AppColors.accent,
  },
  tileScheduled: {
    width: "100%",
    minHeight: 96,
    backgroundColor: AppColors.surfaceMuted,
  },
  tileText: {
    fontSize: 17,
    color: AppColors.text,
    fontWeight: "600",
  },
  tileAccentText: {
    color: AppColors.accentText,
    fontSize: 18,
    fontWeight: "700",
  },
  scheduledNote: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.mutedText,
  },
});
