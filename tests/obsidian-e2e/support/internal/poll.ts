import { INTERVAL_DEFAULT_MS, TIMEOUT_DEFAULT_MS } from "../config";
import type { PollOptions, PollResult } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolveTimeoutMs(opts: PollOptions): number {
  if (opts.timeoutMs != null) return opts.timeoutMs;
  return TIMEOUT_DEFAULT_MS + (opts.timeoutOffset ?? 0);
}

function resolveIntervalMs(opts: PollOptions): number {
  if (opts.intervalMs != null) return opts.intervalMs;
  return INTERVAL_DEFAULT_MS + (opts.intervalOffset ?? 0);
}

/**
 * Generic polling engine.
 * - returns structured info (attempts, waitedMs) for better error messages
 */
export async function poll<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  opts: PollOptions = {},
): Promise<PollResult<T>> {
  const timeoutMs = resolveTimeoutMs(opts);
  const intervalMs = resolveIntervalMs(opts);
  const label = opts.label;

  const start = Date.now();
  let attempts = 0;
  let lastValue: T | undefined;

  while (Date.now() - start < timeoutMs) {
    attempts++;
    lastValue = await fn();
    if (predicate(lastValue)) {
      return {
        attempts,
        intervalMs,
        label,
        ok: true,
        timeoutMs,
        value: lastValue,
        waitedMs: Date.now() - start,
      };
    }
    await sleep(intervalMs);
  }

  return {
    attempts,
    intervalMs,
    label,
    ok: false,
    timeoutMs,
    value: lastValue,
    waitedMs: Date.now() - start,
  };
}