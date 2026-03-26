import {
	readContentErrorToReason,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { err, ok, type Result } from "neverthrow";
import type {
	LexicalMeta,
	ResolvedLemma,
	SenseDisambiguator,
} from "@textfresser/lexical-generation";
import { logger } from "../../../../../utils/logger";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { dictNoteHelper } from "../../../domain/dict-note";
import { commandApiError } from "../../../errors";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";

type DisambiguationResult =
	| { matchedIndex: number }
	| { matchedIndex: null; precomputedEmojiDescription?: string[] }
	| null;

type StoredLexicalMetaCandidate = {
	entryIndex: number;
	lexicalMeta: LexicalMeta;
};

/**
 * Disambiguate sense for a lemma against existing dictionary entries.
 *
 * Returns:
 * - { matchedIndex } if an existing sense matches
 * - null if this is a new sense or first encounter
 */
export async function disambiguateSense(
	vam: VaultActionManager,
	lemma: ResolvedLemma,
	context: string,
	preferredPath?: SplitPathToMdFile,
	options?: {
		disambiguateWith?: SenseDisambiguator;
	},
): Promise<Result<DisambiguationResult, CommandError>> {
	const readExistingNote = async (
		filePath: SplitPathToMdFile,
	): Promise<Result<string, CommandError>> => {
		const readResult = await vam.readContent(filePath);
		if (readResult.isErr()) {
			return err({
				kind: CommandErrorKind.ApiError,
				reason: readContentErrorToReason(readResult.error),
			});
		}

		return ok(readResult.value);
	};

	const runWithContent = async (
		content: string,
	): Promise<Result<DisambiguationResult, CommandError>> => {
		const existingEntries = dictNoteHelper.parse(content);
		logger.info(
			`[disambiguate] Parsed ${existingEntries.length} entries for "${lemma.lemma}"`,
		);

		if (existingEntries.length === 0) {
			logger.info("[disambiguate] No entries in note — new entry");
			return ok(null);
		}

		const lexicalMetaCandidates = existingEntries
			.map((entry): StoredLexicalMetaCandidate | null => {
				const parsed = dictEntryIdHelper.parse(entry.id);
				if (!parsed) {
					logger.warn(
						`[disambiguate] Failed to parse entry ID: "${entry.id}"`,
					);
					return null;
				}

				if (!entry.meta.lexicalMeta) {
					return null;
				}

				return {
					entryIndex: parsed.index,
					lexicalMeta: entry.meta.lexicalMeta,
				};
			})
			.filter((candidate) => candidate !== null);

		logger.info(
			`[disambiguate] LexicalMeta candidates: ${JSON.stringify(lexicalMetaCandidates)}`,
		);

		if (!options?.disambiguateWith) {
			return ok({ matchedIndex: null });
		}

		const moduleResult = await options.disambiguateWith(
			lemma,
			context,
			lexicalMetaCandidates.map((candidate) => candidate.lexicalMeta),
		);
		if (moduleResult.isErr()) {
			return err(
				commandApiError({
					lexicalGenerationError: moduleResult.error,
					reason: moduleResult.error.message,
				}),
			);
		}

		if (moduleResult.value.kind === "matched") {
			const matchedCandidate =
				lexicalMetaCandidates[moduleResult.value.cacheIndex] ?? null;
			if (!matchedCandidate) {
				logger.warn(
					`[disambiguate] cacheIndex ${moduleResult.value.cacheIndex} out of range — treating as new sense`,
				);
				return ok({ matchedIndex: null });
			}

			return ok({
				matchedIndex: matchedCandidate.entryIndex,
			});
		}

		return ok({
			matchedIndex: null,
			precomputedEmojiDescription:
				moduleResult.value.precomputedEmojiDescription,
		});
	};

	const files = vam.findByBasename(lemma.lemma);
	logger.info(
		`[disambiguate] Found ${files.length} files for "${lemma.lemma}"`,
	);

	if (preferredPath) {
		const preferredContent = await readExistingNote(preferredPath);
		if (preferredContent.isOk()) {
			return runWithContent(preferredContent.value);
		}

		logger.info(
			"[disambiguate] Preferred path could not be read, falling back to basename search",
			{
				lemma: lemma.lemma,
				preferredPath,
			},
		);
		const fallbackPath = files[0];
		if (!fallbackPath) {
			logger.info("[disambiguate] First encounter — no existing note");
			return ok(null);
		}

		const fallbackContent = await readExistingNote(fallbackPath);
		if (fallbackContent.isErr()) {
			return err(fallbackContent.error);
		}
		return runWithContent(fallbackContent.value);
	}

	const filePath = files[0];
	if (!filePath) {
		logger.info("[disambiguate] First encounter — no existing note");
		return ok(null);
	}

	const content = await readExistingNote(filePath);
	if (content.isErr()) {
		return err(content.error);
	}

	return runWithContent(content.value);
}
