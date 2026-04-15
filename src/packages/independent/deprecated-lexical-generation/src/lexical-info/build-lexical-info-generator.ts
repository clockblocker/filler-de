import { err, ok, type Result } from "neverthrow";
import {
	type LexicalGenerationError,
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "../errors";
import { executePrompt } from "../internal/prompt-executor";
import type { PromptKind } from "../internal/prompt-smith/codegen/consts";
import type { AgentOutput, UserInput } from "../internal/prompt-smith/schemas";
import { wikilinkHelper } from "../internal/shared/wikilink";
import type {
	CreateLexicalGenerationModuleParams,
	GenerateLexicalInfoOptions,
	LexicalCore,
	LexicalFeatures,
	LexicalGenerationSettings,
	LexicalInfo,
	LexicalInfoField,
	LexicalInfoGenerator,
	LexemeInflections,
	MorphemicBreakdown,
	ResolvedSelection,
} from "../public-types";
import {
	getSpelledLemma,
	isKnownSelection,
	isLexemeSelection,
	isPhrasemeSelection,
} from "../selection-helpers";

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

function buildCorePrompt(lemma: ResolvedSelection): {
	input: UserInput<CorePromptKind>;
	kind: CorePromptKind;
} | null {
	if (!isKnownSelection(lemma)) {
		return null;
	}

	if (isPhrasemeSelection(lemma)) {
		return {
			input: {
				context: "",
				kind: lemma.surface.discriminators.lemmaSubKind,
				word: getSpelledLemma(lemma) ?? "",
			},
			kind: "PhrasemEnrichment",
		};
	}

	if (
		isLexemeSelection(lemma) &&
		(lemma.surface.discriminators.lemmaSubKind === "NOUN" ||
			lemma.surface.discriminators.lemmaSubKind === "PROPN")
	) {
		return {
			input: {
				context: "",
				word: getSpelledLemma(lemma) ?? "",
			},
			kind: "NounEnrichment",
		};
	}

	if (!isLexemeSelection(lemma)) {
		return null;
	}

	return {
		input: {
			context: "",
			pos: lemma.surface.discriminators.lemmaSubKind,
			word: getSpelledLemma(lemma) ?? "",
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
		senseEmojis: output.senseEmojis,
		ipa: output.ipa,
		...(typeof output.senseGloss === "string" &&
		output.senseGloss.length > 0
			? { senseGloss: output.senseGloss }
			: {}),
	};
}

function coreWithFallbackEmoji(
	precomputedSenseEmojis?: string[],
): LexicalInfoField<LexicalCore> | null {
	if (
		!precomputedSenseEmojis ||
		precomputedSenseEmojis.length === 0
	) {
		return null;
	}

	return {
		status: "ready",
		value: {
			senseEmojis: precomputedSenseEmojis,
			ipa: "unknown",
		},
	};
}

function withPrecomputedSenseEmojis(
	coreField: LexicalInfoField<LexicalCore>,
	precomputedSenseEmojis?: string[],
): LexicalInfoField<LexicalCore> {
	if (
		coreField.status !== "ready" ||
		!precomputedSenseEmojis ||
		precomputedSenseEmojis.length === 0
	) {
		return coreField;
	}

	return {
		status: "ready",
		value: {
			...coreField.value,
			senseEmojis: precomputedSenseEmojis,
		},
	};
}

function resolveFeaturesPromptKind(
	lemma: Extract<
		ResolvedSelection,
		{ surface: { discriminators: { lemmaKind: "Lexeme" } } }
	>,
): FeaturePromptKind | null {
	switch (lemma.surface.discriminators.lemmaSubKind) {
		case "ADJ":
			return "FeaturesAdjective";
		case "ADV":
			return "FeaturesAdverb";
		case "ADP":
			return "FeaturesPreposition";
		case "AUX":
			return "FeaturesVerb";
		case "CCONJ":
		case "SCONJ":
			return "FeaturesConjunction";
		case "DET":
			return "FeaturesArticle";
		case "INTJ":
			return "FeaturesInteractionalUnit";
		case "NOUN":
			return "FeaturesNoun";
		case "PART":
			return "FeaturesParticle";
		case "PRON":
			return "FeaturesPronoun";
		case "VERB":
			return "FeaturesVerb";
		default:
			return null;
	}
}

function isProperNounSelection(
	selection: ResolvedSelection,
): selection is Extract<
	ResolvedSelection,
	{ surface: { discriminators: { lemmaKind: "Lexeme"; lemmaSubKind: "PROPN" } } }
> {
	return (
		isLexemeSelection(selection) &&
		selection.surface.discriminators.lemmaSubKind === "PROPN"
	);
}

const NATIVE_GENDER_FROM_LEGACY = {
	Femininum: "Fem",
	Maskulinum: "Masc",
	Neutrum: "Neut",
} as const;

const NATIVE_CASE_FROM_LEGACY = {
	Accusative: "Acc",
	Dative: "Dat",
	Genitive: "Gen",
	Nominative: "Nom",
} as const;

const NATIVE_NUMBER_FROM_LEGACY = {
	Plural: "Plur",
	Singular: "Sing",
} as const;

function mapLegacyGenderToNative(
	gender: "Femininum" | "Maskulinum" | "Neutrum" | null | undefined,
) {
	return gender ? NATIVE_GENDER_FROM_LEGACY[gender] : undefined;
}

function shouldGenerateRelations(
	lemma: ResolvedSelection,
	isProperNoun: boolean,
): boolean {
	if (isProperNoun) {
		return false;
	}
	if (isPhrasemeSelection(lemma)) {
		return true;
	}
	if (!isLexemeSelection(lemma)) {
		return false;
	}

	switch (lemma.surface.discriminators.lemmaSubKind) {
		case "ADJ":
		case "ADP":
		case "ADV":
		case "NOUN":
		case "PART":
		case "VERB":
			return true;
		default:
			return false;
	}
}

function shouldGenerateMorphemicBreakdown(
	lemma: ResolvedSelection,
	isProperNoun: boolean,
): boolean {
	if (isPhrasemeSelection(lemma)) {
		return false;
	}

	return !isProperNoun;
}

function shouldGenerateInflections(
	settings: LexicalGenerationSettings,
	lemma: ResolvedSelection,
	isProperNoun: boolean,
): "disabled" | "not_applicable" | "generate" {
	if (!settings.generateInflections) {
		return "disabled";
	}
	if (!isLexemeSelection(lemma) || isProperNoun) {
		return "not_applicable";
	}

	switch (lemma.surface.discriminators.lemmaSubKind) {
		case "ADJ":
		case "DET":
		case "NOUN":
		case "PRON":
		case "VERB":
			return "generate";
		default:
			return "not_applicable";
	}
}

function mapFeaturesField(
	lemma: ResolvedSelection,
	coreOutput:
		| AgentOutput<"LexemEnrichment">
		| AgentOutput<"NounEnrichment">
		| AgentOutput<"PhrasemEnrichment">
		| null,
	featuresResult: FeaturePromptResult | null,
): LexicalInfoField<LexicalFeatures> {
	if (!isLexemeSelection(lemma)) {
		return { status: "not_applicable" };
	}
	if (featuresResult?.isErr()) {
		return { error: featuresResult.error, status: "error" };
	}

	const inherentFeatures: LexicalFeatures["inherentFeatures"] = {};
	const legacyGender =
		coreOutput && "genus" in coreOutput ? coreOutput.genus : undefined;
	if (legacyGender != null) {
		inherentFeatures.gender = mapLegacyGenderToNative(legacyGender);
	}

	if (
		lemma.surface.discriminators.lemmaSubKind === "VERB" &&
		featuresResult &&
		featuresResult.isOk()
	) {
		const value = featuresResult.value as AgentOutput<"FeaturesVerb">;
		inherentFeatures.reflex =
			value.valency.reflexivity !== "NonReflexive" ? "Yes" : undefined;
		inherentFeatures.separable =
			value.valency.separability === "Separable" ? "Yes" : undefined;
	}

	return {
		status: "ready",
		value: {
			inherentFeatures,
		},
	};
}

function mapInflectionsField(
	inflectionResult: GenericInflectionResult | NounInflectionResult | null,
	status: "disabled" | "not_applicable" | "generate",
): LexicalInfoField<LexemeInflections> {
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
				cells: inflectionResult.value.cells.map((cell) => ({
					article: cell.article,
					case: NATIVE_CASE_FROM_LEGACY[cell.case],
					form: cell.form,
					number: NATIVE_NUMBER_FROM_LEGACY[cell.number],
				})),
				gender: NATIVE_GENDER_FROM_LEGACY[inflectionResult.value.genus],
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
					isSeparable:
						morpheme.separability === "Separable"
							? true
							: morpheme.separability === "Inseparable"
								? false
								: undefined,
					lemma: morpheme.lemma ?? undefined,
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
		lemma: ResolvedSelection,
		attestation: string,
		options: GenerateLexicalInfoOptions = {},
	) => {
		const corePrompt = buildCorePrompt(lemma);
		if (!corePrompt) {
			return err(
				lexicalGenerationError(
					LexicalGenerationFailureKind.InternalContractViolation,
					"generateLexicalInfo requires a known lexeme or phraseme selection",
				),
			);
		}
		corePrompt.input.context = attestation;
		const coreResult = await executePrompt(
			deps,
			corePrompt.kind,
			corePrompt.input,
		);
		if (coreResult.isErr() && isHardStopFailure(coreResult.error)) {
			return err(coreResult.error);
		}

		const coreField = withPrecomputedSenseEmojis(
			coreResult.isOk()
				? ({
						status: "ready",
						value: mapCoreOutputToCore(coreResult.value),
					} as const)
				: (coreWithFallbackEmoji(
						options.precomputedSenseEmojis,
					) ?? {
						error: coreResult.error,
						status: "error",
						}),
				options.precomputedSenseEmojis,
			);
			const coreOutput = coreResult.isOk() ? coreResult.value : null;
			const isProperNoun = isProperNounSelection(lemma);

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

			const featurePromptKind = isLexemeSelection(lemma)
				? resolveFeaturesPromptKind(lemma)
				: null;
			const featuresPromise = isLexemeSelection(lemma) && featurePromptKind
				? executePrompt(deps, featurePromptKind, {
						context: attestation,
						word: getSpelledLemma(lemma) ?? "",
					})
				: Promise.resolve(null);
			const relationPromise = relationApplicable
				? executePrompt(deps, "Relation", {
						context: attestation,
						pos: isLexemeSelection(lemma)
							? lemma.surface.discriminators.lemmaSubKind
							: isPhrasemeSelection(lemma)
								? lemma.surface.discriminators.lemmaSubKind
								: "unknown",
						word: getSpelledLemma(lemma) ?? "",
					})
				: Promise.resolve(null);
			const morphemPromise = morphemApplicable
				? executePrompt(deps, "Morphem", {
						context: attestation,
						word: getSpelledLemma(lemma) ?? "",
					})
				: Promise.resolve(null);
			const inflectionPromise =
				isLexemeSelection(lemma) && inflectionMode === "generate"
					? lemma.surface.discriminators.lemmaSubKind === "NOUN"
						? executePrompt(deps, "NounInflection", {
								context: attestation,
								word: getSpelledLemma(lemma) ?? "",
							})
						: executePrompt(deps, "Inflection", {
								context: attestation,
								pos: lemma.surface.discriminators.lemmaSubKind,
								word: getSpelledLemma(lemma) ?? "",
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

			if (isPhrasemeSelection(lemma)) {
				const lexicalInfo: LexicalInfo = {
					core: coreField,
					features: { status: "not_applicable" },
					inflections: { status: "not_applicable" },
					morphemicBreakdown: mapMorphemicBreakdownField(
						morphemResult,
						morphemApplicable,
				),
				relations: mapRelationsField(
						relationsResult,
						relationApplicable,
					),
					selection: lemma,
				};
				return ok(lexicalInfo);
			}

			const lexicalInfo: LexicalInfo = {
				core: coreField,
				features: mapFeaturesField(lemma, coreOutput, featuresResult),
				inflections: mapInflectionsField(inflectionResult, inflectionMode),
				morphemicBreakdown: mapMorphemicBreakdownField(
					morphemResult,
					morphemApplicable,
				),
				relations: mapRelationsField(relationsResult, relationApplicable),
				selection: lemma,
			};

		return ok(lexicalInfo);
	};
}
