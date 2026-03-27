type LogMethod = "error" | "info" | "warn";

type LogSink = {
	[Method in LogMethod]: (message: string) => void;
};

function formatMessage(message: string, args: readonly unknown[]): string {
	if (args.length === 0) {
		return message;
	}

	const rendered = args.map((arg) => {
		if (typeof arg === "object") {
			try {
				return JSON.stringify(arg, null, 2);
			} catch {
				return "[Object]";
			}
		}
		if (arg === null || arg === undefined) {
			return String(arg);
		}
		return String(arg);
	});

	return `${message} ${rendered.join(" ")}`;
}

const sink: LogSink = globalThis.console;

function write(
	method: LogMethod,
	message: string,
	args: readonly unknown[],
): void {
	sink[method](formatMessage(message, args));
}

export const logger = {
	error(message: string, ...args: unknown[]): void {
		write("error", message, args);
	},
	info(message: string, ...args: unknown[]): void {
		write("info", message, args);
	},
	warn(message: string, ...args: unknown[]): void {
		write("warn", message, args);
	},
};
