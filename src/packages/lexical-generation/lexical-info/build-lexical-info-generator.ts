import { err, ok, type Result } from "neverthrow";
import {
	type LexicalGenerationError,
	LexicalGenerationFailureKind,
} from "../errors";
import { executePrompt } from "../internal/prompt-executor";
import type { PromptKind } from "../internal/prompt-smith/codegen/consts";
import type { AgentOutput, UserInput } from "../internal/prompt-smith/schemas";
import { wikilinkHelper } from "../internal/shared/wikilink";
import type {
	CreateLexicalGenerationModuleParams,
	GenerateLexicalInfoOptions,
	LexemFeatures,
	LexemInflections,
	LexicalCore,
	LexicalGenerationSettings,
	LexicalInfo,
	LexicalInfoField,
	LexicalInfoGenerator,
	MorphemicBreakdown,
	ResolvedLemma,
} from "../public-types";

type PromptDeps = Pick<
	CreateLexicalGenerationModuleParams,
	"fetchStructured" | "knownLang" | "targetLang"
> & {
	settings: LexicalGenerationSettings;
};

type CorePromptKind =
	| "LexemEnrichment"
	| "NounEnrichment"
	| "PhrasemEnrichment";

type FeaturePromptKind = Extract<PromptKind, `Features${string}`>;
type FeaturePromptOutput =
	| AgentOutput<"FeaturesAdjective">
	| AgentOutput<"FeaturesAdverb">
	| AgentOutput<"FeaturesArticle">
	| AgentOutput<"FeaturesConjunction">
	| AgentOutput<"FeaturesInteractionalUnit">
	| AgentOutput<"FeaturesNoun">
	| AgentOutput<"FeaturesParticle">
	| AgentOutput<"FeaturesPreposition">
	| AgentOutput<"FeaturesPronoun">
	| AgentOutput<"FeaturesVerb">;
type FeaturePromptResult = Result<FeaturePromptOutput, LexicalGenerationError>;
type GenericInflectionResult = Result<
	AgentOutput<"Inflection">,
	LexicalGenerationError
>;
type NounInflectionResult = Result<
	AgentOutput<"NounInflection">,
	LexicalGenerationError
>;
type MorphemResult = Result<AgentOutput<"Morphem">, LexicalGenerationError>;
type RelationResult = Result<AgentOutput<"Relation">, LexicalGenerationError>;

function isHardStopFailure(error: LexicalGenerationError): boolean {
	switch (error.kind) {
		case LexicalGenerationFailureKind.InternalContractViolation:
		case LexicalGenerationFailureKind.PromptNotAvailable:
		case LexicalGenerationFailureKind.UnsupportedLanguagePair:
			return true;
		default:
			return false;
	}
}

function findHardStopFailure(
	results: Array<Result<unknown, LexicalGenerationError> | null>,
): LexicalGenerationError | null {
	for (const result of results) {
		if (result?.isErr() && isHardStopFailure(result.error)) {
			return result.error;
		}
	}

	return null;
}

function buildCorePrompt(lemma: ResolvedLemma): {
	input: UserInput<CorePromptKind>;
	kind: CorePromptKind;
} {
	if (lemma.linguisticUnit === "Phrasem") {
		return {
			input: {
				context: "",
				kind: lemma.posLikeKind,
				word: lemma.lemma,
			},
			kind: "PhrasemEnrichment",
		};
	}

	if (lemma.posLikeKind === "Noun") {
		return {
			input: {
				context: "",
				word: lemma.lemma,
			},
			kind: "NounEnrichment",
		};
	}

	return {
		input: {
			context: "",
			pos: lemma.posLikeKind,
			word: lemma.lemma,
		},
		kind: "LexemEnrichment",
	};
}

function parseGenericInflectionForms(
	rawForms: string,
): Array<{ form: string }> {
	return rawForms
		.split(",")
		.map((form) => form.trim())
		.filter((form) => form.length > 0)
		.map((form) => {
			const [wikilink] = wikilinkHelper.parse(form);
			if (wikilink) {
				return {
					form: wikilinkHelper.normalizeLinkTarget(wikilink.surface),
				};
			}

			return { form: wikilinkHelper.normalizeLinkTarget(form) };
		})
		.filter((form) => form.form.length > 0);
}

