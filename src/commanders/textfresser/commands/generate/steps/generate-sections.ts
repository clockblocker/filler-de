import { ResultAsync } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import { getSectionsFor } from "../../../../../linguistics/common/sections/section-config";
import { cssSuffixFor } from "../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../linguistics/common/sections/section-kind";
import type { NounInflectionCell } from "../../../../../linguistics/german/inflection/noun";
import type { GermanLinguisticUnit } from "../../../../../linguistics/german/schemas/linguistic-unit";
import type { AgentOutput } from "../../../../../prompt-smith";
import { PromptKind } from "../../../../../prompt-smith/codegen/consts";
import type { RelationSubKind } from "../../../../../prompt-smith/schemas/relation";
import type { ApiServiceError } from "../../../../../stateless-helpers/api-service";
import type {
	DictEntry,
	EntrySection,
} from "../../../../../stateless-helpers/dict-note/types";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";
import { morphemeFormatterHelper } from "../../../../../stateless-helpers/morpheme-formatter";
import { logger } from "../../../../../utils/logger";
import type { LemmaResult } from "../../lemma/types";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";
import { formatHeaderLine } from "../section-formatters/header-formatter";
import { formatInflectionSection } from "../section-formatters/inflection-formatter";
import { formatNounInflection } from "../section-formatters/noun-inflection-formatter";
import { formatRelationSection } from "../section-formatters/relation-formatter";
import type { ResolvedEntryState } from "./resolve-existing-entry";

export type ParsedRelation = {
	kind: RelationSubKind;
	words: string[];
};

/** V3 sections — the ones we generate in this version. */
const V3_SECTIONS = new Set<DictSectionKind>([
	DictSectionKind.Header,
	DictSectionKind.Morphem,
	DictSectionKind.Relation,
	DictSectionKind.Inflection,
	DictSectionKind.Translation,
	DictSectionKind.Attestation,
]);

function buildSectionQuery(lemmaResult: LemmaResult) {
	if (lemmaResult.linguisticUnit === "Lexem" && lemmaResult.pos) {
		return {
			nounClass: lemmaResult.nounClass,
			pos: lemmaResult.pos,
			unit: "Lexem" as const,
		};
	}
	return {
		unit: lemmaResult.linguisticUnit as "Morphem" | "Phrasem",
	};
}

/**
 * Build a GermanLinguisticUnit DTO from LemmaResult + header output.
 * MVP: only builds for Lexem + Noun + Lemma surface kind.
 */
function buildLinguisticUnit(
	lemmaResult: LemmaResult,
	headerOutput: AgentOutput<"Header"> | null,
): GermanLinguisticUnit | undefined {
	if (
		lemmaResult.linguisticUnit !== "Lexem" ||
		lemmaResult.pos !== "Noun" ||
		lemmaResult.surfaceKind !== "Lemma"
	) {
		return undefined;
	}

	const genus = headerOutput?.genus;
	if (!genus) return undefined;

	return {
		kind: "Lexem",
		surface: {
			features: {
				genus,
				nounClass: lemmaResult.nounClass ?? "Common",
				pos: "Noun",
			},
			lemma: lemmaResult.lemma,
			surfaceKind: "Lemma",
		},
	};
}

