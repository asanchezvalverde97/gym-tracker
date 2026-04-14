import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { WorkoutBuilder } from "../components/workout-builder";
import { AppColors } from "../constants/ui";
import { formatRoutineDisplayName } from "../lib/display-name";
import {
  cloneRoutineBundle,
  createEmptyRoutineBundle,
} from "../lib/routine-bundle";
import {
  deleteRoutineById,
  getRoutineBundles,
  saveRoutineBundle,
  type RoutineBundle,
} from "../lib/routines-storage";

export function RoutinesScreenContent({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [routineBundles, setRoutineBundles] = useState<RoutineBundle[]>([]);
  const [editingBundle, setEditingBundle] = useState<RoutineBundle | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadRoutineBundles = useCallback(async () => {
    const bundles = await getRoutineBundles();
    setRoutineBundles(bundles);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRoutineBundles();
    }, [loadRoutineBundles]),
  );

  function handleCreateRoutine() {
    setEditingBundle(createEmptyRoutineBundle());
  }

  function handleEditRoutine(bundle: RoutineBundle) {
    setEditingBundle(cloneRoutineBundle(bundle));
  }

  async function handleDeleteRoutine(routineId: string) {
    await deleteRoutineById(routineId);
    await loadRoutineBundles();

    if (editingBundle?.routine.id === routineId) {
      setEditingBundle(null);
    }
  }

  async function handleSaveRoutine() {
    if (!editingBundle) {
      return;
    }

    setIsSaving(true);
    await saveRoutineBundle({
      ...editingBundle,
      routine: {
        ...editingBundle.routine,
        name: editingBundle.routine.name.trim() || "untitled_routine",
      },
    });
    await loadRoutineBundles();
    setEditingBundle(null);
    setIsSaving(false);
  }

  if (editingBundle) {
    return (
      <WorkoutBuilder
        bundle={editingBundle}
        title={
          editingBundle.routine.name.trim()
            ? formatRoutineDisplayName(editingBundle.routine.name)
            : "Routine editor"
        }
        kicker="Routine"
        nameLabel="Routine name"
        allowRename
        primaryActionLabel={isSaving ? "Saving..." : "Save routine"}
        onPrimaryAction={handleSaveRoutine}
        onBundleChange={setEditingBundle}
        secondaryActionLabel="Cancel"
        onSecondaryAction={() => setEditingBundle(null)}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        embedded && styles.contentEmbedded,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {!embedded ? <Text style={styles.title}>Routines</Text> : null}

      <Pressable style={styles.primaryButton} onPress={handleCreateRoutine}>
        <Text style={styles.primaryButtonText}>Create routine</Text>
      </Pressable>

      <View style={styles.section}>
        {routineBundles.length === 0 ? (
          <Text style={styles.helperText}>No routines saved yet.</Text>
        ) : (
          routineBundles.map((bundle) => (
            <View key={bundle.routine.id} style={styles.routineCard}>
              <Pressable onPress={() => handleEditRoutine(bundle)}>
                <Text style={styles.routineName}>
                  {formatRoutineDisplayName(bundle.routine.name)}
                </Text>
                <Text style={styles.routineMeta}>
                  {bundle.routineExercises.length} exercises
                </Text>
              </Pressable>

              <View style={styles.routineCardActions}>
                <Pressable
                  style={styles.smallButton}
                  onPress={() => handleEditRoutine(bundle)}
                >
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={styles.smallButton}
                  onPress={() => handleDeleteRoutine(bundle.routine.id)}
                >
                  <Text style={styles.smallButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

export default function RoutinesScreen() {
  return <RoutinesScreenContent />;
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
    fontSize: 32,
    fontWeight: "700",
    color: AppColors.text,
    marginBottom: 24,
  },
  section: {
    marginTop: 24,
    gap: 12,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.mutedText,
  },
  routineCard: {
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  routineName: {
    fontSize: 18,
    fontWeight: "600",
    color: AppColors.text,
  },
  routineMeta: {
    marginTop: 4,
    fontSize: 14,
    color: AppColors.mutedText,
  },
  routineCardActions: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    backgroundColor: AppColors.accent,
    paddingVertical: 18,
    alignItems: "center",
    marginHorizontal: -20,
    borderRadius: 0,
  },
  primaryButtonText: {
    color: AppColors.accentText,
    fontSize: 18,
    fontWeight: "600",
  },
  smallButton: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: AppColors.surface,
  },
  smallButtonText: {
    fontSize: 13,
    color: AppColors.text,
    fontWeight: "600",
  },
});
