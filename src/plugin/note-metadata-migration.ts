import {
	CrossroadNoteMetadata,
	WORTER_SPLIT_PATH,
} from "@textfresser/dictionary";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import { Effect, Exit } from "effect";
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
import { logger } from "../utils/logger";

/**
 * Moves the note metadata of the Library and of the dictionary under
 * `Worter/` into `target`, the format "Hide metadata" now selects, and
 * reports the outcome in a Notice. The dictionary store hears the
 * migration's writes under `Worter/` as events and reads those notes again.
 */
export async function migrateNoteMetadata(
	vam: VaultActionManager,
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
			formatCause(exit.cause),
		);
		new Notice("Moving note metadata failed; see the console.");
		return;
	}
	const report = exit.value;
	if (report.skipped.length > 0 || report.failed.length > 0) {
		logger.warn("[TextEaterPlugin] Metadata migration incomplete:", {
			failed: report.failed,
			skipped: report.skipped,
		});
	}
	new Notice(describeMetadataMigration(report));
}
