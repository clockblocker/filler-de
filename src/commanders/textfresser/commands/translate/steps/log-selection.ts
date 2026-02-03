import { ok, type Result } from "neverthrow";
import { logger } from "../../../../../utils/logger";
import type { CommandError, CommandState } from "../../types";

export function logSelection(
	ctx: CommandState,
): Result<CommandState, CommandError> {
	logger.info("[translateCommand] selection:", ctx.commandContext.selection);
	return ok(ctx);
}
