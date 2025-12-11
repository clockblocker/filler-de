import type { ObsidianVaultActionManager } from "../../../obsidian-vault-action-manager";
import { LIBRARY_ROOT, type RootName } from "../constants";
import { type NoteSnapshot, noteDiffer } from "../diffing/note-differ";
import { mapDiffToActions } from "../diffing/tree-diff-applier";
import { readNoteDtos } from "../filesystem/library-reader";
import { LibraryTree } from "../library-tree/library-tree";
import type { TreePath } from "../types";
import type { FilesystemHealer } from "./filesystem-healer";

export class TreeReconciler {
	constructor(
		private readonly deps: {
			manager: ObsidianVaultActionManager;
			filesystemHealer: FilesystemHealer;
			getTree: () => LibraryTree | null;
			setTree: (tree: LibraryTree) => void;
		},
	) {}

	get tree(): LibraryTree | null {
		return this.deps.getTree();
	}

	async initTrees(): Promise<void> {
		const rootName = LIBRARY_ROOT;
		await this.deps.filesystemHealer.healRootFilesystem(rootName);
		const notes = await readNoteDtos(this.deps.manager, rootName);
		console.log("[TreeReconciler:initTrees]", { notes: notes.length });
		this.deps.setTree(new LibraryTree(notes, rootName));
	}

	async reconcileSubtree(
		rootName: RootName,
		subtreePath: TreePath = [],
	): Promise<void> {
		if (rootName !== LIBRARY_ROOT) return;
		const tree = this.deps.getTree();
		if (!tree) return;

		const filesystemNotes = await readNoteDtos(
			this.deps.manager,
			rootName,
			subtreePath,
		);

		const currentNotes = tree.getNotes(subtreePath);

		// Delete notes not in filesystem
		const fsNoteKeys = new Set(
			filesystemNotes.map((n) => n.path.join("/")),
		);
		const notesToDelete = currentNotes.filter(
			(n) => !fsNoteKeys.has(n.path.join("/")),
		);
		if (notesToDelete.length > 0) {
			tree.deleteNotes(notesToDelete.map((n) => n.path));
		}

		// Add/update notes from filesystem
		const currentNoteMap = new Map(
			currentNotes.map((n) => [n.path.join("/"), n]),
		);
		const notesToAdd = filesystemNotes.filter((n) => {
			const existing = currentNoteMap.get(n.path.join("/"));
			return !existing || existing.status !== n.status;
		});
		if (notesToAdd.length > 0) {
			tree.addNotes(notesToAdd);
		}
	}

	async withDiff<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
		affectedPaths: TreePath[],
	): Promise<{ actions: ReturnType<typeof mapDiffToActions>; result: T }> {
		if (affectedPaths.length > 0) {
			for (const path of affectedPaths) {
				await this.reconcileSubtree(rootName, path);
			}
		}

		return await this.withDiffSync(rootName, mutation);
	}

	async withDiffSync<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
	): Promise<{ actions: ReturnType<typeof mapDiffToActions>; result: T }> {
		if (rootName !== LIBRARY_ROOT) {
			throw new Error(`Tree not found for root: ${rootName}`);
		}
		const tree = this.deps.getTree();
		if (!tree) {
			throw new Error(`Tree not found for root: ${rootName}`);
		}

		const before = tree.snapshot();
		const result = mutation(tree);
		const after = tree.snapshot();

		const diff = noteDiffer.diff(before, after);

		const getNode = (path: TreePath) => {
			const mbNode = tree.getMaybeNode({ path });
			return mbNode.error ? undefined : mbNode.data;
		};

		const actions = mapDiffToActions(diff, rootName, getNode);

		if (actions.length > 0) {
			await this.deps.manager.dispatch(actions);
		}

		return { actions, result };
	}

	getSnapshot(rootName: RootName): NoteSnapshot | null {
		if (rootName !== LIBRARY_ROOT) return null;
		const tree = this.deps.getTree();
		return tree ? tree.snapshot() : null;
	}
}
