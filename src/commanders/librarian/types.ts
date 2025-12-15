import { z } from "zod";
import type { LibraryNoteMetaInfo } from "../../services/dto-services/meta-info-manager/types";
import type { LegacyFullPathToMdFile } from "../../services/obsidian-services/atomic-services/pathfinder";
import type { TextStatusLegacy } from "../../types/common-interface/enums";
import type { Prettify } from "../../types/helpers";
import { NOTE, SECTION } from "../../types/literals";
import type { NodeNameLegacy } from "./indexing/codecs";

// Tree structure: Section → Note (2 levels)
export const NodeTypeLegacySchemaLegacyLegacy = z.enum([SECTION, NOTE]);
export type NodeTypeLegacy = z.infer<typeof NodeTypeLegacySchemaLegacyLegacy>;
export const NodeTypeLegacy = NodeTypeLegacySchemaLegacyLegacy.enum;

export type TreePathLegacyLegacy = NodeNameLegacy[];

export type NoteNodeLegacy = Prettify<{
	name: NodeNameLegacy;
	status: TextStatusLegacy;
	type: typeof NodeTypeLegacy.Note;
	parent: SectionNodeLegacy | null;
}>;

export type SectionNodeLegacy = Prettify<{
	name: NodeNameLegacy;
	status: TextStatusLegacy;
	type: typeof NodeTypeLegacy.Section;
	parent: SectionNodeLegacy | null;
	children: (SectionNodeLegacy | NoteNodeLegacy)[];
}>;

export type NoteDtoLegacy = {
	path: TreePathLegacyLegacy;
	status: TextStatusLegacy;
};

export type LibraryFileLegacy = {
	metaInfo: LibraryNoteMetaInfo;
	fullPath: LegacyFullPathToMdFile;
};
