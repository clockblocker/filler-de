import { TextStatus } from "../../../types/common-interface/enums";
import type { Maybe } from "../../../types/common-interface/maybe";
import type { NodeName } from "../indexing/codecs";
import {
	NodeType,
	type NoteDto,
	type NoteNode,
	type SectionNode,
	type TreePath,
} from "../types";

type TreeNode = SectionNode | NoteNode;

/**
 * Snapshot for diffing trees
 */
export type TreeSnapshot = {
	notes: NoteDto[];
	sectionPaths: TreePath[];
};

/**
 * LibraryTree - Simplified tree with 2 levels: Section → Note
 *
 * Key differences from V1:
 * - Input: NoteDto[] (flat, one per file) instead of TextDto[] (grouped by text)
 * - Structure: Section → Note (no intermediate Text node)
 * - Books are just Sections containing multiple Notes
 */
export class LibraryTree {
	root: SectionNode;

	constructor(notes: NoteDto[], name: string) {
		this.root = {
			children: [],
			name,
			parent: null,
			status: TextStatus.NotStarted,
			type: NodeType.Section,
		};

		this.addNotes(notes);
	}

	// ─── Public API ───────────────────────────────────────────────────

	public getNotes(path: TreePath): NoteDto[] {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return [];
		}

		return this.collectNotesFromNode(mbNode.data);
	}

	public getAllNotes(): NoteDto[] {
		return this.getNotes([]);
	}

	public getAllSectionPaths(): TreePath[] {
		const paths: TreePath[] = [];

		const collectSections = (node: SectionNode): void => {
			for (const child of node.children) {
				if (child.type === NodeType.Section) {
					paths.push(this.getPathFromNode(child));
					collectSections(child);
				}
			}
		};

		collectSections(this.root);
		return paths;
	}

	public snapshot(): TreeSnapshot {
		return {
			notes: this.getAllNotes(),
			sectionPaths: this.getAllSectionPaths(),
		};
	}

	public addNotes(notes: NoteDto[]): void {
		for (const note of notes) {
			this.addNote(note);
		}
		this.initializeParents();
		this.recomputeStatuses();
	}

	public deleteNotes(paths: TreePath[]): void {
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
		path: TreePath;
		status: "Done" | "NotStarted";
	}): Maybe<TreeNode> {
		const mbNode = this.getMaybeNode({ path });
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

	public getMaybeNode({ path }: { path: TreePath }): Maybe<TreeNode> {
		let current: TreeNode = this.root;

		for (const name of path) {
			if (!name) {
				return {
					description: `Invalid path: empty segment in ${path.join("/")}`,
					error: true,
				};
			}

			if (current.type === NodeType.Note) {
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

	public getMaybeNote({ path }: { path: TreePath }): Maybe<NoteNode> {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return mbNode;
		}

		if (mbNode.data.type !== NodeType.Note) {
			return {
				description: `Node at ${path.join("/")} is not a Note`,
				error: true,
			};
		}

		return { data: mbNode.data, error: false };
	}

	public getMaybeSection({ path }: { path: TreePath }): Maybe<SectionNode> {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return mbNode;
		}

		if (mbNode.data.type !== NodeType.Section) {
			return {
				description: `Node at ${path.join("/")} is not a Section`,
				error: true,
			};
		}

		return { data: mbNode.data, error: false };
	}

	public getNearestSection(path: TreePath): SectionNode {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return this.root;
		}

		const node = mbNode.data;
		if (node.type === NodeType.Section) {
			return node;
		}

		// Note's parent is always a Section
		return node.parent ?? this.root;
	}

	// ─── Private Methods ──────────────────────────────────────────────

	private addNote(note: NoteDto): Maybe<NoteNode> {
		const { path, status } = note;

		if (path.length === 0) {
			return { description: "Note path cannot be empty", error: true };
		}

		const noteName = path[path.length - 1];
		if (!noteName) {
			return { description: "Note name is undefined", error: true };
		}

		// Ensure parent sections exist
		let parent: SectionNode = this.root;
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
			if (existing.type === NodeType.Note) {
				existing.status = status;
				return { data: existing, error: false };
			}
			return {
				description: `Cannot create Note "${noteName}": Section exists with same name`,
				error: true,
			};
		}

		// Create note
		const noteNode: NoteNode = {
			name: noteName,
			parent,
			status,
			type: NodeType.Note,
		};

		parent.children.push(noteNode);
		return { data: noteNode, error: false };
	}

	private deleteNote(path: TreePath): void {
		const mbNote = this.getMaybeNote({ path });
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

	private cleanupEmptySections(section: SectionNode): void {
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
		parent: SectionNode,
		name: NodeName,
	): Maybe<SectionNode> {
		const existing = parent.children.find((c) => c.name === name);

		if (existing) {
			if (existing.type === NodeType.Section) {
				return { data: existing, error: false };
			}
			return {
				description: `Cannot create Section "${name}": Note exists with same name`,
				error: true,
			};
		}

		const section: SectionNode = {
			children: [],
			name,
			parent,
			status: TextStatus.NotStarted,
			type: NodeType.Section,
		};

		parent.children.push(section);
		return { data: section, error: false };
	}

	private collectNotesFromNode(node: TreeNode): NoteDto[] {
		if (node.type === NodeType.Note) {
			return [
				{
					path: this.getPathFromNode(node),
					status: node.status,
				},
			];
		}

		const notes: NoteDto[] = [];
		for (const child of node.children) {
			notes.push(...this.collectNotesFromNode(child));
		}
		return notes;
	}

	private getPathFromNode(node: TreeNode): TreePath {
		const path: TreePath = [];
		let current: TreeNode | null = node;

		while (current && current !== this.root) {
			path.unshift(current.name);
			current = current.parent;
		}

		return path;
	}

	private initializeParents(): void {
		this.root.parent = null;

		const setParents = (node: SectionNode): void => {
			for (const child of node.children) {
				child.parent = node;
				if (child.type === NodeType.Section) {
					setParents(child);
				}
			}
		};

		setParents(this.root);
	}

	private recomputeStatuses(): void {
		this.computeStatus(this.root);
	}

	private computeStatus(node: TreeNode): TextStatus {
		if (node.type === NodeType.Note) {
			return node.status;
		}

		if (node.children.length === 0) {
			node.status = TextStatus.NotStarted;
			return node.status;
		}

		const childStatuses = node.children.map((c) => this.computeStatus(c));

		const allDone = childStatuses.every((s) => s === TextStatus.Done);
		const allNotStarted = childStatuses.every(
			(s) => s === TextStatus.NotStarted,
		);

		node.status = allDone
			? TextStatus.Done
			: allNotStarted
				? TextStatus.NotStarted
				: TextStatus.InProgress;

		return node.status;
	}

	private setStatusRecursively(node: TreeNode, status: TextStatus): void {
		node.status = status;

		if (node.type === NodeType.Section) {
			for (const child of node.children) {
				this.setStatusRecursively(child, status);
			}
		}
	}
}
