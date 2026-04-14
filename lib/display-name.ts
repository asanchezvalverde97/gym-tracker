import { exercises } from "../data/exercises";

const exerciseNameOverrides: Record<string, string> = {
  dominadas: "Dominadas",
  remo_mancuerna: "Remo con mancuerna",
  chin_ups: "Chin-ups",
  curl_mancuerna: "Curl con mancuerna",
  dead_hang: "Dead hang",
  fondos: "Fondos",
  flexiones: "Flexiones",
  flexiones_cerradas: "Flexiones cerradas",
  plancha: "Plancha",
  press_hombro_mancuerna: "Press de hombro con mancuerna",
  elevaciones_laterales: "Elevaciones laterales",
  pajaros: "Pajaros",
  isometrico_lateral: "Isometrico lateral",
  leg_raises: "Leg raises",
  shrugs: "Shrugs",
  goblet_squat: "Goblet squat",
  bulgaras: "Bulgaras",
  rumano: "Rumano",
  puente_gluteo: "Puente de gluteo",
};

function toTitleWords(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRoutineDisplayName(value: string | null | undefined): string {
  if (!value || typeof value !== "string") {
    return "Untitled routine";
  }

  return toTitleWords(value.trim().toLowerCase());
}

export function formatWorkoutDisplayName(value: string | null | undefined): string {
  if (!value || typeof value !== "string") {
    return "Untitled workout";
  }

  return toTitleWords(value.trim().toLowerCase());
}

export function formatExerciseDisplayName(value: string | null | undefined): string {
  if (!value || typeof value !== "string") {
    return "Untitled exercise";
  }

  const normalizedValue = value.trim().toLowerCase();
  return exerciseNameOverrides[normalizedValue] ?? toTitleWords(normalizedValue);
}

export function getExerciseDisplayName(exerciseId: string): string {
  const exerciseName = exercises.find((exercise) => exercise.id === exerciseId)?.name;
  return formatExerciseDisplayName(exerciseName ?? exerciseId);
}
