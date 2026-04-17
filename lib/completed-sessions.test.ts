import assert from "node:assert/strict";

import { normalizeCompletedSessionBundle } from "./completed-sessions";
import type { SavedSessionBundle } from "./completed-sessions";

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("normalizeCompletedSessionBundle preserves structured sets", () => {
  const bundle: SavedSessionBundle = {
    kind: "completed_session",
    session: {
      id: "session-1",
      kind: "completed",
      name: "Upper",
      startedAt: "2026-04-14T10:00:00.000Z",
      endedAt: "2026-04-14T10:45:00.000Z",
      createdAt: "2026-04-14T10:00:00.000Z",
    },
    sessionExercises: [],
    workoutSets: [
      {
        id: "set-1",
        sessionExerciseId: "exercise-1",
        setNumber: 1,
        metricType: "reps",
        status: "completed",
        plan: {
          repsMin: 8,
          repsMax: 10,
          durationSec: null,
          weightKg: 20,
          restSec: 90,
          variant: "normal",
        },
        performed: {
          reps: 10,
          durationSec: null,
          weightKg: 20,
          feeling: 3,
        },
        rest: {
          targetSec: 90,
          actualSec: 82,
          startedAt: "2026-04-14T10:05:00.000Z",
          endedAt: "2026-04-14T10:06:22.000Z",
        },
        createdAt: "2026-04-14T10:00:00.000Z",
        completedAt: "2026-04-14T10:05:00.000Z",
        skippedAt: null,
        variant: "normal",
      },
    ],
  };

  const normalized = normalizeCompletedSessionBundle(bundle);

  assert.deepEqual(normalized, bundle);
});

test("normalizeCompletedSessionBundle fills missing performed and rest from legacy flat fields", () => {
  const normalized = normalizeCompletedSessionBundle({
    kind: "completed_session",
    session: {
      id: "session-legacy",
      kind: "completed",
      name: "Legacy",
      startedAt: "2026-04-14T10:00:00.000Z",
      endedAt: "2026-04-14T10:45:00.000Z",
      createdAt: "2026-04-14T10:00:00.000Z",
    },
    sessionExercises: [],
    workoutSets: [
      {
        id: "set-legacy",
        sessionExerciseId: "exercise-1",
        setNumber: 1,
        metricType: "reps",
        status: "completed",
        plan: {
          repsMin: 5,
          repsMax: 8,
          durationSec: null,
          weightKg: 18,
          restSec: 75,
          variant: "normal",
        },
        createdAt: "2026-04-14T10:00:00.000Z",
        completedAt: "2026-04-14T10:05:00.000Z",
        skippedAt: null,
        variant: "normal",
        reps: 8,
        weightKg: 20,
        restSecTarget: 75,
        restSecActual: 70,
        feeling: 4,
      } as SavedSessionBundle["workoutSets"][number] & {
        reps: number;
        weightKg: number;
        restSecTarget: number;
        restSecActual: number;
        feeling: 4;
      },
    ],
  });

  const legacySet = normalized.workoutSets[0];

  assert.equal(legacySet.performed.reps, 8);
  assert.equal(legacySet.performed.weightKg, 20);
  assert.equal(legacySet.performed.feeling, 4);
  assert.equal(legacySet.rest.targetSec, 75);
  assert.equal(legacySet.rest.actualSec, 70);
  assert.equal(legacySet.rest.startedAt, "2026-04-14T10:05:00.000Z");
  assert.equal(legacySet.status, "completed");
});

test("normalizeCompletedSessionBundle creates empty structured blocks when missing", () => {
  const normalized = normalizeCompletedSessionBundle({
    kind: "completed_session",
    session: {
      id: "session-minimal",
      kind: "completed",
      name: "Minimal",
      startedAt: "2026-04-14T10:00:00.000Z",
      endedAt: "2026-04-14T10:45:00.000Z",
      createdAt: "2026-04-14T10:00:00.000Z",
    },
    sessionExercises: [],
    workoutSets: [
      {
        id: "set-minimal",
        sessionExerciseId: "exercise-1",
        setNumber: 1,
        metricType: "duration",
        status: "completed",
        plan: {
          repsMin: null,
          repsMax: null,
          durationSec: 30,
          weightKg: null,
          restSec: null,
          variant: "normal",
        },
        createdAt: "2026-04-14T10:00:00.000Z",
        completedAt: "2026-04-14T10:05:00.000Z",
        skippedAt: null,
        variant: "normal",
      } as SavedSessionBundle["workoutSets"][number],
    ],
  });

  const set = normalized.workoutSets[0];

  assert.deepEqual(set.performed, {
    reps: null,
    durationSec: null,
    weightKg: null,
    feeling: null,
  });
  assert.deepEqual(set.rest, {
    targetSec: null,
    actualSec: null,
    startedAt: "2026-04-14T10:05:00.000Z",
    endedAt: null,
  });
});
