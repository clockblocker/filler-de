const sink = globalThis.console;

/**
 * VAM's plain logger. It hands its arguments to `console` as they are, so
 * devtools can inspect them and an `Error` keeps its message and stack.
 */
export const logger = {
	error(message: string, ...args: unknown[]): void {
		sink.error(message, ...args);
	},
	info(message: string, ...args: unknown[]): void {
		sink.info(message, ...args);
	},
	warn(message: string, ...args: unknown[]): void {
		sink.warn(message, ...args);
	},
};
