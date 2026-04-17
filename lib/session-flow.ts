import type {
  SetFeeling,
  SetVariant,
  SessionExercise,
  WorkoutSetPerformance,
  WorkoutSetPlan,
  WorkoutSetRest,
  WorkoutSet,
} from "../types/workout";
import type { ActiveSessionFlowSnapshot } from "./active-session";

export type SessionFlowPhase = "in_set" | "rest" | "between_exercises" | "finished";

export interface SessionFlowState {
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
  currentExerciseId: string | null;
  currentSetId: string | null;
  phase: SessionFlowPhase;
}

interface SaveSetInput {
  reps?: number | null;
  durationSec?: number | null;
  feeling?: SetFeeling | null;
  weightKg?: number | null;
  variant?: SetVariant;
}

interface SetPosition {
  exerciseIndex: number;
  setIndex: number;
}

function getOrderedSessionExercises(
  sessionExercises: SessionExercise[],
): SessionExercise[] {
  return [...sessionExercises].sort((a, b) => a.order - b.order);
}

function getExerciseSets(
  workoutSets: WorkoutSet[],
  sessionExerciseId: string,
): WorkoutSet[] {
  return workoutSets
    .filter((set) => set.sessionExerciseId === sessionExerciseId)
    .sort((a, b) => a.setNumber - b.setNumber);
}

function updateWorkoutSet(
  workoutSets: WorkoutSet[],
  setId: string,
  updater: (set: WorkoutSet) => WorkoutSet,
): WorkoutSet[] {
  return workoutSets.map((set) => (set.id === setId ? updater(set) : set));
}

function updateWorkoutSets(
  workoutSets: WorkoutSet[],
  matcher: (set: WorkoutSet) => boolean,
  updater: (set: WorkoutSet) => WorkoutSet,
): WorkoutSet[] {
  return workoutSets.map((set) => (matcher(set) ? updater(set) : set));
}

function createUpdatedWorkoutSet(
  set: WorkoutSet,
  updates: Partial<Omit<WorkoutSet, "plan" | "performed" | "rest">> & {
    plan?: Partial<WorkoutSetPlan>;
    performed?: Partial<WorkoutSetPerformance>;
    rest?: Partial<WorkoutSetRest>;
  },
): WorkoutSet {
  const nextStatus =
    updates.status ??
    (updates.completedAt != null
      ? "completed"
      : updates.skippedAt != null
        ? "skipped"
        : set.status);
  const nextCompletedAt = updates.completedAt ?? set.completedAt;
  const nextSkippedAt = updates.skippedAt ?? set.skippedAt;
  const nextVariant = updates.variant ?? set.variant;
  const nextPlan = {
    ...set.plan,
    ...(updates.plan ?? {}),
    variant: updates.plan?.variant ?? nextVariant,
  };
  const nextPerformed = {
    ...set.performed,
    ...(updates.performed ?? {}),
  };
  const nextRest = {
    ...set.rest,
    ...(updates.rest ?? {}),
  };

  return {
    ...set,
    ...updates,
    status: nextStatus,
    plan: nextPlan,
    performed: nextPerformed,
    rest: nextRest,
    variant: nextVariant,
    completedAt: nextCompletedAt,
    skippedAt: nextSkippedAt,
  };
}

function createCompletedRestState(
  set: WorkoutSet,
  startedAt: string,
): WorkoutSetRest {
  return {
    ...set.rest,
    targetSec: set.rest.targetSec ?? null,
    actualSec: null,
    startedAt,
    endedAt: null,
  };
}

function createEndedRestState(
  set: WorkoutSet,
  actualSec: number | null,
  endedAt: string | null,
): WorkoutSetRest {
  return {
    ...set.rest,
    targetSec: set.rest.targetSec ?? null,
    actualSec,
    startedAt: set.rest.startedAt ?? set.completedAt,
    endedAt,
  };
}

function isSetUnavailable(set: WorkoutSet): boolean {
  return set.status !== "pending" || set.completedAt != null || set.skippedAt != null;
}

function getSetPositionById(state: SessionFlowState): SetPosition | null {
  if (!state.currentExerciseId || !state.currentSetId) {
    return null;
  }

  const exerciseIndex = state.sessionExercises.findIndex(
    (exercise) => exercise.id === state.currentExerciseId,
  );

  if (exerciseIndex === -1) {
    return null;
  }

  const sets = getExerciseSets(state.workoutSets, state.currentExerciseId);
  const setIndex = sets.findIndex((set) => set.id === state.currentSetId);

  if (setIndex === -1) {
    return null;
  }

  return { exerciseIndex, setIndex };
}

function findNextPendingPosition(
  state: SessionFlowState,
  fromPosition: SetPosition | null,
): SetPosition | null {
  const startExerciseIndex = fromPosition?.exerciseIndex ?? 0;

  for (
    let exerciseIndex = startExerciseIndex;
    exerciseIndex < state.sessionExercises.length;
    exerciseIndex += 1
  ) {
    const exercise = state.sessionExercises[exerciseIndex];
    const sets = getExerciseSets(state.workoutSets, exercise.id);
    const startSetIndex =
      fromPosition != null && exerciseIndex === fromPosition.exerciseIndex
        ? fromPosition.setIndex + 1
        : 0;

    for (let setIndex = startSetIndex; setIndex < sets.length; setIndex += 1) {
      if (!isSetUnavailable(sets[setIndex])) {
        return {
          exerciseIndex,
          setIndex,
        };
      }
    }
  }

  return null;
}

