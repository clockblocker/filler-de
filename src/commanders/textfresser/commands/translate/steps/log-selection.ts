import { ok, type Result } from "neverthrow";
import { logger } from "../../../../../utils/logger";
import type { CommandError, CommandState } from "../../types";

export function logSelection(
	ctx: CommandState<"TranslateSelection">,
): Result<CommandState<"TranslateSelection">, CommandError> {
	logger.info("[translateCommand] selection:", ctx.selection);
	return ok(ctx);
}
