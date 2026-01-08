import type { SplitPath } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathType } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	Transform,
	VaultAction,
} from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from "../../../services/dto-services/meta-info-manager/interface";
import { SCROLL } from "../../../types/literals";
import { TreeNodeStatusDeprecated } from "../types/tree-node";

/**
 * Build action to update status in metadata.
 * Pure function that returns ProcessMdFile action with transform.
 */
export function buildWriteStatusToMetadataAction(
	splitPath: SplitPath,
	status: TreeNodeStatusDeprecated,
): VaultAction | null {
	if (splitPath.type !== SplitPathType.MdFile) {
		return null;
	}

	const newStatus =
		status === TreeNodeStatusDeprecated.Done
			? TreeNodeStatusDeprecated.Done
			: TreeNodeStatusDeprecated.NotStarted;

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
