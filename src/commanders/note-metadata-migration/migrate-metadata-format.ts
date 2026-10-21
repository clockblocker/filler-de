/**
 * Moves note metadata into the format "Hide metadata" selects, when the
 * setting changes. Each scope names a folder and the namespaces its notes
 * hold; every Markdown note under it that carries their data in the other
 * format is rewritten. The returned report lists what moved, what stayed
 * and why, and what failed.
 */

import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Cause, Effect, Exit, Result } from "effect";
import {
	type AnyMetadataNamespace,
	type FormatConversion,
	type MetadataFormat,
	noteMetadataHelper,
} from "../../stateless-helpers/note-metadata";

export type MetadataScope = {
	readonly folder: SplitPathToFolder;
	readonly namespaces: readonly AnyMetadataNamespace[];
};

export type MetadataMigrationReport = {
	readonly target: MetadataFormat;
	/** Markdown notes read. */
	readonly scanned: number;
	/** Paths of the notes rewritten. */
	readonly converted: readonly string[];
	/** Namespaces left in the old format, with why. */
	readonly skipped: readonly {
		readonly path: string;
		readonly namespace: string;
		readonly reason: FormatConversion["issues"][number]["issue"]["kind"];
	}[];
	/** Folders or notes that could not be scanned, read or written. */
	readonly failed: readonly {
		readonly path: string;
		readonly message: string;
	}[];
};

type MigrationVam = Pick<VaultActionManager, "dispatch" | "scan">;

const message = (cause: unknown): string =>
	cause instanceof Error ? cause.message : String(cause);

export const migrateMetadataFormat = Effect.fn("migrateMetadataFormat")(
	function* (
		vam: MigrationVam,
		target: MetadataFormat,
		scopes: readonly MetadataScope[],
	): Effect.fn.Return<MetadataMigrationReport> {
		let scanned = 0;
		const converted: string[] = [];
		const skipped: MetadataMigrationReport["skipped"][number][] = [];
		const failed: MetadataMigrationReport["failed"][number][] = [];

		for (const { folder, namespaces } of scopes) {
			const scan = yield* Effect.result(vam.scan(folder));
			if (Result.isFailure(scan)) {
				failed.push({
					message: message(scan.failure),
					path: splitPathCodec.format(folder),
				});
				continue;
			}
			for (const diagnostic of scan.success.diagnostics) {
				failed.push({
					message: message(diagnostic),
					path: diagnostic.path,
				});
			}

			for (const entry of scan.success.entries) {
				if (entry.kind !== SplitPathKind.MdFile) continue;
				const { read, ...splitPath } = entry;
				const path = splitPathCodec.format(splitPath);
				scanned += 1;
				const content = yield* Effect.result(read());
				if (Result.isFailure(content)) {
					failed.push({ message: message(content.failure), path });
					continue;
				}
				const converting = yield* Effect.result(
					Effect.try(() =>
						noteMetadataHelper.convertNote(
							content.success,
							target,
							namespaces,
						),
					),
				);
				if (Result.isFailure(converting)) {
					failed.push({
						message: message(converting.failure.cause),
						path,
					});
					continue;
				}
				const conversion = converting.success;
				for (const { issue, namespace } of conversion.issues) {
					skipped.push({ namespace, path, reason: issue.kind });
				}
				if (conversion.content === content.success) continue;

				const written = yield* Effect.exit(
					vam.dispatch([
						{
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: splitPath as SplitPathToMdFile,
								// Runs again on the content Vault.process
								// reads, so a concurrent edit is kept.
								transform: noteMetadataHelper.convertFormat(
									target,
									namespaces,
								),
							},
						},
					]),
				);
				if (Exit.isSuccess(written)) converted.push(path);
				else
					failed.push({
						message: message(Cause.squash(written.cause)),
						path,
					});
			}
		}

		return { converted, failed, scanned, skipped, target };
	},
);

/** A one-line summary for a Notice. */
export function describeMetadataMigration(
	report: MetadataMigrationReport,
): string {
	const where =
		report.target === "Hidden" ? "hidden sections" : "frontmatter";
	const parts = [
		`Moved metadata of ${report.converted.length} of ${report.scanned} note(s) into ${where}.`,
	];
	if (report.skipped.length > 0)
		parts.push(
			`${report.skipped.length} left unchanged (unreadable data).`,
		);
	if (report.failed.length > 0)
		parts.push(`${report.failed.length} failed; see the console.`);
	return parts.join(" ");
}
