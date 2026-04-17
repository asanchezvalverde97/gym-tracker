import { exercises } from "../data/exercises";
import type { Exercise, ExerciseMetricType, SetVariant } from "../types/workout";
import type {
  CompletedWorkoutSession,
  SessionExercise,
  WorkoutSet,
} from "../types/workout";
import type { RoutineBundle } from "./routines-storage";

export type PastSessionSetDraft = {
  id: string;
  metricType: ExerciseMetricType;
  reps: number | null;
  durationSec: number | null;
  weightKg: number | null;
  restMin: number;
  restSec: 0 | 30;
  variant: SetVariant;
};

export type PastSessionExerciseDraft = {
  id: string;
  exerciseId: string;
  order: number;
  sets: PastSessionSetDraft[];
};

export type PastSessionDraft = {
  name: string;
  exercises: PastSessionExerciseDraft[];
};

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

export function getDefaultPastSessionDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(18, 0, 0, 0);
  return date;
}

export function createPastSessionSetDraft(
  metricType: ExerciseMetricType,
  defaults?: Partial<PastSessionSetDraft>,
): PastSessionSetDraft {
  return {
    id: createId("past_set", Date.now(), Math.random().toString(36).slice(2, 8)),
    metricType,
    reps: metricType === "reps" ? defaults?.reps ?? 8 : null,
    durationSec: metricType === "duration" ? defaults?.durationSec ?? 30 : null,
    weightKg: defaults?.weightKg ?? null,
    restMin: defaults?.restMin ?? 1,
    restSec: defaults?.restSec ?? 30,
    variant: defaults?.variant ?? "normal",
  };
}

export function createPastSessionExerciseDraft(
  exerciseId: string,
  order: number,
  setDrafts?: PastSessionSetDraft[],
): PastSessionExerciseDraft {
  const exercise = findExerciseById(exerciseId);

  return {
    id: createId("past_exercise", exerciseId, Date.now(), Math.random().toString(36).slice(2, 8)),
    exerciseId,
    order,
    sets:
      setDrafts && setDrafts.length > 0
        ? setDrafts
        : [createPastSessionSetDraft(exercise.metricType)],
  };
}

export function createEmptyPastSessionDraft(name = "Past workout"): PastSessionDraft {
  return {
    name,
    exercises: [],
  };
}

export function createPastSessionDraftFromRoutineBundle(
  bundle: RoutineBundle,
): PastSessionDraft {
  return {
    name: bundle.routine.name,
    exercises: bundle.routineExercises
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((routineExercise, index) => {
        const exercise = findExerciseById(routineExercise.exerciseId);
        const targetReps =
          routineExercise.targetReps ??
          routineExercise.targetRepsMax ??
          routineExercise.targetRepsMin ??
          8;
        const restTotalSec = Math.max(0, Math.min(330, routineExercise.defaultRestSec ?? 90));
        const restMin = Math.floor(restTotalSec / 60);
        const restSec = restTotalSec % 60 >= 30 ? 30 : 0;

        return createPastSessionExerciseDraft(
          exercise.id,
          index + 1,
          Array.from({ length: Math.max(1, routineExercise.targetSets) }, () =>
            createPastSessionSetDraft(exercise.metricType, {
              reps: exercise.metricType === "reps" ? targetReps : null,
              durationSec:
                exercise.metricType === "duration"
                  ? routineExercise.targetDurationSec ?? 30
                  : null,
              weightKg: routineExercise.defaultWeightKg ?? null,
              restMin,
              restSec,
              variant: routineExercise.defaultSetVariant ?? "normal",
            }),
          ),
        );
      }),
  };
}

function getSessionWindow(
  date: Date,
  durationMin: number,
): {
  startedAt: string;
  endedAt: string;
} {
  const startedAt = new Date(date);
  const endedAt = new Date(startedAt.getTime() + durationMin * 60 * 1000);

  return {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  };
}

function getRestTotalSec(setDraft: PastSessionSetDraft): number {
  return setDraft.restMin * 60 + setDraft.restSec;
}

