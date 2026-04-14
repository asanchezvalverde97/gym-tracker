export type ExerciseMetricType = "reps" | "duration";
export type SetVariant = "normal" | "assisted";
export type SetFeeling = 1 | 2 | 3 | 4;
export type QuoteCategory =
  | "discipline"
  | "epic"
  | "philosophical"
  | "literary";

export interface Exercise {
  id: string;
  name: string;
  metricType: ExerciseMetricType;
  createdAt: string;
}

export interface Routine {
  id: string;
  name: string;
  createdAt: string;
}

export interface RoutineTemplate {
  id: string;
  name: string;
  createdAt: string;
}

export interface RoutineExercise {
  id: string;
  routineId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps?: number | null;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  targetDurationSec?: number | null;
  defaultWeightKg?: number | null;
  defaultRestSec?: number | null;
  defaultSetVariant?: SetVariant;
}

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

export interface ActiveWorkoutSession extends WorkoutSessionBase {
  kind: "active";
  endedAt: null;
}

export interface CompletedWorkoutSession extends WorkoutSessionBase {
  kind: "completed";
  endedAt: string;
}

export type WorkoutSession = ActiveWorkoutSession | CompletedWorkoutSession;

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  targetDurationSec?: number | null;
  defaultWeightKg?: number | null;
  defaultRestSec?: number | null;
}

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

export interface MotivationalQuote {
  id: string;
  text: string;
  author: string;
  category: QuoteCategory;
}
