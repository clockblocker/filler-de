import { logger } from "../../../utils/logger";

export type TranslateSelectionPayload = {
	selection: string;
};

export type TranslateSelectionDeps = Record<string, never>;

/**
 * Translate selected text.
 * TODO: Not yet implemented.
 */
export async function translateSelectionCommand(
	_payload: TranslateSelectionPayload,
	_deps: TranslateSelectionDeps,
): Promise<void> {
	logger.warn("[translateSelectionCommand] Not implemented");
}
