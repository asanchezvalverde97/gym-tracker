import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { AppColors } from "../constants/ui";
import { getActiveSession } from "../lib/active-session";
import { getSavedSessions, type SavedSessionBundle } from "../lib/completed-sessions";
import { formatRoutineDisplayName } from "../lib/display-name";
import { getHomePhrase } from "../lib/home-phrase";
import { getRoutineBundleById } from "../lib/routines-storage";
import {
  formatSessionDate,
  formatSessionDuration,
  getCompletedExerciseCount,
  getCompletedSetCount,
  getLatestCompletedSessionForRoutine,
} from "../lib/session-overview";
import {
  getAssignedRoutineIdForDate,
  getWeeklySchedule,
} from "../lib/weekly-schedule";

export default function IndexScreen() {
  const [activeSessionExists, setActiveSessionExists] = useState(false);
  const [todaysLabel, setTodaysLabel] = useState("Today: Rest day");
  const [todaysRoutineId, setTodaysRoutineId] = useState<string | null>(null);
  const [latestRoutineSession, setLatestRoutineSession] = useState<SavedSessionBundle | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadState() {
        const [activeSession, schedule, savedSessions] = await Promise.all([
          getActiveSession(),
          getWeeklySchedule(),
          getSavedSessions(),
        ]);
        const todaysAssignment = getAssignedRoutineIdForDate(schedule, new Date());
        const todaysRoutineId = todaysAssignment === "rest" ? null : todaysAssignment;
        const todaysRoutineBundle =
          todaysRoutineId != null ? await getRoutineBundleById(todaysRoutineId) : null;
        const nextTodayLabel =
          todaysRoutineBundle != null
            ? `Today: ${formatRoutineDisplayName(todaysRoutineBundle.routine.name)}`
            : todaysRoutineId != null
              ? "Today: Planned routine unavailable"
              : "Today: Rest day";

        if (isActive) {
          setActiveSessionExists(activeSession != null);
          setTodaysLabel(nextTodayLabel);
          setTodaysRoutineId(todaysRoutineId);
          setLatestRoutineSession(
            todaysRoutineId != null
              ? getLatestCompletedSessionForRoutine(savedSessions, todaysRoutineId)
              : null,
          );
        }
      }

      void loadState();

      return () => {
        isActive = false;
      };
    }, []),
  );

  function handleStartWorkout() {
    router.push("/start-workout");
  }

  function handleOpenProgress() {
    router.push("/progress");
  }

  function handleOpenPlan() {
    router.push("/plan");
  }

  function handleOpenSettings() {
    router.push("/settings" as never);
  }

  function handleResumeWorkout() {
    router.push("/session");
  }

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <View style={styles.hero}>
          <View style={styles.todayCard}>
            <Text style={styles.todayLabel}>Today</Text>
            <Text style={styles.todayValue}>{todaysLabel.replace("Today: ", "")}</Text>
          </View>
          <Text style={styles.title}>Gym Tracker</Text>
          <Text style={styles.phrase}>{getHomePhrase()}</Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={handleStartWorkout}>
          <Text style={styles.primaryButtonText}>Start Workout</Text>
        </Pressable>
        {activeSessionExists ? (
          <Pressable style={styles.secondaryButton} onPress={handleResumeWorkout}>
            <Text style={styles.secondaryButtonText}>Resume active workout</Text>
          </Pressable>
        ) : null}

        {todaysRoutineId && latestRoutineSession ? (
          <Pressable
            style={styles.lastWorkoutCard}
            onPress={() => router.push(`/history/${latestRoutineSession.session.id}`)}
          >
            <Text style={styles.lastWorkoutEyebrow}>Last workout</Text>
            <Text style={styles.lastWorkoutName}>
              {formatSessionDate(
                latestRoutineSession.session.endedAt ?? latestRoutineSession.session.startedAt,
              )}
            </Text>
            <View style={styles.lastWorkoutMeta}>
              {formatSessionDuration(
                latestRoutineSession.session.startedAt,
                latestRoutineSession.session.endedAt,
              ) ? (
                <Text style={styles.lastWorkoutMetaText}>
                  {formatSessionDuration(
                    latestRoutineSession.session.startedAt,
                    latestRoutineSession.session.endedAt,
                  )}
                </Text>
              ) : null}
              <Text style={styles.lastWorkoutMetaText}>
                {getCompletedExerciseCount(latestRoutineSession)} exercises
              </Text>
              <Text style={styles.lastWorkoutMetaText}>
                {getCompletedSetCount(latestRoutineSession)} sets
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.homeNav}>
        <Pressable style={styles.homeNavButton} onPress={handleOpenProgress}>
          <Feather name="bar-chart-2" size={18} color={AppColors.text} />
          <Text style={styles.homeNavLabel}>Progress</Text>
        </Pressable>
        <Pressable style={styles.homeNavButton} onPress={handleOpenPlan}>
          <Feather name="list" size={18} color={AppColors.text} />
          <Text style={styles.homeNavLabel}>Plan</Text>
        </Pressable>
        <Pressable style={styles.homeNavButton} onPress={handleOpenSettings}>
          <Feather name="settings" size={18} color={AppColors.text} />
          <Text style={styles.homeNavLabel}>Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  main: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 24,
    gap: 18,
  },
  hero: {
    gap: 18,
  },
  todayCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 14,
    backgroundColor: AppColors.surfaceMuted,
    gap: 4,
  },
  todayLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  todayValue: {
    fontSize: 22,
    fontWeight: "700",
    color: AppColors.text,
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    color: AppColors.text,
  },
  phrase: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "600",
    color: AppColors.text,
    maxWidth: 280,
  },
  primaryButton: {
    marginHorizontal: -20,
    backgroundColor: AppColors.accent,
    paddingVertical: 34,
    alignItems: "center",
  },
  primaryButtonText: {
    color: AppColors.accentText,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: AppColors.surface,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.text,
  },
  lastWorkoutCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    padding: 16,
    gap: 6,
  },
  lastWorkoutEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  lastWorkoutName: {
    fontSize: 18,
    fontWeight: "700",
    color: AppColors.text,
  },
  lastWorkoutMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  lastWorkoutMetaText: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  homeNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: AppColors.surface,
  },
  homeNavButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  homeNavLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: AppColors.text,
  },
});
