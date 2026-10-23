import z from "zod";
import {
	FileExtensionSchema,
	MdExtensionSchema,
	SectionExtensionSchema,
	TreeNodeKind,
} from "../../../healer/library-tree/tree-node/types/atoms";
import { SMALL_EM_DASH, SmallEmDashSchema } from "../../../internal/root/ui";

/**
 * The node-name part of a segment ID. A template literal checks only the
 * shape, so names are validated by the segment-ID codecs, under the
 * `CodecRules`' delimiter.
 */
const NodeNamePartSchema = z.string();

export const NodeSegmentIdSeparatorSchema = z.templateLiteral([
	SmallEmDashSchema,
]);

export type NodeSegmentIdSeparator = z.infer<
	typeof NodeSegmentIdSeparatorSchema
>;
export const NodeSegmentIdSeparator: NodeSegmentIdSeparator = `${SMALL_EM_DASH}`;

export const ScrollNodeSegmentIdSchema = z.templateLiteral([
	NodeNamePartSchema,
	NodeSegmentIdSeparator,
	TreeNodeKind.Scroll,
	NodeSegmentIdSeparator,
	MdExtensionSchema,
]);
export type ScrollNodeSegmentId = z.infer<typeof ScrollNodeSegmentIdSchema>;

export const FileNodeSegmentIdSchema = z.templateLiteral([
	NodeNamePartSchema,
	NodeSegmentIdSeparator,
	TreeNodeKind.File,
	NodeSegmentIdSeparator,
	FileExtensionSchema,
]);
export type FileNodeSegmentId = z.infer<typeof FileNodeSegmentIdSchema>;

export const SectionNodeSegmentIdSchema = z.templateLiteral([
	NodeNamePartSchema,
	NodeSegmentIdSeparator,
	TreeNodeKind.Section,
	NodeSegmentIdSeparator,
	SectionExtensionSchema,
]);
export type SectionNodeSegmentId = z.infer<typeof SectionNodeSegmentIdSchema>;

export const TreeNodeSegmentIdSchema = z.union([
	ScrollNodeSegmentIdSchema,
	FileNodeSegmentIdSchema,
	SectionNodeSegmentIdSchema,
]);
export type TreeNodeSegmentId = z.infer<typeof TreeNodeSegmentIdSchema>;

// --- Chains

export const SectionNodeSegmentIdChainSchema = z.array(
	SectionNodeSegmentIdSchema,
);
export type SectionNodeSegmentIdChain = z.infer<
	typeof SectionNodeSegmentIdChainSchema
>;
