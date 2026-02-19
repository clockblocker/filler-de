import { ok, type Result } from "neverthrow";
import { logger } from "../../../../../utils/logger";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { type DictEntry, dictNoteHelper } from "../../../domain/dict-note";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import { DictSectionKind } from "../../../targets/de/sections/section-kind";
import type { CommandError, CommandStateWithLemma } from "../../types";

export type ResolvedEntryState = CommandStateWithLemma & {
	existingEntries: DictEntry[];
	matchedEntry: DictEntry | null;
	nextIndex: number;
};

const ATTESTATION_CSS_SUFFIX = cssSuffixFor[DictSectionKind.Attestation];
const TRANSLATION_CSS_SUFFIX = cssSuffixFor[DictSectionKind.Translation];
const PROPAGATION_ONLY_SECTION_SUFFIXES = new Set<string>([
	cssSuffixFor[DictSectionKind.Relation],
	cssSuffixFor[DictSectionKind.Morphology],
	cssSuffixFor[DictSectionKind.Inflection],
	cssSuffixFor[DictSectionKind.Tags],
]);

function isPropagationOnlyStubEntry(entry: DictEntry): boolean {
	const sectionKinds = new Set(entry.sections.map((section) => section.kind));
	const hasAttestation = sectionKinds.has(ATTESTATION_CSS_SUFFIX);
	const hasTranslation = sectionKinds.has(TRANSLATION_CSS_SUFFIX);
	const hasPropagationOnlySection = [...sectionKinds].some((kind) =>
		PROPAGATION_ONLY_SECTION_SUFFIXES.has(kind),
	);

	return !hasAttestation && !hasTranslation && hasPropagationOnlySection;
}

/**
 * Parse existing note content into DictEntry[], find matching entry using
 * disambiguation result from Lemma step.
 *
 * Two outcomes:
 * A) matchedEntry != null → existing entry found, Generate should just append attestation
 * B) matchedEntry == null → new entry, Generate should run full LLM pipeline
 */
export function resolveExistingEntry(
	ctx: CommandStateWithLemma,
): Result<ResolvedEntryState, CommandError> {
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const content = ctx.commandContext.activeFile.content;

	let existingEntries = dictNoteHelper.parse(content);

	const prefix = dictEntryIdHelper.buildPrefix(
		lemmaResult.linguisticUnit,
		lemmaResult.surfaceKind,
		lemmaResult.linguisticUnit === "Lexem"
			? lemmaResult.posLikeKind
			: undefined,
	);

	const disambResult = lemmaResult.disambiguationResult;
	let matchedEntry: DictEntry | null = null;

	logger.info(
		`[resolveEntry] disambResult=${disambResult ? `matchedIndex=${disambResult.matchedIndex}` : "null"}`,
	);

	if (disambResult) {
		// Match by unitKind + POS + index, ignoring surfaceKind so that
		// inflected forms find lemma entries and vice versa
		matchedEntry =
			existingEntries.find((e) => {
				const parsed = dictEntryIdHelper.parse(e.id);
				return (
					parsed !== undefined &&
					parsed.index === disambResult.matchedIndex &&
					parsed.unitKind === lemmaResult.linguisticUnit &&
					(lemmaResult.linguisticUnit !== "Lexem" ||
						parsed.pos === lemmaResult.posLikeKind)
				);
			}) ?? null;
	}
	// If no disambResult → matchedEntry stays null (new entry)

	if (matchedEntry && isPropagationOnlyStubEntry(matchedEntry)) {
		const stubEntryId = matchedEntry.id;
		logger.info(
			`[resolveEntry] matchedEntry=${stubEntryId} is propagation-only stub — forcing full generation`,
		);
		existingEntries = existingEntries.filter(
			(entry) => entry.id !== stubEntryId,
		);
		matchedEntry = null;
	}

	logger.info(
		`[resolveEntry] matchedEntry=${matchedEntry ? matchedEntry.id : "null"}`,
	);

	const existingIds = existingEntries.map((e) => e.id);
	const nextIndex = dictEntryIdHelper.nextIndex(existingIds, prefix);

	return ok({
		...ctx,
		existingEntries,
		matchedEntry,
		nextIndex,
	});
}
