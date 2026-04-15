import type { MorphemeKind } from "../../../../deprecated-linguistic-enums";
import { err, ok, type Result } from "neverthrow";
import {
	type LexicalGenerationError,
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "./errors";
import { executePrompt } from "./internal/prompt-executor";
import {
	type CorePromptOutput,
	type FeaturesPromptOutput,
	type GenericInflectionsPromptOutput,
	type MorphemicBreakdownPromptOutput,
	type NounInflectionsPromptOutput,
	operationRegistry,
	type RelationsPromptOutput,
} from "./internal/prompt-registry";
import type {
	CreateLexicalGenerationClientParams,
	GenerateCoreOptions,
	GenerateLexicalInfoOptions,
	LexemeInflections,
	LexicalCore,
	LexicalFeatures,
	LexicalInfo,
	LexicalInfoField,
	LexicalRelations,
	MorphemicBreakdown,
	ResolvedSelection,
} from "./public-types";
import {
	getSpelledLemma,
	isKnownSelection,
	isLexemeSelection,
	isMorphemeSelection,
	isPhrasemeSelection,
} from "./selection-helpers";

type PromptDeps = Pick<
	CreateLexicalGenerationClientParams,
	"fetchStructured" | "knownLanguage" | "settings" | "targetLanguage"
>;

function invalidSelectionError(message: string) {
	return lexicalGenerationError(
		LexicalGenerationFailureKind.InvalidSelection,
		message,
	);
}

function unsupportedOperation(message: string) {
	return lexicalGenerationError(
		LexicalGenerationFailureKind.UnsupportedOperation,
		message,
	);
}

function ensureKnownSelection(selection: ResolvedSelection) {
	if (!isKnownSelection(selection)) {
		return err(invalidSelectionError("Known lexical selection required"));
	}

	if (isMorphemeSelection(selection)) {
		return err(
			unsupportedOperation(
				"Phase 1 lexical-generation-next does not support morpheme selections",
			),
		);
	}

	return ok(selection);
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

function shouldGenerateRelations(selection: ResolvedSelection) {
	if (isPhrasemeSelection(selection)) {
		return true;
	}
	if (!isLexemeSelection(selection) || isProperNounSelection(selection)) {
		return false;
	}

	switch (selection.surface.discriminators.lemmaSubKind) {
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

function shouldGenerateMorphemicBreakdown(selection: ResolvedSelection) {
	return !isPhrasemeSelection(selection) && !isProperNounSelection(selection);
}

function mapCoreOutput(
	output: CorePromptOutput,
	precomputedSenseEmojis?: string[],
): LexicalCore {
	return {
		senseEmojis:
			precomputedSenseEmojis &&
			precomputedSenseEmojis.length > 0
				? precomputedSenseEmojis
				: output.senseEmojis,
		ipa: output.ipa,
		...(output.senseGloss ? { senseGloss: output.senseGloss } : {}),
	};
}

function mapFeaturesOutput(output: FeaturesPromptOutput): LexicalFeatures {
	return {
		inherentFeatures:
			output.inherentFeatures as LexicalFeatures["inherentFeatures"],
	};
}

function mapGenericInflections(
	output: GenericInflectionsPromptOutput,
): LexemeInflections {
	return {
		kind: "generic",
		rows: output.rows.map((row) => ({
			forms: row.forms.map((form) => ({ form })),
			label: row.label,
		})),
	};
}

function mapNounInflections(
	output: NounInflectionsPromptOutput,
): LexemeInflections {
	return {
		cells: output.cells,
		...(output.gender ? { gender: output.gender } : {}),
		kind: "noun",
	};
}

function mapMorphemicBreakdown(
	output: MorphemicBreakdownPromptOutput,
): MorphemicBreakdown {
	return {
		...(output.compoundedFrom
			? { compoundedFrom: output.compoundedFrom }
			: {}),
		...(output.derivedFrom ? { derivedFrom: output.derivedFrom } : {}),
		morphemes: output.morphemes.map((morpheme) => ({
			...(morpheme.isSeparable === true
				? { isSeparable: morpheme.isSeparable }
				: {}),
			kind: morpheme.kind as MorphemeKind,
			...(morpheme.lemma ? { lemma: morpheme.lemma } : {}),
			surface: morpheme.surface,
		})),
	};
}

function mapRelations(output: RelationsPromptOutput) {
	return {
		relations: output.relations,
	};
}

function isHardStopFailure(error: LexicalGenerationError): boolean {
	switch (error.kind) {
		case LexicalGenerationFailureKind.InternalContractViolation:
		case LexicalGenerationFailureKind.PromptNotAvailable:
		case LexicalGenerationFailureKind.UnsupportedLanguagePair:
		case LexicalGenerationFailureKind.UnsupportedOperation:
			return true;
		default:
			return false;
	}
}

async function collectField<T>(
	promise: Promise<Result<LexicalInfoField<T>, LexicalGenerationError>>,
): Promise<Result<LexicalInfoField<T>, LexicalGenerationError>> {
	const result = await promise;
	if (result.isErr() && !isHardStopFailure(result.error)) {
		return ok({
			error: result.error,
			status: "error",
		});
	}
	return result;
}

function disabledField<T>(): Promise<
	Result<LexicalInfoField<T>, LexicalGenerationError>
> {
	return Promise.resolve(ok({ status: "disabled" } as LexicalInfoField<T>));
}

export function buildPartGenerators(deps: PromptDeps) {
	const generateCore = async (
		selection: ResolvedSelection,
		attestation: string,
		options?: GenerateCoreOptions,
	): Promise<
		Result<LexicalInfoField<LexicalCore>, LexicalGenerationError>
	> => {
		const known = ensureKnownSelection(selection);
		if (known.isErr()) {
			return err(known.error);
		}

		const route = isPhrasemeSelection(selection)
			? operationRegistry.core.phraseme
			: isLexemeSelection(selection) &&
					(selection.surface.discriminators.lemmaSubKind === "NOUN" ||
						selection.surface.discriminators.lemmaSubKind === "PROPN")
				? operationRegistry.core.noun
				: operationRegistry.core.lexeme;

		const promptResult = await executePrompt(deps, route, {
			attestation,
			...(isLexemeSelection(selection)
				? { discriminator: selection.surface.discriminators.lemmaSubKind }
				: isPhrasemeSelection(selection)
					? { discriminator: selection.surface.discriminators.lemmaSubKind }
					: {}),
			lemma: getSpelledLemma(selection) ?? "",
		});
		if (promptResult.isErr()) {
			return err(promptResult.error);
		}

		return ok({
			status: "ready",
			value: mapCoreOutput(
				promptResult.value,
				options?.precomputedSenseEmojis,
			),
		});
	};

	const generateFeatures = async (
		selection: ResolvedSelection,
		attestation: string,
	): Promise<
		Result<LexicalInfoField<LexicalFeatures>, LexicalGenerationError>
	> => {
		const known = ensureKnownSelection(selection);
		if (known.isErr()) {
			return err(known.error);
		}
		if (!isLexemeSelection(selection)) {
			return ok({ status: "not_applicable" });
		}

		const pos = selection.surface.discriminators.lemmaSubKind as keyof typeof operationRegistry.featuresByPos;
		const route = operationRegistry.featuresByPos[pos];
		const promptResult = await executePrompt(deps, route, {
			attestation,
			lemma: getSpelledLemma(selection) ?? "",
			pos,
		});
		if (promptResult.isErr()) {
			return err(promptResult.error);
		}

		return ok({
			status: "ready",
			value: mapFeaturesOutput(promptResult.value),
		});
	};

	const generateInflections = async (
		selection: ResolvedSelection,
		attestation: string,
	): Promise<
		Result<LexicalInfoField<LexemeInflections>, LexicalGenerationError>
	> => {
		const known = ensureKnownSelection(selection);
		if (known.isErr()) {
			return err(known.error);
		}
		if (!isLexemeSelection(selection) || isProperNounSelection(selection)) {
			return ok({ status: "not_applicable" });
		}

		const pos = selection.surface.discriminators.lemmaSubKind;
		const nounLike = pos === "NOUN";
		const genericAllowed =
			pos === "ADJ" ||
			pos === "AUX" ||
			pos === "DET" ||
			pos === "PRON" ||
			pos === "VERB";
		if (!nounLike && !genericAllowed) {
			return ok({ status: "not_applicable" });
		}

		if (nounLike) {
			const promptResult = await executePrompt(
				deps,
				operationRegistry.nounInflections,
				{
					attestation,
					discriminator: pos,
					lemma: getSpelledLemma(selection) ?? "",
				},
			);
			if (promptResult.isErr()) {
				return err(promptResult.error);
			}
			return ok({
				status: "ready",
				value: mapNounInflections(promptResult.value),
			});
		}

		const promptResult = await executePrompt(
			deps,
			operationRegistry.genericInflections,
			{
				attestation,
				discriminator: pos,
				lemma: getSpelledLemma(selection) ?? "",
			},
		);
		if (promptResult.isErr()) {
			return err(promptResult.error);
		}
		return ok({
			status: "ready",
			value: mapGenericInflections(promptResult.value),
		});
	};

	const generateMorphemicBreakdown = async (
		selection: ResolvedSelection,
		attestation: string,
	): Promise<
		Result<LexicalInfoField<MorphemicBreakdown>, LexicalGenerationError>
	> => {
		const known = ensureKnownSelection(selection);
		if (known.isErr()) {
			return err(known.error);
		}
		if (!shouldGenerateMorphemicBreakdown(selection)) {
			return ok({ status: "not_applicable" });
		}

		const promptResult = await executePrompt(
			deps,
			operationRegistry.morphemicBreakdown,
			{
				attestation,
				...(isLexemeSelection(selection)
					? { discriminator: selection.surface.discriminators.lemmaSubKind }
					: {}),
				lemma: getSpelledLemma(selection) ?? "",
			},
		);
		if (promptResult.isErr()) {
			return err(promptResult.error);
		}

		return ok({
			status: "ready",
			value: mapMorphemicBreakdown(promptResult.value),
		});
	};

	const generateRelations = async (
		selection: ResolvedSelection,
		attestation: string,
	): Promise<
		Result<LexicalInfoField<LexicalRelations>, LexicalGenerationError>
	> => {
		const known = ensureKnownSelection(selection);
		if (known.isErr()) {
			return err(known.error);
		}
		if (!shouldGenerateRelations(selection)) {
			return ok({ status: "not_applicable" } as const);
		}

		const promptResult = await executePrompt(
			deps,
			operationRegistry.relations,
			{
				attestation,
				...(isLexemeSelection(selection)
					? { discriminator: selection.surface.discriminators.lemmaSubKind }
					: isPhrasemeSelection(selection)
						? {
								discriminator:
									selection.surface.discriminators.lemmaSubKind,
							}
						: {}),
				lemma: getSpelledLemma(selection) ?? "",
			},
		);
		if (promptResult.isErr()) {
			return err(promptResult.error);
		}

		return ok({
			status: "ready",
			value: mapRelations(promptResult.value),
		});
	};

	const generateLexicalInfo = async (
		selection: ResolvedSelection,
		attestation: string,
		options?: GenerateLexicalInfoOptions,
	): Promise<Result<LexicalInfo, LexicalGenerationError>> => {
		const known = ensureKnownSelection(selection);
		if (known.isErr()) {
			return err(known.error);
		}

		const disabled = options?.disabledParts ?? {};
		const corePromise = disabled.core
			? disabledField<LexicalCore>()
			: collectField(
					generateCore(selection, attestation, {
						precomputedSenseEmojis:
							options?.precomputedSenseEmojis,
					}),
				);
		const featuresPromise = disabled.features
			? disabledField<LexicalFeatures>()
			: collectField(generateFeatures(selection, attestation));
		const inflectionsPromise =
			disabled.inflections || !deps.settings.generateInflections
				? disabledField<LexemeInflections>()
				: collectField(generateInflections(selection, attestation));
		const morphemicBreakdownPromise = disabled.morphemicBreakdown
			? disabledField<MorphemicBreakdown>()
			: collectField(generateMorphemicBreakdown(selection, attestation));
		const relationsPromise = disabled.relations
			? disabledField<LexicalRelations>()
			: collectField(generateRelations(selection, attestation));

		const [core, features, inflections, morphemicBreakdown, relations] =
			await Promise.all([
				corePromise,
				featuresPromise,
				inflectionsPromise,
				morphemicBreakdownPromise,
				relationsPromise,
			]);

		for (const result of [
			core,
			features,
			inflections,
			morphemicBreakdown,
			relations,
		]) {
			if (result.isErr()) {
				return err(result.error);
			}
		}

		return ok({
			core: core._unsafeUnwrap(),
			features: features._unsafeUnwrap(),
			inflections: inflections._unsafeUnwrap(),
			morphemicBreakdown: morphemicBreakdown._unsafeUnwrap(),
			relations: relations._unsafeUnwrap(),
			selection,
		});
	};

	return {
		generateCore,
		generateFeatures,
		generateInflections,
		generateLexicalInfo,
		generateMorphemicBreakdown,
		generateRelations,
	};
}
