import assert from "node:assert/strict";

import {
  createSessionFlowState,
  getCurrentSet,
  next,
  saveSet,
  updateCurrentSetWeight,
  updateCurrentSetFeeling,
  type SessionFlowState,
} from "./session-flow";
import type { SessionExercise, WorkoutSet } from "../types/workout";

function createSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: "exercise-1",
    sessionId: "session-1",
    exerciseId: "push-up",
    order: 1,
    targetSets: 2,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetDurationSec: null,
    defaultWeightKg: null,
    defaultRestSec: 90,
    ...overrides,
  };
}

function createWorkoutSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: "set-1",
    sessionExerciseId: "exercise-1",
    setNumber: 1,
    metricType: "reps",
    status: "pending",
    plan: {
      repsMin: 8,
      repsMax: 12,
      durationSec: null,
      weightKg: null,
      restSec: 90,
      variant: "normal",
    },
    performed: {
      reps: null,
      durationSec: null,
      weightKg: null,
      feeling: null,
    },
    rest: {
      targetSec: 90,
      actualSec: null,
      startedAt: null,
      endedAt: null,
    },
    createdAt: "2026-04-13T10:00:00.000Z",
    completedAt: null,
    skippedAt: null,
    variant: "normal",
    ...overrides,
  };
}

function createState(
  options: {
    sessionExercises?: SessionExercise[];
    workoutSets?: WorkoutSet[];
    status?: SessionFlowState["phase"];
  } = {},
): SessionFlowState {
  return createSessionFlowState(
    options.sessionExercises ?? [createSessionExercise()],
    options.workoutSets ??
      [
        createWorkoutSet({ id: "set-1", setNumber: 1 }),
        createWorkoutSet({ id: "set-2", setNumber: 2 }),
      ],
    options.status ?? "in_set",
  );
}

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("createSessionFlowState returns finished when there are no session exercises", () => {
  const state = createSessionFlowState([], []);

  assert.equal(state.phase, "finished");
});

test("saveSet marks the current set as completed and changes phase to rest", () => {
  const state = createState();

  const nextState = saveSet(state, { reps: 10 });
  const currentSet = getCurrentSet(nextState);

  assert.equal(nextState.phase, "rest");
  assert.equal(currentSet?.id, "set-1");
  assert.equal(currentSet?.performed.reps, 10);
  assert.equal(currentSet?.performed.weightKg, null);
  assert.equal(currentSet?.rest.startedAt, currentSet?.completedAt);
  assert.equal(currentSet?.rest.endedAt, null);
  assert.equal(typeof currentSet?.completedAt, "string");
});

test("saveSet does nothing when phase is rest", () => {
  const state = createState({ status: "rest" as SessionFlowState["phase"] });

  const nextState = saveSet(state, { reps: 10 });

  assert.equal(nextState, state);
});

test("next moves to the next set and changes phase back to in_set", () => {
  const state = createState({ status: "rest" as SessionFlowState["phase"] });

  const nextState = next(state);
  const currentSet = getCurrentSet(nextState);

  assert.equal(nextState.phase, "in_set");
  assert.equal(nextState.currentSetId, "set-2");
  assert.equal(currentSet?.id, "set-2");
});

test("next changes phase to finished when there is no upcoming set", () => {
  const state = createState({
    workoutSets: [createWorkoutSet({ id: "set-1", setNumber: 1 })],
    status: "rest" as SessionFlowState["phase"],
  });

  const nextState = next(state);

  assert.equal(nextState.phase, "finished");
});

test("saveSet enters between_exercises when the next pending set belongs to another exercise", () => {
  const sessionExercises = [
    createSessionExercise({ id: "exercise-1", order: 1, targetSets: 2 }),
    createSessionExercise({
      id: "exercise-2",
      exerciseId: "squat",
      order: 2,
      targetSets: 1,
    }),
  ];
  const workoutSets = [
    createWorkoutSet({ id: "set-1", sessionExerciseId: "exercise-1", setNumber: 1 }),
    createWorkoutSet({ id: "set-2", sessionExerciseId: "exercise-1", setNumber: 2 }),
    createWorkoutSet({ id: "set-3", sessionExerciseId: "exercise-2", setNumber: 1 }),
  ];
  const state = createSessionFlowState(sessionExercises, workoutSets, "in_set");
  const completedFirst = saveSet(state, { reps: 10 });
  const completedSecond = next(completedFirst);
  const afterSecondSave = saveSet(completedSecond, { reps: 10 });

  assert.equal(afterSecondSave.phase, "between_exercises");
  assert.equal(afterSecondSave.currentSetId, "set-2");
  assert.equal(getCurrentSet(afterSecondSave)?.id, "set-2");
});

