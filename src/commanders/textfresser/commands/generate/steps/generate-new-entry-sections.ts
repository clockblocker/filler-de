import type {
	GermanGenus,
	NounInflectionCell,
} from "../../../../../linguistics/de/lexem/noun";
import { PromptKind } from "../../../../../prompt-smith/codegen/consts";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import type { EntrySection } from "../../../domain/dict-note/types";
import type { MorphemeItem } from "../../../domain/morpheme/morpheme-formatter";
import { getSectionsFor } from "../../../targets/de/sections/section-config";
import { DictSectionKind } from "../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../lemma/types";
import { dispatchHeaderFormatter } from "../section-formatters/header-dispatch";
import { getFeaturesPromptKindForPos } from "./features-prompt-dispatch";
import type { ResolvedEntryState } from "./resolve-existing-entry";
import {
	buildSectionQuery,
	resolveNounInflectionGenus,
	V3_SECTIONS,
} from "./section-generation-context";
import {
	unwrapCritical,
	unwrapOptional,
	unwrapResultAsync,
} from "./section-generation-results";
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

async function generateEnrichmentOutput(
	lemmaResult: LemmaResult,
	promptRunner: PromptRunner,
	context: string,
): Promise<EnrichmentOutput> {
	if (lemmaResult.linguisticUnit === "Lexem") {
		return unwrapResultAsync(
			promptRunner.generate(PromptKind.LexemEnrichment, {
				context,
				target: {
					lemma: lemmaResult.lemma,
					linguisticUnit: "Lexem",
					posLikeKind: lemmaResult.posLikeKind,
					surfaceKind: lemmaResult.surfaceKind,
				},
			}),
		);
	}

	return unwrapResultAsync(
		promptRunner.generate(PromptKind.PhrasemEnrichment, {
			context,
			target: {
				lemma: lemmaResult.lemma,
				linguisticUnit: "Phrasem",
				posLikeKind: lemmaResult.posLikeKind,
				surfaceKind: lemmaResult.surfaceKind,
			},
		}),
	);
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

	const enrichmentOutput = await generateEnrichmentOutput(
		lemmaResult,
		promptRunner,
		context,
	);
	const applicableSections = getSectionsFor(
		buildSectionQuery(lemmaResult, enrichmentOutput),
	);
	const onlySections = options.onlySections;
	const v3Applicable = applicableSections.filter(
		(sectionKind) =>
			V3_SECTIONS.has(sectionKind) &&
			(onlySections ? onlySections.has(sectionKind) : true),
	);
	const sectionSet = new Set(v3Applicable);
	const shouldRunPropagation =
		sectionSet.has(DictSectionKind.Relation) ||
		sectionSet.has(DictSectionKind.Morphem) ||
		sectionSet.has(DictSectionKind.Morphology) ||
		sectionSet.has(DictSectionKind.Inflection);
	const featuresPromptKind =
		lemmaResult.linguisticUnit === "Lexem"
			? getFeaturesPromptKindForPos(lemmaResult.posLikeKind)
			: null;

	const shouldGenerateMorphem =
		sectionSet.has(DictSectionKind.Morphem) ||
		sectionSet.has(DictSectionKind.Morphology);
	const morphemTask: Promise<MorphemOutput> | null = shouldGenerateMorphem
		? unwrapResultAsync(
				promptRunner.generate(PromptKind.Morphem, {
					context,
					word,
				}),
			)
		: null;
	const relationTask: Promise<RelationOutput> | null = sectionSet.has(
		DictSectionKind.Relation,
	)
		? unwrapResultAsync(
				promptRunner.generate(PromptKind.Relation, {
					context,
					pos: posOrKind,
					word,
				}),
			)
		: null;
	const nounInflectionTask: Promise<NounInflectionOutput> | null =
		sectionSet.has(DictSectionKind.Inflection) &&
		lemmaResult.linguisticUnit === "Lexem" &&
		lemmaResult.posLikeKind === "Noun"
			? unwrapResultAsync(
					promptRunner.generate(PromptKind.NounInflection, {
						context,
						word,
					}),
				)
			: null;
	const inflectionTask: Promise<InflectionOutput> | null =
		sectionSet.has(DictSectionKind.Inflection) &&
		lemmaResult.linguisticUnit === "Lexem" &&
		lemmaResult.posLikeKind !== "Noun"
			? unwrapResultAsync(
					promptRunner.generate(PromptKind.Inflection, {
						context,
						pos: posOrKind,
						word,
					}),
				)
			: null;
	const shouldGenerateTranslation =
		sectionSet.has(DictSectionKind.Translation) || shouldRunPropagation;
	const translationTask: Promise<WordTranslationOutput> | null =
		shouldGenerateTranslation
			? unwrapResultAsync(
					promptRunner.generate(PromptKind.WordTranslation, {
						context: markdownHelper.replaceWikilinks(context),
						pos: posOrKind,
						word,
					}),
				)
			: null;
	const featuresTask: Promise<FeaturesOutput> | null =
		sectionSet.has(DictSectionKind.Tags) && featuresPromptKind
			? unwrapResultAsync(
					promptRunner.generate(featuresPromptKind, {
						context,
						word,
					}),
				)
			: null;

	const tasks: [
		Promise<MorphemOutput> | null,
		Promise<RelationOutput> | null,
		Promise<NounInflectionOutput> | null,
		Promise<InflectionOutput> | null,
		Promise<WordTranslationOutput> | null,
		Promise<FeaturesOutput> | null,
	] = [
		morphemTask,
		relationTask,
		nounInflectionTask,
		inflectionTask,
		translationTask,
		featuresTask,
	];
	const settled = await Promise.allSettled(tasks);

	const failedSections: string[] = [];
	const morphemOutput = unwrapOptional(settled[0], "Morphem", failedSections);
	const relationOutput = unwrapOptional(
		settled[1],
		"Relation",
		failedSections,
	);
	const nounInflectionOutput = unwrapOptional(
		settled[2],
		"Inflection",
		failedSections,
	);
	const otherInflectionOutput = unwrapOptional(
		settled[3],
		"Inflection",
		failedSections,
	);
	let translationOutput: WordTranslationOutput | null = null;
	if (shouldGenerateTranslation) {
		const criticalTranslation = unwrapCritical(settled[4], "Translation");
		if (criticalTranslation !== null) {
			translationOutput = criticalTranslation;
		}
	}
	const featuresOutput = unwrapOptional(
		settled[5],
		"Features",
		failedSections,
	);
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
