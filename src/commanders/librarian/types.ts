import { z } from "zod";
import type { LibraryNoteMetaInfo } from "../../services/dto-services/meta-info-manager/types";
import type { FullPathToFile } from "../../services/obsidian-services/atomic-services/pathfinder";
import type { TextStatus } from "../../types/common-interface/enums";
import type { Prettify } from "../../types/helpers";
import { NOTE, SECTION } from "../../types/literals";
import type { NodeName } from "./indexing/codecs";

// Tree structure: Section → Note (2 levels)
export const NodeTypeSchema = z.enum([SECTION, NOTE]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

export type TreePath = NodeName[];

export type NoteNode = Prettify<{
	name: NodeName;
	status: TextStatus;
	type: typeof NodeType.Note;
	parent: SectionNode | null;
}>;

export type SectionNode = Prettify<{
	name: NodeName;
	status: TextStatus;
	type: typeof NodeType.Section;
	parent: SectionNode | null;
	children: (SectionNode | NoteNode)[];
}>;

export type NoteDto = {
	path: TreePath;
	status: TextStatus;
};

export type LibraryFileDto = {
	metaInfo: LibraryNoteMetaInfo;
	fullPath: FullPathToFile;
};
