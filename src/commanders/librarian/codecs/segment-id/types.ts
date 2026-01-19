import type { TreeNodeKind } from "../../healer/library-tree/tree-node/types/atoms";
import type { SegmentIdComponents } from "../types";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
	TreeNodeSegmentId,
} from "./types/segment-id";

/**
 * Public types for segment-id codecs.
 */
export type AnySegmentId = TreeNodeSegmentId;

export type SegmentIdOf<NK extends TreeNodeKind> =
	NK extends typeof TreeNodeKind.Section
		? SectionNodeSegmentId
		: NK extends typeof TreeNodeKind.Scroll
			? ScrollNodeSegmentId
			: NK extends typeof TreeNodeKind.File
				? FileNodeSegmentId
				: never;

export type { SegmentIdComponents };