test("updateCurrentSetFeeling only works while phase is rest-like", () => {
  const activeState = createState({ status: "in_set" });
  const restingState = createState({ status: "rest" as SessionFlowState["phase"] });

  const activeNextState = updateCurrentSetFeeling(activeState, 4);
  const restingNextState = updateCurrentSetFeeling(restingState, 4);

  assert.equal(activeNextState, activeState);
  assert.equal(getCurrentSet(restingNextState)?.performed.feeling, 4);
});

test("saveSet stores performed weight only from explicit input", () => {
  const state = createState({
    workoutSets: [
      createWorkoutSet({
        id: "set-1",
        plan: {
          repsMin: 8,
          repsMax: 12,
          durationSec: null,
          weightKg: 24,
          restSec: 90,
          variant: "normal",
        },
      }),
    ],
  });

  const nextState = saveSet(state, { reps: 10 });

  assert.equal(getCurrentSet(nextState)?.performed.weightKg, null);
});

test("updateCurrentSetWeight propagates to later pending sets in the same exercise", () => {
  const workoutSets = [
    createWorkoutSet({
      id: "set-1",
      setNumber: 1,
      plan: { repsMin: 8, repsMax: 12, durationSec: null, weightKg: 20, restSec: 90, variant: "normal" },
    }),
    createWorkoutSet({
      id: "set-2",
      setNumber: 2,
      plan: { repsMin: 8, repsMax: 12, durationSec: null, weightKg: 20, restSec: 90, variant: "normal" },
    }),
    createWorkoutSet({
      id: "set-3",
      setNumber: 3,
      plan: { repsMin: 8, repsMax: 12, durationSec: null, weightKg: 20, restSec: 90, variant: "normal" },
    }),
  ];
  const state = createState({ workoutSets });

  const nextState = updateCurrentSetWeight(state, 24);

  assert.equal(getCurrentSet(nextState)?.plan.weightKg, 24);
  assert.equal(nextState.workoutSets.find((set) => set.id === "set-2")?.plan.weightKg, 24);
  assert.equal(nextState.workoutSets.find((set) => set.id === "set-3")?.plan.weightKg, 24);
});

test("updateCurrentSetWeight does not overwrite completed sets or other exercises", () => {
  const sessionExercises = [
    createSessionExercise({ id: "exercise-1", order: 1, targetSets: 3 }),
    createSessionExercise({ id: "exercise-2", exerciseId: "squat", order: 2, targetSets: 1 }),
  ];
  const workoutSets = [
    createWorkoutSet({
      id: "set-1",
      sessionExerciseId: "exercise-1",
      setNumber: 1,
      status: "completed",
      completedAt: "2026-04-13T10:05:00.000Z",
      plan: { repsMin: 8, repsMax: 12, durationSec: null, weightKg: 18, restSec: 90, variant: "normal" },
      performed: { reps: 10, durationSec: null, weightKg: 18, feeling: null },
    }),
    createWorkoutSet({
      id: "set-2",
      sessionExerciseId: "exercise-1",
      setNumber: 2,
      plan: { repsMin: 8, repsMax: 12, durationSec: null, weightKg: 20, restSec: 90, variant: "normal" },
    }),
    createWorkoutSet({
      id: "set-3",
      sessionExerciseId: "exercise-1",
      setNumber: 3,
      status: "skipped",
      skippedAt: "2026-04-13T10:07:00.000Z",
      plan: { repsMin: 8, repsMax: 12, durationSec: null, weightKg: 20, restSec: 90, variant: "normal" },
    }),
    createWorkoutSet({
      id: "set-4",
      sessionExerciseId: "exercise-2",
      setNumber: 1,
      plan: { repsMin: 8, repsMax: 12, durationSec: null, weightKg: 30, restSec: 90, variant: "normal" },
    }),
  ];
  const state = createSessionFlowState(sessionExercises, workoutSets, "in_set");

  const nextState = updateCurrentSetWeight(state, 24);

  assert.equal(nextState.workoutSets.find((set) => set.id === "set-1")?.plan.weightKg, 18);
  assert.equal(nextState.workoutSets.find((set) => set.id === "set-2")?.plan.weightKg, 24);
  assert.equal(nextState.workoutSets.find((set) => set.id === "set-3")?.plan.weightKg, 20);
  assert.equal(nextState.workoutSets.find((set) => set.id === "set-4")?.plan.weightKg, 30);
  assert.equal(nextState.workoutSets.find((set) => set.id === "set-1")?.performed.weightKg, 18);
});
