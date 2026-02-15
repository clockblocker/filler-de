import { ResultAsync } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import { getSectionsFor } from "../../../../../linguistics/common/sections/section-config";
import { cssSuffixFor } from "../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../linguistics/common/sections/section-kind";
import type {
	DeLexemPos,
	GermanLinguisticUnit,
} from "../../../../../linguistics/de";
import type { NounInflectionCell } from "../../../../../linguistics/de/lexem/noun";
import type { AgentOutput } from "../../../../../prompt-smith";
import {
	PromptKind,
	type PromptKind as PromptKindType,
} from "../../../../../prompt-smith/codegen/consts";
import type { RelationSubKind } from "../../../../../prompt-smith/schemas/relation";
import type { ApiServiceError } from "../../../../../stateless-helpers/api-service";
import type {
	DictEntry,
	EntrySection,
} from "../../../../../stateless-helpers/dict-note/types";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";
import type { MorphemeItem } from "../../../../../stateless-helpers/morpheme-formatter";
import { morphemeFormatterHelper } from "../../../../../stateless-helpers/morpheme-formatter";
import { logger } from "../../../../../utils/logger";
import { resolveMorphemeItems } from "../../../common/morpheme-link-target";
import type { LemmaResult } from "../../lemma/types";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";
import { formatInflectionSection } from "../section-formatters/common/inflection-formatter";
import { formatRelationSection } from "../section-formatters/common/relation-formatter";
import { formatInflection } from "../section-formatters/de/lexem/noun/inflection-formatter";
import { dispatchHeaderFormatter } from "../section-formatters/header-dispatch";
import type { ResolvedEntryState } from "./resolve-existing-entry";

export type ParsedRelation = {
	kind: RelationSubKind;
	words: string[];
};

/** V3 sections — the ones generated in the current pipeline. */
const V3_SECTIONS = new Set<DictSectionKind>([
	DictSectionKind.Morphem,
	DictSectionKind.Relation,
	DictSectionKind.Inflection,
	DictSectionKind.Translation,
	DictSectionKind.Attestation,
	DictSectionKind.Tags,
]);

type LexemEnrichmentOutput = AgentOutput<"LexemEnrichment">;
type PhrasemEnrichmentOutput = AgentOutput<"PhrasemEnrichment">;
type EnrichmentOutput = LexemEnrichmentOutput | PhrasemEnrichmentOutput;
type FeaturesOutput = AgentOutput<"FeaturesNoun">;

const FEATURES_PROMPT_KIND_BY_POS: Record<DeLexemPos, PromptKindType> = {
	Adjective: PromptKind.FeaturesAdjective,
	Adverb: PromptKind.FeaturesAdverb,
	Article: PromptKind.FeaturesArticle,
	Conjunction: PromptKind.FeaturesConjunction,
	InteractionalUnit: PromptKind.FeaturesInteractionalUnit,
	Noun: PromptKind.FeaturesNoun,
	Particle: PromptKind.FeaturesParticle,
	Preposition: PromptKind.FeaturesPreposition,
	Pronoun: PromptKind.FeaturesPronoun,
	Verb: PromptKind.FeaturesVerb,
};

export function getFeaturesPromptKindForPos(pos: DeLexemPos): PromptKindType {
	return FEATURES_PROMPT_KIND_BY_POS[pos];
}

function buildSectionQuery(
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
) {
	if (lemmaResult.linguisticUnit === "Lexem") {
		const nounClass =
			lemmaResult.posLikeKind === "Noun" &&
			enrichmentOutput.linguisticUnit === "Lexem" &&
			enrichmentOutput.posLikeKind === "Noun"
				? enrichmentOutput.nounClass
				: undefined;

		return {
			nounClass,
			pos: lemmaResult.posLikeKind,
			unit: "Lexem" as const,
		};
	}

	return {
		unit: "Phrasem" as const,
	};
}

export type GenerateSectionsResult = ResolvedEntryState & {
	allEntries: DictEntry[];
	/** Raw relation data from LLM — used by propagate-relations step. Empty for re-encounters. */
	relations: ParsedRelation[];
	/** Structured noun inflection cells — used by propagate-inflections step. Empty for non-nouns / re-encounters. */
	inflectionCells: NounInflectionCell[];
	/** Resolved morpheme items — used by propagate-morphemes step. Empty for re-encounters. */
	morphemes: MorphemeItem[];
	/** Section names that failed LLM generation but were optional — entry was still created. */
	failedSections: string[];
	/** Block ID of the entry to scroll to after dispatch. */
	targetBlockId?: string;
};

/** Convert a ResultAsync to a Promise that rejects on err (for use with Promise.allSettled). */
function unwrapResultAsync<T>(ra: ResultAsync<T, ApiServiceError>): Promise<T> {
	return ra.match(
		(v) => v,
		(e) => {
			throw new Error(e.reason);
		},
	);
}

