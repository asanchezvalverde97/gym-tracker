# Refactor Report

## 1. Summary
- Separated the session domain into active and completed session types.
- Added explicit execution fields to `WorkoutSet`: `status`, `plan`, `performed`, and `rest`.
- Made rest semantics consistent by treating rest as belonging to the completed set.
- Reworked `SessionFlowState` to use explicit phases: `in_set`, `rest`, `between_exercises`, `finished`.
- Reduced fragile flow cursoring by moving from public array indices to ID-based cursor fields.
- Added active-session persistence snapshots for flow cursor and rest state.
- Kept legacy set fields mirrored for incremental compatibility with existing screens.
- Updated session screen restoration and persistence to use the new flow/persistence model.
- Updated seed data and tests to match the new domain model.
- Kept the refactor incremental so the app still compiles cleanly.

## types/workout.ts

### CHANGED CODE
```ts
export interface WorkoutSessionBase {
  id: string;
  routineId?: string | null;
  name: string;
  startedAt: string;
  bodyweightKg?: number | null;
  feeling?: SetFeeling | null;
  notes?: string | null;
  createdAt: string;
}

export interface WorkoutSet {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  metricType: ExerciseMetricType;
  status: WorkoutSetStatus;
  plan: WorkoutSetPlan;
  performed: WorkoutSetPerformance;
  rest: WorkoutSetRest;
  createdAt: string;
  completedAt: string | null;
  skippedAt: string | null;
  variant: SetVariant;
  reps?: number | null;
  durationSec?: number | null;
  weightKg?: number | null;
  restSecTarget?: number | null;
  restSecActual?: number | null;
  feeling?: SetFeeling | null;
}
```

### ADDED CODE
```ts
export interface RoutineTemplate {
  id: string;
  name: string;
  createdAt: string;
}

export interface ActiveWorkoutSession extends WorkoutSessionBase {
  kind: "active";
  endedAt: null;
}

export interface CompletedWorkoutSession extends WorkoutSessionBase {
  kind: "completed";
  endedAt: string;
}

export type WorkoutSession = ActiveWorkoutSession | CompletedWorkoutSession;

export interface WorkoutSetPlan {
  repsMin?: number | null;
  repsMax?: number | null;
  durationSec?: number | null;
  weightKg?: number | null;
  restSec?: number | null;
  variant: SetVariant;
}

export interface WorkoutSetPerformance {
  reps?: number | null;
  durationSec?: number | null;
  weightKg?: number | null;
  feeling?: SetFeeling | null;
}

export interface WorkoutSetRest {
  targetSec?: number | null;
  actualSec?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
}

export type WorkoutSetStatus = "pending" | "completed" | "skipped";
```

### REMOVED CODE
```ts
export interface WorkoutSession {
  id: string;
  routineId?: string | null;
  name: string;
  startedAt: string;
  endedAt?: string | null;
  bodyweightKg?: number | null;
  feeling?: SetFeeling | null;
  notes?: string | null;
  createdAt: string;
}
```

## lib/create-session.ts

### CHANGED CODE
```ts
export interface CreateSessionResult {
  session: ActiveWorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
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
    reps: null,
    durationSec: null,
    weightKg: routineExercise.defaultWeightKg ?? null,
    restSecTarget: routineExercise.defaultRestSec ?? null,
    restSecActual: null,
    feeling: null,
    completedAt: null,
    skippedAt: null,
  }));
}

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
```

### ADDED CODE
```ts
const targetReps =
  routineExercise.targetReps ??
  routineExercise.targetRepsMax ??
  routineExercise.targetRepsMin ??
  null;

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
kind: "active",
```

### REMOVED CODE
```ts
export interface CreateSessionResult {
  session: WorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
}

const session: WorkoutSession = {
```

## lib/active-session.ts

### CHANGED CODE
```ts
export async function saveActiveSession(
  bundle: ActiveSessionBundle,
): Promise<void> {
  await AsyncStorage.setItem(
    ACTIVE_SESSION_STORAGE_KEY,
    JSON.stringify(bundle),
  );
}

export async function getActiveSession(): Promise<ActiveSessionBundle | null> {
  const rawValue = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as ActiveSessionBundle;
  } catch {
    return null;
  }
}
```

