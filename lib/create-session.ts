import { exercises } from "../data/exercises";
import { routineExercises } from "../data/routines";
import type {
  Exercise,
  Routine,
  RoutineExercise,
  SessionExercise,
  WorkoutSession,
  WorkoutSet,
} from "../types/workout";

export interface CreateSessionResult {
  session: WorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
}

function createId(prefix: string, ...parts: Array<string | number>): string {
  return [prefix, ...parts].join("_");
}

function findExerciseById(exerciseId: string): Exercise {
  const exercise = exercises.find((item) => item.id === exerciseId);

  if (!exercise) {
    throw new Error(`Exercise not found for id: ${exerciseId}`);
  }

  return exercise;
}

function getRoutineExercisesForRoutine(routineId: string): RoutineExercise[] {
  return routineExercises
    .filter((item) => item.routineId === routineId)
    .sort((a, b) => a.order - b.order);
}

function createSessionExercise(
  sessionId: string,
  routineExercise: RoutineExercise,
): SessionExercise {
  return {
    id: createId("se", sessionId, routineExercise.order),
    sessionId,
    exerciseId: routineExercise.exerciseId,
    order: routineExercise.order,
    targetSets: routineExercise.targetSets,
    targetRepsMin: routineExercise.targetRepsMin ?? null,
    targetRepsMax: routineExercise.targetRepsMax ?? null,
    targetDurationSec: routineExercise.targetDurationSec ?? null,
    defaultWeightKg: routineExercise.defaultWeightKg ?? null,
    defaultRestSec: routineExercise.defaultRestSec ?? null,
  };
}

function createWorkoutSets(
  sessionExercise: SessionExercise,
  routineExercise: RoutineExercise,
  exercise: Exercise,
  nowIso: string,
): WorkoutSet[] {
  const variant = routineExercise.defaultSetVariant ?? "normal";

  return Array.from({ length: sessionExercise.targetSets }, (_, index) => ({
    id: createId("ws", sessionExercise.id, index + 1),
    sessionExerciseId: sessionExercise.id,
    setNumber: index + 1,
    metricType: exercise.metricType,
    variant,
    reps: null,
    durationSec: null,
    weightKg: routineExercise.defaultWeightKg ?? null,
    restSecTarget: routineExercise.defaultRestSec ?? null,
    restSecActual: null,
    feeling: null,
    createdAt: nowIso,
  }));
}

export function createSessionFromRoutine(routine: Routine): CreateSessionResult {
  const nowIso = new Date().toISOString();
  const sessionId = createId("session", routine.id, Date.now());

  const session: WorkoutSession = {
    id: sessionId,
    routineId: routine.id,
    name: routine.name,
    startedAt: nowIso,
    createdAt: nowIso,
    endedAt: null,
  };

  const selectedRoutineExercises = getRoutineExercisesForRoutine(routine.id);

  const sessionExercises = selectedRoutineExercises.map((routineExercise) =>
    createSessionExercise(sessionId, routineExercise),
  );

  const workoutSets = selectedRoutineExercises.flatMap((routineExercise, index) => {
    const exercise = findExerciseById(routineExercise.exerciseId);
    const sessionExercise = sessionExercises[index];

    return createWorkoutSets(sessionExercise, routineExercise, exercise, nowIso);
  });

  return {
    session,
    sessionExercises,
    workoutSets,
  };
}