/** Unwrap a settled result for a critical section — throws if rejected. */
function unwrapCritical<T>(
	result: PromiseSettledResult<T>,
	sectionName: string,
): T {
	if (result.status === "fulfilled") return result.value;
	throw new Error(
		`Critical section "${sectionName}" failed: ${result.reason}`,
	);
}

/** Unwrap a settled result for an optional section — returns null and logs if rejected. */
function unwrapOptional<T>(
	result: PromiseSettledResult<T>,
	sectionName: string,
	failedSections: string[],
): T | null {
	if (result.status === "fulfilled") return result.value;
	failedSections.push(sectionName);
	logger.warn(
		`[generateSections] Optional section "${sectionName}" failed:`,
		result.reason,
	);
	return null;
}

function buildLemmaRefId(entryId: string): string {
	const parsed = dictEntryIdHelper.parse(entryId);
	if (!parsed || parsed.surfaceKind === "Lemma") return entryId;

	if (parsed.unitKind === "Lexem" && parsed.pos) {
		return dictEntryIdHelper.build({
			index: parsed.index,
			pos: parsed.pos,
			surfaceKind: "Lemma",
			unitKind: "Lexem",
		});
	}

	return dictEntryIdHelper.build({
		index: parsed.index,
		surfaceKind: "Lemma",
		unitKind: parsed.unitKind,
	});
}

function buildLexemLinguisticUnit(
	entryId: string,
	lemmaResult: Extract<LemmaResult, { linguisticUnit: "Lexem" }>,
	enrichmentOutput: LexemEnrichmentOutput,
): GermanLinguisticUnit | null {
	if (lemmaResult.surfaceKind === "Lemma") {
		if (lemmaResult.posLikeKind === "Noun") {
			if (
				enrichmentOutput.posLikeKind === "Noun" &&
				enrichmentOutput.genus &&
				enrichmentOutput.nounClass
			) {
				return {
					kind: "Lexem",
					surface: {
						features: {
							genus: enrichmentOutput.genus,
							nounClass: enrichmentOutput.nounClass,
							pos: lemmaResult.posLikeKind,
						},
						lemma: lemmaResult.lemma,
						surfaceKind: "Lemma",
					},
				};
			}

			logger.warn(
				"[generateSections] Missing noun genus/nounClass for Lexem lemma metadata",
				{ enrichmentOutput, lemmaResult },
			);
			return null;
		}

		return {
			kind: "Lexem",
			surface: {
				features: { pos: lemmaResult.posLikeKind },
				lemma: lemmaResult.lemma,
				surfaceKind: "Lemma",
			},
		};
	}

	return {
		kind: "Lexem",
		surface: {
			features: { pos: lemmaResult.posLikeKind },
			lemma: lemmaResult.lemma,
			lemmaRef: buildLemmaRefId(entryId),
			surface: lemmaResult.attestation.target.surface,
			surfaceKind: lemmaResult.surfaceKind,
		},
	};
}

function buildPhrasemLinguisticUnit(
	entryId: string,
	lemmaResult: Extract<LemmaResult, { linguisticUnit: "Phrasem" }>,
): GermanLinguisticUnit {
	const phrasemeFeatures = { phrasemeKind: lemmaResult.posLikeKind };

	if (lemmaResult.surfaceKind === "Lemma") {
		return {
			kind: "Phrasem",
			surface: {
				features: phrasemeFeatures,
				lemma: lemmaResult.lemma,
				surfaceKind: "Lemma",
			},
		};
	}

	return {
		kind: "Phrasem",
		surface: {
			features: phrasemeFeatures,
			lemma: lemmaResult.lemma,
			lemmaRef: buildLemmaRefId(entryId),
			surface: lemmaResult.attestation.target.surface,
			surfaceKind: lemmaResult.surfaceKind,
		},
	};
}

export function buildLinguisticUnitMeta(
	entryId: string,
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
): GermanLinguisticUnit | undefined {
	if (
		lemmaResult.linguisticUnit === "Lexem" &&
		enrichmentOutput.linguisticUnit === "Lexem"
	) {
		const lexem = buildLexemLinguisticUnit(
			entryId,
			lemmaResult,
			enrichmentOutput,
		);
		return lexem ?? undefined;
	}

	if (
		lemmaResult.linguisticUnit === "Phrasem" &&
		enrichmentOutput.linguisticUnit === "Phrasem"
	) {
		return buildPhrasemLinguisticUnit(entryId, lemmaResult);
	}

	logger.warn(
		"[generateSections] Enrichment output linguisticUnit mismatched lemma result",
		{ enrichmentUnit: enrichmentOutput.linguisticUnit, lemmaResult },
	);
	return undefined;
}

