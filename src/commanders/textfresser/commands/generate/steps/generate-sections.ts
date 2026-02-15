import { ResultAsync } from "neverthrow";
import { cssSuffixFor } from "../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../linguistics/common/sections/section-kind";
import type { DictEntry } from "../../../../../stateless-helpers/dict-note/types";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";
import { buildLinguisticUnitMeta } from "./build-linguistic-unit-meta";
import {
	buildFeatureTagPath,
	getFeaturesPromptKindForPos,
} from "./features-prompt-dispatch";
import { generateNewEntrySections } from "./generate-new-entry-sections";
import type { GenerateSectionsResult } from "./generate-sections-result";
import type { ResolvedEntryState } from "./resolve-existing-entry";

export { buildLinguisticUnitMeta } from "./build-linguistic-unit-meta";
export { buildFeatureTagPath, getFeaturesPromptKindForPos };
export type { GenerateSectionsResult } from "./generate-sections-result";
export type { ParsedRelation } from "./section-generation-types";

function buildReEncounterResult(
	ctx: ResolvedEntryState,
): GenerateSectionsResult {
	const { matchedEntry, existingEntries } = ctx;
	if (!matchedEntry) return ctx;

	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const attestationRef = lemmaResult.attestation.source.ref;
	const attestationCssSuffix = cssSuffixFor[DictSectionKind.Attestation];
	const attestationSection = matchedEntry.sections.find(
		(section) => section.kind === attestationCssSuffix,
	);

	if (attestationSection) {
		if (!attestationSection.content.includes(attestationRef)) {
			attestationSection.content += `\n\n${attestationRef}`;
		}
	} else {
		const targetLang = ctx.textfresserState.languages.target;
		matchedEntry.sections.push({
			content: attestationRef,
			kind: attestationCssSuffix,
			title: TitleReprFor[DictSectionKind.Attestation][targetLang],
		});
	}

	ctx.textfresserState.targetBlockId = matchedEntry.id;

	return {
		...ctx,
		allEntries: existingEntries,
		failedSections: [],
		inflectionCells: [],
		morphemes: [],
		nounInflectionGenus: undefined,
		relations: [],
		targetBlockId: matchedEntry.id,
	};
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
	if (ctx.matchedEntry) {
		return ResultAsync.fromSafePromise(
			Promise.resolve(buildReEncounterResult(ctx)),
		);
	}

	return ResultAsync.fromPromise(
		(async () => {
			const generated = await generateNewEntrySections(ctx);
			const linguisticUnit = buildLinguisticUnitMeta(
				generated.entryId,
				ctx.textfresserState.latestLemmaResult,
				generated.enrichmentOutput,
			);

			const newEntry: DictEntry = {
				headerContent: generated.headerContent,
				id: generated.entryId,
				meta: {
					emojiDescription:
						ctx.textfresserState.latestLemmaResult
							.precomputedEmojiDescription ??
						generated.enrichmentOutput.emojiDescription,
					...(linguisticUnit ? { linguisticUnit } : {}),
				},
				sections: generated.sections,
			};

			ctx.textfresserState.latestFailedSections =
				generated.failedSections;
			ctx.textfresserState.targetBlockId = generated.entryId;

			return {
				...ctx,
				allEntries: [...ctx.existingEntries, newEntry],
				failedSections: generated.failedSections,
				inflectionCells: generated.inflectionCells,
				morphemes: generated.morphemes,
				nounInflectionGenus: generated.nounInflectionGenus,
				relations: generated.relations,
				targetBlockId: generated.entryId,
			};
		})(),
		(error): CommandError => ({
			kind: CommandErrorKind.ApiError,
			reason: error instanceof Error ? error.message : String(error),
		}),
	);
}
