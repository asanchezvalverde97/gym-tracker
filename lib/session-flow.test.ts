import assert from "node:assert/strict";

import {
  createSessionFlowState,
  getCurrentSet,
  next,
  saveSet,
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
    variant: "normal",
    reps: null,
    durationSec: null,
    weightKg: null,
    restSecTarget: 90,
    restSecActual: null,
    feeling: null,
    completedAt: null,
    createdAt: "2026-04-13T10:00:00.000Z",
    ...overrides,
  };
}

function createState(
  options: {
    sessionExercises?: SessionExercise[];
    workoutSets?: WorkoutSet[];
    status?: SessionFlowState["status"];
  } = {},
): SessionFlowState {
  return createSessionFlowState(
    options.sessionExercises ?? [createSessionExercise()],
    options.workoutSets ??
      [
        createWorkoutSet({ id: "set-1", setNumber: 1 }),
        createWorkoutSet({ id: "set-2", setNumber: 2 }),
      ],
    options.status ?? "active",
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

  assert.equal(state.status, "finished");
});

test("saveSet marks the current set as completed and changes status to resting", () => {
  const state = createState();

  const nextState = saveSet(state, { reps: 10 });
  const currentSet = getCurrentSet(nextState);

  assert.equal(nextState.status, "resting");
  assert.equal(currentSet?.id, "set-1");
  assert.equal(currentSet?.reps, 10);
  assert.equal(typeof currentSet?.completedAt, "string");
});

test("saveSet does nothing when status is resting", () => {
  const state = createState({ status: "resting" });

  const nextState = saveSet(state, { reps: 10 });

  assert.equal(nextState, state);
});

test("next moves to the next set and changes status back to active", () => {
  const state = createState({ status: "resting" });

  const nextState = next(state);
  const currentSet = getCurrentSet(nextState);

  assert.equal(nextState.status, "active");
  assert.equal(nextState.currentSetIndex, 1);
  assert.equal(currentSet?.id, "set-2");
});

test("next changes status to finished when there is no upcoming set", () => {
  const state = createState({
    workoutSets: [createWorkoutSet({ id: "set-1", setNumber: 1 })],
    status: "resting",
  });

  const nextState = next(state);

  assert.equal(nextState.status, "finished");
});

test("next moves from the last set of one exercise to the first set of the next exercise", () => {
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
  const state = {
    ...createSessionFlowState(sessionExercises, workoutSets, "resting"),
    currentExerciseIndex: 0,
    currentSetIndex: 1,
  };

  const nextState = next(state);
  const currentSet = getCurrentSet(nextState);

  assert.equal(nextState.status, "active");
  assert.equal(nextState.currentExerciseIndex, 1);
  assert.equal(nextState.currentSetIndex, 0);
  assert.equal(currentSet?.id, "set-3");
});

test("updateCurrentSetFeeling only works while status is resting", () => {
  const activeState = createState({ status: "active" });
  const restingState = createState({ status: "resting" });

  const activeNextState = updateCurrentSetFeeling(activeState, 4);
  const restingNextState = updateCurrentSetFeeling(restingState, 4);

  assert.equal(activeNextState, activeState);
  assert.equal(getCurrentSet(restingNextState)?.feeling, 4);
});
