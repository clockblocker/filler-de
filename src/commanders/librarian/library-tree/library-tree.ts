import { TextStatusLegacy } from "../../../types/common-interface/enums";
import type { MaybeLegacy } from "../../../types/common-interface/maybe";
import type { NodeNameLegacy } from "../indexing/codecs";
import {
	NodeTypeLegacy,
	type NoteDtoLegacy,
	type NoteNodeLegacy,
	type SectionNodeLegacy,
	type TreePathLegacyLegacy,
} from "../types";

type TreeNodeLegacy = SectionNodeLegacy | NoteNodeLegacy;

/**
 * Snapshot for diffing trees
 */
export type TreeSnapshotLegacy = {
	notes: NoteDtoLegacy[];
	sectionPaths: TreePathLegacyLegacy[];
};

/**
 * LibraryTreeLegacy - Simplified tree with 2 levels: Section → Note
 */
export class LibraryTreeLegacy {
	root: SectionNodeLegacy;

	constructor(notes: NoteDtoLegacy[], name: string) {
		this.root = {
			children: [],
			name,
			parent: null,
			status: TextStatusLegacy.NotStarted,
			type: NodeTypeLegacy.Section,
		};

		this.addNotes(notes);
	}

	// ─── Public API ───────────────────────────────────────────────────

	public getNotes(path: TreePathLegacyLegacy): NoteDtoLegacy[] {
		const mbNode = this.getMaybeLegacyNode({ path });
		if (mbNode.error) {
			return [];
		}

		return this.collectNotesFromNode(mbNode.data);
	}

	public getAllNotes(): NoteDtoLegacy[] {
		return this.getNotes([]);
	}

	public getAllSectionPaths(): TreePathLegacyLegacy[] {
		const paths: TreePathLegacyLegacy[] = [];

		const collectSections = (node: SectionNodeLegacy): void => {
			for (const child of node.children) {
				if (child.type === NodeTypeLegacy.Section) {
					paths.push(this.getPathFromNode(child));
					collectSections(child);
				}
			}
		};

		collectSections(this.root);
		return paths;
	}

	public snapshot(): TreeSnapshotLegacy {
		return {
			notes: this.getAllNotes(),
			sectionPaths: this.getAllSectionPaths(),
		};
	}

	public addNotes(notes: NoteDtoLegacy[]): void {
		for (const note of notes) {
			this.addNote(note);
		}
		this.initializeParents();
		this.recomputeStatuses();
	}

	public deleteNotes(paths: TreePathLegacyLegacy[]): void {
		for (const path of paths) {
			this.deleteNote(path);
		}
		this.initializeParents();
		this.recomputeStatuses();
	}

	public setStatus({
		path,
		status,
	}: {
		path: TreePathLegacyLegacy;
		status: "Done" | "NotStarted";
	}): MaybeLegacy<TreeNodeLegacy> {
		const mbNode = this.getMaybeLegacyNode({ path });
		if (mbNode.error) {
			return mbNode;
		}

		const node = mbNode.data;

		if (node.status === status) {
			return { data: node, error: false };
		}

		this.setStatusRecursively(node, status);
		this.recomputeStatuses();

		return { data: node, error: false };
	}

	public getMaybeLegacyNode({
		path,
	}: {
		path: TreePathLegacyLegacy;
	}): MaybeLegacy<TreeNodeLegacy> {
		let current: TreeNodeLegacy = this.root;

		for (const name of path) {
			if (!name) {
				return {
					description: `Invalid path: empty segment in ${path.join("/")}`,
					error: true,
				};
			}

			if (current.type === NodeTypeLegacy.Note) {
				return {
					description: `Cannot traverse into Note node: ${current.name}`,
					error: true,
				};
			}

			const child = current.children.find((c) => c.name === name);
			if (!child) {
				return {
					description: `Child "${name}" not found in "${current.name}"`,
					error: true,
				};
			}

			current = child;
		}

		return { data: current, error: false };
	}

	public getMaybeLegacyNote({
		path,
	}: {
		path: TreePathLegacyLegacy;
	}): MaybeLegacy<NoteNodeLegacy> {
		const mbNode = this.getMaybeLegacyNode({ path });
		if (mbNode.error) {
			return mbNode;
		}

		if (mbNode.data.type !== NodeTypeLegacy.Note) {
			return {
				description: `Node at ${path.join("/")} is not a Note`,
				error: true,
			};
		}

		return { data: mbNode.data, error: false };
	}

	public getMaybeLegacySection({
		path,
	}: {
		path: TreePathLegacyLegacy;
	}): MaybeLegacy<SectionNodeLegacy> {
		const mbNode = this.getMaybeLegacyNode({ path });
		if (mbNode.error) {
			return mbNode;
		}

		if (mbNode.data.type !== NodeTypeLegacy.Section) {
			return {
				description: `Node at ${path.join("/")} is not a Section`,
				error: true,
			};
		}

		return { data: mbNode.data, error: false };
	}

