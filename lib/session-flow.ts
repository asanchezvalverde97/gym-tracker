import type {
  SetFeeling,
  SetVariant,
  SessionExercise,
  WorkoutSet,
} from "../types/workout";

export interface SessionFlowState {
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  status: "active" | "resting" | "finished";
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

function isSetUnavailable(set: WorkoutSet): boolean {
  return set.completedAt != null || set.skippedAt != null;
}

export function createSessionFlowState(
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
  status: SessionFlowState["status"] = "active",
): SessionFlowState {
  return {
    sessionExercises: getOrderedSessionExercises(sessionExercises),
    workoutSets: [...workoutSets],
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    status: sessionExercises.length === 0 ? "finished" : status,
  };
}

export function getCurrentExercise(
  state: SessionFlowState,
): SessionExercise | null {
  if (state.status === "finished") {
    return null;
  }

  return state.sessionExercises[state.currentExerciseIndex] ?? null;
}

export function getCurrentSet(state: SessionFlowState): WorkoutSet | null {
  const currentExercise = getCurrentExercise(state);

  if (!currentExercise) {
    return null;
  }

  const sets = getExerciseSets(state.workoutSets, currentExercise.id);

  return sets[state.currentSetIndex] ?? null;
}

function getUpcomingPosition(state: SessionFlowState): SetPosition | null {
  for (
    let exerciseIndex = state.currentExerciseIndex;
    exerciseIndex < state.sessionExercises.length;
    exerciseIndex += 1
  ) {
    const exercise = state.sessionExercises[exerciseIndex];
    const sets = getExerciseSets(state.workoutSets, exercise.id);
    const startSetIndex =
      exerciseIndex === state.currentExerciseIndex ? state.currentSetIndex + 1 : 0;

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

export function getUpcomingExercise(
  state: SessionFlowState,
): SessionExercise | null {
  const upcomingPosition = getUpcomingPosition(state);

  if (!upcomingPosition) {
    return null;
  }

  return state.sessionExercises[upcomingPosition.exerciseIndex] ?? null;
}

export function getUpcomingSet(state: SessionFlowState): WorkoutSet | null {
  const upcomingPosition = getUpcomingPosition(state);

  if (!upcomingPosition) {
    return null;
  }

  const upcomingExercise = state.sessionExercises[upcomingPosition.exerciseIndex];
  const sets = getExerciseSets(state.workoutSets, upcomingExercise.id);

  return sets[upcomingPosition.setIndex] ?? null;
}

export function updateCurrentSetWeight(
  state: SessionFlowState,
  weightKg: number | null,
): SessionFlowState {
  const currentSet = getCurrentSet(state);

  if (!currentSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, currentSet.id, (set) => ({
      ...set,
      weightKg,
    })),
  };
}

export function updateCurrentSetRest(
  state: SessionFlowState,
  restSecTarget: number | null,
): SessionFlowState {
  const currentSet = getCurrentSet(state);

  if (!currentSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, currentSet.id, (set) => ({
      ...set,
      restSecTarget,
    })),
  };
}

export function updateCurrentSetActualRest(
  state: SessionFlowState,
  restSecActual: number | null,
): SessionFlowState {
  const currentSet = getCurrentSet(state);

  if (!currentSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, currentSet.id, (set) => ({
      ...set,
      restSecActual,
    })),
  };
}

export function updateCurrentSetFeeling(
  state: SessionFlowState,
  feeling: SetFeeling | null,
): SessionFlowState {
  if (state.status !== "resting") {
    return state;
  }

  const currentSet = getCurrentSet(state);

  if (!currentSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, currentSet.id, (set) => ({
      ...set,
      feeling,
    })),
  };
}

export function saveSet(
  state: SessionFlowState,
  input: SaveSetInput,
): SessionFlowState {
  if (state.status === "resting") {
    return state;
  }

  const currentSet = getCurrentSet(state);

  if (!currentSet || state.status === "finished") {
    return state;
  }

  const nextWorkoutSets = updateWorkoutSet(state.workoutSets, currentSet.id, (set) => {
    const completedAt = new Date().toISOString();

    if (set.metricType === "reps") {
      return {
        ...set,
        reps: input.reps ?? null,
        durationSec: null,
        feeling: input.feeling ?? null,
        weightKg: input.weightKg ?? set.weightKg ?? null,
        variant: input.variant ?? set.variant,
        completedAt,
        skippedAt: null,
      };
    }

    return {
      ...set,
      reps: null,
      durationSec: input.durationSec ?? null,
      feeling: input.feeling ?? null,
      weightKg: input.weightKg ?? set.weightKg ?? null,
      variant: input.variant ?? set.variant,
      completedAt,
      skippedAt: null,
    };
  });

  return {
    ...state,
    workoutSets: nextWorkoutSets,
    status: "resting",
  };
}

export function next(state: SessionFlowState): SessionFlowState {
  if (state.status === "finished") {
    return state;
  }

  const upcomingPosition = getUpcomingPosition(state);

  if (!upcomingPosition) {
    return {
      ...state,
      status: "finished",
    };
  }

  return {
    ...state,
    currentExerciseIndex: upcomingPosition.exerciseIndex,
    currentSetIndex: upcomingPosition.setIndex,
    status: "active",
  };
}

export function finishEarly(state: SessionFlowState): SessionFlowState {
  if (state.status === "finished") {
    return state;
  }

  return {
    ...state,
    status: "finished",
  };
}

export function updateNextSetWeight(
  state: SessionFlowState,
  weightKg: number | null,
): SessionFlowState {
  const upcomingSet = getUpcomingSet(state);

  if (!upcomingSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, upcomingSet.id, (set) => ({
      ...set,
      weightKg,
    })),
  };
}

export function updateNextSetRest(
  state: SessionFlowState,
  restSecTarget: number | null,
): SessionFlowState {
  const upcomingSet = getUpcomingSet(state);

  if (!upcomingSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, upcomingSet.id, (set) => ({
      ...set,
      restSecTarget,
    })),
  };
}

export function skipUpcomingSet(state: SessionFlowState): SessionFlowState {
  if (state.status !== "resting") {
    return state;
  }

  const upcomingSet = getUpcomingSet(state);

  if (!upcomingSet) {
    return state;
  }

  return {
    ...state,
    workoutSets: updateWorkoutSet(state.workoutSets, upcomingSet.id, (set) => ({
      ...set,
      skippedAt: new Date().toISOString(),
    })),
  };
}

export function addSetToCurrentExercise(state: SessionFlowState): SessionFlowState {
  if (state.status !== "resting") {
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
    variant: currentSet.variant,
    reps: null,
    durationSec: null,
    weightKg: currentSet.weightKg ?? null,
    restSecTarget: currentSet.restSecTarget ?? null,
    restSecActual: null,
    feeling: null,
    completedAt: null,
    skippedAt: null,
    createdAt: nowIso,
  };

  return {
    ...state,
    workoutSets: [...state.workoutSets, newSet],
  };
}
