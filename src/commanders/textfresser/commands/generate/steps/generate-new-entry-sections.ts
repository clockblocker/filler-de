import type { ResolvedLemma } from "../../../../../lexical-generation";
import type {
	GermanGenus,
	NounInflectionCell,
} from "../../../../../linguistics/de/lexem/noun";
import { PromptKind } from "../../../../../prompt-smith/codegen/consts";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";
import { getErrorMessage } from "../../../../../utils/get-error-message";
import { logger } from "../../../../../utils/logger";
import { shouldPropagateLinksForSection } from "../../../common/linguistic-wikilink-context";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import type { EntrySection } from "../../../domain/dict-note/types";
import type { MorphemeItem } from "../../../domain/morpheme/morpheme-formatter";
import { getSectionsFor } from "../../../targets/de/sections/section-config";
import { DictSectionKind } from "../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../lemma/types";
import { dispatchHeaderFormatter } from "../section-formatters/header-dispatch";
import {
	adaptLexicalInfoToCompatibility,
	collectLexicalInfoFailures,
} from "./lexical-info-compat";
import type { ResolvedEntryState } from "./resolve-existing-entry";
import {
	buildSectionQuery,
	resolveNounInflectionGenus,
	V3_SECTIONS,
} from "./section-generation-context";
import { unwrapResultAsync } from "./section-generation-results";
import type {
	EnrichmentOutput,
	FeaturesOutput,
	InflectionOutput,
	MorphemOutput,
	MorphologyPayload,
	NounInflectionOutput,
	ParsedRelation,
	RelationOutput,
	WordTranslationOutput,
} from "./section-generation-types";
import {
	generateAttestationSection,
	generateInflectionSection,
	generateMorphemSection,
	generateMorphologySection,
	generateRelationSection,
	generateTagsSection,
	generateTranslationSection,
} from "./section-generators";

type PromptRunner = ResolvedEntryState["textfresserState"]["promptRunner"];

export type GeneratedEntrySectionsData = {
	entryId: string;
	enrichmentOutput: EnrichmentOutput;
	failedSections: string[];
	featuresOutput: FeaturesOutput | null;
	headerContent: string;
	inflectionCells: NounInflectionCell[];
	morphology?: MorphologyPayload;
	morphemes: MorphemeItem[];
	nounInflectionGenus?: GermanGenus;
	relations: ParsedRelation[];
	sections: EntrySection[];
	sourceTranslation?: string;
};

type GenerateNewEntrySectionsOptions = {
	onlySections?: ReadonlySet<DictSectionKind>;
};

type ApplicableSectionState = {
	applicableSections: readonly DictSectionKind[];
	sectionSet: Set<DictSectionKind>;
	v3Applicable: DictSectionKind[];
};

function buildFallbackEnrichmentOutput(
	lemmaResult: LemmaResult,
): EnrichmentOutput {
	return {
		emojiDescription: lemmaResult.precomputedEmojiDescription ?? ["❓"],
		ipa: "unknown",
	};
}

function toResolvedLemma(lemmaResult: LemmaResult): ResolvedLemma {
	if (lemmaResult.linguisticUnit === "Lexem") {
		return {
			contextWithLinkedParts: undefined,
			lemma: lemmaResult.lemma,
			linguisticUnit: "Lexem",
			posLikeKind: lemmaResult.posLikeKind,
			surfaceKind: lemmaResult.surfaceKind,
		};
	}

	return {
		contextWithLinkedParts: undefined,
		lemma: lemmaResult.lemma,
		linguisticUnit: "Phrasem",
		posLikeKind: lemmaResult.posLikeKind,
		surfaceKind: lemmaResult.surfaceKind,
	};
}

function buildEntryId(nextIndex: number, lemmaResult: LemmaResult): string {
	if (lemmaResult.linguisticUnit === "Lexem") {
		return dictEntryIdHelper.build({
			index: nextIndex,
			pos: lemmaResult.posLikeKind,
			surfaceKind: lemmaResult.surfaceKind,
			unitKind: "Lexem",
		});
	}

	if (lemmaResult.linguisticUnit === "Phrasem") {
		return dictEntryIdHelper.build({
			index: nextIndex,
			surfaceKind: lemmaResult.surfaceKind,
			unitKind: lemmaResult.linguisticUnit,
		});
	}

	return "";
}

