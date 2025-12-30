import z from "zod";
import {
	SMALL_EM_DASH,
	SmallEmDashSchema,
} from "../../../../../types/literals";
import { NodeNameSchema } from "../../../types/schemas/node-name";
import {
	FileExtensionSchema,
	MdExtensionSchema,
	SectionExtensionSchema,
	TreeNodeType,
} from "./atoms";

export const NodeSegmentIdSeparatorSchema = z.templateLiteral([
	SmallEmDashSchema,
	SmallEmDashSchema,
]);

export type NodeSegmentIdSeparator = z.infer<
	typeof NodeSegmentIdSeparatorSchema
>;
export const NodeSegmentIdSeparator: NodeSegmentIdSeparator = `${SMALL_EM_DASH}${SMALL_EM_DASH}`;

export const ScrollNodeSegmentIdSchema = z.templateLiteral([
	NodeNameSchema,
	NodeSegmentIdSeparator,
	TreeNodeType.Scroll,
	NodeSegmentIdSeparator,
	MdExtensionSchema,
]);
export type ScrollNodeSegmentId = z.infer<typeof ScrollNodeSegmentIdSchema>;

export const FileNodeSegmentIdSchema = z.templateLiteral([
	NodeNameSchema,
	NodeSegmentIdSeparator,
	TreeNodeType.File,
	NodeSegmentIdSeparator,
	FileExtensionSchema,
]);
export type FileNodeSegmentId = z.infer<typeof FileNodeSegmentIdSchema>;

export const SectionNodeSegmentIdSchema = z.templateLiteral([
	NodeNameSchema,
	NodeSegmentIdSeparator,
	TreeNodeType.Section,
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
