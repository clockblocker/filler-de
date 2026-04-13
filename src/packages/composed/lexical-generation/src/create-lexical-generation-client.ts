import { ok } from "neverthrow";
import type {
	CreateLexicalGenerationClientParams,
	LexicalGenerationClient,
	LexicalGenerationClientResult,
} from "./public-types";
import { buildSenseDisambiguator } from "./disambiguation";
import { buildPartGenerators } from "./lexical-info";
import { buildSelectionResolver } from "./resolve-selection";
import { validatePromptAvailability } from "./internal/prompt-executor";

export function createLexicalGenerationClient(
	params: CreateLexicalGenerationClientParams,
): LexicalGenerationClientResult {
	const validationError = validatePromptAvailability(params);
	if (validationError) {
		return validationError;
	}

	const resolveSelection = buildSelectionResolver(params);
	const disambiguateSense = buildSenseDisambiguator(params);
	const generators = buildPartGenerators(params);

	const client: LexicalGenerationClient = {
		disambiguateSense,
		generateCore: generators.generateCore,
		generateFeatures: generators.generateFeatures,
		generateInflections: generators.generateInflections,
		generateLexicalInfo: generators.generateLexicalInfo,
		generateMorphemicBreakdown: generators.generateMorphemicBreakdown,
		generateRelations: generators.generateRelations,
		resolveSelection,
	};

	return ok(client);
}
