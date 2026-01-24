import { logger } from "../../../utils/logger";

export type ExplainGrammarPayload = {
	selection: string;
};

export type ExplainGrammarDeps = Record<string, never>;

/**
 * Explain grammar of selected text.
 * TODO: Not yet implemented.
 */
export async function explainGrammarCommand(
	_payload: ExplainGrammarPayload,
	_deps: ExplainGrammarDeps,
): Promise<void> {
	logger.warn("[explainGrammarCommand] Not implemented");
}
