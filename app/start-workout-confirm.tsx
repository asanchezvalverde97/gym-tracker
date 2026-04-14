import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WorkoutBuilder } from "../components/workout-builder";
import { AppColors } from "../constants/ui";
import { formatRoutineDisplayName } from "../lib/display-name";
import {
  cloneRoutineBundle,
  createEmptyRoutineBundle,
} from "../lib/routine-bundle";
import {
  getRoutineBundleById,
  type RoutineBundle,
} from "../lib/routines-storage";
import {
  clearStartWorkoutDraft,
  saveStartWorkoutDraft,
} from "../lib/start-workout-draft";

export default function StartWorkoutConfirmScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    routineId?: string | string[];
    mode?: string | string[];
  }>();
  const routineId = Array.isArray(params.routineId) ? params.routineId[0] : params.routineId;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const isScratchMode = mode === "scratch";
  const [bundle, setBundle] = useState<RoutineBundle | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadBundle() {
        if (isScratchMode) {
          if (isActive) {
            setBundle(createEmptyRoutineBundle("Scratch workout"));
          }
          return;
        }

        if (!routineId) {
          if (isActive) {
            setBundle(null);
          }
          return;
        }

        const nextBundle = await getRoutineBundleById(routineId);

        if (isActive) {
          setBundle(nextBundle ? cloneRoutineBundle(nextBundle) : null);
        }
      }

      void loadBundle();

      return () => {
        isActive = false;
      };
    }, [isScratchMode, routineId]),
  );

  async function handleStartWorkout() {
    if (!bundle) {
      return;
    }

    const draftId = `draft_${Date.now()}`;

    await clearStartWorkoutDraft();
    await saveStartWorkoutDraft({
      ...bundle,
      id: draftId,
    });

    router.push({
      pathname: "/session",
      params: { draftId },
    });
  }

  return (
    <View style={styles.container}>
      {bundle ? (
        <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
          <WorkoutBuilder
            bundle={bundle}
            title={
              isScratchMode
                ? "Build workout"
                : formatRoutineDisplayName(bundle.routine.name)
            }
            kicker={isScratchMode ? "Workout" : "Routine"}
            nameLabel="Workout name"
            allowRename={isScratchMode}
            primaryActionLabel="Start Workout"
            onPrimaryAction={handleStartWorkout}
            onBundleChange={setBundle}
            primaryDisabled={bundle.routineExercises.length === 0}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
});
