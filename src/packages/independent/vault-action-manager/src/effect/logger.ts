import { Logger } from "effect";
import { logger } from "../internal/logger";

function messages(value: unknown): readonly unknown[] {
	return Array.isArray(value) ? value : [value];
}

/** Routes Effect-native VAM logs through the repository logging sink. */
export const VamLoggerLive = Logger.layer([
	Logger.make<unknown, void>(({ logLevel, message }) => {
		const [head, ...args] = messages(message);
		const text = typeof head === "string" ? head : String(head);

		if (logLevel === "Fatal" || logLevel === "Error") {
			logger.error(text, ...args);
			return;
		}
		if (logLevel === "Warn") {
			logger.warn(text, ...args);
			return;
		}
		logger.info(text, ...args);
	}),
]);
