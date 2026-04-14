import type { MorphemeKind } from "@textfresser/linguistics";
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
	{ surface: { lemma: { lemmaKind: "Lexeme"; pos: "PROPN" } } }
> {
	return (
		isLexemeSelection(selection) && selection.surface.lemma.pos === "PROPN"
	);
}

function shouldGenerateRelations(selection: ResolvedSelection) {
	if (isPhrasemeSelection(selection)) {
		return true;
	}
	if (!isLexemeSelection(selection) || isProperNounSelection(selection)) {
		return false;
	}

	switch (selection.surface.lemma.pos) {
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
	precomputedEmojiDescription?: string[],
): LexicalCore {
	return {
		emojiDescription:
			precomputedEmojiDescription &&
			precomputedEmojiDescription.length > 0
				? precomputedEmojiDescription
				: output.emojiDescription,
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
					(selection.surface.lemma.pos === "NOUN" ||
						selection.surface.lemma.pos === "PROPN")
				? operationRegistry.core.noun
				: operationRegistry.core.lexeme;

		const promptResult = await executePrompt(deps, route, {
			attestation,
			...(isLexemeSelection(selection)
				? { discriminator: selection.surface.lemma.pos }
				: isPhrasemeSelection(selection)
					? { discriminator: selection.surface.lemma.phrasemeKind }
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
				options?.precomputedEmojiDescription,
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

		const route =
			operationRegistry.featuresByPos[selection.surface.lemma.pos];
		const promptResult = await executePrompt(deps, route, {
			attestation,
			lemma: selection.surface.lemma.spelledLemma,
			pos: selection.surface.lemma.pos,
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

		const pos = selection.surface.lemma.pos;
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
					lemma: selection.surface.lemma.spelledLemma,
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
				lemma: selection.surface.lemma.spelledLemma,
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
					? { discriminator: selection.surface.lemma.pos }
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
					? { discriminator: selection.surface.lemma.pos }
					: isPhrasemeSelection(selection)
						? {
								discriminator:
									selection.surface.lemma.phrasemeKind,
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
						precomputedEmojiDescription:
							options?.precomputedEmojiDescription,
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
