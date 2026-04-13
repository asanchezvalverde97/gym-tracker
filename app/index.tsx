import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { routines } from "../data/routines";
import { getActiveSession } from "../lib/active-session";
import {
  getSavedSessions,
  type SavedSessionBundle,
} from "../lib/completed-sessions";

function formatRoutineName(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

export default function IndexScreen() {
  const [activeSessionExists, setActiveSessionExists] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SavedSessionBundle[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadRecentSessions() {
        const [savedSessions, activeSession] = await Promise.all([
          getSavedSessions(),
          getActiveSession(),
        ]);

        if (isActive) {
          setRecentSessions(savedSessions);
          setActiveSessionExists(activeSession != null);
        }
      }

      void loadRecentSessions();

      return () => {
        isActive = false;
      };
    }, []),
  );

  function handleStartWorkout(routineId?: string) {
    const defaultRoutineId = routineId ?? routines[0]?.id;

    router.push({
      pathname: "/session",
      params: defaultRoutineId ? { routineId: defaultRoutineId } : undefined,
    });
  }

  function handleContinueWorkout() {
    router.push("/session");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Gym Tracker</Text>
        <Text style={styles.subtitle}>Simple workouts, clean history.</Text>
      </View>

      {activeSessionExists ? (
        <Pressable style={styles.secondaryButton} onPress={handleContinueWorkout}>
          <Text style={styles.secondaryButtonText}>Continue workout</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={handleStartWorkout}>
        <Text style={styles.primaryButtonText}>Start workout</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Routines</Text>
        <View style={styles.list}>
          {routines.map((routine) => (
            <Pressable
              key={routine.id}
              style={styles.routineButton}
              onPress={() => handleStartWorkout(routine.id)}
            >
              <Text style={styles.listRow}>{formatRoutineName(routine.name)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent sessions</Text>
        <View style={styles.list}>
          {recentSessions.length === 0 ? (
            <Text style={styles.emptyText}>No completed sessions yet.</Text>
          ) : (
            recentSessions.map((bundle) => (
              <View key={bundle.session.id} style={styles.sessionRow}>
                <Text style={styles.sessionName}>{bundle.session.name}</Text>
                <Text style={styles.sessionDate}>
                  {formatSessionDate(bundle.session.endedAt ?? bundle.session.startedAt)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#111",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    color: "#666",
  },
  primaryButton: {
    backgroundColor: "#111",
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 32,
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#111",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: "#111",
    fontSize: 18,
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#444",
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  listRow: {
    fontSize: 18,
    color: "#111",
  },
  routineButton: {
    alignSelf: "flex-start",
  },
  sessionRow: {
    gap: 2,
  },
  sessionName: {
    fontSize: 18,
    color: "#111",
  },
  sessionDate: {
    fontSize: 14,
    color: "#666",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
});