	public getNearestSection(path: TreePathLegacyLegacy): SectionNodeLegacy {
		const mbNode = this.getMaybeLegacyNode({ path });
		if (mbNode.error) {
			return this.root;
		}

		const node = mbNode.data;
		if (node.type === NodeTypeLegacy.Section) {
			return node;
		}

		// Note's parent is always a Section
		return node.parent ?? this.root;
	}

	// ─── Private Methods ──────────────────────────────────────────────

	private addNote(note: NoteDtoLegacy): MaybeLegacy<NoteNodeLegacy> {
		const { path, status } = note;

		if (path.length === 0) {
			return { description: "Note path cannot be empty", error: true };
		}

		const noteName = path[path.length - 1];
		if (!noteName) {
			return { description: "Note name is undefined", error: true };
		}

		// Ensure parent sections exist
		let parent: SectionNodeLegacy = this.root;
		for (const name of path.slice(0, -1)) {
			const mbSection = this.getOrCreateSection(parent, name);
			if (mbSection.error) {
				return mbSection;
			}
			parent = mbSection.data;
		}

		// Check if note already exists
		const existing = parent.children.find((c) => c.name === noteName);
		if (existing) {
			if (existing.type === NodeTypeLegacy.Note) {
				existing.status = status;
				return { data: existing, error: false };
			}
			return {
				description: `Cannot create Note "${noteName}": Section exists with same name`,
				error: true,
			};
		}

		// Create note
		const noteNode: NoteNodeLegacy = {
			name: noteName,
			parent,
			status,
			type: NodeTypeLegacy.Note,
		};

		parent.children.push(noteNode);
		return { data: noteNode, error: false };
	}

	private deleteNote(path: TreePathLegacyLegacy): void {
		const mbNote = this.getMaybeLegacyNote({ path });
		if (mbNote.error) {
			return;
		}

		const note = mbNote.data;
		const parent = note.parent;

		if (!parent) {
			return;
		}

		// Remove from parent
		parent.children = parent.children.filter((c) => c.name !== note.name);

		// Clean up empty parent sections (except root)
		this.cleanupEmptySections(parent);
	}

	private cleanupEmptySections(section: SectionNodeLegacy): void {
		if (section === this.root) {
			return;
		}

		if (section.children.length === 0 && section.parent) {
			const parent = section.parent;
			parent.children = parent.children.filter(
				(c) => c.name !== section.name,
			);
			this.cleanupEmptySections(parent);
		}
	}

	private getOrCreateSection(
		parent: SectionNodeLegacy,
		name: NodeNameLegacy,
	): MaybeLegacy<SectionNodeLegacy> {
		const existing = parent.children.find((c) => c.name === name);

		if (existing) {
			if (existing.type === NodeTypeLegacy.Section) {
				return { data: existing, error: false };
			}
			return {
				description: `Cannot create Section "${name}": Note exists with same name`,
				error: true,
			};
		}

		const section: SectionNodeLegacy = {
			children: [],
			name,
			parent,
			status: TextStatusLegacy.NotStarted,
			type: NodeTypeLegacy.Section,
		};

		parent.children.push(section);
		return { data: section, error: false };
	}

	private collectNotesFromNode(node: TreeNodeLegacy): NoteDtoLegacy[] {
		if (node.type === NodeTypeLegacy.Note) {
			return [
				{
					path: this.getPathFromNode(node),
					status: node.status,
				},
			];
		}

		const notes: NoteDtoLegacy[] = [];
		for (const child of node.children) {
			notes.push(...this.collectNotesFromNode(child));
		}
		return notes;
	}

	private getPathFromNode(node: TreeNodeLegacy): TreePathLegacyLegacy {
		const path: TreePathLegacyLegacy = [];
		let current: TreeNodeLegacy | null = node;

		while (current && current !== this.root) {
			path.unshift(current.name);
			current = current.parent;
		}

		return path;
	}

	private initializeParents(): void {
		this.root.parent = null;

		const setParents = (node: SectionNodeLegacy): void => {
			for (const child of node.children) {
				child.parent = node;
				if (child.type === NodeTypeLegacy.Section) {
					setParents(child);
				}
			}
		};

		setParents(this.root);
	}

	private recomputeStatuses(): void {
		this.computeStatus(this.root);
	}

	private computeStatus(node: TreeNodeLegacy): TextStatusLegacy {
		if (node.type === NodeTypeLegacy.Note) {
			return node.status;
		}

		if (node.children.length === 0) {
			node.status = TextStatusLegacy.NotStarted;
			return node.status;
		}

		const childStatuses = node.children.map((c) => this.computeStatus(c));

		const allDone = childStatuses.every((s) => s === TextStatusLegacy.Done);
		const allNotStarted = childStatuses.every(
			(s) => s === TextStatusLegacy.NotStarted,
		);

		node.status = allDone
			? TextStatusLegacy.Done
			: allNotStarted
				? TextStatusLegacy.NotStarted
				: TextStatusLegacy.InProgress;

		return node.status;
	}

	private setStatusRecursively(
		node: TreeNodeLegacy,
		status: TextStatusLegacy,
	): void {
		node.status = status;

		if (node.type === NodeTypeLegacy.Section) {
			for (const child of node.children) {
				this.setStatusRecursively(child, status);
			}
		}
	}
}
