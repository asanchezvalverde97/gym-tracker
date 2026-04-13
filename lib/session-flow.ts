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
  isResting: boolean;
  isFinished: boolean;
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

export function createSessionFlowState(
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
): SessionFlowState {
  return {
    sessionExercises: getOrderedSessionExercises(sessionExercises),
    workoutSets: [...workoutSets],
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    isResting: false,
    isFinished: sessionExercises.length === 0,
  };
}

export function getCurrentExercise(
  state: SessionFlowState,
): SessionExercise | null {
  if (state.isFinished) {
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
  const currentExercise = getCurrentExercise(state);
  const currentSets = currentExercise
    ? getExerciseSets(state.workoutSets, currentExercise.id)
    : [];

  if (!currentExercise || currentSets.length === 0) {
    return null;
  }

  if (state.currentSetIndex < currentSets.length - 1) {
    return {
      exerciseIndex: state.currentExerciseIndex,
      setIndex: state.currentSetIndex + 1,
    };
  }

  if (state.currentExerciseIndex < state.sessionExercises.length - 1) {
    return {
      exerciseIndex: state.currentExerciseIndex + 1,
      setIndex: 0,
    };
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
  if (!state.isResting) {
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
  const currentSet = getCurrentSet(state);

  if (!currentSet || state.isFinished) {
    return state;
  }

  const nextWorkoutSets = updateWorkoutSet(state.workoutSets, currentSet.id, (set) => {
    if (set.metricType === "reps") {
      return {
        ...set,
        reps: input.reps ?? null,
        durationSec: null,
        feeling: input.feeling ?? null,
        weightKg: input.weightKg ?? set.weightKg ?? null,
        variant: input.variant ?? set.variant,
      };
    }

    return {
      ...set,
      reps: null,
      durationSec: input.durationSec ?? null,
      feeling: input.feeling ?? null,
      weightKg: input.weightKg ?? set.weightKg ?? null,
      variant: input.variant ?? set.variant,
    };
  });

  return {
    ...state,
    workoutSets: nextWorkoutSets,
    isResting: true,
  };
}

export function next(state: SessionFlowState): SessionFlowState {
  if (state.isFinished) {
    return state;
  }

  const upcomingPosition = getUpcomingPosition(state);

  if (!upcomingPosition) {
    return {
      ...state,
      isResting: false,
      isFinished: true,
    };
  }

  return {
    ...state,
    currentExerciseIndex: upcomingPosition.exerciseIndex,
    currentSetIndex: upcomingPosition.setIndex,
    isResting: false,
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
