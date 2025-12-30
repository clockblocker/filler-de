import z from "zod";
import { TreeNodeType } from "../../tree-node/types/atoms";
import {
	FileNodeSegmentIdSchema,
	ScrollNodeSegmentIdSchema,
	SectionNodeSegmentIdChainSchema,
	SectionNodeSegmentIdSchema,
} from "../../tree-node/types/node-segment-id";

const BaseNodeLocatorSchema = z.object({
	segmentIdChainToParent: SectionNodeSegmentIdChainSchema,
});

const SectionNodeLocatorSchema = BaseNodeLocatorSchema.extend({
	segmentId: SectionNodeSegmentIdSchema,
	targetType: z.literal(TreeNodeType.Section),
});

const ScrollNodeLocatorSchema = BaseNodeLocatorSchema.extend({
	segmentId: ScrollNodeSegmentIdSchema,
	targetType: z.literal(TreeNodeType.Scroll),
});

const FileNodeLocatorSchema = BaseNodeLocatorSchema.extend({
	segmentId: FileNodeSegmentIdSchema,
	targetType: z.literal(TreeNodeType.File),
});

const TreeNodeLocatorSchema = z.discriminatedUnion("targetType", [
	SectionNodeLocatorSchema,
	ScrollNodeLocatorSchema,
	FileNodeLocatorSchema,
]);

export type SectionNodeLocator = z.infer<typeof SectionNodeLocatorSchema>;
export type ScrollNodeLocator = z.infer<typeof ScrollNodeLocatorSchema>;
export type FileNodeLocator = z.infer<typeof FileNodeLocatorSchema>;
export type TreeNodeLocator = z.infer<typeof TreeNodeLocatorSchema>;
