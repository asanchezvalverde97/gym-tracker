import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { AppColors } from "../constants/ui";
import { exercises } from "../data/exercises";
import { getExerciseDisplayName } from "../lib/display-name";
import { createRoutineExercise } from "../lib/routine-bundle";
import type { RoutineBundle } from "../lib/routines-storage";
import type { Exercise, RoutineExercise, SetVariant } from "../types/workout";
import { MiniWheelControl } from "./mini-wheel-control";

function createNumberRange(min: number, max: number, step = 1): number[] {
  return Array.from(
    { length: Math.floor((max - min) / step) + 1 },
    (_, index) => min + index * step,
  );
}

const restSecondsOptions = Array.from({ length: 12 }, (_, index) => index * 5);

function toRestParts(totalSeconds: number): { minutes: number; seconds: number } {
  const clamped = Math.max(0, Math.min(300, Math.round(totalSeconds)));
  const snappedTotalSeconds = Math.round(clamped / 5) * 5;
  const safe = Math.max(0, Math.min(300, snappedTotalSeconds));

  return {
    minutes: Math.floor(safe / 60),
    seconds: safe % 60,
  };
}

function fromRestParts(minutes: number, seconds: number): number {
  return Math.max(0, Math.min(300, minutes * 60 + seconds));
}

function formatExerciseDetails(exercise: RoutineExercise): string {
  const parts = [`${exercise.targetSets} sets`];

  if (exercise.targetDurationSec != null) {
    parts.push(`${exercise.targetDurationSec}s`);
  } else if (exercise.targetReps != null) {
    parts.push(`${exercise.targetReps} reps`);
  }

  if (exercise.defaultRestSec != null) {
    parts.push(`${exercise.defaultRestSec}s rest`);
  }

  if (exercise.defaultWeightKg != null) {
    parts.push(`${exercise.defaultWeightKg} kg`);
  }

  return parts.join(" · ");
}

function BuilderRestWheelControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const { minutes, seconds } = toRestParts(value);
  const secondsOptions = minutes >= 5 ? [0] : restSecondsOptions;

  function handleMinutesChange(minutes: number) {
    onChange(fromRestParts(minutes, minutes >= 5 ? 0 : seconds));
  }

  function handleSecondsChange(seconds: number) {
    onChange(fromRestParts(minutes, seconds));
  }

  return (
    <>
      <MiniWheelControl
        label="Rest min"
        value={minutes}
        options={createNumberRange(0, 5)}
        onChange={handleMinutesChange}
      />
      <MiniWheelControl
        label="Rest sec"
        value={seconds}
        options={secondsOptions}
        onChange={handleSecondsChange}
        formatValue={(seconds) => String(seconds).padStart(2, "0")}
      />
    </>
  );
}

