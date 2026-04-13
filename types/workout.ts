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

export interface RoutineExercise {
  id: string;
  routineId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  targetDurationSec?: number | null;
  defaultWeightKg?: number | null;
  defaultRestSec?: number | null;
  defaultSetVariant?: SetVariant;
}

export interface WorkoutSession {
  id: string;
  routineId?: string | null;
  name: string;
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
}

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

export interface WorkoutSet {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  metricType: ExerciseMetricType;
  variant: SetVariant;
  reps?: number | null;
  durationSec?: number | null;
  weightKg?: number | null;
  restSecTarget?: number | null;
  restSecActual?: number | null;
  feeling?: SetFeeling | null;
  createdAt: string;
}

export interface MotivationalQuote {
  id: string;
  text: string;
  author: string;
  category: QuoteCategory;
}