function mapCoreOutputToCore(
	output:
		| AgentOutput<"LexemEnrichment">
		| AgentOutput<"NounEnrichment">
		| AgentOutput<"PhrasemEnrichment">,
): LexicalCore {
	return {
		emojiDescription: output.emojiDescription,
		ipa: output.ipa,
		...("genus" in output || "nounClass" in output
			? {
					nounIdentity: {
						...("genus" in output && output.genus != null
							? { genus: output.genus }
							: {}),
						...("nounClass" in output && output.nounClass != null
							? { nounClass: output.nounClass }
							: {}),
					},
				}
			: {}),
		...(typeof output.senseGloss === "string" &&
		output.senseGloss.length > 0
			? { senseGloss: output.senseGloss }
			: {}),
	};
}

function coreWithFallbackEmoji(
	precomputedEmojiDescription?: string[],
): LexicalInfoField<LexicalCore> | null {
	if (
		!precomputedEmojiDescription ||
		precomputedEmojiDescription.length === 0
	) {
		return null;
	}

	return {
		status: "ready",
		value: {
			emojiDescription: precomputedEmojiDescription,
			ipa: "unknown",
		},
	};
}

function withPrecomputedEmojiDescription(
	coreField: LexicalInfoField<LexicalCore>,
	precomputedEmojiDescription?: string[],
): LexicalInfoField<LexicalCore> {
	if (
		coreField.status !== "ready" ||
		!precomputedEmojiDescription ||
		precomputedEmojiDescription.length === 0
	) {
		return coreField;
	}

	return {
		status: "ready",
		value: {
			...coreField.value,
			emojiDescription: precomputedEmojiDescription,
		},
	};
}

function resolveFeaturesPromptKind(
	lemma: Extract<ResolvedLemma, { linguisticUnit: "Lexem" }>,
): FeaturePromptKind {
	switch (lemma.posLikeKind) {
		case "Adjective":
			return "FeaturesAdjective";
		case "Adverb":
			return "FeaturesAdverb";
		case "Article":
			return "FeaturesArticle";
		case "Conjunction":
			return "FeaturesConjunction";
		case "InteractionalUnit":
			return "FeaturesInteractionalUnit";
		case "Noun":
			return "FeaturesNoun";
		case "Particle":
			return "FeaturesParticle";
		case "Preposition":
			return "FeaturesPreposition";
		case "Pronoun":
			return "FeaturesPronoun";
		case "Verb":
			return "FeaturesVerb";
	}
}

function isProperNounFromCore(
	coreField: LexicalInfoField<LexicalCore>,
	coreOutput:
		| AgentOutput<"NounEnrichment">
		| AgentOutput<"LexemEnrichment">
		| AgentOutput<"PhrasemEnrichment">
		| null,
): boolean {
	if (coreField.status !== "ready") {
		return false;
	}

	return (
		!!coreOutput &&
		"nounClass" in coreOutput &&
		coreOutput.nounClass === "Proper"
	);
}

function shouldGenerateRelations(
	lemma: ResolvedLemma,
	isProperNoun: boolean,
): boolean {
	if (isProperNoun) {
		return false;
	}
	if (lemma.linguisticUnit === "Phrasem") {
		return true;
	}

	switch (lemma.posLikeKind) {
		case "Adjective":
		case "Adverb":
		case "Noun":
		case "Particle":
		case "Preposition":
		case "Verb":
			return true;
		default:
			return false;
	}
}

function shouldGenerateMorphemicBreakdown(
	lemma: ResolvedLemma,
	isProperNoun: boolean,
): boolean {
	if (lemma.linguisticUnit === "Phrasem") {
		return false;
	}

	return !isProperNoun;
}

function shouldGenerateInflections(
	settings: LexicalGenerationSettings,
	lemma: ResolvedLemma,
	isProperNoun: boolean,
): "disabled" | "not_applicable" | "generate" {
	if (!settings.generateInflections) {
		return "disabled";
	}
	if (lemma.linguisticUnit === "Phrasem" || isProperNoun) {
		return "not_applicable";
	}

	switch (lemma.posLikeKind) {
		case "Adjective":
		case "Article":
		case "Noun":
		case "Pronoun":
		case "Verb":
			return "generate";
		default:
			return "not_applicable";
	}
}