function findFirstPendingPosition(state: SessionFlowState): SetPosition | null {
  return findNextPendingPosition(state, null);
}

function getSetAtPosition(
  state: SessionFlowState,
  position: SetPosition | null,
): WorkoutSet | null {
  if (!position) {
    return null;
  }

  const exercise = state.sessionExercises[position.exerciseIndex];

  if (!exercise) {
    return null;
  }

  const sets = getExerciseSets(state.workoutSets, exercise.id);
  return sets[position.setIndex] ?? null;
}

function getExerciseAtPosition(
  state: SessionFlowState,
  position: SetPosition | null,
): SessionExercise | null {
  if (!position) {
    return null;
  }

  return state.sessionExercises[position.exerciseIndex] ?? null;
}

function getNextPendingPosition(state: SessionFlowState): SetPosition | null {
  return findNextPendingPosition(state, getSetPositionById(state));
}

function createCursorState(
  state: SessionFlowState,
  position: SetPosition | null,
  phase: SessionFlowPhase,
): SessionFlowState {
  const exercise = getExerciseAtPosition(state, position);
  const set = getSetAtPosition(state, position);

  return {
    ...state,
    currentExerciseId: exercise?.id ?? null,
    currentSetId: set?.id ?? null,
    phase,
  };
}

function getRestPhaseForCurrentSet(state: SessionFlowState): Extract<
  SessionFlowPhase,
  "rest" | "between_exercises"
> {
  const currentPosition = getSetPositionById(state);
  const upcomingPosition = getNextPendingPosition(state);

  if (
    currentPosition &&
    upcomingPosition &&
    upcomingPosition.exerciseIndex !== currentPosition.exerciseIndex
  ) {
    return "between_exercises";
  }

  return "rest";
}

export function isRestPhase(
  phase: SessionFlowPhase,
): phase is "rest" | "between_exercises" {
  return phase === "rest" || phase === "between_exercises";
}

export function createSessionFlowState(
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
  phase: SessionFlowPhase = "in_set",
): SessionFlowState {
  const orderedExercises = getOrderedSessionExercises(sessionExercises);
  const baseState: SessionFlowState = {
    sessionExercises: orderedExercises,
    workoutSets: [...workoutSets],
    currentExerciseId: null,
    currentSetId: null,
    phase: "finished",
  };
  const firstPendingPosition = findFirstPendingPosition(baseState);

  if (!firstPendingPosition) {
    return baseState;
  }

  return createCursorState(baseState, firstPendingPosition, phase);
}

export function createSessionFlowStateFromSnapshot(
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
  snapshot: ActiveSessionFlowSnapshot,
): SessionFlowState {
  const baseState: SessionFlowState = {
    sessionExercises: getOrderedSessionExercises(sessionExercises),
    workoutSets: [...workoutSets],
    currentExerciseId: snapshot.currentExerciseId,
    currentSetId: snapshot.currentSetId,
    phase: snapshot.phase,
  };

  return getSetPositionById(baseState)
    ? baseState
    : createSessionFlowState(sessionExercises, workoutSets, snapshot.phase);
}

export function createSessionFlowSnapshot(
  state: SessionFlowState,
): ActiveSessionFlowSnapshot | null {
  if (
    state.phase === "finished" ||
    !state.currentExerciseId ||
    !state.currentSetId
  ) {
    return null;
  }

  return {
    phase: state.phase,
    currentExerciseId: state.currentExerciseId,
    currentSetId: state.currentSetId,
  };
}

export function getCurrentExercise(
  state: SessionFlowState,
): SessionExercise | null {
  return getExerciseAtPosition(state, getSetPositionById(state));
}

export function getCurrentSet(state: SessionFlowState): WorkoutSet | null {
  return getSetAtPosition(state, getSetPositionById(state));
}

export function getUpcomingExercise(
  state: SessionFlowState,
): SessionExercise | null {
  return getExerciseAtPosition(state, getNextPendingPosition(state));
}

export function getUpcomingSet(state: SessionFlowState): WorkoutSet | null {
  return getSetAtPosition(state, getNextPendingPosition(state));
}

export function updateCurrentSetWeight(
  state: SessionFlowState,
  weightKg: number | null,
): SessionFlowState {
  const currentSet = getCurrentSet(state);
  const currentExercise = getCurrentExercise(state);
  const currentPosition = getSetPositionById(state);

  if (!currentSet || !currentExercise || !currentPosition) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSets(
      state.workoutSets,
      (set) =>
        set.sessionExerciseId === currentExercise.id &&
        set.setNumber >= currentSet.setNumber &&
        set.status === "pending",
      (set) =>
        createUpdatedWorkoutSet(set, {
          plan: { weightKg },
        }),
    ),
  };
}

