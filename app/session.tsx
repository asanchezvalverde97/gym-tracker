import { useEffect, useRef, useState } from "react";
import {
  AppState,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import { exercises } from "../data/exercises";
import { routines } from "../data/routines";
import type { Routine } from "../types/workout";
import {
  createSessionFromRoutine,
  type CreateSessionResult,
} from "../lib/create-session";
import {
  clearActiveSession,
  getActiveSession,
  saveActiveSession,
} from "../lib/active-session";
import { saveCompletedSession } from "../lib/completed-sessions";
import {
  createSessionFlowState,
  getCurrentExercise,
  getCurrentSet,
  getUpcomingExercise,
  next,
  saveSet,
  updateCurrentSetActualRest,
  updateCurrentSetFeeling,
  updateCurrentSetRest,
  updateCurrentSetWeight,
  updateNextSetRest,
  type SessionFlowState,
} from "../lib/session-flow";
import type { SetFeeling, WorkoutSession } from "../types/workout";

const feelingOptions: Array<{ value: SetFeeling; label: string }> = [
  { value: 1, label: "Bad" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Good" },
  { value: 4, label: "Very good" },
];

const restPhrases = [
  "No es vivir, sino vivir bien.",
  "La primera victoria es sobre uno mismo.",
  "Hoy es victoria sobre ti mismo.",
  "El que se domina a si mismo es invencible.",
  "Una repeticion mas. Siempre una mas.",
  "Sin distraccion. Solo accion.",
  "El cansancio es pasajero. El progreso no.",
  "Haz lo que toca, aunque no apetezca.",
  "Disciplina ahora, libertad despues.",
  "Tu mente se rinde antes que tu cuerpo.",
  "Foco. Respira. Continua.",
  "No negocies contigo mismo.",
  "Cada set cuenta.",
  "Hazlo limpio, hazlo fuerte.",
  "Constancia > motivacion",
];

const secondsOptions = Array.from({ length: 12 }, (_, index) => index * 5);
const wheelRowHeight = 44;

function getExerciseName(exerciseId: string): string {
  return exercises.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
}

function getRoutineFromId(routineId?: string): Routine | null {
  if (routineId) {
    const matchingRoutine = routines.find((routine) => routine.id === routineId);

    if (matchingRoutine) {
      return matchingRoutine;
    }
  }

  return routines[0] ?? null;
}

function createInitialSessionData(routineId?: string): CreateSessionResult | null {
  const routine = getRoutineFromId(routineId);

  if (!routine) {
    return null;
  }

  return createSessionFromRoutine(routine);
}

function isValidActiveSessionBundle(value: unknown): value is {
  session: WorkoutSession;
  sessionExercises: SessionFlowState["sessionExercises"];
  workoutSets: SessionFlowState["workoutSets"];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const bundle = value as {
    session?: unknown;
    sessionExercises?: unknown;
    workoutSets?: unknown;
  };

  return (
    bundle.session != null &&
    Array.isArray(bundle.sessionExercises) &&
    Array.isArray(bundle.workoutSets)
  );
}

function getInitialMainValue(
  metricType: "reps" | "duration",
  targetRepsMin?: number | null,
  targetRepsMax?: number | null,
  targetDurationSec?: number | null,
  reps?: number | null,
  durationSec?: number | null,
): number {
  if (metricType === "reps") {
    return clamp(targetRepsMax ?? targetRepsMin ?? reps ?? 0, 0, 30);
  }

  return clamp(targetDurationSec ?? durationSec ?? 0, 0, 300);
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toRestParts(totalSeconds: number): { minutes: number; seconds: number } {
  const safe = clamp(totalSeconds, 0, 300);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  const snappedSeconds = secondsOptions.reduce((closest, option) => {
    return Math.abs(option - remainder) < Math.abs(closest - remainder)
      ? option
      : closest;
  }, 0);

  return { minutes, seconds: snappedSeconds };
}

function fromRestParts(minutes: number, seconds: number): number {
  return clamp(minutes * 60 + seconds, 0, 300);
}

function getNearestIndex(options: number[], value: number): number {
  let closestIndex = 0;

  for (let index = 1; index < options.length; index += 1) {
    if (
      Math.abs(options[index] - value) <
      Math.abs(options[closestIndex] - value)
    ) {
      closestIndex = index;
    }
  }

  return closestIndex;
}

function createNumberRange(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function getRandomRestPhrase(): string {
  const index = Math.floor(Math.random() * restPhrases.length);
  return restPhrases[index];
}

function getRemainingRestSeconds(
  restEndTimeMs: number | null,
  nowMs: number,
): number {
  if (restEndTimeMs == null) {
    return 0;
  }

  const remainingMs = restEndTimeMs - nowMs;

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

function WheelNumberControl({
  label,
  value,
  options,
  onChange,
  large = false,
  formatValue,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  large?: boolean;
  formatValue?: (value: number) => string;
}) {
  const currentIndex = getNearestIndex(options, value);
  const [dragOffset, setDragOffset] = useState(0);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const displayValue = formatValue ?? ((item: number) => String(item));
  const previousValue = options[currentIndex - 1];
  const selectedValue = options[currentIndex];
  const nextValue = options[currentIndex + 1];

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 3,
      onPanResponderMove: (_, gestureState) => {
        setDragOffset(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const stepDelta = Math.round(-gestureState.dy / wheelRowHeight);
        const nextIndex = clamp(
          currentIndexRef.current + stepDelta,
          0,
          options.length - 1,
        );

        setDragOffset(0);
        onChange(options[nextIndex]);
      },
      onPanResponderTerminate: () => {
        setDragOffset(0);
      },
    }),
  ).current;

  const translateY = clamp(dragOffset, -wheelRowHeight, wheelRowHeight);

  return (
    <View style={large ? styles.bigWheelContainer : styles.smallWheelContainer}>
      <Text style={large ? styles.bigWheelLabel : styles.smallWheelLabel}>
        {label}
      </Text>
      <View
        style={large ? styles.bigWheelViewport : styles.smallWheelViewport}
        {...panResponder.panHandlers}
      >
        <View style={[styles.wheelTrack, { transform: [{ translateY }] }]}>
          <Text style={large ? styles.bigWheelSideValue : styles.smallWheelSideValue}>
            {previousValue == null ? "" : displayValue(previousValue)}
          </Text>
          <Text style={large ? styles.bigWheelCenterValue : styles.smallWheelCenterValue}>
            {displayValue(selectedValue)}
          </Text>
          <Text style={large ? styles.bigWheelSideValue : styles.smallWheelSideValue}>
            {nextValue == null ? "" : displayValue(nextValue)}
          </Text>
        </View>
        <View pointerEvents="none" style={styles.wheelCenterHighlight} />
      </View>
    </View>
  );
}

function RestWheelControl({
  label,
  totalSeconds,
  onChange,
}: {
  label: string;
  totalSeconds: number;
  onChange: (value: number) => void;
}) {
  const parts = toRestParts(totalSeconds);

  function handleMinutesChange(minutes: number) {
    onChange(fromRestParts(minutes, parts.seconds));
  }

  function handleSecondsChange(seconds: number) {
    onChange(fromRestParts(parts.minutes, seconds));
  }

  return (
    <View style={styles.restWheelGroup}>
      <Text style={styles.smallWheelLabel}>{label}</Text>
      <View style={styles.restWheelRow}>
        <WheelNumberControl
          label="Min"
          value={parts.minutes}
          options={createNumberRange(0, 5)}
          onChange={handleMinutesChange}
          formatValue={(value) => String(value)}
        />
        <WheelNumberControl
          label="Sec"
          value={parts.seconds}
          options={secondsOptions}
          onChange={handleSecondsChange}
          formatValue={(value) => String(value).padStart(2, "0")}
        />
      </View>
    </View>
  );
}

export default function SessionScreen() {
  const params = useLocalSearchParams<{ routineId?: string | string[] }>();
  const selectedRoutineId = Array.isArray(params.routineId)
    ? params.routineId[0]
    : params.routineId;
  const [flowState, setFlowState] = useState<SessionFlowState | null>(null);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [selectedFeeling, setSelectedFeeling] = useState<SetFeeling>(2);
  const [showFeelingOverlay, setShowFeelingOverlay] = useState(false);
  const [mainValue, setMainValue] = useState(0);
  const [currentWeightValue, setCurrentWeightValue] = useState(0);
  const [currentRestValue, setCurrentRestValue] = useState(0);
  const [restStartTimeMs, setRestStartTimeMs] = useState<number | null>(null);
  const [restDurationTargetSec, setRestDurationTargetSec] = useState<number | null>(null);
  const [restEndTimeMs, setRestEndTimeMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [restPhrase, setRestPhrase] = useState(restPhrases[0]);
  const hasAdvancedRestRef = useRef(false);
  const hasSavedCompletedSessionRef = useRef(false);
  const flowStateRef = useRef<SessionFlowState | null>(null);
  const sessionRef = useRef<WorkoutSession | null>(null);
  const restStartTimeMsRef = useRef<number | null>(null);
  const restDurationTargetSecRef = useRef<number | null>(null);

  const currentExercise = flowState ? getCurrentExercise(flowState) : null;
  const currentSet = flowState ? getCurrentSet(flowState) : null;
  const upcomingExercise = flowState ? getUpcomingExercise(flowState) : null;
  const remainingRestSec = getRemainingRestSeconds(restEndTimeMs, nowMs);

  useEffect(() => {
    flowStateRef.current = flowState;
    sessionRef.current = session;
    restStartTimeMsRef.current = restStartTimeMs;
    restDurationTargetSecRef.current = restDurationTargetSec;
  }, [flowState, restDurationTargetSec, restStartTimeMs, session]);

  useEffect(() => {
    let isActive = true;

    async function initializeSession() {
      setIsHydrating(true);
      let nextRestStartTimeMs: number | null = null;
      let nextRestDurationTargetSec: number | null = null;
      let nextRestEndTimeMs: number | null = null;

      if (!isActive) {
        return;
      }

      if (selectedRoutineId) {
        const initialSessionData = createInitialSessionData(selectedRoutineId);

        setFlowState(
          initialSessionData
            ? createSessionFlowState(
                initialSessionData.sessionExercises,
                initialSessionData.workoutSets,
              )
            : null,
        );
        setSession(initialSessionData?.session ?? null);
      } else {
        const savedActiveSession = await getActiveSession();

        if (!isActive) {
          return;
        }

        if (isValidActiveSessionBundle(savedActiveSession)) {
          setFlowState(
            createSessionFlowState(
              savedActiveSession.sessionExercises,
              savedActiveSession.workoutSets,
            ),
          );
          setSession(savedActiveSession.session);
          nextRestStartTimeMs = savedActiveSession.restStartTimeMs ?? null;
          nextRestDurationTargetSec =
            savedActiveSession.restDurationTargetSec ?? null;
          nextRestEndTimeMs =
            savedActiveSession.restStartTimeMs != null &&
              savedActiveSession.restDurationTargetSec != null
              ? savedActiveSession.restStartTimeMs +
                  savedActiveSession.restDurationTargetSec * 1000
              : null;
        } else {
          const initialSessionData = createInitialSessionData();

          setFlowState(
            initialSessionData
              ? createSessionFlowState(
                  initialSessionData.sessionExercises,
                  initialSessionData.workoutSets,
                )
              : null,
          );
          setSession(initialSessionData?.session ?? null);
        }
      }

      setSelectedFeeling(2);
      setShowFeelingOverlay(false);
      setMainValue(0);
      setCurrentWeightValue(0);
      setCurrentRestValue(0);
      setRestStartTimeMs(nextRestStartTimeMs);
      setRestDurationTargetSec(nextRestDurationTargetSec);
      setRestEndTimeMs(nextRestEndTimeMs);
      setNowMs(Date.now());
      setRestPhrase(restPhrases[0]);
      hasAdvancedRestRef.current = false;
      hasSavedCompletedSessionRef.current = false;
      setIsHydrating(false);
    }

    void initializeSession();

    return () => {
      isActive = false;
    };
  }, [selectedRoutineId]);

  useEffect(() => {
    if (!currentExercise || !currentSet) {
      return;
    }

    setMainValue(
      getInitialMainValue(
        currentSet.metricType,
        currentExercise.targetRepsMin,
        currentExercise.targetRepsMax,
        currentExercise.targetDurationSec,
        currentSet.reps,
        currentSet.durationSec,
      ),
    );
    setCurrentWeightValue(clamp(currentSet.weightKg ?? 0, 0, 60));
    setCurrentRestValue(clamp(currentSet.restSecTarget ?? 0, 0, 300));
  }, [currentExercise?.id, currentSet?.id]);

  useEffect(() => {
    if (!flowState?.isResting) {
      setRestStartTimeMs(null);
      setRestDurationTargetSec(null);
      setRestEndTimeMs(null);
      setShowFeelingOverlay(false);
      hasAdvancedRestRef.current = false;
      return;
    }

    if (restStartTimeMs != null && restDurationTargetSec != null) {
      setRestEndTimeMs(restStartTimeMs + restDurationTargetSec * 1000);
      setNowMs(Date.now());
    }

    hasAdvancedRestRef.current = false;
  }, [
    flowState?.isResting,
    currentSet?.id,
    currentSet?.restSecTarget,
    restDurationTargetSec,
    restStartTimeMs,
  ]);

  useEffect(() => {
    if (!flowState?.isResting) {
      return;
    }

    setRestPhrase(getRandomRestPhrase());
  }, [flowState?.isResting, currentSet?.id]);

  useEffect(() => {
    if (!showFeelingOverlay) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setShowFeelingOverlay(false);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [showFeelingOverlay]);

  useEffect(() => {
    if (!flowState?.isResting) {
      return;
    }

    setNowMs(Date.now());
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [flowState?.isResting]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setNowMs(Date.now());
        return;
      }

      const currentFlowState = flowStateRef.current;
      const currentSession = sessionRef.current;

      if (!currentFlowState || !currentSession) {
        return;
      }

      const now = Date.now();
      const currentRestStartTimeMs = restStartTimeMsRef.current;
      const currentRestDurationTargetSec = restDurationTargetSecRef.current;
      const actualRestSec =
        currentFlowState.isResting && currentRestStartTimeMs != null
          ? Math.max(0, Math.round((now - currentRestStartTimeMs) / 1000))
          : null;
      const flowStateToPersist =
        actualRestSec == null
          ? currentFlowState
          : updateCurrentSetActualRest(currentFlowState, actualRestSec);

      void saveActiveSession({
        session: currentSession,
        sessionExercises: flowStateToPersist.sessionExercises,
        workoutSets: flowStateToPersist.workoutSets,
        restStartTimeMs: currentRestStartTimeMs,
        restDurationTargetSec: currentRestDurationTargetSec,
      });
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!flowState?.isResting || remainingRestSec !== 0 || hasAdvancedRestRef.current) {
      return;
    }

    hasAdvancedRestRef.current = true;
    handleAdvanceRest();
  }, [flowState?.isResting, remainingRestSec]);

  useEffect(() => {
    if (!flowState?.isFinished || !session || hasSavedCompletedSessionRef.current) {
      return;
    }

    hasSavedCompletedSessionRef.current = true;

    const completedSession: WorkoutSession = {
      ...session,
      endedAt: session.endedAt ?? new Date().toISOString(),
    };

    setSession(completedSession);
    void (async () => {
      await saveCompletedSession(
        completedSession,
        flowState.sessionExercises,
        flowState.workoutSets,
      );
      await clearActiveSession();
    })();
  }, [flowState?.isFinished, flowState?.sessionExercises, flowState?.workoutSets, session]);

  function handleCurrentWeightChange(value: number) {
    const nextValue = clamp(value, 0, 60);
    setCurrentWeightValue(nextValue);
    setFlowState((current) =>
      current ? updateCurrentSetWeight(current, nextValue) : current,
    );
  }

  function handleCurrentRestChange(value: number) {
    const nextValue = clamp(value, 0, 300);
    setCurrentRestValue(nextValue);
    setFlowState((current) =>
      current ? updateCurrentSetRest(current, nextValue) : current,
    );
  }

  function handleDonePress() {
    if (!flowState || !currentSet) {
      return;
    }

    const nextState = saveSet(flowState, {
      reps: currentSet.metricType === "reps" ? mainValue : null,
      durationSec: currentSet.metricType === "duration" ? mainValue : null,
      feeling: null,
    });

    const restDurationSec = clamp(currentRestValue, 0, 300);
    const now = Date.now();
    const nextRestEndTimeMs = now + restDurationSec * 1000;

    setFlowState(nextState);
    setRestStartTimeMs(now);
    setRestDurationTargetSec(restDurationSec);
    setRestEndTimeMs(nextRestEndTimeMs);
    setNowMs(now);
    hasAdvancedRestRef.current = false;
    setRestPhrase(getRandomRestPhrase());
    setShowFeelingOverlay(true);
    if (session) {
      void saveActiveSession({
        session,
        sessionExercises: nextState.sessionExercises,
        workoutSets: nextState.workoutSets,
        restStartTimeMs: now,
        restDurationTargetSec: restDurationSec,
      });
    }
  }

  function handleFeelingSelect(feeling: SetFeeling) {
    setSelectedFeeling(feeling);
    setFlowState((current) =>
      current ? updateCurrentSetFeeling(current, feeling) : current,
    );
    setShowFeelingOverlay(false);
  }

  function handleDismissFeeling() {
    setShowFeelingOverlay(false);
  }

  function handleAdvanceRest() {
    if (!flowState) {
      return;
    }

    const now = Date.now();
    const actualRestSec =
      restStartTimeMs == null ? 0 : Math.max(0, Math.round((now - restStartTimeMs) / 1000));
    const flowStateWithActualRest = updateCurrentSetActualRest(flowState, actualRestSec);
    const nextFlowState = next(flowStateWithActualRest);

    setShowFeelingOverlay(false);
    setRestStartTimeMs(null);
    setRestDurationTargetSec(null);
    setRestEndTimeMs(null);
    setNowMs(now);
    hasAdvancedRestRef.current = false;
    setFlowState(nextFlowState);
    if (session && !nextFlowState.isFinished) {
      void saveActiveSession({
        session,
        sessionExercises: nextFlowState.sessionExercises,
        workoutSets: nextFlowState.workoutSets,
        restStartTimeMs: null,
        restDurationTargetSec: null,
      });
    }
  }

  function updateUpcomingRestAndTimer(
    updater: (current: number) => number,
  ) {
    const now = Date.now();
    const elapsedRestSec =
      restStartTimeMs == null ? 0 : Math.max(0, Math.round((now - restStartTimeMs) / 1000));
    const currentDurationSec = restDurationTargetSec ?? currentRestValue;
    const currentRemainingSec = Math.max(0, currentDurationSec - elapsedRestSec);
    const nextRemainingSec = clamp(updater(currentRemainingSec), 0, 300);
    const nextDurationTargetSec = clamp(elapsedRestSec + nextRemainingSec, 0, 300);
    const nextRestEndTimeMs = (restStartTimeMs ?? now) + nextDurationTargetSec * 1000;

    setRestDurationTargetSec(nextDurationTargetSec);
    setRestEndTimeMs(nextRestEndTimeMs);
    setNowMs(now);
    hasAdvancedRestRef.current = false;
    setFlowState((currentFlow) => {
      if (!currentFlow) {
        return currentFlow;
      }

      const withCurrentRest = updateCurrentSetRest(currentFlow, nextDurationTargetSec);
      return updateNextSetRest(withCurrentRest, nextDurationTargetSec);
    });
  }

  function handleAddRestTime() {
    updateUpcomingRestAndTimer((current) => current + 15);
  }

  function handleReduceRestTime() {
    updateUpcomingRestAndTimer((current) => current - 15);
  }

  if (!flowState) {
    return (
      <View style={styles.container}>
        <Text>{isHydrating ? "Loading workout..." : "No routine available."}</Text>
      </View>
    );
  }

  if (flowState.isFinished || !currentExercise || !currentSet) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Workout complete</Text>
      </View>
    );
  }

  const exerciseName = getExerciseName(currentExercise.exerciseId);
  const totalSets = currentExercise.targetSets;
  const mainLabel = currentSet.metricType === "reps" ? "REPS" : "SECONDS";
  const mainOptions =
    currentSet.metricType === "reps"
      ? createNumberRange(0, 30)
      : createNumberRange(0, 300);
  const nextExerciseLabel = upcomingExercise
    ? upcomingExercise.id === currentExercise.id
      ? `Next: ${getExerciseName(upcomingExercise.exerciseId)}`
      : `Next exercise: ${getExerciseName(upcomingExercise.exerciseId)}`
    : "Next: Finish workout";

  if (flowState.isResting) {
    return (
      <View style={styles.container}>
        <View style={styles.restScreen}>
          <View style={styles.topBar}>
            <Text style={styles.topBarText}>{nextExerciseLabel}</Text>
          </View>

          <View style={styles.restCenter}>
            <Text style={styles.restQuote}>{restPhrase}</Text>

            <View style={styles.countdownBlock}>
              <Text style={styles.countdownText}>{formatCountdown(remainingRestSec)}</Text>
            </View>

            <View style={styles.timerControlsRow}>
              <Pressable style={styles.timerControl} onPress={handleReduceRestTime}>
                <Text style={styles.timerControlText}>-15s</Text>
              </Pressable>
              <Pressable style={styles.timerControl} onPress={handleAddRestTime}>
                <Text style={styles.timerControlText}>+15s</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.skipBar} onPress={handleAdvanceRest}>
            <Text style={styles.skipBarText}>SKIP</Text>
          </Pressable>
        </View>

        {showFeelingOverlay ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>How did it feel?</Text>
            <View style={styles.feelingsGrid}>
              {feelingOptions.map((option) => {
                const isSelected = selectedFeeling === option.value;

                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.feelingButton,
                      isSelected && styles.feelingButtonSelected,
                    ]}
                    onPress={() => handleFeelingSelect(option.value)}
                  >
                    <Text style={styles.feelingText}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.skipButton} onPress={handleDismissFeeling}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.title}>{exerciseName}</Text>
        <Text style={styles.subtitle}>
          Set {currentSet.setNumber} / {totalSets}
        </Text>

        <View style={styles.topWheelRow}>
          <WheelNumberControl
            label="Weight"
            value={currentWeightValue}
            options={createNumberRange(0, 60)}
            onChange={handleCurrentWeightChange}
          />
        </View>

        <RestWheelControl
          label="Rest"
          totalSeconds={currentRestValue}
          onChange={handleCurrentRestChange}
        />
      </View>

      <View style={styles.centerSection}>
        <WheelNumberControl
          label={mainLabel}
          value={mainValue}
          options={mainOptions}
          onChange={setMainValue}
          large
        />
      </View>

      <View style={styles.bottomSection}>
        <Pressable style={styles.primaryButton} onPress={handleDonePress}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  topSection: {
    paddingTop: 24,
  },
  centerSection: {
    flex: 1,
    justifyContent: "center",
  },
  bottomSection: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 18,
    marginTop: 6,
    marginBottom: 18,
  },
  topWheelRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  smallWheelContainer: {
    flex: 1,
    alignItems: "center",
  },
  bigWheelContainer: {
    alignItems: "center",
  },
  smallWheelLabel: {
    fontSize: 13,
    textTransform: "uppercase",
    color: "#444",
    marginBottom: 8,
  },
  bigWheelLabel: {
    fontSize: 18,
    letterSpacing: 1,
    marginBottom: 12,
  },
  smallWheelViewport: {
    height: wheelRowHeight * 3,
    width: "100%",
    borderWidth: 1,
    borderColor: "#999",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bigWheelViewport: {
    height: wheelRowHeight * 3 + 24,
    width: "100%",
    minWidth: 240,
    borderWidth: 1,
    borderColor: "#999",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  wheelTrack: {
    alignItems: "center",
    justifyContent: "center",
  },
  wheelCenterHighlight: {
    position: "absolute",
    top: "50%",
    marginTop: -wheelRowHeight / 2,
    left: 8,
    right: 8,
    height: wheelRowHeight,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  smallWheelSideValue: {
    height: wheelRowHeight,
    fontSize: 20,
    color: "#999",
    opacity: 0.55,
    textAlignVertical: "center",
    lineHeight: wheelRowHeight,
  },
  smallWheelCenterValue: {
    height: wheelRowHeight,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: wheelRowHeight,
  },
  bigWheelSideValue: {
    height: wheelRowHeight + 12,
    fontSize: 36,
    color: "#999",
    opacity: 0.45,
    lineHeight: wheelRowHeight + 12,
  },
  bigWheelCenterValue: {
    height: wheelRowHeight + 12,
    fontSize: 84,
    fontWeight: "800",
    lineHeight: wheelRowHeight + 12,
  },
  restWheelGroup: {
    marginTop: 4,
  },
  restWheelRow: {
    flexDirection: "row",
    gap: 12,
  },
  restScreen: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "space-between",
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: -20,
    paddingTop: 0,
    paddingBottom: 20,
  },
  topBar: {
    backgroundColor: "#111",
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  topBarText: {
    color: "#fff",
    fontSize: 15,
    textAlign: "center",
    fontWeight: "600",
  },
  restCenter: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 12,
    paddingHorizontal: 24,
  },
  restQuote: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: "#555",
    maxWidth: 320,
    minHeight: 44,
  },
  countdownBlock: {
    height: 116,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: {
    fontSize: 88,
    fontWeight: "800",
    lineHeight: 96,
    textAlign: "center",
  },
  timerControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    minHeight: 44,
    alignItems: "center",
  },
  timerControl: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#f3f3f3",
  },
  timerControlText: {
    fontSize: 16,
    color: "#444",
    fontWeight: "600",
  },
  skipBar: {
    backgroundColor: "#111",
    paddingVertical: 18,
    alignItems: "center",
  },
  skipBarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: "#111",
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(255,255,255,0.88)",
    padding: 20,
    justifyContent: "center",
  },
  overlayTitle: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  feelingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  feelingButton: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#999",
    paddingVertical: 18,
    alignItems: "center",
  },
  feelingButtonSelected: {
    backgroundColor: "#e6e6e6",
  },
  feelingText: {
    fontSize: 16,
  },
  skipButton: {
    alignSelf: "center",
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: "#666",
  },
});
