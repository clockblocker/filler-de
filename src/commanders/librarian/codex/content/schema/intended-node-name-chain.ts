import z from "zod";
import { NodeNameChainSchema } from "../../../types/schemas/node-name";
import { CodexLineTypeSchema } from "../schemas";

// CodexLineType enum
export const CodexLineTypeLineSchema = z.enum([
	"MdFile",
	"File",
	"ChildSectionCodex",
	"ParentSectionCodex",
]);

export type CodexLineType = z.infer<typeof CodexLineTypeSchema>;
export const CodexLineType = CodexLineTypeSchema.enum;

// Object schemas with type discriminator
export const NodeNameChainForMdFileLineSchema = z.object({
	type: z.literal(CodexLineType.MdFile),
	value: NodeNameChainSchema,
});

export const NodeNameChainForFileLineSchema = z.object({
	type: z.literal(CodexLineType.File),
	value: NodeNameChainSchema,
});

export const NodeNameChainForChildSectionCodexLineSchema = z.object({
	type: z.literal(CodexLineType.ChildSectionCodex),
	value: NodeNameChainSchema,
});

export const NodeNameChainForParentSectionCodexLineSchema = z.object({
	type: z.literal(CodexLineType.ParentSectionCodex),
	value: NodeNameChainSchema,
});

// Combined schema using discriminated union
export const IntendedNodeNameChainSchema = z.discriminatedUnion("type", [
	NodeNameChainForMdFileLineSchema,
	NodeNameChainForFileLineSchema,
	NodeNameChainForChildSectionCodexLineSchema,
	NodeNameChainForParentSectionCodexLineSchema,
]);