export function createCompletedSessionFromPastSessionDraft(
  draft: PastSessionDraft,
  options: {
    sessionDate: Date;
    durationMin: number;
    notes?: string | null;
    routineId?: string | null;
  },
): {
  session: CompletedWorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
} {
  const durationMin = Math.max(1, Math.round(options.durationMin));
  const sessionId = createId("past_session", Date.now());
  const { startedAt, endedAt } = getSessionWindow(options.sessionDate, durationMin);
  const createdAt = startedAt;
  const orderedExercises = draft.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((exerciseDraft, index) => ({
      ...exerciseDraft,
      order: index + 1,
    }));
  const totalSets = Math.max(
    1,
    orderedExercises.reduce((count, exerciseDraft) => count + exerciseDraft.sets.length, 0),
  );
  let completedSetIndex = 0;

  const sessionExercises: SessionExercise[] = orderedExercises.map((exerciseDraft) => {
    const metricType = findExerciseById(exerciseDraft.exerciseId).metricType;
    const repsValues = exerciseDraft.sets
      .map((setDraft) => setDraft.reps)
      .filter((value): value is number => typeof value === "number");
    const durationValues = exerciseDraft.sets
      .map((setDraft) => setDraft.durationSec)
      .filter((value): value is number => typeof value === "number");
    const weightValues = exerciseDraft.sets
      .map((setDraft) => setDraft.weightKg)
      .filter((value): value is number => typeof value === "number");
    const restValues = exerciseDraft.sets.map((setDraft) => getRestTotalSec(setDraft));

    return {
      id: createId("past_se", sessionId, exerciseDraft.order),
      sessionId,
      exerciseId: exerciseDraft.exerciseId,
      order: exerciseDraft.order,
      targetSets: exerciseDraft.sets.length,
      targetRepsMin: metricType === "reps" && repsValues.length > 0 ? Math.min(...repsValues) : null,
      targetRepsMax: metricType === "reps" && repsValues.length > 0 ? Math.max(...repsValues) : null,
      targetDurationSec:
        metricType === "duration" && durationValues.length > 0 ? durationValues[0] : null,
      defaultWeightKg: weightValues[0] ?? null,
      defaultRestSec: restValues[0] ?? null,
    };
  });

  const workoutSets: WorkoutSet[] = orderedExercises.flatMap((exerciseDraft, exerciseIndex) => {
    const sessionExercise = sessionExercises[exerciseIndex];
    const metricType = findExerciseById(exerciseDraft.exerciseId).metricType;

    return exerciseDraft.sets.map((setDraft, setIndex) => {
      completedSetIndex += 1;
      const completedAtMs =
        new Date(startedAt).getTime() +
        Math.round((durationMin * 60 * 1000 * completedSetIndex) / (totalSets + 1));
      const completedAt = new Date(completedAtMs).toISOString();
      const restSec = getRestTotalSec(setDraft);

      return {
        id: createId("past_ws", sessionExercise.id, setIndex + 1),
        sessionExerciseId: sessionExercise.id,
        setNumber: setIndex + 1,
        metricType,
        status: "completed",
        plan: {
          repsMin: metricType === "reps" ? setDraft.reps : null,
          repsMax: metricType === "reps" ? setDraft.reps : null,
          durationSec: metricType === "duration" ? setDraft.durationSec : null,
          weightKg: setDraft.weightKg,
          restSec,
          variant: setDraft.variant,
        },
        performed: {
          reps: metricType === "reps" ? setDraft.reps : null,
          durationSec: metricType === "duration" ? setDraft.durationSec : null,
          weightKg: setDraft.weightKg,
          feeling: null,
        },
        rest: {
          targetSec: restSec,
          actualSec: restSec,
          startedAt: completedAt,
          endedAt: completedAt,
        },
        createdAt,
        completedAt,
        skippedAt: null,
        variant: setDraft.variant,
      };
    });
  });

  return {
    session: {
      id: sessionId,
      kind: "completed",
      routineId: options.routineId ?? null,
      name: draft.name.trim() || "Past workout",
      startedAt,
      endedAt,
      bodyweightKg: null,
      feeling: null,
      notes: options.notes?.trim() ? options.notes.trim() : null,
      createdAt,
    },
    sessionExercises,
    workoutSets,
  };
}
