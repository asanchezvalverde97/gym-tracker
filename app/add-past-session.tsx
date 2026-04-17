import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../constants/ui";
import { exercises } from "../data/exercises";
import {
  formatExerciseDisplayName,
  formatRoutineDisplayName,
} from "../lib/display-name";
import {
  createCompletedSessionFromPastSessionDraft,
  createEmptyPastSessionDraft,
  createPastSessionDraftFromRoutineBundle,
  createPastSessionExerciseDraft,
  createPastSessionSetDraft,
  getDefaultPastSessionDate,
  type PastSessionDraft,
  type PastSessionSetDraft,
} from "../lib/past-session";
import {
  getRoutineBundles,
  type RoutineBundle,
} from "../lib/routines-storage";
import { saveCompletedSession } from "../lib/completed-sessions";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getMonthLabel(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatDateLabel(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatTimeLabel(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function createCalendarDays(monthDate: Date): (Date | null)[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function updateDateKeepingTime(current: Date, nextDate: Date): Date {
  const nextValue = new Date(current);
  nextValue.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  return nextValue;
}

function updateTimePart(current: Date, hours: number, minutes: number): Date {
  const nextValue = new Date(current);
  nextValue.setHours(hours, minutes, 0, 0);
  return nextValue;
}

function getMetricLabel(setDraft: PastSessionSetDraft): string {
  return setDraft.metricType === "duration" ? "Seconds" : "Reps";
}

function getMetricValue(setDraft: PastSessionSetDraft): number {
  return setDraft.metricType === "duration"
    ? setDraft.durationSec ?? 30
    : setDraft.reps ?? 8;
}

function getWeekdayLabels(): string[] {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

function StepperInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));

  function commitValue(rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    const nextValue = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
    setInputValue(String(nextValue));
    setIsEditing(false);
    onChange(nextValue);
  }

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
          <Pressable
            style={styles.stepperValueButton}
            onPress={() => {
              setInputValue(String(value));
              setIsEditing(true);
            }}
          >
            <Text style={styles.stepperValueText}>{value}</Text>
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

function RestSecondsInput({
  value,
  onChange,
}: {
  value: 0 | 30;
  onChange: (value: 0 | 30) => void;
}) {
  return (
    <View style={styles.stepperField}>
      <Text style={styles.fieldLabel}>Rest sec</Text>
      <View style={styles.toggleRow}>
        {[0, 30].map((option) => {
          const isSelected = value === option;

          return (
            <Pressable
              key={option}
              style={[
                styles.toggleButton,
                isSelected && styles.toggleButtonSelected,
              ]}
              onPress={() => onChange(option as 0 | 30)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  isSelected && styles.toggleButtonTextSelected,
                ]}
              >
                {String(option).padStart(2, "0")}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AddPastSessionScreen() {
  const insets = useSafeAreaInsets();
  const [routineBundles, setRoutineBundles] = useState<RoutineBundle[]>([]);
  const [selectedMode, setSelectedMode] = useState<"routine" | "scratch">("routine");
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PastSessionDraft | null>(null);
  const [sessionDate, setSessionDate] = useState<Date>(getDefaultPastSessionDate);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const date = getDefaultPastSessionDate();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [durationValue, setDurationValue] = useState("45");
  const [notesValue, setNotesValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  const calendarDays = useMemo(() => createCalendarDays(visibleMonth), [visibleMonth]);
  const weekdayLabels = useMemo(() => getWeekdayLabels(), []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadRoutines() {
        const nextRoutineBundles = await getRoutineBundles();

        if (!isActive) {
          return;
        }

        setRoutineBundles(nextRoutineBundles);

        if (selectedMode === "routine") {
          const nextSelectedRoutineId =
            selectedRoutineId ?? nextRoutineBundles[0]?.routine.id ?? null;
          const nextBundle =
            nextRoutineBundles.find((item) => item.routine.id === nextSelectedRoutineId) ?? null;

          setSelectedRoutineId(nextSelectedRoutineId);
          setDraft(nextBundle ? createPastSessionDraftFromRoutineBundle(nextBundle) : null);
        } else {
          setDraft((current) => current ?? createEmptyPastSessionDraft());
        }
      }

      void loadRoutines();

      return () => {
        isActive = false;
      };
    }, [selectedMode, selectedRoutineId]),
  );

  function updateDraft(updater: (current: PastSessionDraft) => PastSessionDraft) {
    setDraft((current) => (current ? updater(current) : current));
  }

  function handleSelectRoutineMode(routineId: string) {
    setSelectedMode("routine");
    setSelectedRoutineId(routineId);
    const nextBundle = routineBundles.find((item) => item.routine.id === routineId) ?? null;
    setDraft(nextBundle ? createPastSessionDraftFromRoutineBundle(nextBundle) : null);
  }

  function handleSelectScratchMode() {
    setSelectedMode("scratch");
    setSelectedRoutineId(null);
    setDraft(createEmptyPastSessionDraft());
  }

  function handleAddExercise(exerciseId: string) {
    updateDraft((current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        createPastSessionExerciseDraft(exerciseId, current.exercises.length + 1),
      ],
    }));
    setShowExercisePicker(false);
  }

  function handleRemoveExercise(exerciseId: string) {
    updateDraft((current) => ({
      ...current,
      exercises: current.exercises
        .filter((exerciseDraft) => exerciseDraft.id !== exerciseId)
        .map((exerciseDraft, index) => ({
          ...exerciseDraft,
          order: index + 1,
        })),
    }));
  }

  function handleAddSet(exerciseId: string) {
    updateDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exerciseDraft) => {
        if (exerciseDraft.id !== exerciseId) {
          return exerciseDraft;
        }

        const lastSet = exerciseDraft.sets[exerciseDraft.sets.length - 1];
        const metricType =
          lastSet?.metricType ??
          exercises.find((exercise) => exercise.id === exerciseDraft.exerciseId)?.metricType ??
          "reps";

        return {
          ...exerciseDraft,
          sets: [
            ...exerciseDraft.sets,
            createPastSessionSetDraft(metricType, {
              reps: lastSet?.reps ?? null,
              durationSec: lastSet?.durationSec ?? null,
              weightKg: lastSet?.weightKg ?? null,
              restMin: lastSet?.restMin ?? 1,
              restSec: lastSet?.restSec ?? 30,
              variant: lastSet?.variant ?? "normal",
            }),
          ],
        };
      }),
    }));
  }

  function handleRemoveSet(exerciseId: string, setId: string) {
    updateDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exerciseDraft) => {
        if (exerciseDraft.id !== exerciseId) {
          return exerciseDraft;
        }

        if (exerciseDraft.sets.length <= 1) {
          return exerciseDraft;
        }

        return {
          ...exerciseDraft,
          sets: exerciseDraft.sets.filter((setDraft) => setDraft.id !== setId),
        };
      }),
    }));
  }

  function handleUpdateSet(
    exerciseId: string,
    setId: string,
    updater: (setDraft: PastSessionSetDraft) => PastSessionSetDraft,
  ) {
    updateDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exerciseDraft) => {
        if (exerciseDraft.id !== exerciseId) {
          return exerciseDraft;
        }

        return {
          ...exerciseDraft,
          sets: exerciseDraft.sets.map((setDraft) =>
            setDraft.id === setId ? updater(setDraft) : setDraft,
          ),
        };
      }),
    }));
  }

  async function handleSavePastSession() {
    if (!draft) {
      return;
    }

    const parsedDuration = Number.parseInt(durationValue, 10);

    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      setErrorMessage("Enter a valid duration in minutes.");
      return;
    }

    if (draft.exercises.length === 0) {
      setErrorMessage("Add at least one exercise.");
      return;
    }

    const hasInvalidSet = draft.exercises.some((exerciseDraft) =>
      exerciseDraft.sets.some((setDraft) =>
        setDraft.metricType === "duration"
          ? !setDraft.durationSec || setDraft.durationSec <= 0
          : !setDraft.reps || setDraft.reps <= 0,
      ),
    );

    if (hasInvalidSet) {
      setErrorMessage("Each set needs a valid reps or duration value.");
      return;
    }

    setErrorMessage("");

    const completedSession = createCompletedSessionFromPastSessionDraft(draft, {
      sessionDate,
      durationMin: parsedDuration,
      notes: notesValue,
      routineId: selectedMode === "routine" ? selectedRoutineId : null,
    });

    await saveCompletedSession(
      completedSession.session,
      completedSession.sessionExercises,
      completedSession.workoutSets,
    );

    router.replace(`/history/${completedSession.session.id}`);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>History</Text>
        <Text style={styles.title}>Add past session</Text>
        {draft ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Session details</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Workout name</Text>
                <TextInput
                  style={styles.input}
                  value={draft.name}
                  onChangeText={(value) =>
                    updateDraft((current) => ({
                      ...current,
                      name: value,
                    }))
                  }
                  placeholder="Past workout"
                  placeholderTextColor={AppColors.mutedText}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date</Text>
                <Pressable
                  style={styles.selectorButton}
                  onPress={() => setShowCalendar((current) => !current)}
                >
                  <Text style={styles.selectorButtonText}>{formatDateLabel(sessionDate)}</Text>
                </Pressable>
                {showCalendar ? (
                  <View style={styles.calendarCard}>
                    <View style={styles.calendarHeader}>
                      <Pressable
                        style={styles.calendarNavButton}
                        onPress={() =>
                          setVisibleMonth(
                            (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                          )
                        }
                      >
                        <Text style={styles.calendarNavButtonText}>Prev</Text>
                      </Pressable>
                      <Text style={styles.calendarTitle}>{getMonthLabel(visibleMonth)}</Text>
                      <Pressable
                        style={styles.calendarNavButton}
                        onPress={() =>
                          setVisibleMonth(
                            (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                          )
                        }
                      >
                        <Text style={styles.calendarNavButtonText}>Next</Text>
                      </Pressable>
                    </View>
                    <View style={styles.calendarWeekRow}>
                      {weekdayLabels.map((label) => (
                        <Text key={label} style={styles.calendarWeekday}>
                          {label}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.calendarGrid}>
                      {calendarDays.map((day, index) => {
                        if (!day) {
                          return <View key={`empty_${index}`} style={styles.calendarCell} />;
                        }

                        const isSelected = isSameDay(day, sessionDate);

                        return (
                          <Pressable
                            key={day.toISOString()}
                            style={[
                              styles.calendarCell,
                              styles.calendarDayButton,
                              isSelected && styles.calendarDayButtonSelected,
                            ]}
                            onPress={() => {
                              setSessionDate((current) => updateDateKeepingTime(current, day));
                              setShowCalendar(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.calendarDayText,
                                isSelected && styles.calendarDayTextSelected,
                              ]}
                            >
                              {day.getDate()}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Start time</Text>
                <Pressable
                  style={styles.selectorButton}
                  onPress={() => setShowTimePicker((current) => !current)}
                >
                  <Text style={styles.selectorButtonText}>{formatTimeLabel(sessionDate)}</Text>
                </Pressable>
                {showTimePicker ? (
                  <View style={styles.timePickerCard}>
                    <View style={styles.inlineControlsRow}>
                      <StepperInput
                        label="Hour"
                        value={sessionDate.getHours()}
                        min={0}
                        max={23}
                        step={1}
                        onChange={(hours) =>
                          setSessionDate((current) =>
                            updateTimePart(current, hours, current.getMinutes()),
                          )
                        }
                      />
                      <StepperInput
                        label="Minute"
                        value={sessionDate.getMinutes()}
                        min={0}
                        max={59}
                        step={1}
                        onChange={(minutes) =>
                          setSessionDate((current) =>
                            updateTimePart(current, current.getHours(), minutes),
                          )
                        }
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Duration (min)</Text>
                <TextInput
                  style={styles.input}
                  value={durationValue}
                  onChangeText={setDurationValue}
                  placeholder="45"
                  placeholderTextColor={AppColors.mutedText}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Source</Text>
                <View style={styles.selectionList}>
                  <Pressable
                    style={[
                      styles.selectionTile,
                      selectedMode === "scratch" && styles.selectionTileSelected,
                    ]}
                    onPress={handleSelectScratchMode}
                  >
                    <Text
                      style={[
                        styles.selectionTileText,
                        selectedMode === "scratch" && styles.selectionTileTextSelected,
                      ]}
                    >
                      Start from scratch
                    </Text>
                  </Pressable>
                  {routineBundles.map((routineBundle) => {
                    const isSelected =
                      selectedMode === "routine" &&
                      selectedRoutineId === routineBundle.routine.id;

                    return (
                      <Pressable
                        key={routineBundle.routine.id}
                        style={[
                          styles.selectionTile,
                          isSelected && styles.selectionTileSelected,
                        ]}
                        onPress={() => handleSelectRoutineMode(routineBundle.routine.id)}
                      >
                        <Text
                          style={[
                            styles.selectionTileText,
                            isSelected && styles.selectionTileTextSelected,
                          ]}
                        >
                          {formatRoutineDisplayName(routineBundle.routine.name)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={notesValue}
                  onChangeText={setNotesValue}
                  placeholder="Optional notes"
                  placeholderTextColor={AppColors.mutedText}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Exercises</Text>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setShowExercisePicker((current) => !current)}
                >
                  <Text style={styles.secondaryButtonText}>
                    {showExercisePicker ? "Close" : "Add exercise"}
                  </Text>
                </Pressable>
              </View>
              {showExercisePicker ? (
                <View style={styles.exercisePickerList}>
                  {exercises.map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      style={styles.selectionTile}
                      onPress={() => handleAddExercise(exercise.id)}
                    >
                      <Text style={styles.selectionTileText}>
                        {formatExerciseDisplayName(exercise.name)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {draft.exercises.length === 0 ? (
                <Text style={styles.emptyText}>No exercises added yet.</Text>
              ) : (
                <View style={styles.exerciseList}>
                  {draft.exercises.map((exerciseDraft) => (
                    <View key={exerciseDraft.id} style={styles.exerciseCard}>
                      <View style={styles.exerciseHeader}>
                        <View style={styles.exerciseHeaderText}>
                          <Text style={styles.exerciseName}>
                            {formatExerciseDisplayName(
                              exercises.find((exercise) => exercise.id === exerciseDraft.exerciseId)
                                ?.name ?? exerciseDraft.exerciseId,
                            )}
                          </Text>
                          <Text style={styles.exerciseMeta}>
                            {exerciseDraft.sets.length} set
                            {exerciseDraft.sets.length === 1 ? "" : "s"}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.removeButton}
                          onPress={() => handleRemoveExercise(exerciseDraft.id)}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </Pressable>
                      </View>

                      <View style={styles.setList}>
                        {exerciseDraft.sets.map((setDraft, setIndex) => (
                          <View key={setDraft.id} style={styles.setCard}>
                            <View style={styles.setHeader}>
                              <Text style={styles.setTitle}>Set {setIndex + 1}</Text>
                              {exerciseDraft.sets.length > 1 ? (
                                <Pressable
                                  style={styles.removeSetButton}
                                  onPress={() => handleRemoveSet(exerciseDraft.id, setDraft.id)}
                                >
                                  <Text style={styles.removeSetButtonText}>Remove set</Text>
                                </Pressable>
                              ) : null}
                            </View>

                            <View style={styles.inlineControlsRow}>
                              <StepperInput
                                label={getMetricLabel(setDraft)}
                                value={getMetricValue(setDraft)}
                                min={setDraft.metricType === "duration" ? 5 : 1}
                                max={setDraft.metricType === "duration" ? 600 : 60}
                                step={setDraft.metricType === "duration" ? 5 : 1}
                                onChange={(value) =>
                                  handleUpdateSet(exerciseDraft.id, setDraft.id, (current) => ({
                                    ...current,
                                    reps: current.metricType === "reps" ? value : null,
                                    durationSec:
                                      current.metricType === "duration" ? value : null,
                                  }))
                                }
                              />
                              <StepperInput
                                label="Weight"
                                value={setDraft.weightKg ?? 0}
                                min={0}
                                max={200}
                                step={1}
                                onChange={(value) =>
                                  handleUpdateSet(exerciseDraft.id, setDraft.id, (current) => ({
                                    ...current,
                                    weightKg: value === 0 ? null : value,
                                  }))
                                }
                              />
                            </View>

                            <View style={styles.inlineControlsRow}>
                              <StepperInput
                                label="Rest min"
                                value={setDraft.restMin}
                                min={0}
                                max={5}
                                step={1}
                                onChange={(value) =>
                                  handleUpdateSet(exerciseDraft.id, setDraft.id, (current) => ({
                                    ...current,
                                    restMin: value,
                                  }))
                                }
                              />
                              <RestSecondsInput
                                value={setDraft.restSec}
                                onChange={(value) =>
                                  handleUpdateSet(exerciseDraft.id, setDraft.id, (current) => ({
                                    ...current,
                                    restSec: value,
                                  }))
                                }
                              />
                            </View>
                          </View>
                        ))}
                      </View>

                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => handleAddSet(exerciseDraft.id)}
                      >
                        <Text style={styles.secondaryButtonText}>Add set</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={styles.actionsRow}>
              <Pressable style={styles.secondaryAction} onPress={() => router.back()}>
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryAction} onPress={handleSavePastSession}>
                <Text style={styles.primaryActionText}>Save completed session</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: AppColors.text,
  },
  panel: {
    gap: 16,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: AppColors.text,
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
  },
  notesInput: {
    minHeight: 88,
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectorButtonText: {
    fontSize: 16,
    color: AppColors.text,
  },
  calendarCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    padding: 12,
    gap: 12,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  calendarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.text,
  },
  calendarNavButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  calendarNavButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  calendarWeekRow: {
    flexDirection: "row",
  },
  calendarWeekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: AppColors.mutedText,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  calendarDayButton: {
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  calendarDayButtonSelected: {
    borderColor: AppColors.accent,
    backgroundColor: AppColors.accent,
  },
  calendarDayText: {
    fontSize: 14,
    color: AppColors.text,
  },
  calendarDayTextSelected: {
    color: AppColors.accentText,
    fontWeight: "700",
  },
  timePickerCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    padding: 12,
  },
  selectionList: {
    gap: 8,
  },
  selectionTile: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectionTileSelected: {
    borderColor: AppColors.accent,
    backgroundColor: AppColors.accentSoft,
  },
  selectionTileText: {
    fontSize: 15,
    color: AppColors.text,
  },
  selectionTileTextSelected: {
    fontWeight: "700",
    color: AppColors.accent,
  },
  exercisePickerList: {
    gap: 8,
  },
  exerciseList: {
    gap: 16,
  },
  exerciseCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    padding: 14,
    gap: 14,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  exerciseHeaderText: {
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
  setList: {
    gap: 12,
  },
  setCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 12,
    gap: 12,
  },
  setHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  setTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.text,
  },
  inlineControlsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
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
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonSelected: {
    borderColor: AppColors.accent,
    backgroundColor: AppColors.accent,
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.text,
  },
  toggleButtonTextSelected: {
    color: AppColors.accentText,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  removeSetButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeSetButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.danger,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  emptyText: {
    fontSize: 15,
    color: AppColors.mutedText,
  },
  errorText: {
    fontSize: 14,
    color: AppColors.danger,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.surface,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.text,
  },
  primaryAction: {
    flex: 1.4,
    borderWidth: 1,
    borderColor: AppColors.accent,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.accent,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.accentText,
  },
});