### ADDED CODE
```ts
export type ActiveSessionFlowPhase = "in_set" | "rest" | "between_exercises";

export interface ActiveSessionFlowSnapshot {
  phase: ActiveSessionFlowPhase;
  currentExerciseId: string;
  currentSetId: string;
}

export interface ActiveSessionRestSnapshot {
  interpretation: "after_completed_set";
  setId: string;
  startedAt: string;
  targetDurationSec: number;
  endsAt: string | null;
}

export interface ActiveSessionBundle {
  kind: "active_session";
  session: ActiveWorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
  flow: ActiveSessionFlowSnapshot;
  rest: ActiveSessionRestSnapshot | null;
}
```

### REMOVED CODE
```ts
import type { SavedSessionBundle } from "./completed-sessions";

export async function saveActiveSession(
  bundle: SavedSessionBundle,
): Promise<void> {
```

## lib/completed-sessions.ts

### CHANGED CODE
```ts
export async function saveCompletedSession(
  session: CompletedWorkoutSession,
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
): Promise<void> {
  const savedBundles = await readSavedSessionBundles();
  const nextBundle: CompletedSessionBundle = {
    kind: "completed_session",
    session,
    sessionExercises,
    workoutSets,
  };
```

### ADDED CODE
```ts
export interface CompletedSessionBundle {
  kind: "completed_session";
  session: CompletedWorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
}

export type SavedSessionBundle = CompletedSessionBundle;
```

### REMOVED CODE
```ts
export interface SavedSessionBundle {
  session: WorkoutSession;
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
  restStartTimeMs?: number | null;
  restDurationTargetSec?: number | null;
}
```

## lib/session-flow.ts

### CHANGED CODE
```ts
export interface SessionFlowState {
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
  currentExerciseId: string | null;
  currentSetId: string | null;
  phase: SessionFlowPhase;
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
        feeling,
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
        reps: input.reps ?? null,
        durationSec: null,
        feeling: input.feeling ?? null,
        weightKg: input.weightKg ?? set.weightKg ?? null,
        variant: input.variant ?? set.variant,
        completedAt,
        skippedAt: null,
        performed: {
          reps: input.reps ?? null,
          durationSec: null,
          weightKg: input.weightKg ?? set.weightKg ?? null,
          feeling: input.feeling ?? null,
        },
        rest: {
          targetSec: set.rest.targetSec ?? set.restSecTarget ?? null,
          actualSec: null,
          startedAt: completedAt,
          endedAt: null,
        },
      });
    }

    return createUpdatedWorkoutSet(set, {
      status: "completed",
      reps: null,
      durationSec: input.durationSec ?? null,
      feeling: input.feeling ?? null,
      weightKg: input.weightKg ?? set.weightKg ?? null,
      variant: input.variant ?? set.variant,
      completedAt,
      skippedAt: null,
      performed: {
        reps: null,
        durationSec: input.durationSec ?? null,
        weightKg: input.weightKg ?? set.weightKg ?? null,
        feeling: input.feeling ?? null,
      },
      rest: {
        targetSec: set.rest.targetSec ?? set.restSecTarget ?? null,
        actualSec: null,
        startedAt: completedAt,
        endedAt: null,
      },
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
```

### ADDED CODE
```ts
import type { ActiveSessionFlowSnapshot } from "./active-session";

export type SessionFlowPhase = "in_set" | "rest" | "between_exercises" | "finished";

function createUpdatedWorkoutSet(
  set: WorkoutSet,
  updates: Partial<Omit<WorkoutSet, "plan" | "performed" | "rest">> & {
    plan?: Partial<WorkoutSetPlan>;
    performed?: Partial<WorkoutSetPerformance>;
    rest?: Partial<WorkoutSetRest>;
  },
): WorkoutSet {
  // exact implementation was added here
}

function getSetPositionById(state: SessionFlowState): SetPosition | null {
  // exact implementation was added here
}

function findNextPendingPosition(
  state: SessionFlowState,
  fromPosition: SetPosition | null,
): SetPosition | null {
  // exact implementation was added here
}

function findFirstPendingPosition(state: SessionFlowState): SetPosition | null {
  return findNextPendingPosition(state, null);
}

function getSetAtPosition(
  state: SessionFlowState,
  position: SetPosition | null,
): WorkoutSet | null {
  // exact implementation was added here
}

function getExerciseAtPosition(
  state: SessionFlowState,
  position: SetPosition | null,
): SessionExercise | null {
  // exact implementation was added here
}

function getNextPendingPosition(state: SessionFlowState): SetPosition | null {
  return findNextPendingPosition(state, getSetPositionById(state));
}

function createCursorState(
  state: SessionFlowState,
  position: SetPosition | null,
  phase: SessionFlowPhase,
): SessionFlowState {
  // exact implementation was added here
}

function getRestPhaseForCurrentSet(state: SessionFlowState): Extract<
  SessionFlowPhase,
  "rest" | "between_exercises"
> {
  // exact implementation was added here
}

export function isRestPhase(
  phase: SessionFlowPhase,
): phase is "rest" | "between_exercises" {
  return phase === "rest" || phase === "between_exercises";
}

export function createSessionFlowStateFromSnapshot(
  sessionExercises: SessionExercise[],
  workoutSets: WorkoutSet[],
  snapshot: ActiveSessionFlowSnapshot,
): SessionFlowState {
  // exact implementation was added here
}

export function createSessionFlowSnapshot(
  state: SessionFlowState,
): ActiveSessionFlowSnapshot | null {
  // exact implementation was added here
}
```

