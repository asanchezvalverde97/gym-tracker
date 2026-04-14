import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../constants/ui";
import { getExerciseDisplayName } from "../lib/display-name";
import {
  createSessionFromRoutine,
  type CreateSessionResult,
} from "../lib/create-session";
import { getRoutineBundleById, getRoutineBundles } from "../lib/routines-storage";
import {
  clearStartWorkoutDraft,
  getStartWorkoutDraft,
} from "../lib/start-workout-draft";
import { getUserSettings } from "../lib/user-settings";
import {
  clearActiveSession,
  getActiveSession,
  saveActiveSession,
} from "../lib/active-session";
import { saveCompletedSession } from "../lib/completed-sessions";
import {
  addSetToCurrentExercise,
  createSessionFlowState,
  finishEarly,
  getCurrentExercise,
  getCurrentSet,
  getUpcomingExercise,
  getUpcomingSet,
  next,
  saveSet,
  skipUpcomingSet,
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
const wheelRowHeight = 52;

async function createInitialSessionData(
  routineId?: string,
  draftId?: string,
): Promise<CreateSessionResult | null> {
  const routineBundle = draftId
    ? await getStartWorkoutDraft(draftId)
    : routineId
      ? await getRoutineBundleById(routineId)
      : (await getRoutineBundles())[0] ?? null;

  if (!routineBundle) {
    return null;
  }

  const userSettings = await getUserSettings();
  if (draftId) {
    await clearStartWorkoutDraft();
  }

  return createSessionFromRoutine(
    routineBundle.routine,
    routineBundle.routineExercises,
    userSettings,
  );
}

function isValidActiveSessionBundle(value: unknown): value is {
  session: WorkoutSession;
  sessionExercises: SessionFlowState["sessionExercises"];
  workoutSets: SessionFlowState["workoutSets"];
  restStartTimeMs?: number | null;
  restDurationTargetSec?: number | null;
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

function getRestoredFlowState(bundle: {
  session: WorkoutSession;
  sessionExercises: SessionFlowState["sessionExercises"];
  workoutSets: SessionFlowState["workoutSets"];
  restStartTimeMs?: number | null;
  restDurationTargetSec?: number | null;
}): {
  flowState: SessionFlowState;
  restStartTimeMs: number | null;
  restDurationTargetSec: number | null;
  restEndTimeMs: number | null;
} | null {
  if (bundle.session.endedAt != null) {
    return null;
  }

  if (bundle.sessionExercises.length === 0 || bundle.workoutSets.length === 0) {
    return null;
  }

  const hasRestStart = bundle.restStartTimeMs != null;
  const hasRestDuration = bundle.restDurationTargetSec != null;

  if (hasRestStart !== hasRestDuration) {
    return null;
  }

  const orderedExercises = [...bundle.sessionExercises].sort((a, b) => a.order - b.order);
  const flatSets: Array<{
    exerciseIndex: number;
    setIndex: number;
    completedAt: string | null;
    skippedAt: string | null;
  }> = [];

  for (let exerciseIndex = 0; exerciseIndex < orderedExercises.length; exerciseIndex += 1) {
    const exercise = orderedExercises[exerciseIndex];
    const sets = bundle.workoutSets
      .filter((set) => set.sessionExerciseId === exercise.id)
      .sort((a, b) => a.setNumber - b.setNumber);

    if (sets.length === 0) {
      return null;
    }

    for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
      flatSets.push({
        exerciseIndex,
        setIndex,
        completedAt: sets[setIndex].completedAt,
        skippedAt: sets[setIndex].skippedAt,
      });
    }
  }

  const firstIncompleteIndex = flatSets.findIndex(
    (set) => set.completedAt == null && set.skippedAt == null,
  );

  if (firstIncompleteIndex === -1) {
    return null;
  }

  if (
    flatSets
      .slice(firstIncompleteIndex + 1)
      .some((set) => set.completedAt != null || set.skippedAt != null)
  ) {
    return null;
  }

  if (hasRestStart && firstIncompleteIndex === 0) {
    return null;
  }

  const currentPosition = flatSets[firstIncompleteIndex];
  const status = hasRestStart ? "resting" : "active";

  return {
    flowState: {
      ...createSessionFlowState(bundle.sessionExercises, bundle.workoutSets, status),
      currentExerciseIndex: currentPosition.exerciseIndex,
      currentSetIndex: currentPosition.setIndex,
    },
    restStartTimeMs: bundle.restStartTimeMs ?? null,
    restDurationTargetSec: bundle.restDurationTargetSec ?? null,
    restEndTimeMs:
      bundle.restStartTimeMs != null && bundle.restDurationTargetSec != null
        ? bundle.restStartTimeMs + bundle.restDurationTargetSec * 1000
        : null,
  };
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

function formatElapsedDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
  nowMs: number,
): string {
  if (!startedAt) {
    return "00:00";
  }

  const startedAtMs = new Date(startedAt).getTime();
  const endedAtMs = endedAt ? new Date(endedAt).getTime() : nowMs;

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs < startedAtMs) {
    return "00:00";
  }

  const totalSeconds = Math.floor((endedAtMs - startedAtMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

function getRemainingRestMilliseconds(
  restEndTimeMs: number | null,
  nowMs: number,
): number {
  if (restEndTimeMs == null) {
    return 0;
  }

  return Math.max(0, restEndTimeMs - nowMs);
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
  const initialParts = toRestParts(totalSeconds);
  const [minutesValue, setMinutesValue] = useState(initialParts.minutes);
  const [secondsValue, setSecondsValue] = useState(initialParts.seconds);

  useEffect(() => {
    const nextParts = toRestParts(totalSeconds);
    setMinutesValue(nextParts.minutes);
    setSecondsValue(nextParts.seconds);
  }, [totalSeconds]);

  function handleMinutesChange(minutes: number) {
    setMinutesValue(minutes);
    onChange(fromRestParts(minutes, secondsValue));
  }

  function handleSecondsChange(seconds: number) {
    setSecondsValue(seconds);
    onChange(fromRestParts(minutesValue, seconds));
  }

  return (
    <View style={styles.restWheelGroup}>
      <Text style={styles.smallWheelLabel}>{label}</Text>
      <View style={styles.restWheelRow}>
        <WheelNumberControl
          label="Min"
          value={minutesValue}
          options={createNumberRange(0, 5)}
          onChange={handleMinutesChange}
          formatValue={(value) => String(value)}
        />
        <WheelNumberControl
          label="Sec"
          value={secondsValue}
          options={secondsOptions}
          onChange={handleSecondsChange}
          formatValue={(value) => String(value).padStart(2, "0")}
        />
      </View>
    </View>
  );
}

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    routineId?: string | string[];
    draftId?: string | string[];
  }>();
  const selectedRoutineId = Array.isArray(params.routineId)
    ? params.routineId[0]
    : params.routineId;
  const selectedDraftId = Array.isArray(params.draftId)
    ? params.draftId[0]
    : params.draftId;
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
  const [isFinalFeelingOverlay, setIsFinalFeelingOverlay] = useState(false);
  const [showNextTransition, setShowNextTransition] = useState(false);
  const [sessionFeeling, setSessionFeeling] = useState<SetFeeling | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const hasAdvancedRestRef = useRef(false);
  const hasPlayedRestCompleteRef = useRef(false);
  const hasStartedNextTransitionRef = useRef(false);
  const hasSavedCompletedSessionRef = useRef(false);
  const isFinalizingSessionRef = useRef(false);
  const flowStateRef = useRef<SessionFlowState | null>(null);
  const sessionRef = useRef<WorkoutSession | null>(null);
  const restStartTimeMsRef = useRef<number | null>(null);
  const restDurationTargetSecRef = useRef<number | null>(null);
  const restCompleteSoundRef = useRef<AudioPlayer | null>(null);
  const nextTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTransitionAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTransitionBackdropOpacity = useRef(new Animated.Value(0)).current;
  const nextTransitionBackdropScale = useRef(new Animated.Value(0.94)).current;
  const nextTransitionOpacity = useRef(new Animated.Value(0)).current;
  const nextTransitionScale = useRef(new Animated.Value(0.9)).current;
  const nextExerciseOpacity = useRef(new Animated.Value(0)).current;
  const nextExerciseAccentOpacity = useRef(new Animated.Value(0.42)).current;
  const nextExerciseScale = useRef(new Animated.Value(0.9)).current;

  const currentExercise = flowState ? getCurrentExercise(flowState) : null;
  const currentSet = flowState ? getCurrentSet(flowState) : null;
  const upcomingExercise = flowState ? getUpcomingExercise(flowState) : null;
  const upcomingSet = flowState ? getUpcomingSet(flowState) : null;
  const remainingRestSec = getRemainingRestSeconds(restEndTimeMs, nowMs);
  const remainingRestMs = getRemainingRestMilliseconds(restEndTimeMs, nowMs);
  const nextTransitionLeadMs = 1200;
  const nextTransitionDurationMs = 1200;

  function startNextTransition() {
    if (hasStartedNextTransitionRef.current) {
      return;
    }

    hasStartedNextTransitionRef.current = true;
    if (!hasPlayedRestCompleteRef.current) {
      hasPlayedRestCompleteRef.current = true;
      restCompleteSoundRef.current?.seekTo(0);
      restCompleteSoundRef.current?.play();
    }
    nextTransitionBackdropOpacity.setValue(0);
    nextTransitionBackdropScale.setValue(0.94);
    nextTransitionOpacity.setValue(0);
    nextTransitionScale.setValue(0.9);
    nextExerciseOpacity.setValue(0);
    nextExerciseAccentOpacity.setValue(0.42);
    nextExerciseScale.setValue(0.9);
    setShowNextTransition(true);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(nextTransitionBackdropOpacity, {
          toValue: 0.14,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(nextTransitionBackdropOpacity, {
          toValue: 0.08,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(nextTransitionBackdropOpacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(nextTransitionBackdropScale, {
          toValue: 1.02,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(nextTransitionBackdropScale, {
          toValue: 1.08,
          duration: 340,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(nextTransitionOpacity, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.timing(nextTransitionScale, {
            toValue: 1.04,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(250),
        Animated.parallel([
          Animated.timing(nextTransitionOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(nextTransitionScale, {
            toValue: 1.08,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(nextExerciseOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.spring(nextExerciseScale, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(nextExerciseAccentOpacity, {
          toValue: 0.78,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(nextExerciseAccentOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    if (nextTransitionAdvanceTimeoutRef.current != null) {
      clearTimeout(nextTransitionAdvanceTimeoutRef.current);
      nextTransitionAdvanceTimeoutRef.current = null;
    }

    nextTransitionAdvanceTimeoutRef.current = setTimeout(() => {
      nextTransitionAdvanceTimeoutRef.current = null;

      if (hasAdvancedRestRef.current) {
        return;
      }

      hasAdvancedRestRef.current = true;
      setShowNextTransition(false);
      handleAdvanceRest();
    }, nextTransitionDurationMs);
  }

  useEffect(() => {
    const player = createAudioPlayer(
      require("../assets/sounds/lifeneverbeensoweet.mp3"),
    );
    restCompleteSoundRef.current = player;

    return () => {
      if (nextTransitionTimeoutRef.current != null) {
        clearTimeout(nextTransitionTimeoutRef.current);
        nextTransitionTimeoutRef.current = null;
      }

      if (nextTransitionAdvanceTimeoutRef.current != null) {
        clearTimeout(nextTransitionAdvanceTimeoutRef.current);
        nextTransitionAdvanceTimeoutRef.current = null;
      }

      const sound = restCompleteSoundRef.current;
      restCompleteSoundRef.current = null;

      if (sound) {
        sound.release();
      }
    };
  }, []);

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

      if (selectedRoutineId || selectedDraftId) {
        const initialSessionData = await createInitialSessionData(
          selectedRoutineId,
          selectedDraftId,
        );

        setFlowState(
          initialSessionData
            ? createSessionFlowState(
                initialSessionData.sessionExercises,
                initialSessionData.workoutSets,
                "active",
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
          const restoredState = getRestoredFlowState(savedActiveSession);

          if (restoredState) {
            setFlowState(restoredState.flowState);
            setSession(savedActiveSession.session);
            nextRestStartTimeMs = restoredState.restStartTimeMs;
            nextRestDurationTargetSec = restoredState.restDurationTargetSec;
            nextRestEndTimeMs = restoredState.restEndTimeMs;
          } else {
            await clearActiveSession();
            const initialSessionData = await createInitialSessionData();

            setFlowState(
              initialSessionData
                ? createSessionFlowState(
                    initialSessionData.sessionExercises,
                    initialSessionData.workoutSets,
                    "active",
                  )
                : null,
            );
            setSession(initialSessionData?.session ?? null);
          }
        } else {
          await clearActiveSession();
          const initialSessionData = await createInitialSessionData();

          setFlowState(
            initialSessionData
              ? createSessionFlowState(
                  initialSessionData.sessionExercises,
                  initialSessionData.workoutSets,
                  "active",
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
        setIsFinalFeelingOverlay(false);
        setShowNextTransition(false);
        hasStartedNextTransitionRef.current = false;
        setSessionFeeling(null);
        setSessionNotes("");
        hasAdvancedRestRef.current = false;
        hasPlayedRestCompleteRef.current = false;
        hasSavedCompletedSessionRef.current = false;
        isFinalizingSessionRef.current = false;
        setIsHydrating(false);
    }

    void initializeSession();

    return () => {
      isActive = false;
    };
  }, [selectedDraftId, selectedRoutineId]);

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
      if (flowState?.status !== "resting" && !isFinalFeelingOverlay) {
        setRestStartTimeMs(null);
        setRestDurationTargetSec(null);
        setRestEndTimeMs(null);
        setShowFeelingOverlay(false);
        setShowNextTransition(false);
        hasStartedNextTransitionRef.current = false;
        hasAdvancedRestRef.current = false;
        hasPlayedRestCompleteRef.current = false;
        return;
      }

    if (restStartTimeMs != null && restDurationTargetSec != null) {
      setRestEndTimeMs(restStartTimeMs + restDurationTargetSec * 1000);
      setNowMs(Date.now());
    }

      hasAdvancedRestRef.current = false;
      hasPlayedRestCompleteRef.current = false;
      setShowNextTransition(false);
      hasStartedNextTransitionRef.current = false;
    }, [
      flowState?.status,
      currentSet?.id,
    currentSet?.restSecTarget,
    isFinalFeelingOverlay,
    restDurationTargetSec,
    restStartTimeMs,
  ]);

  useEffect(() => {
    if (flowState?.status !== "resting") {
      return;
    }

    setRestPhrase(getRandomRestPhrase());
  }, [flowState?.status, currentSet?.id]);

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
    if (!session || session.endedAt != null) {
      return;
    }

    setNowMs(Date.now());
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [session?.endedAt, session?.startedAt]);

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

      if (currentFlowState.status === "finished" || currentSession.endedAt != null) {
        void clearActiveSession();
        return;
      }

      const now = Date.now();
      const currentRestStartTimeMs = restStartTimeMsRef.current;
      const currentRestDurationTargetSec = restDurationTargetSecRef.current;
      const actualRestSec =
        currentFlowState.status === "resting" && currentRestStartTimeMs != null
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
    if (
      flowState?.status !== "resting" ||
      restEndTimeMs == null ||
      hasStartedNextTransitionRef.current
    ) {
      return;
    }

    if (nextTransitionTimeoutRef.current != null) {
      clearTimeout(nextTransitionTimeoutRef.current);
      nextTransitionTimeoutRef.current = null;
    }

    const delayMs = Math.max(remainingRestMs - nextTransitionLeadMs, 0);

    if (delayMs === 0) {
      startNextTransition();
      return;
    }

    nextTransitionTimeoutRef.current = setTimeout(() => {
      nextTransitionTimeoutRef.current = null;
      startNextTransition();
    }, delayMs);

    return () => {
      if (nextTransitionTimeoutRef.current != null) {
        clearTimeout(nextTransitionTimeoutRef.current);
        nextTransitionTimeoutRef.current = null;
      }
    };
  }, [
    flowState?.status,
    remainingRestMs,
    restEndTimeMs,
  ]);

  useEffect(() => {
    if (
      flowState?.status !== "resting" ||
      remainingRestSec !== 0 ||
      hasStartedNextTransitionRef.current ||
      hasAdvancedRestRef.current
    ) {
      return;
    }

    if (nextTransitionTimeoutRef.current != null) {
      clearTimeout(nextTransitionTimeoutRef.current);
      nextTransitionTimeoutRef.current = null;
    }

    startNextTransition();
  }, [flowState?.status, remainingRestSec]);

  useEffect(() => {
    if (flowState?.status !== "finished" || !session || hasSavedCompletedSessionRef.current) {
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
  }, [flowState?.status, flowState?.sessionExercises, flowState?.workoutSets, session]);

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
    if (!flowState || !currentSet || flowState.status !== "active") {
      return;
    }

    const isFinalSet = getUpcomingSet(flowState) == null;
    const nextState = saveSet(flowState, {
      reps: currentSet.metricType === "reps" ? mainValue : null,
      durationSec: currentSet.metricType === "duration" ? mainValue : null,
      feeling: null,
    });

    const now = Date.now();

    if (isFinalSet) {
      const nextActiveState = {
        ...nextState,
        status: "active" as const,
      };

      setFlowState(nextActiveState);
      setRestStartTimeMs(null);
      setRestDurationTargetSec(null);
        setRestEndTimeMs(null);
        setNowMs(now);
        setIsFinalFeelingOverlay(true);
        setShowNextTransition(false);
        hasStartedNextTransitionRef.current = false;
        hasAdvancedRestRef.current = false;
        hasPlayedRestCompleteRef.current = false;
        setShowFeelingOverlay(true);
      if (session) {
        void saveActiveSession({
          session,
          sessionExercises: nextActiveState.sessionExercises,
          workoutSets: nextActiveState.workoutSets,
          restStartTimeMs: null,
          restDurationTargetSec: null,
        });
      }
      return;
    }

    const restDurationSec = clamp(currentRestValue, 0, 300);
    const nextRestEndTimeMs = now + restDurationSec * 1000;

    setFlowState(nextState);
    setRestStartTimeMs(now);
    setRestDurationTargetSec(restDurationSec);
    setRestEndTimeMs(nextRestEndTimeMs);
    setNowMs(now);
    setIsFinalFeelingOverlay(false);
    setShowNextTransition(false);
    hasStartedNextTransitionRef.current = false;
    hasAdvancedRestRef.current = false;
    hasPlayedRestCompleteRef.current = false;
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

    if (isFinalFeelingOverlay) {
      setFlowState((current) => {
        if (!current) {
          return current;
        }

        return next(updateCurrentSetFeeling({ ...current, status: "resting" }, feeling));
      });
      setIsFinalFeelingOverlay(false);
      setShowFeelingOverlay(false);
      return;
    }

    setFlowState((current) =>
      current ? updateCurrentSetFeeling(current, feeling) : current,
    );
    setShowFeelingOverlay(false);
  }

  function handleDismissFeeling() {
    if (isFinalFeelingOverlay) {
      setFlowState((current) => (current ? next(current) : current));
      setIsFinalFeelingOverlay(false);
    }

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
    setIsFinalFeelingOverlay(false);
    setShowNextTransition(false);
    if (nextTransitionAdvanceTimeoutRef.current != null) {
      clearTimeout(nextTransitionAdvanceTimeoutRef.current);
      nextTransitionAdvanceTimeoutRef.current = null;
    }
    hasStartedNextTransitionRef.current = false;
    hasAdvancedRestRef.current = false;
    setFlowState(nextFlowState);
    if (session && nextFlowState.status !== "finished") {
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
    hasPlayedRestCompleteRef.current = false;
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

  function handleSkipNextSet() {
    if (!flowState || !session || !upcomingSet) {
      return;
    }

    const nextFlowState = skipUpcomingSet(flowState);

    setFlowState(nextFlowState);
    void saveActiveSession({
      session,
      sessionExercises: nextFlowState.sessionExercises,
      workoutSets: nextFlowState.workoutSets,
      restStartTimeMs,
      restDurationTargetSec,
    });
  }

  function handleAddSet() {
    if (!flowState || !session) {
      return;
    }

    const nextFlowState = addSetToCurrentExercise(flowState);

    setFlowState(nextFlowState);
    void saveActiveSession({
      session,
      sessionExercises: nextFlowState.sessionExercises,
      workoutSets: nextFlowState.workoutSets,
      restStartTimeMs,
      restDurationTargetSec,
    });
  }

  function handleFinishEarly() {
    if (!flowState) {
      return;
    }

    const nextFlowState = finishEarly(flowState);

    setShowFeelingOverlay(false);
    setRestStartTimeMs(null);
    setRestDurationTargetSec(null);
    setRestEndTimeMs(null);
    setNowMs(Date.now());
    setIsFinalFeelingOverlay(false);
    setShowNextTransition(false);
    hasStartedNextTransitionRef.current = false;
    hasAdvancedRestRef.current = false;
    hasPlayedRestCompleteRef.current = false;
    setFlowState(nextFlowState);
    void clearActiveSession();
  }

  async function handleFinishSessionPress() {
    if (!flowState || !session || isFinalizingSessionRef.current) {
      return;
    }

    isFinalizingSessionRef.current = true;

    const completedSession: WorkoutSession = {
      ...session,
      endedAt: session.endedAt ?? new Date().toISOString(),
      feeling: sessionFeeling,
      notes: sessionNotes.trim() || null,
    };

    setSession(completedSession);
    await saveCompletedSession(
      completedSession,
      flowState.sessionExercises,
      flowState.workoutSets,
    );
    await clearActiveSession();
    router.replace("/");
  }

  if (!flowState) {
    return (
      <View style={styles.container}>
        <Text>{isHydrating ? "Loading workout..." : "No routine available."}</Text>
      </View>
    );
  }

  const completedSetsCount = flowState.workoutSets.filter((set) => set.completedAt != null).length;
  const completedExercisesCount = flowState.sessionExercises.filter((exercise) =>
    flowState.workoutSets
      .filter((set) => set.sessionExerciseId === exercise.id)
      .every((set) => set.completedAt != null),
  ).length;
  const sessionDuration = formatElapsedDuration(
    session?.startedAt,
    session?.endedAt,
    nowMs,
  );

  if (flowState.status === "finished" || !currentExercise || !currentSet) {
    return (
      <View style={styles.container}>
        <View style={styles.completionScreen}>
          <Text style={styles.title}>Workout complete</Text>
          <Text style={styles.completionStat}>Total duration: {sessionDuration}</Text>
          <Text style={styles.completionStat}>
            Exercises completed: {completedExercisesCount}
          </Text>
          <Text style={styles.completionStat}>Sets completed: {completedSetsCount}</Text>

          <View style={styles.completionSection}>
            <Text style={styles.smallWheelLabel}>Session feeling</Text>
            <View style={styles.feelingsGrid}>
              {feelingOptions.map((option) => {
                const isSelected = sessionFeeling === option.value;

                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.feelingButton,
                      isSelected && styles.feelingButtonSelected,
                    ]}
                    onPress={() => setSessionFeeling(option.value)}
                  >
                    <Text style={styles.feelingText}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.completionSection}>
            <Text style={styles.smallWheelLabel}>Session notes</Text>
            <TextInput
              style={styles.notesInput}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="Add a note"
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.bottomSection}>
            <Pressable style={styles.primaryButton} onPress={handleFinishSessionPress}>
              <Text style={styles.primaryButtonText}>Finish</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const exerciseName = getExerciseDisplayName(currentExercise.exerciseId);
  const totalSets = currentExercise.targetSets;
  const mainLabel = currentSet.metricType === "reps" ? "REPS" : "SECONDS";
  const mainOptions =
    currentSet.metricType === "reps"
      ? createNumberRange(0, 30)
      : createNumberRange(0, 300);
  const nextExerciseLabel = upcomingExercise
    ? upcomingExercise.id === currentExercise.id
      ? `Next: ${getExerciseDisplayName(upcomingExercise.exerciseId)}`
      : `Next exercise: ${getExerciseDisplayName(upcomingExercise.exerciseId)}`
    : "Next: Finish workout";
  const nextTransitionLabel = upcomingExercise
    ? getExerciseDisplayName(upcomingExercise.exerciseId)
    : "Finish";

  if (flowState.status === "resting") {
    return (
      <View style={styles.container}>
          <View style={styles.restScreen}>
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
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

            <View style={styles.timerControlsRow}>
              <Pressable
                style={[styles.timerControl, !upcomingSet && styles.timerControlDisabled]}
                onPress={handleSkipNextSet}
                disabled={!upcomingSet}
              >
                <Text style={styles.timerControlText}>Skip next set</Text>
              </Pressable>
              <Pressable style={styles.timerControl} onPress={handleAddSet}>
                <Text style={styles.timerControlText}>Add set</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.secondaryAction} onPress={handleFinishEarly}>
            <Text style={styles.secondaryActionText}>Finish early</Text>
          </Pressable>

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
        {showNextTransition ? (
          <Animated.View
            pointerEvents="none"
            style={styles.nextTransition}
          >
            <Animated.View
              style={[
                styles.nextTransitionBackdrop,
                {
                  opacity: nextTransitionBackdropOpacity,
                  transform: [{ scale: nextTransitionBackdropScale }],
                },
              ]}
            />
            <Animated.Text
              style={[
                styles.nextTransitionText,
                {
                  opacity: nextTransitionOpacity,
                  transform: [{ scale: nextTransitionScale }],
                },
              ]}
            >
              NEXT
            </Animated.Text>
            <View style={styles.nextTransitionNameWrap}>
              <Animated.Text
                style={[
                  styles.nextTransitionNameAccentText,
                  { opacity: nextExerciseAccentOpacity },
                ]}
              >
                {nextTransitionLabel}
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.nextTransitionNameText,
                  {
                    opacity: nextExerciseOpacity,
                    transform: [{ scale: nextExerciseScale }],
                  },
                ]}
              >
                {nextTransitionLabel}
              </Animated.Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{exerciseName}</Text>
              <Text style={styles.subtitle}>
                {currentSet.setNumber}/{totalSets}
              </Text>
            </View>
          </View>
          <Pressable style={styles.headerUtilityButton} onPress={handleFinishEarly}>
            <Text style={styles.headerUtilityText}>Finish early</Text>
          </Pressable>
        </View>
        <Text style={styles.sessionTimer}>Time {sessionDuration}</Text>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 0,
    backgroundColor: AppColors.surface,
  },
  topSection: {
    paddingTop: 34,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  centerSection: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 8,
  },
  bottomSection: {
    marginHorizontal: -20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 44,
    fontWeight: "700",
    color: AppColors.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 24,
    color: AppColors.mutedText,
    fontWeight: "700",
  },
  sessionTimer: {
    fontSize: 20,
    color: AppColors.mutedText,
    marginTop: 10,
    marginBottom: 12,
  },
  headerUtilityButton: {
    marginTop: 12,
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AppColors.text,
  },
  headerUtilityText: {
    fontSize: 13,
    color: AppColors.surface,
    fontWeight: "700",
  },
  topWheelRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  smallWheelContainer: {
    flex: 1,
    alignItems: "center",
  },
  bigWheelContainer: {
    alignItems: "center",
    width: "100%",
  },
  smallWheelLabel: {
    fontSize: 10,
    color: AppColors.mutedText,
    marginBottom: 6,
    letterSpacing: 0.2,
    fontWeight: "500",
  },
  bigWheelLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
    marginBottom: 8,
    color: AppColors.mutedText,
    fontWeight: "500",
  },
  smallWheelViewport: {
    height: wheelRowHeight * 3,
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bigWheelViewport: {
    height: wheelRowHeight * 3 + 24,
    width: "100%",
    minWidth: 260,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  wheelTrack: {
    alignItems: "center",
    justifyContent: "center",
  },
  smallWheelSideValue: {
    height: wheelRowHeight,
    fontSize: 17,
    color: AppColors.mutedText,
    opacity: 0.4,
    textAlignVertical: "center",
    lineHeight: wheelRowHeight,
  },
  smallWheelCenterValue: {
    height: wheelRowHeight,
    fontSize: 38,
    fontWeight: "800",
    lineHeight: wheelRowHeight,
    color: AppColors.text,
  },
  bigWheelSideValue: {
    height: wheelRowHeight + 12,
    fontSize: 32,
    color: AppColors.mutedText,
    opacity: 0.24,
    lineHeight: wheelRowHeight + 12,
  },
  bigWheelCenterValue: {
    height: wheelRowHeight + 12,
    fontSize: 84,
    fontWeight: "800",
    lineHeight: wheelRowHeight + 12,
    color: AppColors.text,
  },
  restWheelGroup: {
    marginTop: 0,
  },
  completionScreen: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  completionSection: {
    gap: 10,
  },
  completionStat: {
    fontSize: 18,
    color: AppColors.mutedText,
  },
  notesInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
    backgroundColor: AppColors.surface,
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
    backgroundColor: AppColors.surface,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  topBarText: {
    color: AppColors.text,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  restCenter: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 10,
    paddingHorizontal: 24,
  },
  restQuote: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: AppColors.mutedText,
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
    color: AppColors.text,
  },
  timerControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    minHeight: 44,
    alignItems: "center",
  },
  timerControl: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#f5f5f5",
    minWidth: 120,
    alignItems: "center",
  },
  timerControlDisabled: {
    opacity: 0.45,
  },
  timerControlText: {
    fontSize: 16,
    color: AppColors.text,
    fontWeight: "600",
  },
  skipBar: {
    backgroundColor: AppColors.text,
    paddingVertical: 18,
    alignItems: "center",
    marginHorizontal: 0,
  },
  skipBarText: {
    color: AppColors.surface,
    fontSize: 22,
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: AppColors.accent,
    paddingVertical: 22,
    alignItems: "center",
    borderRadius: 0,
    marginHorizontal: -20,
  },
  secondaryAction: {
    alignItems: "center",
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: AppColors.accentText,
    fontSize: 20,
    fontWeight: "600",
  },
  secondaryActionText: {
    fontSize: 13,
    color: AppColors.mutedText,
    fontWeight: "600",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 20,
    justifyContent: "center",
  },
  overlayTitle: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
    color: AppColors.text,
  },
  feelingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  feelingButton: {
    width: "48%",
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 18,
    backgroundColor: AppColors.surface,
    paddingVertical: 18,
    alignItems: "center",
  },
  feelingButtonSelected: {
    backgroundColor: "#f3f4f4",
    borderColor: AppColors.text,
  },
  feelingText: {
    fontSize: 16,
    color: AppColors.text,
    fontWeight: "600",
  },
  skipButton: {
    alignSelf: "center",
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: AppColors.mutedText,
  },
  nextTransition: {
    position: "absolute",
    inset: 0,
    backgroundColor: AppColors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  nextTransitionBackdrop: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  nextTransitionText: {
    fontSize: 82,
    fontWeight: "900",
    letterSpacing: 2.6,
    color: AppColors.accentText,
  },
  nextTransitionNameWrap: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  nextTransitionNameText: {
    fontSize: 40,
    fontWeight: "800",
    textAlign: "center",
    color: AppColors.accentText,
    letterSpacing: 0.5,
  },
  nextTransitionNameAccentText: {
    position: "absolute",
    fontSize: 40,
    fontWeight: "800",
    textAlign: "center",
    color: AppColors.accentText,
    letterSpacing: 0.5,
  },
});