export function WorkoutBuilder({
  bundle,
  title,
  kicker,
  nameLabel,
  allowRename = false,
  primaryActionLabel,
  onPrimaryAction,
  onBundleChange,
  secondaryActionLabel,
  onSecondaryAction,
  primaryDisabled = false,
}: {
  bundle: RoutineBundle;
  title: string;
  kicker: string;
  nameLabel: string;
  allowRename?: boolean;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  onBundleChange: (bundle: RoutineBundle) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  primaryDisabled?: boolean;
}) {
  const [exerciseSearchValue, setExerciseSearchValue] = useState("");

  const availableExercises = useMemo(() => {
    const normalizedQuery = exerciseSearchValue.trim().toLowerCase();

    return exercises.filter((exercise) => {
      const alreadyAdded = bundle.routineExercises.some(
        (routineExercise) => routineExercise.exerciseId === exercise.id,
      );

      if (alreadyAdded) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return getExerciseDisplayName(exercise.id)
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [bundle.routineExercises, exerciseSearchValue]);

  function updateBundle(updater: (current: RoutineBundle) => RoutineBundle) {
    onBundleChange(updater(bundle));
  }

  function updateExercise(
    exerciseId: string,
    updater: (exercise: RoutineExercise) => RoutineExercise,
  ) {
    updateBundle((current) => ({
      ...current,
      routineExercises: current.routineExercises.map((exercise, index) => {
        const nextExercise =
          exercise.id === exerciseId ? updater(exercise) : exercise;

        return {
          ...nextExercise,
          order: index + 1,
        };
      }),
    }));
  }

  function moveExercise(exerciseId: string, direction: -1 | 1) {
    updateBundle((current) => {
      const currentIndex = current.routineExercises.findIndex(
        (exercise) => exercise.id === exerciseId,
      );

      if (currentIndex < 0) {
        return current;
      }

      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= current.routineExercises.length) {
        return current;
      }

      const nextExercises = [...current.routineExercises];
      const [selectedExercise] = nextExercises.splice(currentIndex, 1);
      nextExercises.splice(nextIndex, 0, selectedExercise);

      return {
        ...current,
        routineExercises: nextExercises.map((exercise, index) => ({
          ...exercise,
          order: index + 1,
        })),
      };
    });
  }

  function removeExercise(exerciseId: string) {
    updateBundle((current) => ({
      ...current,
      routineExercises: current.routineExercises
        .filter((exercise) => exercise.id !== exerciseId)
        .map((exercise, index) => ({
          ...exercise,
          order: index + 1,
        })),
    }));
  }

  function addExercise(exercise: Exercise) {
    updateBundle((current) => ({
      ...current,
      routineExercises: [
        ...current.routineExercises,
        createRoutineExercise(
          current.routine.id,
          exercise,
          current.routineExercises.length + 1,
        ),
      ],
    }));
    setExerciseSearchValue("");
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{title}</Text>

        {allowRename ? (
          <View style={styles.nameSection}>
            <Text style={styles.fieldLabel}>{nameLabel}</Text>
            <TextInput
              style={styles.nameInput}
              value={bundle.routine.name}
              onChangeText={(value) =>
                updateBundle((current) => ({
                  ...current,
                  routine: {
                    ...current.routine,
                    name: value,
                  },
                }))
              }
              placeholder={nameLabel}
              placeholderTextColor={AppColors.mutedText}
            />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <Text style={styles.sectionMeta}>{bundle.routineExercises.length} selected</Text>
        </View>

        {bundle.routineExercises.length === 0 ? (
          <Text style={styles.helperText}>Add exercises to build this workout.</Text>
        ) : (
          bundle.routineExercises.map((routineExercise, index) => {
            const exercise = exercises.find(
              (item) => item.id === routineExercise.exerciseId,
            );

            if (!exercise) {
              return null;
            }

            const isRepsExercise = exercise.metricType === "reps";

            return (
              <View key={routineExercise.id} style={styles.exerciseRow}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseTitleGroup}>
                    <Text style={styles.exerciseOrder}>{index + 1}</Text>
                    <View style={styles.exerciseTextGroup}>
                      <Text style={styles.exerciseName}>
                        {getExerciseDisplayName(routineExercise.exerciseId)}
                      </Text>
                      <Text style={styles.exerciseMeta}>
                        {formatExerciseDetails(routineExercise)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exerciseActions}>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => moveExercise(routineExercise.id, -1)}
                      hitSlop={8}
                    >
                      <Feather name="arrow-up" size={15} color={AppColors.mutedText} />
                    </Pressable>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => moveExercise(routineExercise.id, 1)}
                      hitSlop={8}
                    >
                      <Feather name="arrow-down" size={15} color={AppColors.mutedText} />
                    </Pressable>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => removeExercise(routineExercise.id)}
                      hitSlop={8}
                    >
                      <Feather name="x" size={16} color={AppColors.mutedText} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.wheelRow}>
                  <MiniWheelControl
                    label="Sets"
                    value={routineExercise.targetSets}
                    options={createNumberRange(1, 8)}
                    onChange={(value) =>
                      updateExercise(routineExercise.id, (current) => ({
                        ...current,
                        targetSets: value,
                      }))
                    }
                  />
                  {isRepsExercise ? (
                    <MiniWheelControl
                      label="Reps"
                      value={routineExercise.targetReps ?? 8}
                      options={createNumberRange(1, 25)}
                      onChange={(value) =>
                        updateExercise(routineExercise.id, (current) => ({
                          ...current,
                          targetReps: value,
                          targetDurationSec: null,
                        }))
                      }
                    />
                  ) : (
                    <MiniWheelControl
                      label="Seconds"
                      value={routineExercise.targetDurationSec ?? 30}
                      options={createNumberRange(5, 180, 5)}
                      onChange={(value) =>
                        updateExercise(routineExercise.id, (current) => ({
                          ...current,
                          targetDurationSec: value,
                          targetReps: null,
                        }))
                      }
                    />
                  )}
                  <BuilderRestWheelControl
                    value={routineExercise.defaultRestSec ?? 90}
                    onChange={(value) =>
                      updateExercise(routineExercise.id, (current) => ({
                        ...current,
                        defaultRestSec: value,
                      }))
                    }
                  />
                </View>

                <View style={styles.detailRow}>
                  <MiniWheelControl
                    label="Weight"
                    value={routineExercise.defaultWeightKg ?? 0}
                    options={createNumberRange(0, 60, 2.5)}
                    onChange={(value) =>
                      updateExercise(routineExercise.id, (current) => ({
                        ...current,
                        defaultWeightKg: value === 0 ? null : value,
                      }))
                    }
                    formatValue={(value) => (value === 0 ? "BW" : `${value} kg`)}
                  />

                  <View style={styles.detailField}>
                    <Text style={styles.fieldLabel}>Set variant</Text>
                    <View style={styles.variantRow}>
                      {(["normal", "assisted"] as SetVariant[]).map((variant) => {
                        const isSelected =
                          (routineExercise.defaultSetVariant ?? "normal") === variant;

                        return (
                          <Pressable
                            key={variant}
                            style={[
                              styles.variantButton,
                              isSelected && styles.variantButtonSelected,
                            ]}
                            onPress={() =>
                              updateExercise(routineExercise.id, (current) => ({
                                ...current,
                                defaultSetVariant: variant,
                              }))
                            }
                          >
                            <Text style={styles.variantButtonText}>{variant}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.addSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add exercise</Text>
            <Text style={styles.sectionMeta}>{availableExercises.length} available</Text>
          </View>
          <TextInput
            style={styles.searchInput}
            value={exerciseSearchValue}
            onChangeText={setExerciseSearchValue}
            placeholder="Search exercises"
            placeholderTextColor={AppColors.mutedText}
          />
          <View style={styles.addList}>
            {availableExercises.map((exercise) => (
              <Pressable
                key={exercise.id}
                style={styles.addRow}
                onPress={() => addExercise(exercise)}
              >
                <View style={styles.addRowTextGroup}>
                  <Feather name="plus" size={14} color={AppColors.mutedText} />
                  <Text style={styles.addRowText}>{getExerciseDisplayName(exercise.id)}</Text>
                </View>
                <Text style={styles.addRowAction}>Add</Text>
              </Pressable>
            ))}
            {availableExercises.length === 0 ? (
              <Text style={styles.helperText}>No more exercises available.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, primaryDisabled && styles.primaryButtonDisabled]}
          onPress={onPrimaryAction}
          disabled={primaryDisabled}
        >
          <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
        </Pressable>
        {secondaryActionLabel && onSecondaryAction ? (
          <Pressable style={styles.secondaryFooterButton} onPress={onSecondaryAction}>
            <Text style={styles.secondaryFooterButtonText}>{secondaryActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: AppColors.mutedText,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: AppColors.text,
    marginBottom: 20,
  },
  nameSection: {
    gap: 8,
    marginBottom: 20,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    color: AppColors.text,
    backgroundColor: AppColors.surface,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  sectionMeta: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.mutedText,
  },
  exerciseRow: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: AppColors.border,
    gap: 12,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  exerciseTitleGroup: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  exerciseOrder: {
    width: 20,
    fontSize: 15,
    fontWeight: "700",
    color: AppColors.mutedText,
  },
  exerciseTextGroup: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "700",
    color: AppColors.text,
  },
  exerciseMeta: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  exerciseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -2,
  },
  iconButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelRow: {
    flexDirection: "row",
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  detailField: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  variantRow: {
    flexDirection: "row",
    gap: 8,
  },
  variantButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: AppColors.surface,
  },
  variantButtonSelected: {
    borderColor: AppColors.accent,
  },
  variantButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.text,
    textTransform: "capitalize",
  },
  addSection: {
    marginTop: 26,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: AppColors.border,
    gap: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: AppColors.text,
  },
  addList: {
    borderTopWidth: 1,
    borderColor: AppColors.border,
  },
  addRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  addRowTextGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 12,
  },
  addRowText: {
    fontSize: 16,
    color: AppColors.text,
  },
  addRowAction: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: AppColors.accent,
  },
  footer: {
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: AppColors.background,
  },
  primaryButton: {
    backgroundColor: AppColors.accent,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    color: AppColors.accentText,
    fontSize: 20,
    fontWeight: "700",
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryFooterButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryFooterButtonText: {
    fontSize: 15,
    color: AppColors.mutedText,
  },
});
