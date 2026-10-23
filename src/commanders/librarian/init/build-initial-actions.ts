import type {
	Codecs,
	CreateObservationDiagnostic,
	CreateTreeLeafAction,
} from "@textfresser/library-core";
import {
	makeLibraryScope,
	TreeNodeStatus,
	translateCreateObservation,
} from "@textfresser/library-core";
import type {
	SplitPathToAnyFile,
	VaultScanPath,
} from "@textfresser/vault-action-manager";
import {
	SplitPathKind,
	splitPathCodec,
} from "@textfresser/vault-action-manager";
import { Cause, Effect, Result } from "effect";
import {
	LibraryMetadata,
	noteMetadataHelper,
} from "../../../stateless-helpers/note-metadata";

/**
 * The entry's split path alone: a snapshot entry also carries its reader
 * and stat, which must not travel into tree or vault actions.
 */
function splitPathOf(file: VaultScanPath): SplitPathToAnyFile {
	const { basename, kind, pathParts } = file;
	return kind === SplitPathKind.MdFile
		? { basename, extension: file.extension, kind, pathParts }
		: { basename, extension: file.extension, kind, pathParts };
}

// ─── Scroll Metadata Schema ───

type BuildInitialActionsResult = {
	createActions: CreateTreeLeafAction[];
	createDiagnostics: CreateObservationDiagnostic[];
};

/**
 * Build CreateTreeLeafAction for each file in the library.
 * Applies policy (NameKing for root, PathKing for nested) to determine canonical location.
 * Reads status from md file metadata or YAML frontmatter.
 *
 * @param files - Files from vault with readers
 * @param codecs - Codec API
 */
export const buildInitialCreateActions = Effect.fn("buildInitialCreateActions")(
	function* (
		files: readonly VaultScanPath[],
		codecs: Codecs,
	): Effect.fn.Return<BuildInitialActionsResult> {
		const createActions: CreateTreeLeafAction[] = [];
		const createDiagnostics: CreateObservationDiagnostic[] = [];
		const libraryScope = makeLibraryScope(codecs.rules);

		for (const file of files) {
			const observedFile = splitPathOf(file);
			// Convert to library-scoped path
			const libraryScopedResult =
				libraryScope.toLibraryPath(observedFile);
			if (Result.isFailure(libraryScopedResult)) {
				yield* Effect.logWarning(
					`[Librarian] Skipping file outside library: ${file.basename}`,
				);
				continue;
			}
			const observedPath = libraryScopedResult.success;
			const preflight = translateCreateObservation(observedPath, codecs);
			if (preflight.kind === "IgnoredGeneratedCodex") continue;
			if (preflight.kind === "Invalid") {
				createDiagnostics.push(preflight.diagnostic);
				continue;
			}
			if (file.kind === SplitPathKind.File) {
				createActions.push(preflight.action);
				continue;
			}

			// Read status for md files
			let status: TreeNodeStatus = TreeNodeStatus.NotStarted;
			if (file.kind === SplitPathKind.MdFile) {
				const content = yield* Effect.result(file.read());
				if (Result.isSuccess(content)) {
					const meta = noteMetadataHelper.read(
						content.success,
						LibraryMetadata,
						codecs.rules.metadataFormat(),
					);
					if (meta?.status === "Done") {
						status = TreeNodeStatus.Done;
					}
				} else {
					yield* Effect.logWarning(
						`[Librarian] Failed to read startup status at ${splitPathCodec.format(file)}:`,
						Cause.fail(content.failure),
					);
				}
			}

			const translation = translateCreateObservation(
				observedPath,
				codecs,
				status,
			);
			if (translation.kind === "Translated") {
				createActions.push(translation.action);
			} else if (translation.kind === "Invalid") {
				createDiagnostics.push(translation.diagnostic);
			}
		}

		return { createActions, createDiagnostics };
	},
);
