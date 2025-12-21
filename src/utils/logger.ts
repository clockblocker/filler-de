import winston from "winston";

/**
 * Logger utility with winston + console transports.
 * Rule: No object logging - stringify important parts only.
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

const logger = winston.createLogger({
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

export const log = {
	debug: (message: string, ...args: unknown[]): void => {
		logger.debug(formatMessage(message, ...args));
	},
	error: (message: string, ...args: unknown[]): void => {
		logger.error(formatMessage(message, ...args));
	},
	info: (message: string, ...args: unknown[]): void => {
		logger.info(formatMessage(message, ...args));
	},
	warn: (message: string, ...args: unknown[]): void => {
		logger.warn(formatMessage(message, ...args));
	},
};
