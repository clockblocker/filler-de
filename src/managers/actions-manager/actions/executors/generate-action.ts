import { logger } from "../../../../utils/logger";

export type GeneratePayload = {
	selection: string;
};

export type GenerateDeps = Record<string, never>;

/**
 * Generate content from selected text.
 * TODO: Not yet implemented.
 */
export async function generateAction(
	_payload: GeneratePayload,
	_deps: GenerateDeps,
): Promise<void> {
	logger.warn("[generateAction] Not implemented");
}
