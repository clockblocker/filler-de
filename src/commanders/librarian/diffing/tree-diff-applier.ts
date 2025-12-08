import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import {
	type VaultAction,
	VaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { codexFormatter } from "../codex";
import { createCodexGenerator } from "../codex/codex-generator";
import type { RootName } from "../constants";
import {
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../indexing/codecs";
import type { NoteDto, NoteNode, SectionNode, TreePath } from "../types";
import { NodeType } from "../types";
import { treePathToPrettyPath } from "../utils/path-conversions";
import type { NoteDiff, NoteStatusChange } from "./note-differ";

/**
 * Callback to get a node from the tree by path.
 */
export type GetNodeFn = (path: TreePath) => SectionNode | NoteNode | undefined;

function isBookPage(notePath: TreePath): boolean {
	const lastSegment = notePath[notePath.length - 1];
	return !!lastSegment && /^\d{3}$/.test(lastSegment);
}

function getBookPath(pagePath: TreePath): TreePath {
	return pagePath.slice(0, -1);
}

export class TreeDiffApplier {
	private readonly rootName: RootName;

	constructor(rootName: RootName) {
		this.rootName = rootName;
	}

	mapDiffToActions(diff: NoteDiff, getNode?: GetNodeFn): VaultAction[] {
		const actions: VaultAction[] = [];
		const affectedBookPaths = new Set<string>();

		for (const sectionPath of diff.addedSections) {
			actions.push(this.createFolderAction(sectionPath));
			actions.push(this.createCodexAction(sectionPath, getNode));
		}

		for (const note of diff.addedNotes) {
			actions.push(this.createNoteAction(note));
			if (isBookPage(note.path)) {
				affectedBookPaths.add(getBookPath(note.path).join("/"));
			}
			this.addAncestorPaths(note.path, affectedBookPaths);
		}

		for (const note of diff.removedNotes) {
			actions.push(this.trashNoteAction(note));
			if (isBookPage(note.path)) {
				affectedBookPaths.add(getBookPath(note.path).join("/"));
			}
			this.addAncestorPaths(note.path, affectedBookPaths);
		}

		const sortedRemovedSections = [...diff.removedSections].sort(
			(a, b) => b.length - a.length,
		);
		for (const sectionPath of sortedRemovedSections) {
			actions.push(this.trashCodexAction(sectionPath));
			actions.push(this.trashFolderAction(sectionPath));
		}

		for (const change of diff.statusChanges) {
			actions.push(this.createStatusUpdateAction(change));
			if (isBookPage(change.path)) {
				affectedBookPaths.add(getBookPath(change.path).join("/"));
			}
			this.addAncestorPaths(change.path, affectedBookPaths);
		}

		for (const pathKey of affectedBookPaths) {
			const path = pathKey === "" ? [] : (pathKey.split("/") as TreePath);

			if (getNode) {
				const node = getNode(path);
				if (node && node.type === NodeType.Note) {
					continue;
				}
			}

			actions.push(this.updateCodexAction(path, getNode));
		}

		return actions;
	}

	private addAncestorPaths(notePath: TreePath, paths: Set<string>): void {
		paths.add(""); // root
		for (let i = 1; i < notePath.length; i++) {
			paths.add(notePath.slice(0, i).join("/"));
		}
	}

	private createNoteAction(note: NoteDto): VaultAction {
		const isPage = isBookPage(note.path);

		const metaInfo: MetaInfo = isPage
			? {
					fileType: "Page",
					index: Number(note.path[note.path.length - 1]),
					status: note.status,
				}
			: {
					fileType: "Scroll",
					status: note.status,
				};

		return {
			payload: {
				content: editOrAddMetaInfo("", metaInfo),
				prettyPath: treePathToPrettyPath(note.path, this.rootName),
			},
			type: VaultActionType.UpdateOrCreateFile,
		};
	}

	private trashNoteAction(note: NoteDto): VaultAction {
		return {
			payload: {
				prettyPath: treePathToPrettyPath(note.path, this.rootName),
			},
			type: VaultActionType.TrashFile,
		};
	}

	private createStatusUpdateAction(change: NoteStatusChange): VaultAction {
		const isPage = isBookPage(change.path);

		const metaInfo: MetaInfo = isPage
			? {
					fileType: "Page",
					index: Number(change.path[change.path.length - 1]),
					status: change.newStatus,
				}
			: {
					fileType: "Scroll",
					status: change.newStatus,
				};

		return {
			payload: {
				prettyPath: treePathToPrettyPath(change.path, this.rootName),
				transform: (content: string) =>
					editOrAddMetaInfo(content, metaInfo),
			},
			type: VaultActionType.ProcessFile,
		};
	}

	private createFolderAction(sectionPath: TreePath): VaultAction {
		return {
			payload: {
				prettyPath: this.sectionPathToPrettyPath(sectionPath),
			},
			type: VaultActionType.UpdateOrCreateFolder,
		};
	}

	private trashFolderAction(sectionPath: TreePath): VaultAction {
		return {
			payload: {
				prettyPath: this.sectionPathToPrettyPath(sectionPath),
			},
			type: VaultActionType.TrashFolder,
		};
	}

	private createCodexAction(
		sectionPath: TreePath,
		getNode?: GetNodeFn,
	): VaultAction {
		return {
			payload: {
				content: this.generateCodexContent(sectionPath, getNode),
				prettyPath: this.codexPrettyPath(sectionPath),
			},
			type: VaultActionType.UpdateOrCreateFile,
		};
	}

	private updateCodexAction(
		path: TreePath,
		getNode?: GetNodeFn,
	): VaultAction {
		return {
			payload: {
				content: this.generateCodexContent(path, getNode),
				prettyPath: this.codexPrettyPath(path),
			},
			type: VaultActionType.UpdateOrCreateFile,
		};
	}

	private trashCodexAction(sectionPath: TreePath): VaultAction {
		return {
			payload: {
				prettyPath: this.codexPrettyPath(sectionPath),
			},
			type: VaultActionType.TrashFile,
		};
	}

	private generateCodexContent(path: TreePath, getNode?: GetNodeFn): string {
		if (!getNode) {
			return "";
		}

		const root = getNode([]);
		if (!root || root.type !== NodeType.Section) {
			return "";
		}

		const node = path.length === 0 ? root : getNode(path);
		if (!node || node.type !== NodeType.Section) {
			return "";
		}

		const generator = createCodexGenerator(root);
		const codexContent = generator.generateCodexForSection(node);

		return codexFormatter.format(codexContent);
	}

	private sectionPathToPrettyPath(sectionPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...sectionPath.slice(0, -1)];
		const basename = sectionPath[sectionPath.length - 1] ?? "";
		return { basename, pathParts };
	}

	private codexPrettyPath(path: TreePath): PrettyPath {
		if (path.length === 0) {
			return {
				basename: treePathToCodexBasename.encode([this.rootName]),
				pathParts: [this.rootName],
			};
		}
		const pathParts = [this.rootName, ...path];
		const basename = treePathToCodexBasename.encode(path);
		return { basename, pathParts };
	}

	regenerateAllCodexes(
		sectionPaths: TreePath[],
		getNode: GetNodeFn,
	): VaultAction[] {
		const actions: VaultAction[] = [];
		actions.push(this.updateCodexAction([], getNode));
		for (const path of sectionPaths) {
			actions.push(this.updateCodexAction(path, getNode));
		}
		return actions;
	}
}
