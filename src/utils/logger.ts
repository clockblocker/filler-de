import winston from "winston";

/**
 * Logger utility with winston + console transports.
 * Objects are auto-stringified — no manual JSON.stringify() needed.
 */

const formatMessage = (message: string, ...args: unknown[]): string => {
	if (args.length === 0) {
		return message;
	}

	const stringifiedArgs = args.map((arg) => {
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

	return `${message} ${stringifiedArgs.join(" ")}`;
};

const winstonLogger = winston.createLogger({
	format: winston.format.combine(
		winston.format.errors({ stack: true }),
		winston.format.printf(({ level, message, timestamp, stack }) => {
			const ts = timestamp ?? new Date().toISOString();
			return `[${ts}] ${level.toUpperCase()}: ${stack ?? message}`;
		}),
	),
	level: "info",
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.printf(({ level, message, stack }) => {
					return `${level}: ${stack ?? message}`;
				}),
			),
		}),
	],
});

export const logger = {
	error: (message: string, ...args: unknown[]): void => {
		winstonLogger.error(formatMessage(message, ...args));
	},
	info: (message: string, ...args: unknown[]): void => {
		winstonLogger.info(formatMessage(message, ...args));
	},
	warn: (message: string, ...args: unknown[]): void => {
		winstonLogger.warn(formatMessage(message, ...args));
	},
};
