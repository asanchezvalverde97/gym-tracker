const MAX_REST_SECONDS = 330;

export const REST_SECONDS_OPTIONS = [0, 30];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function getRestSecondsOptions(): number[] {
  return REST_SECONDS_OPTIONS;
}

export function toRestParts(
  totalSeconds: number | null | undefined,
): { minutes: number; seconds: number } {
  const clamped = clamp(totalSeconds ?? 0, 0, MAX_REST_SECONDS);

  return {
    minutes: Math.floor(clamped / 60),
    seconds: clamped % 60,
  };
}

export function fromRestParts(minutes: number, seconds: number): number {
  const safeMinutes = clamp(minutes, 0, 5);
  const safeSeconds = seconds === 30 ? 30 : 0;

  return clamp(safeMinutes * 60 + safeSeconds, 0, MAX_REST_SECONDS);
}
