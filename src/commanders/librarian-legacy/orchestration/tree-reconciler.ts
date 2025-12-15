import type { TexfresserObsidianServices } from "../../../services/obsidian-services/interface";
import type { ActionDispatcherLegacy } from "../action-dispatcher";
import { LIBRARY_ROOTSLegacy, type RootNameLegacy } from "../constants";
import { type NoteSnapshotLegacy, noteDiffer } from "../diffing/note-differ";
import { mapDiffToActions } from "../diffing/tree-diff-applier";
import { readNoteDtoLegacy } from "../filesystem/library-reader";
import type { LibrarianLegacyStateLegacy } from "../librarian-state";
import { LibraryTreeLegacy } from "../library-tree/library-tree";
import type { TreePathLegacyLegacy } from "../types";
import type { FilesystemHealerLegacy } from "./filesystem-healer";

export class TreeReconcilerLegacy {
	constructor(
		private readonly deps: {
			state: LibrarianLegacyStateLegacy;
			dispatcher: ActionDispatcherLegacy;
			filesystemHealer: FilesystemHealerLegacy;
		} & Pick<TexfresserObsidianServices, "backgroundFileService">,
	) {}

	get tree(): LibraryTreeLegacy | null {
		return this.deps.state.tree;
	}

	async initTrees(): Promise<void> {
		const rootName = LIBRARY_ROOTSLegacy[0];
		await this.deps.filesystemHealer.healRootFilesystem(rootName);
		const notes = await readNoteDtoLegacy(
			this.deps.backgroundFileService,
			rootName,
		);
		this.deps.state.tree = new LibraryTreeLegacy(notes, rootName);
	}

	async reconcileSubtree(
		rootName: RootNameLegacy,
		subtreePath: TreePathLegacyLegacy = [],
	): Promise<void> {
		if (rootName !== LIBRARY_ROOTSLegacy[0]) return;
		const tree = this.deps.state.tree;
		if (!tree) return;

		const filesystemNotes = await readNoteDtoLegacy(
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
		rootName: RootNameLegacy,
		mutation: (tree: LibraryTreeLegacy) => T,
		affectedPaths: TreePathLegacyLegacy[],
	): Promise<{ actions: ReturnType<typeof mapDiffToActions>; result: T }> {
		if (!this.deps.state.skipReconciliation && affectedPaths.length > 0) {
			for (const path of affectedPaths) {
				await this.reconcileSubtree(rootName, path);
			}
		}

		return this.withDiffSync(rootName, mutation);
	}

	withDiffSync<T>(
		rootName: RootNameLegacy,
		mutation: (tree: LibraryTreeLegacy) => T,
	): { actions: ReturnType<typeof mapDiffToActions>; result: T } {
		if (rootName !== LIBRARY_ROOTSLegacy[0]) {
			throw new Error(`Tree not found for root: ${rootName}`);
		}
		const tree = this.deps.state.tree;
		if (!tree) {
			throw new Error(`Tree not found for root: ${rootName}`);
		}

		const before = tree.snapshot();
		const result = mutation(tree);
		const after = tree.snapshot();

		const diff = noteDiffer.diff(before, after);

		const getNode = (path: TreePathLegacyLegacy) => {
			const mbNode = tree.getMaybeLegacyNode({ path });
			return mbNode.error ? undefined : mbNode.data;
		};

		const actions = mapDiffToActions(diff, rootName, getNode);

		if (actions.length > 0) {
			this.deps.dispatcher.pushMany(actions);
		}

		return { actions, result };
	}

	getSnapshot(rootName: RootNameLegacy): NoteSnapshotLegacy | null {
		if (rootName !== LIBRARY_ROOTSLegacy[0]) return null;
		const tree = this.deps.state.tree;
		return tree ? tree.snapshot() : null;
	}
}
