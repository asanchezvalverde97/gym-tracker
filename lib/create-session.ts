import { exercises } from "../data/exercises";
import type { UserSettings } from "./user-settings";
import type {
  Exercise,
  ActiveWorkoutSession,
  Routine,
  RoutineExercise,
  SessionExercise,
  WorkoutSet,
} from "../types/workout";

export interface CreateSessionResult {
  session: ActiveWorkoutSession;
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

function createSessionExercise(
  sessionId: string,
  routineExercise: RoutineExercise,
): SessionExercise {
  const targetReps =
    routineExercise.targetReps ??
    routineExercise.targetRepsMax ??
    routineExercise.targetRepsMin ??
    null;

  return {
    id: createId("se", sessionId, routineExercise.order),
    sessionId,
    exerciseId: routineExercise.exerciseId,
    order: routineExercise.order,
    targetSets: routineExercise.targetSets,
    targetRepsMin: targetReps,
    targetRepsMax: targetReps,
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
  const targetReps =
    routineExercise.targetReps ??
    routineExercise.targetRepsMax ??
    routineExercise.targetRepsMin ??
    null;

  return Array.from({ length: sessionExercise.targetSets }, (_, index) => ({
    id: createId("ws", sessionExercise.id, index + 1),
    sessionExerciseId: sessionExercise.id,
    setNumber: index + 1,
    metricType: exercise.metricType,
    status: "pending",
    plan: {
      repsMin: targetReps,
      repsMax: targetReps,
      durationSec: routineExercise.targetDurationSec ?? null,
      weightKg: routineExercise.defaultWeightKg ?? null,
      restSec: routineExercise.defaultRestSec ?? null,
      variant,
    },
    performed: {
      reps: null,
      durationSec: null,
      weightKg: null,
      feeling: null,
    },
    rest: {
      targetSec: routineExercise.defaultRestSec ?? null,
      actualSec: null,
      startedAt: null,
      endedAt: null,
    },
    createdAt: nowIso,
    variant,
    completedAt: null,
    skippedAt: null,
  }));
}

export function createSessionFromRoutine(
  routine: Routine,
  selectedRoutineExercises: RoutineExercise[],
  userSettings: UserSettings,
): CreateSessionResult {
  const nowIso = new Date().toISOString();
  const sessionId = createId("session", routine.id, Date.now());

  const session: ActiveWorkoutSession = {
    id: sessionId,
    kind: "active",
    routineId: routine.id,
    name: routine.name,
    startedAt: nowIso,
    createdAt: nowIso,
    endedAt: null,
    bodyweightKg: userSettings.bodyweightKg ?? null,
    feeling: null,
    notes: null,
  };

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
