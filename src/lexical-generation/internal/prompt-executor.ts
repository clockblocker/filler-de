import { err, type Result } from "neverthrow";
import {
	type AgentOutput,
	PROMPT_FOR,
	SchemasFor,
	type UserInput,
} from "../../prompt-smith";
import type { PromptKind } from "../../prompt-smith/codegen/consts";
import {
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "../errors";
import type {
	CreateLexicalGenerationModuleParams,
	ZodSchemaLike,
} from "../public-types";

type PromptExecutorDeps = Pick<
	CreateLexicalGenerationModuleParams,
	"fetchStructured" | "knownLang" | "targetLang"
>;

export const REQUIRED_PROMPT_KINDS = [
	"Lemma",
	"Disambiguate",
	"LexemEnrichment",
	"NounEnrichment",
	"PhrasemEnrichment",
	"Relation",
	"Morphem",
	"Inflection",
	"NounInflection",
	"FeaturesNoun",
	"FeaturesPronoun",
	"FeaturesArticle",
	"FeaturesAdjective",
	"FeaturesVerb",
	"FeaturesPreposition",
	"FeaturesAdverb",
	"FeaturesParticle",
	"FeaturesConjunction",
	"FeaturesInteractionalUnit",
] as const satisfies readonly PromptKind[];

export function validatePromptAvailability(
	params: Pick<
		CreateLexicalGenerationModuleParams,
		"knownLang" | "targetLang"
	>,
) {
	const promptFamily = PROMPT_FOR[params.targetLang]?.[params.knownLang];
	if (!promptFamily) {
		return err(
			lexicalGenerationError(
				LexicalGenerationFailureKind.UnsupportedLanguagePair,
				`Unsupported language pair: ${params.targetLang} -> ${params.knownLang}`,
				{ knownLang: params.knownLang, targetLang: params.targetLang },
			),
		);
	}

	for (const kind of REQUIRED_PROMPT_KINDS) {
		const prompt = promptFamily[kind];
		const schema = SchemasFor[kind]?.agentOutputSchema;
		if (!prompt?.systemPrompt || !schema) {
			return err(
				lexicalGenerationError(
					LexicalGenerationFailureKind.PromptNotAvailable,
					`Missing prompt asset for ${kind}`,
					{
						kind,
						knownLang: params.knownLang,
						targetLang: params.targetLang,
					},
				),
			);
		}
	}

	return null;
}

export async function executePrompt<K extends PromptKind>(
	deps: PromptExecutorDeps,
	kind: K,
	input: UserInput<K>,
): Promise<Result<AgentOutput<K>, import("../errors").LexicalGenerationError>> {
	const prompt = PROMPT_FOR[deps.targetLang]?.[deps.knownLang]?.[kind];
	const schema = SchemasFor[kind]?.agentOutputSchema as ZodSchemaLike<
		AgentOutput<K>
	>;
	if (!prompt?.systemPrompt || !schema) {
		return err(
			lexicalGenerationError(
				LexicalGenerationFailureKind.PromptNotAvailable,
				`Missing prompt asset for ${kind}`,
				{
					kind,
					knownLang: deps.knownLang,
					targetLang: deps.targetLang,
				},
			),
		);
	}

	try {
		return await deps.fetchStructured<AgentOutput<K>>({
			requestLabel: kind,
			schema,
			systemPrompt: prompt.systemPrompt,
			userInput:
				typeof input === "string" ? input : JSON.stringify(input),
			withCache: true,
		});
	} catch (error) {
		return err(
			lexicalGenerationError(
				LexicalGenerationFailureKind.InternalContractViolation,
				`fetchStructured threw while executing ${kind}`,
				{
					error:
						error instanceof Error ? error.message : String(error),
					kind,
				},
			),
		);
	}
}