export type GenerateSectionsResult = ResolvedEntryState & {
	allEntries: DictEntry[];
	/** Raw relation data from LLM — used by propagate-relations step. Empty for re-encounters. */
	relations: ParsedRelation[];
	/** Structured noun inflection cells — used by propagate-inflections step. Empty for non-nouns / re-encounters. */
	inflectionCells: NounInflectionCell[];
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

/**
 * Generate dictionary entry sections via LLM calls, or append attestation to existing entry.
 *
 * Path A (re-encounter): matchedEntry exists → append attestation ref, skip LLM calls
 * Path B (new entry): full LLM pipeline → build new DictEntry with computed nextIndex
 */
export function generateSections(
	ctx: ResolvedEntryState,
): ResultAsync<GenerateSectionsResult, CommandError> {
	const lemmaResult = ctx.textfresserState.latestLemmaResult!;
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
				relations: [],
				targetBlockId: matchedEntry.id,
			}),
		);
	}

	// Path B: new entry — full LLM pipeline
	const { promptRunner, languages } = ctx.textfresserState;
	const targetLang = languages.target;

	const applicableSections = getSectionsFor(buildSectionQuery(lemmaResult));
	const v3Applicable = applicableSections.filter((s) => V3_SECTIONS.has(s));

	const word = lemmaResult.lemma;
	const pos =
		lemmaResult.pos ??
		(lemmaResult.linguisticUnit !== "Lexem"
			? lemmaResult.linguisticUnit
			: "");
	const context = lemmaResult.attestation.source.textWithOnlyTargetMarked;

	return ResultAsync.fromPromise(
		(async () => {
			let headerContent = `[[${word}]]`;
			const sections: EntrySection[] = [];
			let relations: ParsedRelation[] = [];
			let inflectionCells: NounInflectionCell[] = [];
			const failedSections: string[] = [];

			// Fire all independent LLM calls in parallel
			const sectionSet = new Set(v3Applicable);

			const settled = await Promise.allSettled([
				sectionSet.has(DictSectionKind.Header)
					? unwrapResultAsync(
							promptRunner.generate(PromptKind.Header, {
								context,
								pos,
								word,
							}),
						)
					: null,
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
								pos,
								word,
							}),
						)
					: null,
				sectionSet.has(DictSectionKind.Inflection) && pos === "Noun"
					? unwrapResultAsync(
							promptRunner.generate(PromptKind.NounInflection, {
								context,
								word,
							}),
						)
					: null,
				sectionSet.has(DictSectionKind.Inflection) && pos !== "Noun"
					? unwrapResultAsync(
							promptRunner.generate(PromptKind.Inflection, {
								context,
								pos,
								word,
							}),
						)
					: null,
				sectionSet.has(DictSectionKind.Translation)
					? unwrapResultAsync(
							promptRunner.generate(PromptKind.WordTranslation, {
								context:
									markdownHelper.replaceWikilinks(context),
								pos,
								word,
							}),
						)
					: null,
			]);

			// Unwrap: critical sections throw on failure, optional ones degrade to null
			const headerOutput = unwrapCritical(settled[0], "Header");
			const morphemOutput = unwrapOptional(
				settled[1],
				"Morphem",
				failedSections,
			);
			const relationOutput = unwrapOptional(
				settled[2],
				"Relation",
				failedSections,
			);
			const nounInflectionOutput = unwrapOptional(
				settled[3],
				"Inflection",
				failedSections,
			);
			const otherInflectionOutput = unwrapOptional(
				settled[4],
				"Inflection",
				failedSections,
			);
			const translationOutput = unwrapCritical(settled[5], "Translation");

			// Assemble sections in correct order from parallel results
			for (const sectionKind of v3Applicable) {
				switch (sectionKind) {
					case DictSectionKind.Header: {
						if (headerOutput) {
							headerContent = formatHeaderLine(
								headerOutput,
								word,
								targetLang,
							);
						}
						break;
					}

					case DictSectionKind.Morphem: {
						if (morphemOutput) {
							const content =
								morphemeFormatterHelper.formatSection(
									morphemOutput.morphemes,
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

						if (pos === "Noun" && nounInflectionOutput) {
							const result =
								formatNounInflection(nounInflectionOutput);
							inflectionContent = result.formattedSection;
							inflectionCells = result.cells;
						} else if (pos !== "Noun" && otherInflectionOutput) {
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

			const entryId = dictEntryIdHelper.build(
				lemmaResult.linguisticUnit === "Lexem" && lemmaResult.pos
					? {
							index: nextIndex,
							pos: lemmaResult.pos,
							surfaceKind: lemmaResult.surfaceKind,
							unitKind: "Lexem",
						}
					: {
							index: nextIndex,
							surfaceKind: lemmaResult.surfaceKind,
							unitKind: lemmaResult.linguisticUnit as Exclude<
								typeof lemmaResult.linguisticUnit,
								"Lexem"
							>,
						},
			);

			const linguisticUnit = buildLinguisticUnit(
				lemmaResult,
				headerOutput,
			);

			const newEntry: DictEntry = {
				headerContent,
				id: entryId,
				meta: {
					emojiDescription:
						headerOutput?.emojiDescription ??
						lemmaResult.precomputedEmojiDescription ??
						undefined,
					linguisticUnit,
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