function mapFeaturesField(
	lemma: Extract<ResolvedLemma, { linguisticUnit: "Lexem" }>,
	coreOutput:
		| AgentOutput<"LexemEnrichment">
		| AgentOutput<"NounEnrichment">
		| AgentOutput<"PhrasemEnrichment">
		| null,
	featuresResult: FeaturePromptResult | null,
): LexicalInfoField<LexemFeatures> {
	if (!featuresResult) {
		return { status: "not_applicable" };
	}
	if (featuresResult.isErr()) {
		return { error: featuresResult.error, status: "error" };
	}

	if (lemma.posLikeKind === "Adjective") {
		const value = featuresResult.value as AgentOutput<"FeaturesAdjective">;
		return {
			status: "ready",
			value: {
				classification: value.classification,
				distribution: value.distribution,
				gradability: value.gradability,
				kind: "adjective",
				valency: {
					governedPattern: value.valency.governedPattern,
					governedPreposition:
						value.valency.governedPreposition ?? undefined,
				},
			},
		};
	}

	if (lemma.posLikeKind === "Verb") {
		const value = featuresResult.value as AgentOutput<"FeaturesVerb">;
		return {
			status: "ready",
			value: {
				conjugation: value.conjugation,
				kind: "verb",
				valency: {
					governedPreposition:
						value.valency.governedPreposition ?? undefined,
					reflexivity: value.valency.reflexivity,
					separability: value.valency.separability,
				},
			},
		};
	}

	if (lemma.posLikeKind === "Noun") {
		const value = featuresResult.value as AgentOutput<"FeaturesNoun">;
		return {
			status: "ready",
			value: {
				genus:
					coreOutput && "genus" in coreOutput
						? (coreOutput.genus ?? undefined)
						: undefined,
				kind: "noun",
				nounClass:
					coreOutput && "nounClass" in coreOutput
						? (coreOutput.nounClass ?? undefined)
						: undefined,
				tags: value.tags,
			},
		};
	}

	const value = featuresResult.value as AgentOutput<"FeaturesAdverb">;
	return {
		status: "ready",
		value: {
			kind: "tags",
			tags: value.tags,
		},
	};
}

function mapInflectionsField(
	inflectionResult: GenericInflectionResult | NounInflectionResult | null,
	status: "disabled" | "not_applicable" | "generate",
): LexicalInfoField<LexemInflections> {
	if (status === "disabled") {
		return { status: "disabled" };
	}
	if (status === "not_applicable") {
		return { status: "not_applicable" };
	}
	if (!inflectionResult) {
		return { status: "not_applicable" };
	}
	if (inflectionResult.isErr()) {
		return { error: inflectionResult.error, status: "error" };
	}
	if ("cells" in inflectionResult.value) {
		return {
			status: "ready",
			value: {
				cells: inflectionResult.value.cells,
				genus: inflectionResult.value.genus,
				kind: "noun",
			},
		};
	}

	return {
		status: "ready",
		value: {
			kind: "generic",
			rows: inflectionResult.value.rows.map((row) => ({
				forms: parseGenericInflectionForms(row.forms),
				label: row.label,
			})),
		},
	};
}

function mapMorphemicBreakdownField(
	result: MorphemResult | null,
	applicable: boolean,
): LexicalInfoField<MorphemicBreakdown> {
	if (!applicable) {
		return { status: "not_applicable" };
	}
	if (!result) {
		return { status: "not_applicable" };
	}
	if (result.isErr()) {
		return { error: result.error, status: "error" };
	}

	return {
		status: "ready",
		value: {
			compoundedFrom: result.value.compounded_from ?? undefined,
			derivedFrom: result.value.derived_from
				? {
						derivationType:
							result.value.derived_from.derivation_type,
						lemma: result.value.derived_from.lemma,
					}
				: undefined,
			morphemes: result.value.morphemes.map((morpheme) => ({
				kind: morpheme.kind,
				lemma: morpheme.lemma ?? undefined,
				separability: morpheme.separability ?? undefined,
				surface: morpheme.surf,
			})),
		},
	};
}

