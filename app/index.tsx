import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { AppColors } from "../constants/ui";
import { getActiveSession } from "../lib/active-session";
import { getHomePhrase } from "../lib/home-phrase";

export default function IndexScreen() {
  const [activeSessionExists, setActiveSessionExists] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadState() {
        const activeSession = await getActiveSession();

        if (isActive) {
          setActiveSessionExists(activeSession != null);
        }
      }

      void loadState();

      return () => {
        isActive = false;
      };
    }, []),
  );

  function handleStartWorkout() {
    router.push(activeSessionExists ? "/session" : "/start-workout");
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

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <View style={styles.hero}>
          <Text style={styles.title}>Gym Tracker</Text>
          <Text style={styles.phrase}>{getHomePhrase()}</Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={handleStartWorkout}>
          <Text style={styles.primaryButtonText}>Start Workout</Text>
        </Pressable>
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
    justifyContent: "space-between",
  },
  hero: {
    gap: 22,
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
