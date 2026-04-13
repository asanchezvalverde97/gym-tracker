import type { Exercise } from "../types/workout";

const createdAt = "2026-04-12T00:00:00.000Z";

export const exercises: Exercise[] = [
  { id: "ex_dominadas", name: "dominadas", metricType: "reps", createdAt },
  {
    id: "ex_remo_mancuerna",
    name: "remo_mancuerna",
    metricType: "reps",
    createdAt,
  },
  { id: "ex_chin_ups", name: "chin_ups", metricType: "reps", createdAt },
  {
    id: "ex_curl_mancuerna",
    name: "curl_mancuerna",
    metricType: "reps",
    createdAt,
  },
  { id: "ex_dead_hang", name: "dead_hang", metricType: "duration", createdAt },
  { id: "ex_fondos", name: "fondos", metricType: "reps", createdAt },
  { id: "ex_flexiones", name: "flexiones", metricType: "reps", createdAt },
  {
    id: "ex_flexiones_cerradas",
    name: "flexiones_cerradas",
    metricType: "reps",
    createdAt,
  },
  { id: "ex_plancha", name: "plancha", metricType: "duration", createdAt },
  {
    id: "ex_press_hombro_mancuerna",
    name: "press_hombro_mancuerna",
    metricType: "reps",
    createdAt,
  },
  {
    id: "ex_elevaciones_laterales",
    name: "elevaciones_laterales",
    metricType: "reps",
    createdAt,
  },
  { id: "ex_pajaros", name: "pajaros", metricType: "reps", createdAt },
  {
    id: "ex_isometrico_lateral",
    name: "isometrico_lateral",
    metricType: "duration",
    createdAt,
  },
  { id: "ex_leg_raises", name: "leg_raises", metricType: "reps", createdAt },
  { id: "ex_shrugs", name: "shrugs", metricType: "reps", createdAt },
  {
    id: "ex_goblet_squat",
    name: "goblet_squat",
    metricType: "reps",
    createdAt,
  },
  { id: "ex_bulgaras", name: "bulgaras", metricType: "reps", createdAt },
  { id: "ex_rumano", name: "rumano", metricType: "reps", createdAt },
  {
    id: "ex_puente_gluteo",
    name: "puente_gluteo",
    metricType: "reps",
    createdAt,
  },
];
