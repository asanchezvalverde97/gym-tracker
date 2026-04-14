import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../constants/ui";
import { formatRoutineDisplayName } from "../lib/display-name";
import {
  getRoutineBundles,
  type RoutineBundle,
} from "../lib/routines-storage";

export default function StartWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const [routineBundles, setRoutineBundles] = useState<RoutineBundle[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadRoutines() {
        const bundles = await getRoutineBundles();

        if (isActive) {
          setRoutineBundles(bundles);
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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.listArea}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Choose routine</Text>

        <View style={styles.grid}>
          <Pressable style={[styles.tile, styles.tileAccent]} onPress={handleStartFromScratch}>
            <Feather name="plus" size={22} color={AppColors.accentText} />
            <Text style={styles.tileAccentText}>Start from scratch</Text>
          </Pressable>

          {routineBundles.map((bundle) => (
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
});
