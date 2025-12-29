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
import { NodeNameSchemaDeprecated } from "../../../types/schemas/node-name";
import type { CodexLineType } from "./literals";

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
	NodeNameSchemaDeprecated,
	z.literal(OBSIDIAN_LINK_CLOSE),
]);

// Parent backlink format: [[filename|← displayName]]
const ParentBacklinkSchema = z.templateLiteral([
	z.literal(OBSIDIAN_LINK_OPEN),
	FilenameSchema,
	z.literal(PIPE),
	z.literal(BACK_ARROW),
	z.literal(SPACE_F),
	NodeNameSchemaDeprecated,
	z.literal(OBSIDIAN_LINK_CLOSE),
]);

// Template literal schemas for the string values
export const CodexLineForScrollSchema = z.templateLiteral([
	CheckboxSchema,
	z.literal(SPACE_F),
	RegularBacklinkSchema,
]);

export const CodexLineForFileSchema = z.templateLiteral([
	z.literal(DASH),
	z.literal(SPACE_F),
	RegularBacklinkSchema,
]);

export const CodexLineForChildSectionCodexSchema = z.templateLiteral([
	CheckboxSchema,
	z.literal(SPACE_F),
	RegularBacklinkSchema,
]);

export const CodexLineForParentSectionCodexSchema = ParentBacklinkSchema;

// Combined schema using discriminated union
export const CodexLineSchema = z.union([
	CodexLineForScrollSchema,
	CodexLineForFileSchema,
	CodexLineForChildSectionCodexSchema,
	CodexLineForParentSectionCodexSchema,
]);

export type AnyCodexLine = z.infer<typeof CodexLineSchema>;
export type CodexLineForScroll = z.infer<typeof CodexLineForScrollSchema>;
export type CodexLineForFile = z.infer<typeof CodexLineForFileSchema>;
export type CodexLineForChildSectionCodex = z.infer<
	typeof CodexLineForChildSectionCodexSchema
>;
export type CodexLineForParentSectionCodex = z.infer<
	typeof CodexLineForParentSectionCodexSchema
>;

export type CodexLine<T extends CodexLineType> =
	T extends typeof CodexLineType.Scroll
		? CodexLineForScroll
		: T extends typeof CodexLineType.File
			? CodexLineForFile
			: T extends typeof CodexLineType.ChildSectionCodex
				? CodexLineForChildSectionCodex
				: T extends typeof CodexLineType.ParentSectionCodex
					? CodexLineForParentSectionCodex
					: never;

export type TypedCodexLine<T extends CodexLineType> = {
	line: CodexLine<T>;
	type: T;
};
