import {
	CrossroadNoteMetadata,
	type DumdictVaultStore,
	WORTER_SPLIT_PATH,
} from "@textfresser/dictionary";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Cause, Effect, Exit } from "effect";
import { Notice } from "obsidian";
import {
	describeMetadataMigration,
	migrateMetadataFormat,
} from "../commanders/note-metadata-migration/migrate-metadata-format";
import { getParsedUserSettings } from "../global-state/global-state";
import {
	LemmaNoteMetadata,
	LibraryMetadata,
	type MetadataFormat,
	ReadingNoteMetadata,
} from "../stateless-helpers/note-metadata";
import { getErrorMessage } from "../utils/get-error-message";
import { logger } from "../utils/logger";

/**
 * Moves the note metadata of the Library and of the dictionary under
 * `Worter/` into `target`, the format "Hide metadata" now selects, and
 * reports the outcome in a Notice. `store` is the dictionary store when it
 * was built or is building.
 */
export async function migrateNoteMetadata(
	vam: VaultActionManager,
	store: Promise<DumdictVaultStore> | null,
	target: MetadataFormat,
): Promise<void> {
	const exit = await Effect.runPromiseExit(
		migrateMetadataFormat(vam, target, [
			{
				folder: getParsedUserSettings().splitPathToLibraryRoot,
				namespaces: [LibraryMetadata],
			},
			{
				folder: WORTER_SPLIT_PATH,
				namespaces: [
					LemmaNoteMetadata,
					ReadingNoteMetadata,
					CrossroadNoteMetadata,
				],
			},
		]),
	);
	if (Exit.isFailure(exit)) {
		logger.error(
			"[TextEaterPlugin] Metadata migration failed:",
			getErrorMessage(Cause.squash(exit.cause)),
		);
		new Notice("Moving note metadata failed; see the console.");
		return;
	}
	const report = exit.value;
	// VAM's own writes reach the dictionary store as Self Events only, so
	// it reads the notes the migration moved under `Worter/` again.
	await store
		?.then((built) => Effect.runPromise(built.rescan))
		.catch((error: unknown) =>
			logger.warn(
				"[TextEaterPlugin] The dictionary could not read Worter/ again after the metadata migration:",
				getErrorMessage(error),
			),
		);
	if (report.skipped.length > 0 || report.failed.length > 0) {
		logger.warn("[TextEaterPlugin] Metadata migration incomplete:", {
			failed: report.failed,
			skipped: report.skipped,
		});
	}
	new Notice(describeMetadataMigration(report));
}