### REMOVED CODE
```ts
export interface SessionFlowState {
  sessionExercises: SessionExercise[];
  workoutSets: WorkoutSet[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  status: "active" | "resting" | "finished";
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
```

## lib/session-flow.test.ts

### CHANGED CODE
```ts
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
    reps: null,
    durationSec: null,
    weightKg: null,
    restSecTarget: 90,
    restSecActual: null,
    feeling: null,
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
```

### ADDED CODE
```ts
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
```

### REMOVED CODE
```ts
status?: SessionFlowState["status"];
options.status ?? "active",

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
```

## lib/dev-seed-completed-sessions.ts

### CHANGED CODE
```ts
function createCompletedSet(
  sessionExerciseId: string,
  setNumber: number,
  value: number,
  metricType: Exercise["metricType"],
  variant: SetVariant,
  weightKg: number | null,
  restSecTarget: number | null,
  completedAt: string,
  createdAt: string,
): WorkoutSet {
  return {
    id: `seed_ws_${sessionExerciseId}_${setNumber}_${variant}`,
    sessionExerciseId,
    setNumber,
    metricType,
    status: "completed",
    plan: {
      repsMin: metricType === "reps" ? value : null,
      repsMax: metricType === "reps" ? value : null,
      durationSec: metricType === "duration" ? value : null,
      weightKg,
      restSec: restSecTarget,
      variant,
    },
    performed: {
      reps: metricType === "reps" ? value : null,
      durationSec: metricType === "duration" ? value : null,
      weightKg,
      feeling: null,
    },
    rest: {
      targetSec: restSecTarget,
      actualSec: restSecTarget,
      startedAt: completedAt,
      endedAt: completedAt,
    },
    createdAt,
    completedAt,
    skippedAt: null,
    variant,
    reps: metricType === "reps" ? value : null,
    durationSec: metricType === "duration" ? value : null,
    weightKg,
    restSecTarget,
    restSecActual: restSecTarget,
    feeling: null,
  };
}

const session: CompletedWorkoutSession = {
  id: sessionId,
  kind: "completed",
  routineId: null,
  name: template.day,
  startedAt,
  endedAt,
  bodyweightKg: template.bodyweightKg ?? null,
  feeling: template.feeling ?? null,
  notes: template.notes ?? null,
  createdAt: startedAt,
};

return {
  kind: "completed_session",
  session,
  sessionExercises,
  workoutSets,
};
```

### ADDED CODE
```ts
status: "completed",
plan: {
  repsMin: metricType === "reps" ? value : null,
  repsMax: metricType === "reps" ? value : null,
  durationSec: metricType === "duration" ? value : null,
  weightKg,
  restSec: restSecTarget,
  variant,
},
performed: {
  reps: metricType === "reps" ? value : null,
  durationSec: metricType === "duration" ? value : null,
  weightKg,
  feeling: null,
},
rest: {
  targetSec: restSecTarget,
  actualSec: restSecTarget,
  startedAt: completedAt,
  endedAt: completedAt,
},
kind: "completed",
kind: "completed_session",
```

### REMOVED CODE
```ts
import type {
  Exercise,
  SessionExercise,
  SetVariant,
  WorkoutSession,
  WorkoutSet,
} from "../types/workout";
```

## app/session.tsx

