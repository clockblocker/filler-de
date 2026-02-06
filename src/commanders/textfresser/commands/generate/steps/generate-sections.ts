import { ResultAsync } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/dict-entry-id/dict-entry-id";
import { getSectionsFor } from "../../../../../linguistics/sections/section-config";
import { cssSuffixFor } from "../../../../../linguistics/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../linguistics/sections/section-kind";
import type { AgentOutput } from "../../../../../prompt-smith";
import { PromptKind } from "../../../../../prompt-smith/codegen/consts";
import type {
	DictEntry,
	EntrySection,
} from "../../../../../stateless-helpers/dict-note/types";
import { morphemeFormatterHelper } from "../../../../../stateless-helpers/morpheme-formatter";
import type { LemmaResult } from "../../lemma/types";
import type { CommandError, CommandState } from "../../types";
import { CommandErrorKind } from "../../types";
import { formatHeaderLine } from "../section-formatters/header-formatter";
import { formatRelationSection } from "../section-formatters/relation-formatter";

/** V1 sections — the ones we generate in this version. */
const V1_SECTIONS = new Set<DictSectionKind>([
	DictSectionKind.Header,
	DictSectionKind.Morphem,
	DictSectionKind.Relation,
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

/**
 * Generate dictionary entry sections via LLM calls.
 * Returns a CommandState with the DictEntry built and content set.
 */
export function generateSections(
	ctx: CommandState,
): ResultAsync<CommandState & { dictEntry: DictEntry }, CommandError> {
	const lemmaResult = ctx.textfresserState.latestLemmaResult!;
	const { promptRunner, languages } = ctx.textfresserState;
	const targetLang = languages.target;

	const applicableSections = getSectionsFor(buildSectionQuery(lemmaResult));
	const v1Applicable = applicableSections.filter((s) => V1_SECTIONS.has(s));

	const word = lemmaResult.lemma;
	const pos = lemmaResult.pos ?? "";
	const context = lemmaResult.attestation.source.textWithOnlyTargetMarked;

	return ResultAsync.fromPromise(
		(async () => {
			let headerContent = `[[${word}]]`;
			const sections: EntrySection[] = [];

			for (const sectionKind of v1Applicable) {
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

			// Build entry ID (V1: always index 1)
			const entryId = dictEntryIdHelper.build(
				lemmaResult.linguisticUnit === "Lexem" && lemmaResult.pos
					? {
							index: 1,
							pos: lemmaResult.pos,
							surfaceKind: lemmaResult.surfaceKind,
							unitKind: "Lexem",
						}
					: {
							index: 1,
							surfaceKind: lemmaResult.surfaceKind,
							unitKind: lemmaResult.linguisticUnit as Exclude<
								typeof lemmaResult.linguisticUnit,
								"Lexem"
							>,
						},
			);

			const dictEntry: DictEntry = {
				headerContent,
				id: entryId,
				meta: {},
				sections,
			};

			return {
				...ctx,
				dictEntry,
			};
		})(),
		(e): CommandError => ({
			kind: CommandErrorKind.ApiError,
			reason: e instanceof Error ? e.message : String(e),
		}),
	);
}
