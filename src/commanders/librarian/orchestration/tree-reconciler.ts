import type { TexfresserObsidianServices } from "../../../services/obsidian-services/interface";
import type { ActionDispatcher } from "../action-dispatcher";
import { LIBRARY_ROOTS, type RootName } from "../constants";
import { type NoteSnapshot, noteDiffer } from "../diffing/note-differ";
import { mapDiffToActions } from "../diffing/tree-diff-applier";
import { readNoteDtos } from "../filesystem/library-reader";
import type { LibrarianState } from "../librarian-state";
import { LibraryTree } from "../library-tree/library-tree";
import type { NoteDto, TreePath } from "../types";
import type { FilesystemHealer } from "./filesystem-healer";

export class TreeReconciler {
	constructor(
		private readonly deps: {
			state: LibrarianState;
			dispatcher: ActionDispatcher;
			filesystemHealer: FilesystemHealer;
		} & Pick<TexfresserObsidianServices, "backgroundFileService">,
	) {}

	get trees(): Record<RootName, LibraryTree> {
		return this.deps.state.trees;
	}

	async initTrees(): Promise<void> {
		this.deps.state.trees = {} as Record<RootName, LibraryTree>;
		for (const rootName of LIBRARY_ROOTS) {
			await this.deps.filesystemHealer.healRootFilesystem(rootName);
			const notes = await readNoteDtos(
				this.deps.backgroundFileService,
				rootName,
			);
			this.deps.state.trees[rootName] = new LibraryTree(notes, rootName);
		}
	}

	async reconcileSubtree(
		rootName: RootName,
		subtreePath: TreePath = [],
	): Promise<void> {
		const tree = this.deps.state.trees[rootName];
		if (!tree) return;

		const filesystemNotes = await readNoteDtos(
			this.deps.backgroundFileService,
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
		if (!this.deps.state.skipReconciliation && affectedPaths.length > 0) {
			for (const path of affectedPaths) {
				await this.reconcileSubtree(rootName, path);
			}
		}

		return this.withDiffSync(rootName, mutation);
	}

	withDiffSync<T>(
		rootName: RootName,
		mutation: (tree: LibraryTree) => T,
	): { actions: ReturnType<typeof mapDiffToActions>; result: T } {
		const tree = this.deps.state.trees[rootName];
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
			this.deps.dispatcher.pushMany(actions);
		}

		return { actions, result };
	}

	getSnapshot(rootName: RootName): NoteSnapshot | null {
		const tree = this.deps.state.trees[rootName];
		return tree ? tree.snapshot() : null;
	}
}
