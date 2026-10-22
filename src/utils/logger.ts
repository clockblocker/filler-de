import { recentTrace } from "./recent-trace";

type Level = "error" | "info" | "warn";

const sink = globalThis.console;

/**
 * Hands its arguments to `console` as they are, so devtools can inspect
 * them and an `Error` keeps its message and stack, and records the entry in
 * `recentTrace`.
 */
function write(level: Level, message: string, args: readonly unknown[]): void {
	sink[level](message, ...args);
	recentTrace.recordLog(level, [message, ...args]);
}

export const logger = {
	error: (message: string, ...args: unknown[]): void =>
		write("error", message, args),
	info: (message: string, ...args: unknown[]): void =>
		write("info", message, args),
	warn: (message: string, ...args: unknown[]): void =>
		write("warn", message, args),
};
