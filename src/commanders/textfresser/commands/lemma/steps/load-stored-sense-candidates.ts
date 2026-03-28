import type { LexicalMeta } from "@textfresser/lexical-generation";
import {
	readContentErrorToReason,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { err, ok, type Result } from "neverthrow";
import { logger } from "../../../../../utils/logger";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { dictNoteHelper } from "../../../domain/dict-note";
import type { CommandError } from "../../types";
import { CommandErrorKind } from "../../types";

export type StoredSenseCandidate = {
	entryIndex: number;
	lexicalMeta: LexicalMeta;
};

async function readExistingNote(params: {
	vam: VaultActionManager;
	filePath: SplitPathToMdFile;
}): Promise<Result<string, CommandError>> {
	const readResult = await params.vam.readContent(params.filePath);
	if (readResult.isErr()) {
		return err({
			kind: CommandErrorKind.ApiError,
			reason: readContentErrorToReason(readResult.error),
		});
	}

	return ok(readResult.value);
}

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

export async function loadStoredSenseCandidates(params: {
	vam: VaultActionManager;
	lemma: string;
	preferredPath?: SplitPathToMdFile;
}): Promise<Result<StoredSenseCandidate[] | null, CommandError>> {
	const { lemma, preferredPath, vam } = params;
	const files = vam.findByBasename(lemma);
	logger.info(`[sense-match] Found ${files.length} files for "${lemma}"`);

	if (preferredPath) {
		const preferredContent = await readExistingNote({
			filePath: preferredPath,
			vam,
		});
		if (preferredContent.isOk()) {
			return ok(
				extractStoredSenseCandidates({
					content: preferredContent.value,
					lemma,
				}),
			);
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
		return ok(null);
	}

	const fallbackContent = await readExistingNote({
		filePath: fallbackPath,
		vam,
	});
	if (fallbackContent.isErr()) {
		return err(fallbackContent.error);
	}

	return ok(
		extractStoredSenseCandidates({
			content: fallbackContent.value,
			lemma,
		}),
	);
}
