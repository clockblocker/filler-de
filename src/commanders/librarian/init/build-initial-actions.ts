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
import type { VaultScanPath } from "@textfresser/vault-action-manager";
import {
	SplitPathKind,
	splitPathCodec,
} from "@textfresser/vault-action-manager";
import { Effect, Result } from "effect";
import { z } from "zod";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import { logger } from "../../../utils/logger";

// ─── Scroll Metadata Schema ───

const ScrollMetadataSchema = z
	.object({
		status: z.enum(["Done", "NotStarted"]),
	})
	.passthrough();

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
			const observedFile =
				file.kind === SplitPathKind.MdFile
					? (({ read: _read, ...path }) => path)(file)
					: file;
			// Convert to library-scoped path
			const libraryScopedResult =
				libraryScope.toLibraryPath(observedFile);
			if (libraryScopedResult.isErr()) {
				logger.warn(
					`[Librarian] Skipping file outside library: ${file.basename}`,
				);
				continue;
			}
			const observedPath = libraryScopedResult.value;
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
					// Read metadata using unified API (tries JSON first, then YAML)
					const meta = noteMetadataHelper.read(
						content.success,
						ScrollMetadataSchema,
					);
					if (meta?.status === "Done") {
						status = TreeNodeStatus.Done;
					}
				} else {
					logger.warn(
						`[Librarian] Failed to read startup status at ${splitPathCodec.format(file)}:`,
						content.failure,
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
