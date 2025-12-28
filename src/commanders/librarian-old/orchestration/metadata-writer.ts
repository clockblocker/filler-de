import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type {
	Transform,
	VaultAction,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from "../../../services/dto-services/meta-info-manager/interface";
import { SCROLL } from "../../../types/literals";
import { TreeNodeStatus } from "../../librarin-shared/types/tree-node";

/**
 * Build action to update status in metadata.
 * Pure function that returns ProcessMdFile action with transform.
 */
export function buildWriteStatusToMetadataAction(
	splitPath: SplitPath,
	status: TreeNodeStatus,
): VaultAction | null {
	if (splitPath.type !== SplitPathType.MdFile) {
		return null;
	}

	const newStatus =
		status === TreeNodeStatus.Done
			? TreeNodeStatus.Done
			: TreeNodeStatus.NotStarted;

	const transform: Transform = (content: string) => {
		const currentMeta = extractMetaInfo(content);
		const fileType = currentMeta?.fileType;

		if (fileType && fileType !== SCROLL) {
			return content;
		}

		const newMeta = {
			fileType: SCROLL,
			status: newStatus,
		};

		return editOrAddMetaInfo(content, newMeta);
	};

	return {
		payload: { splitPath, transform },
		type: VaultActionType.ProcessMdFile,
	};
}
