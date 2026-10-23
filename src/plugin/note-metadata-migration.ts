import {
	CrossroadNoteMetadata,
	WORTER_SPLIT_PATH,
} from "@textfresser/dictionary";
import type {
	SplitPathToFolder,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect, Exit } from "effect";
import {
	describeMetadataMigration,
	migrateMetadataFormat,
} from "../commanders/note-metadata-migration/migrate-metadata-format";
import type { Notices } from "../managers/obsidian/host";
import {
	LemmaNoteMetadata,
	LibraryMetadata,
	type MetadataFormat,
	ReadingNoteMetadata,
} from "../stateless-helpers/note-metadata";

/**
 * Moves the note metadata of the Library at `libraryRoot` and of the
 * dictionary under `Worter/` into `target`, the format "Hide metadata" now selects, and
 * reports the outcome in a Notice. The dictionary store hears the
 * migration's writes under `Worter/` as events and reads those notes again.
 */
export const migrateNoteMetadata = Effect.fn("migrateNoteMetadata")(function* (
	vam: VaultActionManager,
	notices: Notices["Service"],
	target: MetadataFormat,
	libraryRoot: SplitPathToFolder,
) {
	const exit = yield* Effect.exit(
		migrateMetadataFormat(vam, target, [
			{
				folder: libraryRoot,
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
		yield* Effect.logError(
			"[TextEaterPlugin] Metadata migration failed:",
			exit.cause,
		);
		yield* notices.show("Moving note metadata failed; see the console.");
		return;
	}
	const report = exit.value;
	if (report.skipped.length > 0 || report.failed.length > 0) {
		yield* Effect.logWarning(
			"[TextEaterPlugin] Metadata migration incomplete",
		).pipe(
			Effect.annotateLogs({
				failed: report.failed,
				skipped: report.skipped,
			}),
		);
	}
	yield* notices.show(describeMetadataMigration(report));
});
