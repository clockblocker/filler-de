import z from "zod";
import { TreeNodeKind } from "../../../healer/library-tree/tree-node/types/atoms";
import {
	FileNodeSegmentIdSchema,
	ScrollNodeSegmentIdSchema,
	SectionNodeSegmentIdChainSchema,
	SectionNodeSegmentIdSchema,
} from "../../../healer/library-tree/tree-node/types/node-segment-id";

const BaseNodeLocatorSchema = z.object({
	segmentIdChainToParent: SectionNodeSegmentIdChainSchema,
});

export { BaseNodeLocatorSchema };

export const SectionNodeLocatorSchema = BaseNodeLocatorSchema.extend({
	segmentId: SectionNodeSegmentIdSchema,
	targetKind: z.literal(TreeNodeKind.Section),
});

export const ScrollNodeLocatorSchema = BaseNodeLocatorSchema.extend({
	segmentId: ScrollNodeSegmentIdSchema,
	targetKind: z.literal(TreeNodeKind.Scroll),
});

export const FileNodeLocatorSchema = BaseNodeLocatorSchema.extend({
	segmentId: FileNodeSegmentIdSchema,
	targetKind: z.literal(TreeNodeKind.File),
});

export const TreeNodeLocatorSchema = z.discriminatedUnion("targetKind", [
	SectionNodeLocatorSchema,
	ScrollNodeLocatorSchema,
	FileNodeLocatorSchema,
]);
