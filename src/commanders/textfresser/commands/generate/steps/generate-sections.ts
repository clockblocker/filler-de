import { ResultAsync } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import { getSectionsFor } from "../../../../../linguistics/common/sections/section-config";
import { cssSuffixFor } from "../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../linguistics/common/sections/section-kind";
import type { NounInflectionCell } from "../../../../../linguistics/german/inflection/noun";
import type { AgentOutput } from "../../../../../prompt-smith";
import { PromptKind } from "../../../../../prompt-smith/codegen/consts";
import type { RelationSubKind } from "../../../../../prompt-smith/schemas/relation";
import type {
	DictEntry,
	EntrySection,
} from "../../../../../stateless-helpers/dict-note/types";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";
import { morphemeFormatterHelper } from "../../../../../stateless-helpers/morpheme-formatter";
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

/** V2 sections — the ones we generate in this version. */
const V2_SECTIONS = new Set<DictSectionKind>([
	DictSectionKind.Header,
	DictSectionKind.Morphem,
	DictSectionKind.Relation,
	DictSectionKind.Inflection,
	DictSectionKind.Translation,
	DictSectionKind.Attestation,
]);

function buildSectionQuery(lemmaResult: LemmaResult) {
	if (lemmaResult.linguisticUnit === "Lexem" && lemmaResult.pos) {
		return { pos: lemmaResult.pos, unit: "Lexem" as const };
	}
	return {
		unit: lemmaResult.linguisticUnit as "Morphem" | "Phrasem",
	};
}

export type GenerateSectionsResult = ResolvedEntryState & {
	allEntries: DictEntry[];
	/** Raw relation data from LLM — used by propagate-relations step. Empty for re-encounters. */
	relations: ParsedRelation[];
	/** Structured noun inflection cells — used by propagate-inflections step. Empty for non-nouns / re-encounters. */
	inflectionCells: NounInflectionCell[];
};

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
				attestationSection.content += `\n${attestationRef}`;
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

		return ResultAsync.fromSafePromise(
			Promise.resolve({
				...ctx,
				allEntries: existingEntries,
				inflectionCells: [],
				relations: [],
			}),
		);
	}

	// Path B: new entry — full LLM pipeline
	const { promptRunner, languages } = ctx.textfresserState;
	const targetLang = languages.target;

	const applicableSections = getSectionsFor(buildSectionQuery(lemmaResult));
	const v2Applicable = applicableSections.filter((s) => V2_SECTIONS.has(s));

	const word = lemmaResult.lemma;
	const pos = lemmaResult.pos ?? "";
	const context = lemmaResult.attestation.source.textWithOnlyTargetMarked;

	return ResultAsync.fromPromise(
		(async () => {
			let headerContent = `[[${word}]]`;
			const sections: EntrySection[] = [];
			let relations: ParsedRelation[] = [];
			let inflectionCells: NounInflectionCell[] = [];

			for (const sectionKind of v2Applicable) {
				switch (sectionKind) {
					case DictSectionKind.Header: {
						const headerOutput: AgentOutput<"Header"> =
							await promptRunner.generate(PromptKind.Header, {
								context,
								pos,
								word,
							});
						headerContent = formatHeaderLine(
							headerOutput,
							word,
							targetLang,
						);
						break;
					}

					case DictSectionKind.Morphem: {
						const morphemOutput = await promptRunner.generate(
							PromptKind.Morphem,
							{ context, word },
						);
						const content = morphemeFormatterHelper.formatSection(
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
						break;
					}

					case DictSectionKind.Relation: {
						const relationOutput = await promptRunner.generate(
							PromptKind.Relation,
							{ context, pos, word },
						);
						relations = relationOutput.relations;
						const content = formatRelationSection(relationOutput);
						if (content) {
							sections.push({
								content,
								kind: cssSuffixFor[DictSectionKind.Relation],
								title: TitleReprFor[DictSectionKind.Relation][
									targetLang
								],
							});
						}
						break;
					}

					case DictSectionKind.Inflection: {
						let inflectionContent: string;

						if (pos === "Noun") {
							const nounOutput = await promptRunner.generate(
								PromptKind.NounInflection,
								{ context, word },
							);
							const result = formatNounInflection(nounOutput);
							inflectionContent = result.formattedSection;
							inflectionCells = result.cells;
						} else {
							const inflectionOutput =
								await promptRunner.generate(
									PromptKind.Inflection,
									{ context, pos, word },
								);
							inflectionContent =
								formatInflectionSection(inflectionOutput);
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
						const cleanedContext =
							markdownHelper.replaceWikilinks(context);
						const translation = await promptRunner.generate(
							PromptKind.Translate,
							cleanedContext,
						);
						sections.push({
							content: translation,
							kind: cssSuffixFor[DictSectionKind.Translation],
							title: TitleReprFor[DictSectionKind.Translation][
								targetLang
							],
						});
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

			const newEntry: DictEntry = {
				headerContent,
				id: entryId,
				meta: {},
				sections,
			};

			return {
				...ctx,
				allEntries: [...existingEntries, newEntry],
				inflectionCells,
				relations,
			};
		})(),
		(e): CommandError => ({
			kind: CommandErrorKind.ApiError,
			reason: e instanceof Error ? e.message : String(e),
		}),
	);
}
