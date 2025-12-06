import { z } from "zod";
import type { LibraryNoteMetaInfo } from "../../services/dto-services/meta-info-manager/types";
import type { FullPathToFile } from "../../services/obsidian-services/atomic-services/pathfinder";
import type { TextStatus } from "../../types/common-interface/enums";
import type { Prettify } from "../../types/helpers";
import { NOTE, SECTION } from "../../types/literals";
import type { GuardedNodeName } from "./indexing/formatters";

// Tree structure: Section → Note (2 levels)
export const NodeTypeV2Schema = z.enum([SECTION, NOTE]);
export type NodeTypeV2 = z.infer<typeof NodeTypeV2Schema>;
export const NodeTypeV2 = NodeTypeV2Schema.enum;

export type TreePath = GuardedNodeName[];

// NoteNode is a leaf (scroll or book page)
export type NoteNode = Prettify<{
	name: GuardedNodeName;
	status: TextStatus;
	type: typeof NodeTypeV2.Note;
	parent: SectionNodeV2 | null;
}>;

// SectionNodeV2 contains Sections or Notes
// Books are Sections containing Notes with numeric names (000, 001, etc.)
export type SectionNodeV2 = Prettify<{
	name: GuardedNodeName;
	status: TextStatus;
	type: typeof NodeTypeV2.Section;
	parent: SectionNodeV2 | null;
	children: (SectionNodeV2 | NoteNode)[];
}>;

// NoteDto - flat structure, one DTO per note/file
export type NoteDto = {
	path: TreePath;
	status: TextStatus;
};

export type LibraryFileDto = {
	metaInfo: LibraryNoteMetaInfo;
	fullPath: FullPathToFile;
};
