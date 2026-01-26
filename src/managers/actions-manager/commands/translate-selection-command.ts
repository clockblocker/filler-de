import { logger } from "../../../utils/logger";

export type TranslateSelectionPayload = {
	selection: string;
};

export type TranslateSelectionDeps = Record<string, never>;

/**
 * Translate selected text.
 */
export async function translateSelectionCommand(
	payload: TranslateSelectionPayload,
	_deps: TranslateSelectionDeps,
): Promise<void> {
	const { selection } = payload;
	logger.info(
		`[translateSelectionCommand] selection: ${JSON.stringify(selection)}`,
	);
}
