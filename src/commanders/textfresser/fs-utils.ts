/**
 * File system utilities for Textfresser.
 * Extracts VAM calls for reading current file context.
 */

import { err, ok, type Result } from "neverthrow";
import type { VaultActionManager } from "../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../managers/obsidian/vault-action-manager/types/split-path";

// ─── Types ───

export type FsReadResult = {
	splitPath: SplitPathToMdFile;
	content: string;
};

export type FsError =
	| { kind: "NoMdFile" }
	| { kind: "ReadFailed"; reason: string };

export const FsErrorKind = {
	NoMdFile: "NoMdFile",
	ReadFailed: "ReadFailed",
} as const;

// ─── Functions ───

/**
 * Read the currently open markdown file.
 * Returns split path and content, or error if no file open or read fails.
 */
export async function readCurrentFile(
	vam: VaultActionManager,
): Promise<Result<FsReadResult, FsError>> {
	const splitPath = await vam.mdPwd();
	if (!splitPath) {
		return err({ kind: FsErrorKind.NoMdFile });
	}

	const contentResult = await vam.readContent(splitPath);
	if (contentResult.isErr()) {
		return err({ kind: FsErrorKind.ReadFailed, reason: contentResult.error });
	}

	return ok({ splitPath, content: contentResult.value });
}