export function updateCurrentSetRest(
  state: SessionFlowState,
  restTargetSec: number | null,
): SessionFlowState {
  const currentSet = getCurrentSet(state);

  if (!currentSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, currentSet.id, (set) =>
      createUpdatedWorkoutSet(set, {
        rest: { targetSec: restTargetSec },
      }),
    ),
  };
}

export function updateCurrentSetActualRest(
  state: SessionFlowState,
  actualRestSec: number | null,
): SessionFlowState {
  const currentSet = getCurrentSet(state);

  if (!currentSet) {
    return state;
  }

  const restEndedAt = isRestPhase(state.phase) ? new Date().toISOString() : null;

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, currentSet.id, (set) =>
      createUpdatedWorkoutSet(set, {
        rest: createEndedRestState(set, actualRestSec, restEndedAt),
      }),
    ),
  };
}

export function updateCurrentSetFeeling(
  state: SessionFlowState,
  feeling: SetFeeling | null,
): SessionFlowState {
  if (!isRestPhase(state.phase)) {
    return state;
  }

  const currentSet = getCurrentSet(state);

  if (!currentSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, currentSet.id, (set) =>
      createUpdatedWorkoutSet(set, {
        performed: { feeling },
      }),
    ),
  };
}

export function saveSet(
  state: SessionFlowState,
  input: SaveSetInput,
): SessionFlowState {
  if (isRestPhase(state.phase)) {
    return state;
  }

  const currentSet = getCurrentSet(state);

  if (!currentSet || state.phase === "finished") {
    return state;
  }

  const completedAt = new Date().toISOString();
  const nextWorkoutSets = updateWorkoutSet(state.workoutSets, currentSet.id, (set) => {
    if (set.metricType === "reps") {
      return createUpdatedWorkoutSet(set, {
        status: "completed",
        variant: input.variant ?? set.variant,
        completedAt,
        skippedAt: null,
        performed: {
          reps: input.reps ?? null,
          durationSec: null,
          weightKg: input.weightKg ?? null,
          feeling: input.feeling ?? null,
        },
        rest: createCompletedRestState(set, completedAt),
      });
    }

    return createUpdatedWorkoutSet(set, {
      status: "completed",
      variant: input.variant ?? set.variant,
      completedAt,
      skippedAt: null,
      performed: {
        reps: null,
        durationSec: input.durationSec ?? null,
        weightKg: input.weightKg ?? null,
        feeling: input.feeling ?? null,
      },
      rest: createCompletedRestState(set, completedAt),
    });
  });

  const nextState = {
    ...state,
    workoutSets: nextWorkoutSets,
  };

  return {
    ...nextState,
    phase: getRestPhaseForCurrentSet(nextState),
  };
}

export function next(state: SessionFlowState): SessionFlowState {
  if (state.phase === "finished") {
    return state;
  }

  const upcomingPosition = getNextPendingPosition(state);

  if (!upcomingPosition) {
    return {
      ...state,
      phase: "finished",
      currentExerciseId: null,
      currentSetId: null,
    };
  }

  return createCursorState(state, upcomingPosition, "in_set");
}

export function finishEarly(state: SessionFlowState): SessionFlowState {
  if (state.phase === "finished") {
    return state;
  }

  return {
    ...state,
    phase: "finished",
    currentExerciseId: null,
    currentSetId: null,
  };
}

export function skipUpcomingSet(state: SessionFlowState): SessionFlowState {
  if (!isRestPhase(state.phase)) {
    return state;
  }

  const upcomingSet = getUpcomingSet(state);

  if (!upcomingSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, upcomingSet.id, (set) =>
      createUpdatedWorkoutSet(set, {
        status: "skipped",
        skippedAt: new Date().toISOString(),
      }),
    ),
  };
}

export function addSetToCurrentExercise(state: SessionFlowState): SessionFlowState {
  if (!isRestPhase(state.phase)) {
    return state;
  }

  const currentExercise = getCurrentExercise(state);
  const currentSet = getCurrentSet(state);

  if (!currentExercise || !currentSet) {
    return state;
  }

  const exerciseSets = getExerciseSets(state.workoutSets, currentExercise.id);
  const nextSetNumber = exerciseSets.length + 1;
  const nowIso = new Date().toISOString();
  const newSet: WorkoutSet = {
    id: `ws_${currentExercise.id}_${nextSetNumber}_${Date.now()}`,
    sessionExerciseId: currentExercise.id,
    setNumber: nextSetNumber,
    metricType: currentSet.metricType,
    status: "pending",
    plan: {
      ...currentSet.plan,
      weightKg: currentSet.plan.weightKg ?? null,
      restSec: currentSet.plan.restSec ?? null,
      variant: currentSet.variant,
    },
    performed: {
      reps: null,
      durationSec: null,
      weightKg: null,
      feeling: null,
    },
    rest: {
      targetSec: currentSet.rest.targetSec ?? null,
      actualSec: null,
      startedAt: null,
      endedAt: null,
    },
    createdAt: nowIso,
    completedAt: null,
    skippedAt: null,
    variant: currentSet.variant,
  };

  return {
    ...state,
    workoutSets: [...state.workoutSets, newSet],
  };
}
