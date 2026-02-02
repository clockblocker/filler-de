import { logger } from "../../../utils/logger";
import type { CommandContext } from "../types";

export type TranslateSelectionDeps = Record<string, never>;

/**
 * Translate selected text.
 * Uses context.selection from VAM.
 */
export async function translateSelectionCommand(
	context: CommandContext,
	_deps: TranslateSelectionDeps,
): Promise<void> {
	const selection = context.selection?.text;
	logger.info(
		`[translateSelectionCommand] selection: ${JSON.stringify(selection)}`,
	);
}
