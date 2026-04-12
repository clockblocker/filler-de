import { ok } from "neverthrow";
import { buildSenseDisambiguator } from "./disambiguation/build-sense-disambiguator";
import { validatePromptAvailability } from "./internal/prompt-executor";
import { buildSelectionResolver } from "./lemma/build-lemma-generator";
import { buildLexicalInfoGenerator } from "./lexical-info/build-lexical-info-generator";
import type {
	CreateLexicalGenerationModuleParams,
	LexicalGenerationModuleResult,
} from "./public-types";

export function createLexicalGenerationModule(
	params: CreateLexicalGenerationModuleParams,
): LexicalGenerationModuleResult {
	const validationError = validatePromptAvailability(params);
	if (validationError) {
		return validationError;
	}

	return ok({
		disambiguateSense: buildSenseDisambiguator(params),
		generateLexicalInfo: buildLexicalInfoGenerator(params),
		resolveSelection: buildSelectionResolver(params),
	});
}
