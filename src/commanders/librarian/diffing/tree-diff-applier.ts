import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { codexFormatter } from "../codex";
import { createCodexGenerator } from "../codex/codex-generator";
import type { RootName } from "../constants";
import { treePathToCodexBasename } from "../indexing/codecs";
import type { NoteDto, NoteNode, SectionNode, TreePath } from "../types";
import { NodeType } from "../types";
import { treePathToPrettyPath } from "../utils/path-conversions";
import type { NoteDiff, NoteStatusChange } from "./note-differ";

/**
 * Callback to get a node from the tree by path.
 */
export type GetNodeFn = (path: TreePath) => SectionNode | NoteNode | undefined;

// ─── Module-Private Helpers ──────────────────────────────────────────────

function isBookPage(notePath: TreePath): boolean {
	const lastSegment = notePath[notePath.length - 1];
	return !!lastSegment && /^\d{3}$/.test(lastSegment);
}

function getBookPath(pagePath: TreePath): TreePath {
	return pagePath.slice(0, -1);
}

function addAncestorPaths(notePath: TreePath, paths: Set<string>): void {
	paths.add(""); // root
	for (let i = 1; i < notePath.length; i++) {
		paths.add(notePath.slice(0, i).join("/"));
	}
}

function createNoteAction(
	note: NoteDto,
	rootName: RootName,
): LegacyVaultAction {
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
			prettyPath: treePathToPrettyPath(note.path, rootName),
		},
		type: LegacyVaultActionType.UpdateOrCreateFile,
	};
}

function trashNoteAction(note: NoteDto, rootName: RootName): LegacyVaultAction {
	return {
		payload: {
			prettyPath: treePathToPrettyPath(note.path, rootName),
		},
		type: LegacyVaultActionType.TrashFile,
	};
}

function createStatusUpdateAction(
	change: NoteStatusChange,
	rootName: RootName,
): LegacyVaultAction {
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
			prettyPath: treePathToPrettyPath(change.path, rootName),
			transform: (content: string) =>
				editOrAddMetaInfo(content, metaInfo),
		},
		type: LegacyVaultActionType.ProcessFile,
	};
}

function sectionPathToPrettyPath(
	sectionPath: TreePath,
	rootName: RootName,
): PrettyPath {
	const pathParts = [rootName, ...sectionPath.slice(0, -1)];
	const basename = sectionPath[sectionPath.length - 1] ?? "";
	return { basename, pathParts };
}

function codexPrettyPath(path: TreePath, rootName: RootName): PrettyPath {
	if (path.length === 0) {
		return {
			basename: treePathToCodexBasename.encode([rootName]),
			pathParts: [rootName],
		};
	}
	const pathParts = [rootName, ...path];
	const basename = treePathToCodexBasename.encode(path);
	return { basename, pathParts };
}

function generateCodexContent(path: TreePath, getNode?: GetNodeFn): string {
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

function createFolderAction(
	sectionPath: TreePath,
	rootName: RootName,
): LegacyVaultAction {
	return {
		payload: {
			prettyPath: sectionPathToPrettyPath(sectionPath, rootName),
		},
		type: LegacyVaultActionType.UpdateOrCreateFolder,
	};
}

function trashFolderAction(
	sectionPath: TreePath,
	rootName: RootName,
): LegacyVaultAction {
	return {
		payload: {
			prettyPath: sectionPathToPrettyPath(sectionPath, rootName),
		},
		type: LegacyVaultActionType.TrashFolder,
	};
}

function createCodexAction(
	sectionPath: TreePath,
	rootName: RootName,
	getNode?: GetNodeFn,
): LegacyVaultAction {
	return {
		payload: {
			content: generateCodexContent(sectionPath, getNode),
			prettyPath: codexPrettyPath(sectionPath, rootName),
		},
		type: LegacyVaultActionType.UpdateOrCreateFile,
	};
}

function updateCodexAction(
	path: TreePath,
	rootName: RootName,
	getNode?: GetNodeFn,
): LegacyVaultAction {
	return {
		payload: {
			content: generateCodexContent(path, getNode),
			prettyPath: codexPrettyPath(path, rootName),
		},
		type: LegacyVaultActionType.UpdateOrCreateFile,
	};
}

function trashCodexAction(
	sectionPath: TreePath,
	rootName: RootName,
): LegacyVaultAction {
	return {
		payload: {
			prettyPath: codexPrettyPath(sectionPath, rootName),
		},
		type: LegacyVaultActionType.TrashFile,
	};
}

// ─── Exported Pure Functions ─────────────────────────────────────────────

/**
 * Map a tree diff to vault actions.
 * Pure function — no side effects.
 *
 * @param diff - The diff between tree snapshots
 * @param rootName - Library root name
 * @param getNode - Optional callback to get tree nodes (for codex generation)
 * @returns Array of vault actions to execute
 */
export function mapDiffToActions(
	diff: NoteDiff,
	rootName: RootName,
	getNode?: GetNodeFn,
): LegacyVaultAction[] {
	const actions: LegacyVaultAction[] = [];
	const affectedBookPaths = new Set<string>();

	for (const sectionPath of diff.addedSections) {
		actions.push(createFolderAction(sectionPath, rootName));
		actions.push(createCodexAction(sectionPath, rootName, getNode));
	}

	for (const note of diff.addedNotes) {
		actions.push(createNoteAction(note, rootName));
		if (isBookPage(note.path)) {
			affectedBookPaths.add(getBookPath(note.path).join("/"));
		}
		addAncestorPaths(note.path, affectedBookPaths);
	}

	for (const note of diff.removedNotes) {
		actions.push(trashNoteAction(note, rootName));
		if (isBookPage(note.path)) {
			affectedBookPaths.add(getBookPath(note.path).join("/"));
		}
		addAncestorPaths(note.path, affectedBookPaths);
	}

	const sortedRemovedSections = [...diff.removedSections].sort(
		(a, b) => b.length - a.length,
	);
	for (const sectionPath of sortedRemovedSections) {
		actions.push(trashCodexAction(sectionPath, rootName));
		actions.push(trashFolderAction(sectionPath, rootName));
	}

	for (const change of diff.statusChanges) {
		actions.push(createStatusUpdateAction(change, rootName));
		if (isBookPage(change.path)) {
			affectedBookPaths.add(getBookPath(change.path).join("/"));
		}
		addAncestorPaths(change.path, affectedBookPaths);
	}

	for (const pathKey of affectedBookPaths) {
		const path = pathKey === "" ? [] : (pathKey.split("/") as TreePath);

		if (getNode) {
			const node = getNode(path);
			if (node && node.type === NodeType.Note) {
				continue;
			}
		}

		actions.push(updateCodexAction(path, rootName, getNode));
	}

	return actions;
}

/**
 * Generate actions to regenerate all codexes for given section paths.
 * Pure function — no side effects.
 *
 * @param sectionPaths - Paths to sections
 * @param rootName - Library root name
 * @param getNode - Callback to get tree nodes
 * @returns Array of vault actions to update codexes
 */
export function regenerateCodexActions(
	sectionPaths: TreePath[],
	rootName: RootName,
	getNode: GetNodeFn,
): LegacyVaultAction[] {
	const actions: LegacyVaultAction[] = [];
	actions.push(updateCodexAction([], rootName, getNode));
	for (const path of sectionPaths) {
		actions.push(updateCodexAction(path, rootName, getNode));
	}
	return actions;
}
