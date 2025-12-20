import type { TFile } from "obsidian";
import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { TreeNodeStatus } from "../types/tree-node";
import { buildWriteStatusAction } from "./metadata-writer";

export type MetadataServiceContext = {
	dispatch: (actions: VaultAction[]) => Promise<{ isErr: () => boolean; error?: Array<{ error: string }> }>;
	readContent: (splitPath: SplitPath) => Promise<string>;
	splitPath: (tFile: TFile) => SplitPath;
};

/**
 * Write status to metadata in file.
 * Pure function that takes context.
 */
export async function writeStatusToMetadata(
	tFile: TFile,
	status: TreeNodeStatus,
	context: MetadataServiceContext,
): Promise<void> {
	const splitPath = context.splitPath(tFile);
	if (splitPath.type !== SplitPathType.MdFile) {
		return;
	}

	const currentContent = await context.readContent(splitPath);

	const action = buildWriteStatusAction(currentContent, splitPath, status);

	if (!action) {
		return;
	}

	const result = await context.dispatch([action]);

	if (result.isErr()) {
		const errors = result.error;
		console.error(
			"[Librarian] writeStatusToMetadata: dispatch errors:",
			errors,
		);
		throw new Error(
			`Failed to write metadata: ${errors?.map((e) => e.error).join(", ") ?? "unknown error"}`,
		);
	}

	console.log("[Librarian] writeStatusToMetadata: success");
}

