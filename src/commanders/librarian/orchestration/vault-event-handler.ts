import type { TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import type { ObsidianVaultActionManager } from "../../../obsidian-vault-action-manager";
import type {
	CoreSplitPath,
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { fullPathFromSystemPath } from "../../../services/obsidian-services/atomic-services/pathfinder";
import { isInUntracked, isRootName, LIBRARY_ROOT } from "../constants";
import type { TreePath } from "../types";
import type { TreeReconciler } from "./tree-reconciler";

export class VaultEventHandler {
	constructor(
		private readonly deps: {
			manager: ObsidianVaultActionManager;
			treeReconciler: TreeReconciler;
			regenerateAllCodexes: () => Promise<void>;
		},
	) {}

	private getParentPath(splitPath: CoreSplitPath): TreePath {
		return splitPath.pathParts.slice(1);
	}

	private async reconcile(rootName: string, parentPath: TreePath) {
		await this.deps.treeReconciler.reconcileSubtree(
			rootName as typeof LIBRARY_ROOT,
			parentPath,
		);
		await this.deps.regenerateAllCodexes();
	}

	async onFileCreated(file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;
		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];
		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(fullPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		const parentPath = this.getParentPath(fullPath);
		await this.reconcile(rootName, parentPath);
	}

	async onFileCreatedFromSplitPath(
		createdPath: SplitPathToFile | SplitPathToMdFile,
	): Promise<void> {
		const rootName = createdPath.pathParts[0];
		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(createdPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		const parentPath = this.getParentPath(createdPath);
		await this.reconcile(rootName, parentPath);
	}

	async onFileRenamed(file: TAbstractFile, _oldPath: string): Promise<void> {
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;
		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];
		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(fullPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		const parentPath = this.getParentPath(fullPath);
		await this.reconcile(rootName, parentPath);
	}

	async onFileRenamedFromSplitPath(
		newPath: CoreSplitPath,
		_oldPath: string,
	): Promise<void> {
		const rootName = newPath.pathParts[0];
		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(newPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		const parentPath = this.getParentPath(newPath);
		await this.reconcile(rootName, parentPath);
	}

	async onFileDeleted(file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile)) return;
		if (file.extension !== "md") return;
		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];
		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(fullPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		const parentPath = this.getParentPath(fullPath);
		await this.reconcile(rootName, parentPath);
	}

	async onFileDeletedFromSplitPath(targetPath: CoreSplitPath): Promise<void> {
		const rootName = targetPath.pathParts[0];
		if (!rootName || !isRootName(rootName)) return;
		if (isInUntracked(targetPath.pathParts)) return;
		if (rootName !== LIBRARY_ROOT) return;
		const parentPath = this.getParentPath(targetPath);
		await this.reconcile(rootName, parentPath);
	}
}
