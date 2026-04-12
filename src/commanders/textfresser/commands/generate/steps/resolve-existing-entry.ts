import { ok, type Result } from "neverthrow";
import { logger } from "../../../../../utils/logger";
import { resolveEntryMatch } from "../../../core/entries/entry-match-policy";
import { entryIdentity } from "../../../core/entries/entry-identity";
import type { NoteEntry } from "../../../core/notes/types";
import { deLanguagePack } from "../../../languages/de/pack";
import type { CommandError, CommandStateWithLemma } from "../../types";
import { parseGenerateEntries } from "./canonical-note-entry";

export type ResolvedEntryState = CommandStateWithLemma & {
	existingEntries: NoteEntry[];
	matchedEntry: NoteEntry | null;
	nextIndex: number;
};

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

	const parsedEntries = parseGenerateEntries({
		lookupInLibraryByCoreName: ctx.textfresserState.lookupInLibrary,
		noteText: content,
		parseLibraryBasename: ctx.textfresserState.parseLibraryBasename,
	});
	const disambResult = lemmaResult.disambiguationResult;

	logger.info(
		`[resolveEntry] disambResult=${disambResult ? `matchedIndex=${disambResult.matchedIndex}` : "null"}`,
	);

	const { existingEntries, matchedEntry, nextIndex } = resolveEntryMatch({
		disambiguationResult: disambResult,
		existingEntries: parsedEntries,
		linguisticUnit: lemmaResult.linguisticUnit,
		posLikeKind:
			lemmaResult.linguisticUnit === "Lexeme"
				? lemmaResult.posLikeKind
				: undefined,
		stubPolicy: {
			getSectionKey(section) {
				if (section.kind !== "typed") {
					return undefined;
				}
				const marker = section.marker;
				if (!marker) {
					return undefined;
				}
				return deLanguagePack.getSectionByMarker(marker)?.key;
			},
			propagationOnlyKeys: [
				"relation",
				"morphology",
				"inflection",
				"tags",
			],
		},
		surfaceKind: lemmaResult.surfaceKind,
	});

	if (
		disambResult &&
		matchedEntry === null &&
		existingEntries.length < parsedEntries.length
	) {
		const matchedStub = parsedEntries.find((entry) => {
			const parsed = entryIdentity.parse(entry.id);
			return (
				parsed !== undefined &&
				parsed.index === disambResult.matchedIndex &&
				parsed.unitKind === lemmaResult.linguisticUnit &&
				(lemmaResult.linguisticUnit !== "Lexeme" ||
					parsed.pos === lemmaResult.posLikeKind)
			);
		});
		if (matchedStub) {
			logger.info(
				`[resolveEntry] matchedEntry=${matchedStub.id} is propagation-only stub — forcing full generation`,
			);
		}
	}

	logger.info(
		`[resolveEntry] matchedEntry=${matchedEntry ? matchedEntry.id : "null"}`,
	);

	return ok({
		...ctx,
		existingEntries,
		matchedEntry,
		nextIndex,
	});
}
