import type { LocalDate, TimeRange } from "../domain/shared";
import { parseLocalDate } from "../dates";
import type { PlanningWindow } from "./types";

const MINUTE_MS = 60_000;

export interface ResolvedPlanningWindow extends PlanningWindow {
  startMs: number;
  endMs: number;
}

export interface ResolvedRange extends TimeRange {
  startMs: number;
  endMs: number;
}

export function parseInstant(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${label} must be a valid ISO date-time`);
  }

  return parsed;
}

export function resolveRange(range: TimeRange, label: string): ResolvedRange {
  const startMs = parseInstant(range.startsAt, `${label}.startsAt`);
  const endMs = parseInstant(range.endsAt, `${label}.endsAt`);
  if (endMs <= startMs) {
    throw new RangeError(`${label} must have a positive duration`);
  }

  return { ...range, startMs, endMs };
}

export function durationMinutes(range: Pick<ResolvedRange, "startMs" | "endMs">): number {
  return Math.floor((range.endMs - range.startMs) / MINUTE_MS);
}

export function addMinutes(instantMs: number, minutes: number): number {
  return instantMs + minutes * MINUTE_MS;
}

export function toIso(instantMs: number): string {
  return new Date(instantMs).toISOString();
}

/** Merge overlapping or adjacent ranges only when they belong to the same civil date. */
export function normalizePlanningWindows(
  windows: readonly PlanningWindow[],
): ResolvedPlanningWindow[] {
  const resolved = windows
    .map((window, index) => {
      parseLocalDate(window.localDate);
      return {
        ...resolveRange(window, `workWindows[${index}]`),
        localDate: window.localDate,
      };
    })
    .sort(compareResolvedWindows);

  const normalized: ResolvedPlanningWindow[] = [];
  for (const window of resolved) {
    const previous = normalized.at(-1);
    if (
      previous &&
      previous.localDate === window.localDate &&
      window.startMs <= previous.endMs
    ) {
      previous.endMs = Math.max(previous.endMs, window.endMs);
      previous.endsAt = toIso(previous.endMs);
      continue;
    }

    normalized.push({ ...window });
  }

  return normalized;
}

export function subtractRanges(
  windows: readonly ResolvedPlanningWindow[],
  blocking: readonly ResolvedRange[],
): ResolvedPlanningWindow[] {
  let free = windows.map((window) => ({ ...window }));

  for (const block of [...blocking].sort(compareResolvedRanges)) {
    free = free.flatMap((window) => subtractRange(window, block));
  }

  return free.filter((window) => durationMinutes(window) >= 1);
}

export function reserveRange(
  windows: readonly ResolvedPlanningWindow[],
  range: ResolvedRange,
): ResolvedPlanningWindow[] {
  return windows.flatMap((window) => subtractRange(window, range));
}

function subtractRange(
  window: ResolvedPlanningWindow,
  block: ResolvedRange,
): ResolvedPlanningWindow[] {
  if (block.endMs <= window.startMs || block.startMs >= window.endMs) {
    return [{ ...window }];
  }

  const result: ResolvedPlanningWindow[] = [];
  if (block.startMs > window.startMs) {
    result.push({
      ...window,
      endMs: block.startMs,
      endsAt: toIso(block.startMs),
    });
  }

  if (block.endMs < window.endMs) {
    result.push({
      ...window,
      startMs: block.endMs,
      startsAt: toIso(block.endMs),
    });
  }

  return result;
}

export function compareResolvedRanges(
  left: Pick<ResolvedRange, "startMs" | "endMs">,
  right: Pick<ResolvedRange, "startMs" | "endMs">,
): number {
  return left.startMs - right.startMs || left.endMs - right.endMs;
}

function compareResolvedWindows(
  left: ResolvedPlanningWindow,
  right: ResolvedPlanningWindow,
): number {
  return (
    compareResolvedRanges(left, right) ||
    left.localDate.localeCompare(right.localDate)
  );
}

export function weekdayForLocalDate(localDate: LocalDate): number {
  parseLocalDate(localDate);
  const parsed = Date.parse(`${localDate}T00:00:00.000Z`);

  return new Date(parsed).getUTCDay();
}