/**
 * Generate dictionary entry sections via LLM calls, or append attestation to existing entry.
 *
 * Path A (re-encounter): matchedEntry exists → append attestation ref, skip LLM calls
 * Path B (new entry): full LLM pipeline → build new DictEntry with computed nextIndex
 */
export function generateSections(
	ctx: ResolvedEntryState,
): ResultAsync<GenerateSectionsResult, CommandError> {
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const { matchedEntry, existingEntries, nextIndex } = ctx;

	// Path A: re-encounter — just append attestation ref to existing entry
	if (matchedEntry) {
		const attestationRef = lemmaResult.attestation.source.ref;
		const attestationCssSuffix = cssSuffixFor[DictSectionKind.Attestation];
		const attestationSection = matchedEntry.sections.find(
			(s) => s.kind === attestationCssSuffix,
		);

		if (attestationSection) {
			// Append new ref on a new line (avoid duplicates)
			if (!attestationSection.content.includes(attestationRef)) {
				attestationSection.content += `\n\n${attestationRef}`;
			}
		} else {
			// No Attestation section yet — create one
			const targetLang = ctx.textfresserState.languages.target;
			matchedEntry.sections.push({
				content: attestationRef,
				kind: attestationCssSuffix,
				title: TitleReprFor[DictSectionKind.Attestation][targetLang],
			});
		}

		ctx.textfresserState.targetBlockId = matchedEntry.id;

		return ResultAsync.fromSafePromise(
			Promise.resolve({
				...ctx,
				allEntries: existingEntries,
				failedSections: [],
				inflectionCells: [],
				morphemes: [],
				relations: [],
				targetBlockId: matchedEntry.id,
			}),
		);
	}

	// Path B: new entry — full LLM pipeline
	const { promptRunner, languages } = ctx.textfresserState;
	const targetLang = languages.target;

	const word = lemmaResult.lemma;
	const posOrKind = lemmaResult.posLikeKind;
	const context = lemmaResult.attestation.source.textWithOnlyTargetMarked;

	return ResultAsync.fromPromise(
		(async () => {
			let enrichmentOutput: EnrichmentOutput;
			if (lemmaResult.linguisticUnit === "Lexem") {
				enrichmentOutput = await unwrapResultAsync(
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
			} else {
				enrichmentOutput = await unwrapResultAsync(
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

			const applicableSections = getSectionsFor(
				buildSectionQuery(lemmaResult, enrichmentOutput),
			);
			const v3Applicable = applicableSections.filter((s) =>
				V3_SECTIONS.has(s),
			);
			const sectionSet = new Set(v3Applicable);
			const featuresPromptKind =
				lemmaResult.linguisticUnit === "Lexem"
					? getFeaturesPromptKindForPos(lemmaResult.posLikeKind)
					: null;

			// Build header from enrichment output (+ precomputed emoji override)
			const headerContent = dispatchHeaderFormatter(
				lemmaResult,
				enrichmentOutput,
				targetLang,
			);
			const sections: EntrySection[] = [];
			let relations: ParsedRelation[] = [];
			let inflectionCells: NounInflectionCell[] = [];
			let morphemes: MorphemeItem[] = [];
			const failedSections: string[] = [];

			// Fire all independent LLM calls in parallel
			const settled = await Promise.allSettled([
				sectionSet.has(DictSectionKind.Morphem)
					? unwrapResultAsync(
							promptRunner.generate(PromptKind.Morphem, {
								context,
								word,
							}),
						)
					: null,
				sectionSet.has(DictSectionKind.Relation)
					? unwrapResultAsync(
							promptRunner.generate(PromptKind.Relation, {
								context,
								pos: posOrKind,
								word,
							}),
						)
					: null,
				sectionSet.has(DictSectionKind.Inflection) &&
				lemmaResult.linguisticUnit === "Lexem" &&
				lemmaResult.posLikeKind === "Noun"
					? unwrapResultAsync(
							promptRunner.generate(PromptKind.NounInflection, {
								context,
								word,
							}),
						)
					: null,
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
					: null,
				sectionSet.has(DictSectionKind.Translation)
					? unwrapResultAsync(
							promptRunner.generate(PromptKind.WordTranslation, {
								context:
									markdownHelper.replaceWikilinks(context),
								pos: posOrKind,
								word,
							}),
						)
					: null,
				// Features prompt — fires for all Lexem POS (non-critical)
				sectionSet.has(DictSectionKind.Tags) && featuresPromptKind
					? unwrapResultAsync(
							promptRunner.generate(featuresPromptKind, {
								context,
								word,
							}),
						)
					: null,
			]);

			// Unwrap: critical sections throw on failure, optional ones degrade to null
			const morphemOutput = unwrapOptional(
				settled[0],
				"Morphem",
				failedSections,
			);
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
			const translationOutput = unwrapCritical(settled[4], "Translation");
			const featuresOutput = unwrapOptional(
				settled[5],
				"Features",
				failedSections,
			) as FeaturesOutput | null;

			// Assemble sections in correct order from parallel results
			for (const sectionKind of v3Applicable) {
				switch (sectionKind) {
					case DictSectionKind.Morphem: {
						if (morphemOutput) {
							const resolved = resolveMorphemeItems(
								morphemOutput.morphemes,
								targetLang,
							);
							morphemes = resolved;
							const content =
								morphemeFormatterHelper.formatSection(
									resolved,
									targetLang,
								);
							sections.push({
								content,
								kind: cssSuffixFor[DictSectionKind.Morphem],
								title: TitleReprFor[DictSectionKind.Morphem][
									targetLang
								],
							});
						}
						break;
					}

					case DictSectionKind.Relation: {
						if (relationOutput) {
							relations = relationOutput.relations;
							const content =
								formatRelationSection(relationOutput);
							if (content) {
								sections.push({
									content,
									kind: cssSuffixFor[
										DictSectionKind.Relation
									],
									title: TitleReprFor[
										DictSectionKind.Relation
									][targetLang],
								});
							}
						}
						break;
					}

					case DictSectionKind.Inflection: {
						let inflectionContent: string | undefined;

						if (
							lemmaResult.linguisticUnit === "Lexem" &&
							lemmaResult.posLikeKind === "Noun" &&
							nounInflectionOutput
						) {
							const result =
								formatInflection(nounInflectionOutput);
							inflectionContent = result.formattedSection;
							inflectionCells = result.cells;
						} else if (
							lemmaResult.linguisticUnit === "Lexem" &&
							lemmaResult.posLikeKind !== "Noun" &&
							otherInflectionOutput
						) {
							inflectionContent = formatInflectionSection(
								otherInflectionOutput,
							);
						}

						if (inflectionContent) {
							sections.push({
								content: inflectionContent,
								kind: cssSuffixFor[DictSectionKind.Inflection],
								title: TitleReprFor[DictSectionKind.Inflection][
									targetLang
								],
							});
						}
						break;
					}

					case DictSectionKind.Translation: {
						if (translationOutput) {
							sections.push({
								content: translationOutput,
								kind: cssSuffixFor[DictSectionKind.Translation],
								title: TitleReprFor[
									DictSectionKind.Translation
								][targetLang],
							});
						}
						break;
					}

					case DictSectionKind.Tags: {
						if (
							featuresOutput &&
							lemmaResult.linguisticUnit === "Lexem"
						) {
							const tagPath = [
								lemmaResult.posLikeKind.toLowerCase(),
								...featuresOutput.tags,
							].join("/");
							sections.push({
								content: `#${tagPath}`,
								kind: cssSuffixFor[DictSectionKind.Tags],
								title: TitleReprFor[DictSectionKind.Tags][
									targetLang
								],
							});
						}
						break;
					}

					case DictSectionKind.Attestation: {
						sections.push({
							content: lemmaResult.attestation.source.ref,
							kind: cssSuffixFor[DictSectionKind.Attestation],
							title: TitleReprFor[DictSectionKind.Attestation][
								targetLang
							],
						});
						break;
					}
				}
			}

			const entryId =
				lemmaResult.linguisticUnit === "Lexem"
					? dictEntryIdHelper.build({
							index: nextIndex,
							pos: lemmaResult.posLikeKind,
							surfaceKind: lemmaResult.surfaceKind,
							unitKind: "Lexem",
						})
					: lemmaResult.linguisticUnit === "Phrasem"
						? dictEntryIdHelper.build({
								index: nextIndex,
								surfaceKind: lemmaResult.surfaceKind,
								unitKind: lemmaResult.linguisticUnit,
							})
						: "";

			if (!entryId) {
				throw new Error(
					`Unexpected linguisticUnit for entry ID: ${lemmaResult.linguisticUnit}`,
				);
			}

			const linguisticUnit = buildLinguisticUnitMeta(
				entryId,
				lemmaResult,
				enrichmentOutput,
			);

			const newEntry: DictEntry = {
				headerContent,
				id: entryId,
				meta: {
					emojiDescription:
						lemmaResult.precomputedEmojiDescription ??
						enrichmentOutput.emojiDescription,
					...(linguisticUnit ? { linguisticUnit } : {}),
				},
				sections,
			};

			// Publish failed sections and target block ID to state
			ctx.textfresserState.latestFailedSections = failedSections;
			ctx.textfresserState.targetBlockId = entryId;

			return {
				...ctx,
				allEntries: [...existingEntries, newEntry],
				failedSections,
				inflectionCells,
				morphemes,
				relations,
				targetBlockId: entryId,
			};
		})(),
		(e): CommandError => ({
			kind: CommandErrorKind.ApiError,
			reason: e instanceof Error ? e.message : String(e),
		}),
	);
}
