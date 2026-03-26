import type { LexicalInfo } from "../../../../../lexical-generation";
import type { NounInflectionCell } from "../../../../../linguistics/de/lexem/noun";
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
import { dispatchHeaderFormatter } from "../section-formatters/header-dispatch";
import type { ResolvedEntryState } from "./resolve-existing-entry";
import {
	buildSectionQuery,
	resolveNounInflectionGenus,
	V3_SECTIONS,
} from "./section-generation-context";
import { unwrapResultAsync } from "./section-generation-results";
import type {
	GeneratedSectionArtifacts,
	MorphologyPayload,
	ParsedRelation,
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

export type GeneratedEntrySectionsData = GeneratedSectionArtifacts & {
	entryId: string;
	failedSections: string[];
	headerContent: string;
	lexicalInfo: LexicalInfo;
	sections: EntrySection[];
};

type GenerateNewEntrySectionsOptions = {
	onlySections?: ReadonlySet<DictSectionKind>;
};

type ApplicableSectionState = {
	applicableSections: readonly DictSectionKind[];
	sectionSet: Set<DictSectionKind>;
	v3Applicable: DictSectionKind[];
};

function collectLexicalInfoFailures(
	lexicalInfo: LexicalInfo,
	failedSections: string[],
): void {
	if (lexicalInfo.core.status === "error") {
		failedSections.push("Enrichment");
	}
	if (lexicalInfo.features.status === "error") {
		failedSections.push("Features");
	}
	if (lexicalInfo.inflections.status === "error") {
		failedSections.push("Inflection");
	}
	if (lexicalInfo.morphemicBreakdown.status === "error") {
		failedSections.push("Morphem");
	}
	if (lexicalInfo.relations.status === "error") {
		failedSections.push("Relation");
	}
}

function buildEntryId(
	nextIndex: number,
	lemmaResult: NonNullable<
		ResolvedEntryState["textfresserState"]["latestLemmaResult"]
	>,
): string {
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
	lexicalInfo: LexicalInfo,
	options: GenerateNewEntrySectionsOptions,
): ApplicableSectionState {
	const applicableSections = getSectionsFor(buildSectionQuery(lexicalInfo));
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
	let applicableSectionState: ApplicableSectionState | null = null;
	let lexicalInfo: LexicalInfo | null = null;
	const lexicalGeneration = ctx.textfresserState.lexicalGeneration;
	if (!lexicalGeneration) {
		throw (
			ctx.textfresserState.lexicalGenerationInitError ??
			new Error("Lexical generation is unavailable")
		);
	}

	const lexicalInfoResult = await lexicalGeneration.generateLexicalInfo(
		lemmaResult,
		context,
		{
			precomputedEmojiDescription:
				lemmaResult.precomputedEmojiDescription,
		},
	);
	if (lexicalInfoResult.isErr()) {
		throw lexicalInfoResult.error;
	}

	lexicalInfo = lexicalInfoResult.value;
	collectLexicalInfoFailures(lexicalInfo, failedSections);

	if (!applicableSectionState) {
		applicableSectionState = resolveApplicableSectionState(
			lexicalInfo,
			options,
		);
	}

	const { sectionSet, v3Applicable } =
		applicableSectionState ??
		resolveApplicableSectionState(lexicalInfo, options);
	const shouldRunPropagation = v3Applicable.some((sectionKind) =>
		shouldPropagateLinksForSection(sectionKind),
	);
	const shouldGenerateMorphem =
		sectionSet.has(DictSectionKind.Morphem) ||
		sectionSet.has(DictSectionKind.Morphology);
	const shouldGenerateTranslation =
		sectionSet.has(DictSectionKind.Translation) || shouldRunPropagation;
	const morphemSectionResult = generateMorphemSection({
		lexicalInfo,
		targetLang,
	});
	if (shouldGenerateMorphem && !morphemSectionResult) {
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
	let translationOutput: string | null;
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
	const nounInflectionGenus = resolveNounInflectionGenus(lexicalInfo);

	const headerContent = dispatchHeaderFormatter(lexicalInfo, targetLang);

	const sections: EntrySection[] = [];
	let relations: ParsedRelation[] = [];
	let inflectionCells: NounInflectionCell[] = [];
	let morphemes: MorphemeItem[] = [];
	let morphology: MorphologyPayload | undefined;
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
				if (!morphemSectionResult) break;
				const result = generateMorphologySection({
					lexicalInfo,
					morphemes,
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
				const result = generateRelationSection({
					lexicalInfo,
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
					lexicalInfo,
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
					lexicalInfo,
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
		entryId,
		failedSections,
		headerContent,
		inflectionCells,
		lexicalInfo,
		morphemes,
		morphology,
		nounInflectionGenus,
		relations,
		sections,
		sourceTranslation: sourceTranslation ?? undefined,
	};
}
