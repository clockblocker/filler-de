import { logger } from "../../../../utils/logger";
import type { CommandError } from "../../commands/types";
import { extractErrorReason } from "../../errors";

/** Returns a .mapErr() callback that notifies the user and logs the error. */
export function notifyAndLogError(
	notify: (message: string) => void,
	logContext: string,
): (error: CommandError) => CommandError {
	return (error) => {
		const reason = extractErrorReason(error);
		notify(`⚠ ${reason}`);
		logger.warn(`[${logContext}] Failed:`, error);
		return error;
	};
}
