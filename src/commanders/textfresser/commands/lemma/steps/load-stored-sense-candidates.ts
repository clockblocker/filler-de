import type { LexicalMeta } from "@textfresser/lexical-generation";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import type { VaultActionManager } from "@textfresser/vault-action-manager/facade";
import { Effect, Option } from "effect";
import { logger } from "../../../../../utils/logger";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { dictNoteHelper } from "../../../domain/dict-note";
import { vamIoFailureToCommandError } from "../../../orchestration/shared/vam-failure";
import type { CommandError } from "../../types";

export type StoredSenseCandidate = {
	entryIndex: number;
	lexicalMeta: LexicalMeta;
};

const readExistingNote = Effect.fn("Textfresser.readExistingSenseNote")(
	function* (params: {
		vam: VaultActionManager;
		filePath: SplitPathToMdFile;
	}) {
		return yield* params.vam
			.readContent(params.filePath)
			.pipe(Effect.mapError(vamIoFailureToCommandError));
	},
);

function extractStoredSenseCandidates(params: {
	content: string;
	lemma: string;
}): StoredSenseCandidate[] | null {
	const existingEntries = dictNoteHelper.parse(params.content);
	logger.info(
		`[sense-match] Parsed ${existingEntries.length} entries for "${params.lemma}"`,
	);

	if (existingEntries.length === 0) {
		logger.info("[sense-match] No entries in note - new entry");
		return null;
	}

	const lexicalMetaCandidates = existingEntries
		.map((entry): StoredSenseCandidate | null => {
			const parsed = dictEntryIdHelper.parse(entry.id);
			if (!parsed) {
				logger.warn(
					`[sense-match] Failed to parse entry ID: "${entry.id}"`,
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
		`[sense-match] LexicalMeta candidates: ${JSON.stringify(lexicalMetaCandidates)}`,
	);

	return lexicalMetaCandidates;
}

export const loadStoredSenseCandidates = Effect.fn(
	"Textfresser.loadStoredSenseCandidates",
)(function* (params: {
	vam: VaultActionManager;
	lemma: string;
	preferredPath?: SplitPathToMdFile;
}): Effect.fn.Return<StoredSenseCandidate[] | null, CommandError> {
	const { lemma, preferredPath, vam } = params;
	const files = yield* vam
		.findByBasename(lemma)
		.pipe(Effect.mapError(vamIoFailureToCommandError));
	logger.info(`[sense-match] Found ${files.length} files for "${lemma}"`);

	if (preferredPath) {
		const preferredContent = yield* readExistingNote({
			filePath: preferredPath,
			vam,
		}).pipe(Effect.option);
		if (Option.isSome(preferredContent)) {
			return extractStoredSenseCandidates({
				content: preferredContent.value,
				lemma,
			});
		}

		logger.info(
			"[sense-match] Preferred path could not be read, falling back to basename search",
			{
				lemma,
				preferredPath,
			},
		);
	}

	const fallbackPath = files[0];
	if (!fallbackPath) {
		logger.info("[sense-match] First encounter - no existing note");
		return null;
	}

	const fallbackContent = yield* readExistingNote({
		filePath: fallbackPath,
		vam,
	});
	return extractStoredSenseCandidates({
		content: fallbackContent,
		lemma,
	});
});
