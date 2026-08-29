import type {
	AnySplitPathInsideLibrary,
	Codecs,
	CreateTreeLeafAction,
} from "@textfresser/library-core";
import {
	inferCreatePolicy,
	isCodexSplitPath,
	makeLibraryScope,
	TreeNodeKind,
	TreeNodeStatus,
	tryCanonicalizeSplitPathToDestination,
} from "@textfresser/library-core";
import type {
	MD,
	VaultActionManagerReadablePath,
} from "@textfresser/vault-action-manager";
import { SplitPathKind } from "@textfresser/vault-action-manager";
import { Effect, Option } from "effect";
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
		files: readonly VaultActionManagerReadablePath[],
		codecs: Codecs,
	): Effect.fn.Return<BuildInitialActionsResult> {
		const createActions: CreateTreeLeafAction[] = [];
		const libraryScope = makeLibraryScope(codecs.rules);

		for (const file of files) {
			// Skip codex files (basename starts with __)
			if (isCodexSplitPath(file)) {
				continue;
			}

			// Convert to library-scoped path
			const libraryScopedResult = libraryScope.toLibraryPath(file);
			if (libraryScopedResult.isErr()) {
				logger.warn(
					`[Librarian] Skipping file outside library: ${file.basename}`,
				);
				continue;
			}
			const observedPath = libraryScopedResult.value;

			// Apply policy to get canonical destination
			// NameKing for root-level files, PathKing for nested
			const policy = inferCreatePolicy(observedPath);
			const canonicalResult = tryCanonicalizeSplitPathToDestination(
				observedPath,
				policy,
				undefined, // no rename intent for create
				codecs,
			);
			if (canonicalResult.isErr()) {
				logger.error(
					`[Librarian] Failed to parse file: ${file.basename}`,
					canonicalResult.error,
				);
				continue;
			}
			const canonicalPath = canonicalResult.value;

			// Build locator from canonical path
			const locatorResult =
				codecs.locator.canonicalSplitPathInsideLibraryToLocator(
					canonicalPath,
				);
			if (locatorResult.isErr()) {
				logger.error(
					`[Librarian] Failed to build locator: ${file.basename}`,
					locatorResult.error,
				);
				continue;
			}
			const locator = locatorResult.value;

			// Read status for md files
			let status: TreeNodeStatus = TreeNodeStatus.NotStarted;
			if (file.kind === SplitPathKind.MdFile) {
				const content = yield* Effect.option(file.read());
				if (Option.isSome(content)) {
					// Read metadata using unified API (tries JSON first, then YAML)
					const meta = noteMetadataHelper.read(
						content.value,
						ScrollMetadataSchema,
					);
					if (meta?.status === "Done") {
						status = TreeNodeStatus.Done;
					}
				}
			}

			if (locator.targetKind === TreeNodeKind.Scroll) {
				createActions.push({
					actionType: "Create",
					initialStatus: status,
					observedSplitPath:
						observedPath as AnySplitPathInsideLibrary & {
							kind: typeof SplitPathKind.MdFile;
							extension: MD;
						},
					targetLocator: locator,
				});
			} else if (locator.targetKind === TreeNodeKind.File) {
				createActions.push({
					actionType: "Create",
					observedSplitPath:
						observedPath as AnySplitPathInsideLibrary & {
							kind: typeof SplitPathKind.File;
							extension: string;
						},
					targetLocator: locator,
				});
			}
		}

		return { createActions };
	},
);
