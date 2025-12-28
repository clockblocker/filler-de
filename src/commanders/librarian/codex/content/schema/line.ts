import z from "zod";
import {
	BACK_ARROW,
	CheckboxSchema,
	DASH,
	OBSIDIAN_LINK_CLOSE,
	OBSIDIAN_LINK_OPEN,
	PIPE,
	SPACE_F,
} from "../../../../../types/literals";
import { NodeNameSchema } from "../../../naming/types/node-name";

// CodexLineType enum
export const CodexLineTypeSchema = z.enum([
	"MdFile",
	"File",
	"ChildSectionCodex",
	"ParentSectionCodex",
]);

export type CodexLineType = z.infer<typeof CodexLineTypeSchema>;
export const CodexLineType = CodexLineTypeSchema.enum;

// Filename can contain delimiters, so we use a more permissive string
// but exclude the pipe and brackets used in the link format
const FilenameSchema = z
	.string()
	.min(1)
	.refine(
		(val) =>
			!val.includes(PIPE) &&
			!val.includes(OBSIDIAN_LINK_OPEN) &&
			!val.includes(OBSIDIAN_LINK_CLOSE),
		{
			message: `Filename cannot contain ${PIPE}, ${OBSIDIAN_LINK_OPEN} or ${OBSIDIAN_LINK_CLOSE}`,
		},
	);

// Regular backlink format: [[filename|displayName]]
const RegularBacklinkSchema = z.templateLiteral([
	z.literal(OBSIDIAN_LINK_OPEN),
	FilenameSchema,
	z.literal(PIPE),
	NodeNameSchema,
	z.literal(OBSIDIAN_LINK_CLOSE),
]);

// Parent backlink format: [[filename|← displayName]]
const ParentBacklinkSchema = z.templateLiteral([
	z.literal(OBSIDIAN_LINK_OPEN),
	FilenameSchema,
	z.literal(PIPE),
	z.literal(BACK_ARROW),
	z.literal(SPACE_F),
	NodeNameSchema,
	z.literal(OBSIDIAN_LINK_CLOSE),
]);

// Template literal schemas for the string values
const CodexLineForMdFileValueSchema = z.templateLiteral([
	CheckboxSchema,
	z.literal(SPACE_F),
	RegularBacklinkSchema,
]);

const CodexLineForFileValueSchema = z.templateLiteral([
	z.literal(DASH),
	z.literal(SPACE_F),
	RegularBacklinkSchema,
]);

const CodexLineForChildSectionCodexValueSchema = z.templateLiteral([
	CheckboxSchema,
	z.literal(SPACE_F),
	RegularBacklinkSchema,
]);

const CodexLineForParentSectionCodexValueSchema = ParentBacklinkSchema;

// Object schemas with type discriminator
export const CodexLineForMdFileSchema = z.object({
	type: z.literal(CodexLineType.MdFile),
	value: CodexLineForMdFileValueSchema,
});

export const CodexLineForFileSchema = z.object({
	type: z.literal(CodexLineType.File),
	value: CodexLineForFileValueSchema,
});

export const CodexLineForChildSectionCodexSchema = z.object({
	type: z.literal(CodexLineType.ChildSectionCodex),
	value: CodexLineForChildSectionCodexValueSchema,
});

export const CodexLineForParentSectionCodexSchema = z.object({
	type: z.literal(CodexLineType.ParentSectionCodex),
	value: CodexLineForParentSectionCodexValueSchema,
});

// Combined schema using discriminated union
export const CodexLineSchema = z.discriminatedUnion("type", [
	CodexLineForMdFileSchema,
	CodexLineForFileSchema,
	CodexLineForChildSectionCodexSchema,
	CodexLineForParentSectionCodexSchema,
]);

export type CodexLine = z.infer<typeof CodexLineSchema>;
export type CodexLineForMdFile = z.infer<typeof CodexLineForMdFileSchema>;
export type CodexLineForFile = z.infer<typeof CodexLineForFileSchema>;
export type CodexLineForChildSectionCodex = z.infer<
	typeof CodexLineForChildSectionCodexSchema
>;
export type CodexLineForParentSectionCodex = z.infer<
	typeof CodexLineForParentSectionCodexSchema
>;