### CHANGED CODE
```ts
type LegacyActiveSessionBundle = {
  session: WorkoutSession;
  sessionExercises: SessionFlowState["sessionExercises"];
  workoutSets: SessionFlowState["workoutSets"];
  restStartTimeMs?: number | null;
  restDurationTargetSec?: number | null;
};

function isValidActiveSessionBundle(
  value: unknown,
): value is ActiveSessionBundle | LegacyActiveSessionBundle {
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
  flow?: ActiveSessionBundle["flow"];
  rest?: ActiveSessionBundle["rest"];
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

  if ("flow" in bundle && bundle.flow) {
    const flowState = createSessionFlowStateFromSnapshot(
      bundle.sessionExercises,
      bundle.workoutSets,
      bundle.flow,
    );
    const restStartedAtMs = bundle.rest?.startedAt
      ? new Date(bundle.rest.startedAt).getTime()
      : null;

    return {
      flowState,
      restStartTimeMs: restStartedAtMs,
      restDurationTargetSec: bundle.rest?.targetDurationSec ?? null,
      restEndTimeMs:
        bundle.rest?.endsAt != null
          ? new Date(bundle.rest.endsAt).getTime()
          : restStartedAtMs != null && bundle.rest?.targetDurationSec != null
            ? restStartedAtMs + bundle.rest.targetDurationSec * 1000
            : null,
    };
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
  const orderedExercise = orderedExercises[currentPosition.exerciseIndex];
  const currentSet = bundle.workoutSets
    .filter((set) => set.sessionExerciseId === orderedExercise.id)
    .sort((a, b) => a.setNumber - b.setNumber)[currentPosition.setIndex];

  if (!orderedExercise || !currentSet) {
    return null;
  }

  return {
    flowState: createSessionFlowStateFromSnapshot(
      bundle.sessionExercises,
      bundle.workoutSets,
      {
        phase: hasRestStart ? "rest" : "in_set",
        currentExerciseId: orderedExercise.id,
        currentSetId: currentSet.id,
      },
    ),
    restStartTimeMs: bundle.restStartTimeMs ?? null,
    restDurationTargetSec: bundle.restDurationTargetSec ?? null,
    restEndTimeMs:
      bundle.restStartTimeMs != null && bundle.restDurationTargetSec != null
        ? bundle.restStartTimeMs + bundle.restDurationTargetSec * 1000
        : null,
  };
}

function getActiveSessionBundle(
  session: WorkoutSession,
  flowState: SessionFlowState,
  restStartTimeMs: number | null,
  restDurationTargetSec: number | null,
): ActiveSessionBundle | null {
  if (session.kind !== "active" || session.endedAt != null) {
    return null;
  }

  const flow = createSessionFlowSnapshot(flowState);

  if (!flow) {
    return null;
  }

  return {
    kind: "active_session",
    session,
    sessionExercises: flowState.sessionExercises,
    workoutSets: flowState.workoutSets,
    flow,
    rest:
      isRestPhase(flowState.phase) &&
      restStartTimeMs != null &&
      restDurationTargetSec != null &&
      flowState.currentSetId != null
        ? {
            interpretation: "after_completed_set",
            setId: flowState.currentSetId,
            startedAt: new Date(restStartTimeMs).toISOString(),
            targetDurationSec: restDurationTargetSec,
            endsAt: new Date(restStartTimeMs + restDurationTargetSec * 1000).toISOString(),
          }
        : null,
  };
}
```

### ADDED CODE
```ts
import {
  type ActiveSessionBundle,
  clearActiveSession,
  getActiveSession,
  saveActiveSession,
} from "../lib/active-session";

import {
  addSetToCurrentExercise,
  createSessionFlowSnapshot,
  createSessionFlowState,
  createSessionFlowStateFromSnapshot,
  finishEarly,
  getCurrentExercise,
  getCurrentSet,
  getUpcomingExercise,
  getUpcomingSet,
  isRestPhase,
  next,
  saveSet,
  skipUpcomingSet,
  updateCurrentSetActualRest,
  updateCurrentSetFeeling,
  updateCurrentSetRest,
  updateCurrentSetWeight,
  type SessionFlowState,
} from "../lib/session-flow";

import type {
  CompletedWorkoutSession,
  SetFeeling,
  WorkoutSession,
} from "../types/workout";
```

### REMOVED CODE
```ts
updateNextSetRest,

const status = hasRestStart ? "resting" : "active";

flowState: {
  ...createSessionFlowState(bundle.sessionExercises, bundle.workoutSets, status),
  currentExerciseIndex: currentPosition.exerciseIndex,
  currentSetIndex: currentPosition.setIndex,
},

if (flowState.status === "resting") {
```