function resolveApplicableSectionState(
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
	options: GenerateNewEntrySectionsOptions,
): ApplicableSectionState {
	const applicableSections = getSectionsFor(
		buildSectionQuery(lemmaResult, enrichmentOutput),
	);
	const onlySections = options.onlySections;
	const v3Applicable = applicableSections.filter(
		(sectionKind) =>
			V3_SECTIONS.has(sectionKind) &&
			(onlySections ? onlySections.has(sectionKind) : true),
	);

	return {
		applicableSections,
		sectionSet: new Set(v3Applicable),
		v3Applicable,
	};
}

export async function generateNewEntrySections(
	ctx: ResolvedEntryState,
	options: GenerateNewEntrySectionsOptions = {},
): Promise<GeneratedEntrySectionsData> {
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const { promptRunner, languages } = ctx.textfresserState;
	const targetLang = languages.target;
	const word = lemmaResult.lemma;
	const posOrKind = lemmaResult.posLikeKind;
	const context = lemmaResult.attestation.source.textWithOnlyTargetMarked;

	const failedSections: string[] = [];
	let enrichmentOutput: EnrichmentOutput;
	let featuresOutput: FeaturesOutput | null = null;
	let morphemOutput: MorphemOutput | null = null;
	let relationOutput: RelationOutput | null = null;
	let nounInflectionOutput: NounInflectionOutput | null = null;
	let otherInflectionOutput: InflectionOutput | null = null;
	let applicableSectionState: ApplicableSectionState | null = null;
	const lexicalGeneration = ctx.textfresserState.lexicalGeneration;
	if (!lexicalGeneration) {
		throw (
			ctx.textfresserState.lexicalGenerationInitError ??
			new Error("Lexical generation is unavailable")
		);
	}

	const lexicalInfoResult = await lexicalGeneration.generateLexicalInfo(
		toResolvedLemma(lemmaResult),
		context,
		{
			precomputedEmojiDescription:
				lemmaResult.precomputedEmojiDescription,
		},
	);
	if (lexicalInfoResult.isErr()) {
		throw lexicalInfoResult.error;
	}

	collectLexicalInfoFailures(lexicalInfoResult.value, failedSections);
	const compatibility = adaptLexicalInfoToCompatibility(
		lexicalInfoResult.value,
	);

	enrichmentOutput =
		compatibility.enrichmentOutput ??
		buildFallbackEnrichmentOutput(lemmaResult);
	featuresOutput = compatibility.featuresOutput;
	morphemOutput = compatibility.morphemOutput;
	relationOutput = compatibility.relationOutput;
	nounInflectionOutput = compatibility.nounInflectionOutput;
	otherInflectionOutput = compatibility.otherInflectionOutput;

	if (
		compatibility.enrichmentOutput === null &&
		lemmaResult.precomputedEmojiDescription
	) {
		logger.warn(
			"[generateSections] Lexical core unavailable; using fallback header metadata",
			{ lemma: lemmaResult.lemma },
		);
	}

	if (!applicableSectionState) {
		applicableSectionState = resolveApplicableSectionState(
			lemmaResult,
			enrichmentOutput,
			options,
		);
	}

	const { sectionSet, v3Applicable } =
		applicableSectionState ??
		resolveApplicableSectionState(lemmaResult, enrichmentOutput, options);
	const shouldRunPropagation = v3Applicable.some((sectionKind) =>
		shouldPropagateLinksForSection(sectionKind),
	);
	const shouldGenerateMorphem =
		sectionSet.has(DictSectionKind.Morphem) ||
		sectionSet.has(DictSectionKind.Morphology);
	const shouldGenerateTranslation =
		sectionSet.has(DictSectionKind.Translation) || shouldRunPropagation;
	if (shouldGenerateMorphem && !morphemOutput) {
		logger.warn(
			"[generateSections] Morphem failed; skipping dependent outputs (Morphology section + morpheme/morphology propagation)",
			{
				lemma: lemmaResult.lemma,
				willSkipMorphologySection: sectionSet.has(
					DictSectionKind.Morphology,
				),
			},
		);
	}
	let translationOutput: WordTranslationOutput | null;
	if (shouldGenerateTranslation) {
		try {
			translationOutput = await unwrapResultAsync(
				promptRunner.generate(PromptKind.WordTranslation, {
					context: markdownHelper.replaceWikilinks(context),
					pos: posOrKind,
					word,
				}),
			);
		} catch (error) {
			failedSections.push("Translation");
			logger.warn("[generateSections] Translation failed", {
				error: getErrorMessage(error),
				lemma: lemmaResult.lemma,
			});
			translationOutput = null;
		}
	} else {
		translationOutput = null;
	}
	const nounInflectionGenus = resolveNounInflectionGenus(
		lemmaResult,
		enrichmentOutput,
		nounInflectionOutput,
	);

	const headerContent = dispatchHeaderFormatter(
		lemmaResult,
		enrichmentOutput,
		targetLang,
		nounInflectionGenus,
	);

	const sections: EntrySection[] = [];
	let relations: ParsedRelation[] = [];
	let inflectionCells: NounInflectionCell[] = [];
	let morphemes: MorphemeItem[] = [];
	let morphology: MorphologyPayload | undefined;

	const morphemSectionResult = morphemOutput
		? generateMorphemSection({
				output: morphemOutput,
				targetLang,
			})
		: null;
	if (morphemSectionResult) {
		morphemes = morphemSectionResult.morphemes;
	}

	const sourceTranslation = translationOutput
		?.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0);

	for (const sectionKind of v3Applicable) {
		switch (sectionKind) {
			case DictSectionKind.Morphem: {
				if (!morphemSectionResult) break;
				sections.push(morphemSectionResult.section);
				break;
			}

			case DictSectionKind.Morphology: {
				if (!morphemOutput) break;
				const result = generateMorphologySection({
					morphemes,
					output: morphemOutput,
					posLikeKind: lemmaResult.posLikeKind,
					sourceLemma: lemmaResult.lemma,
					sourceTranslation,
					targetLang,
				});
				morphology = result.morphology;
				if (result.section) {
					sections.push(result.section);
				}
				break;
			}

			case DictSectionKind.Relation: {
				if (!relationOutput) break;
				const result = generateRelationSection({
					output: relationOutput,
					targetLang,
				});
				relations = result.relations;
				if (result.section) {
					sections.push(result.section);
				}
				break;
			}

			case DictSectionKind.Inflection: {
				const result = generateInflectionSection({
					lemmaResult,
					nounInflectionOutput,
					otherInflectionOutput,
					targetLang,
				});
				inflectionCells = result.inflectionCells;
				if (result.section) {
					sections.push(result.section);
				}
				break;
			}

			case DictSectionKind.Translation: {
				if (!translationOutput) break;
				const section = generateTranslationSection({
					output: translationOutput,
					targetLang,
				});
				if (section) {
					sections.push(section);
				}
				break;
			}

			case DictSectionKind.Tags: {
				const section = generateTagsSection({
					featuresOutput,
					lemmaResult,
					targetLang,
				});
				if (section) {
					sections.push(section);
				}
				break;
			}

			case DictSectionKind.Attestation: {
				sections.push(
					generateAttestationSection({
						lemmaResult,
						targetLang,
					}),
				);
				break;
			}
		}
	}

	const entryId = buildEntryId(ctx.nextIndex, lemmaResult);
	if (!entryId) {
		throw new Error(
			`Unexpected linguisticUnit for entry ID: ${lemmaResult.linguisticUnit}`,
		);
	}

	return {
		enrichmentOutput,
		entryId,
		failedSections,
		featuresOutput,
		headerContent,
		inflectionCells,
		morphemes,
		morphology,
		nounInflectionGenus,
		relations,
		sections,
		sourceTranslation: sourceTranslation ?? undefined,
	};
}
