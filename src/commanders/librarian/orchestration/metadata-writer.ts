import type { TFile } from "obsidian";
import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from "../../../services/dto-services/meta-info-manager/interface";
import { TreeNodeStatus } from "../types/tree-node";

export type MetadataWriterContext = {
	readContent: (splitPath: SplitPath) => Promise<string>;
	splitPath: (tFile: TFile) => SplitPath;
};

/**
 * Build action to write status to metadata in file.
 * Pure function that takes content and returns action.
 */
export function buildWriteStatusAction(
	currentContent: string,
	splitPath: SplitPath,
	status: TreeNodeStatus,
): VaultAction | null {
	if (splitPath.type !== SplitPathType.MdFile) {
		return null;
	}

	const currentMeta = extractMetaInfo(currentContent);

	// Determine fileType from existing metadata or default to Scroll
	const fileType = currentMeta?.fileType ?? "Scroll";

	// Only update Scroll files (not Pages or other types)
	if (fileType !== "Scroll") {
		return null;
	}

	const newMeta = {
		fileType: "Scroll" as const,
		status:
			status === TreeNodeStatus.Done
				? TreeNodeStatus.Done
				: TreeNodeStatus.NotStarted,
	};

	const updatedContent = editOrAddMetaInfo(currentContent, newMeta);

	return {
		payload: { content: updatedContent, splitPath },
		type: VaultActionType.UpsertMdFile,
	};
}