function mapRelationsField(result: RelationResult | null, applicable: boolean) {
	if (!applicable) {
		return { status: "not_applicable" } as const;
	}
	if (!result) {
		return { status: "not_applicable" } as const;
	}
	if (result.isErr()) {
		return { error: result.error, status: "error" } as const;
	}

	return {
		status: "ready",
		value: {
			relations: result.value.relations,
		},
	} as const;
}

export function buildLexicalInfoGenerator(
	deps: PromptDeps,
): LexicalInfoGenerator {
	return async (
		lemma: ResolvedLemma,
		attestation: string,
		options: GenerateLexicalInfoOptions = {},
	) => {
		const corePrompt = buildCorePrompt(lemma);
		corePrompt.input.context = attestation;
		const coreResult = await executePrompt(
			deps,
			corePrompt.kind,
			corePrompt.input,
		);
		if (coreResult.isErr() && isHardStopFailure(coreResult.error)) {
			return err(coreResult.error);
		}

		const coreField = withPrecomputedEmojiDescription(
			coreResult.isOk()
				? ({
						status: "ready",
						value: mapCoreOutputToCore(coreResult.value),
					} as const)
				: (coreWithFallbackEmoji(
						options.precomputedEmojiDescription,
					) ?? {
						error: coreResult.error,
						status: "error",
					}),
			options.precomputedEmojiDescription,
		);
		const coreOutput = coreResult.isOk() ? coreResult.value : null;
		const isProperNoun = isProperNounFromCore(coreField, coreOutput);

		const relationApplicable = shouldGenerateRelations(lemma, isProperNoun);
		const morphemApplicable = shouldGenerateMorphemicBreakdown(
			lemma,
			isProperNoun,
		);
		const inflectionMode = shouldGenerateInflections(
			deps.settings,
			lemma,
			isProperNoun,
		);

		const featuresPromise =
			lemma.linguisticUnit === "Lexem"
				? executePrompt(deps, resolveFeaturesPromptKind(lemma), {
						context: attestation,
						word: lemma.lemma,
					})
				: Promise.resolve(null);
		const relationPromise = relationApplicable
			? executePrompt(deps, "Relation", {
					context: attestation,
					pos: lemma.posLikeKind,
					word: lemma.lemma,
				})
			: Promise.resolve(null);
		const morphemPromise = morphemApplicable
			? executePrompt(deps, "Morphem", {
					context: attestation,
					word: lemma.lemma,
				})
			: Promise.resolve(null);
		const inflectionPromise =
			lemma.linguisticUnit === "Lexem" && inflectionMode === "generate"
				? lemma.posLikeKind === "Noun"
					? executePrompt(deps, "NounInflection", {
							context: attestation,
							word: lemma.lemma,
						})
					: executePrompt(deps, "Inflection", {
							context: attestation,
							pos: lemma.posLikeKind,
							word: lemma.lemma,
						})
				: Promise.resolve(null);

		const [
			featuresResult,
			relationsResult,
			morphemResult,
			inflectionResult,
		] = await Promise.all([
			featuresPromise,
			relationPromise,
			morphemPromise,
			inflectionPromise,
		]);
		const hardStopFailure = findHardStopFailure([
			featuresResult,
			relationsResult,
			morphemResult,
			inflectionResult,
		]);
		if (hardStopFailure) {
			return err(hardStopFailure);
		}

		if (lemma.linguisticUnit === "Phrasem") {
			const lexicalInfo: LexicalInfo = {
				core: coreField,
				features: { status: "not_applicable" },
				inflections: { status: "not_applicable" },
				lemma,
				morphemicBreakdown: mapMorphemicBreakdownField(
					morphemResult,
					morphemApplicable,
				),
				relations: mapRelationsField(
					relationsResult,
					relationApplicable,
				),
			};
			return ok(lexicalInfo);
		}

		const lexicalInfo: LexicalInfo = {
			core: coreField,
			features: mapFeaturesField(lemma, coreOutput, featuresResult),
			inflections: mapInflectionsField(inflectionResult, inflectionMode),
			lemma,
			morphemicBreakdown: mapMorphemicBreakdownField(
				morphemResult,
				morphemApplicable,
			),
			relations: mapRelationsField(relationsResult, relationApplicable),
		};

		return ok(lexicalInfo);
	};
}
