import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import {
  fromRestParts,
  toRestParts,
} from "../lib/rest-time";
import { createRoutineExercise } from "../lib/routine-bundle";
import type { RoutineBundle } from "../lib/routines-storage";
import type { Exercise, RoutineExercise, SetVariant } from "../types/workout";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function snapToStep(value: number, min: number, max: number, step: number): number {
  const normalized = Math.round((value - min) / step) * step + min;
  return clamp(normalized, min, max);
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

function StepperInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(value));
    }
  }, [isEditing, value]);

  function commitValue(rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    const nextValue = Number.isFinite(parsed)
      ? snapToStep(parsed, min, max, step)
      : value;

    setInputValue(String(nextValue));
    setIsEditing(false);
    onChange(nextValue);
  }

  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <View style={styles.stepperField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          style={styles.stepperButton}
          onPress={() => onChange(clamp(value - step, min, max))}
        >
          <Text style={styles.stepperButtonText}>-</Text>
        </Pressable>
        {isEditing ? (
          <TextInput
            style={styles.stepperInput}
            value={inputValue}
            onChangeText={setInputValue}
            onBlur={() => commitValue(inputValue)}
            onSubmitEditing={() => commitValue(inputValue)}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
          />
        ) : (
          <Pressable style={styles.stepperValueButton} onPress={() => setIsEditing(true)}>
            <Text style={styles.stepperValueText}>{displayValue}</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.stepperButton}
          onPress={() => onChange(clamp(value + step, min, max))}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RestInput({
  value,
  onMinutesChange,
  onSecondsChange,
}: {
  value: number;
  onMinutesChange: (minutes: number) => void;
  onSecondsChange: (seconds: number) => void;
}) {
  const { minutes, seconds } = toRestParts(value);

  return (
    <View style={styles.restField}>
      <StepperInput
        label="Rest min"
        value={minutes}
        min={0}
        max={5}
        step={1}
        onChange={onMinutesChange}
      />
      <View style={styles.restSecondsField}>
        <Text style={styles.fieldLabel}>Rest sec</Text>
        <View style={styles.restSecondsRow}>
          {[0, 30].map((option) => {
            const isSelected = seconds === option;

            return (
              <Pressable
                key={option}
                style={[
                  styles.restSecondsButton,
                  isSelected && styles.restSecondsButtonSelected,
                ]}
                onPress={() => onSecondsChange(option)}
              >
                <Text
                  style={[
                    styles.restSecondsButtonText,
                    isSelected && styles.restSecondsButtonTextSelected,
                  ]}
                >
                  {String(option).padStart(2, "0")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function WorkoutBuilder({
  bundle,
  title,
  kicker,
  nameLabel,
  headerContent,
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
  headerContent?: ReactNode;
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

        {headerContent ? <View style={styles.headerContent}>{headerContent}</View> : null}

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

                <View style={styles.controlsRow}>
                  <StepperInput
                    label="Sets"
                    value={routineExercise.targetSets}
                    min={1}
                    max={8}
                    step={1}
                    onChange={(value) =>
                      updateExercise(routineExercise.id, (current) => ({
                        ...current,
                        targetSets: value,
                      }))
                    }
                  />
                  {isRepsExercise ? (
                    <StepperInput
                      label="Reps"
                      value={routineExercise.targetReps ?? 8}
                      min={1}
                      max={30}
                      step={1}
                      onChange={(value) =>
                        updateExercise(routineExercise.id, (current) => ({
                          ...current,
                          targetReps: value,
                          targetDurationSec: null,
                        }))
                      }
                    />
                  ) : (
                    <StepperInput
                      label="Seconds"
                      value={routineExercise.targetDurationSec ?? 30}
                      min={5}
                      max={180}
                      step={5}
                      onChange={(value) =>
                        updateExercise(routineExercise.id, (current) => ({
                          ...current,
                          targetDurationSec: value,
                          targetReps: null,
                        }))
                      }
                    />
                  )}
                </View>

                <View style={styles.restRow}>
                  <RestInput
                    value={routineExercise.defaultRestSec ?? 90}
                    onMinutesChange={(minutes) =>
                      updateExercise(routineExercise.id, (current) => ({
                        ...current,
                        defaultRestSec: fromRestParts(
                          minutes,
                          toRestParts(current.defaultRestSec ?? 90).seconds,
                        ),
                      }))
                    }
                    onSecondsChange={(seconds) =>
                      updateExercise(routineExercise.id, (current) => ({
                        ...current,
                        defaultRestSec: fromRestParts(
                          toRestParts(current.defaultRestSec ?? 90).minutes,
                          seconds,
                        ),
                      }))
                    }
                  />
                </View>

                <View style={styles.detailRow}>
                  <StepperInput
                    label="Weight"
                    value={routineExercise.defaultWeightKg ?? 0}
                    min={0}
                    max={200}
                    step={1}
                    onChange={(value) =>
                      updateExercise(routineExercise.id, (current) => ({
                        ...current,
                        defaultWeightKg: value === 0 ? null : value,
                      }))
                    }
                    formatValue={(value) => String(value)}
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
  headerContent: {
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
  controlsRow: {
    flexDirection: "row",
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  restRow: {
    flexDirection: "row",
  },
  stepperField: {
    flex: 1,
    gap: 6,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperButton: {
    width: 36,
    height: 44,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: AppColors.text,
  },
  stepperValueButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  stepperValueText: {
    fontSize: 18,
    fontWeight: "700",
    color: AppColors.text,
  },
  stepperInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 10,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: AppColors.text,
  },
  restField: {
    flex: 1,
    gap: 10,
  },
  restSecondsField: {
    gap: 6,
  },
  restSecondsRow: {
    flexDirection: "row",
    gap: 8,
  },
  restSecondsButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  restSecondsButtonSelected: {
    borderColor: AppColors.accent,
    backgroundColor: AppColors.accent,
  },
  restSecondsButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.text,
  },
  restSecondsButtonTextSelected: {
    color: AppColors.accentText,
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
