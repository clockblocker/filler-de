import z from "zod";
import {
	BACK_ARROW,
	OBSIDIAN_LINK_CLOSE,
	OBSIDIAN_LINK_OPEN,
	PIPE,
	SPACE_F,
} from "../../../../../types/literals";
import { NodeNameSchemaDeprecated } from "../../../types/schemas/node-name";

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
		{ message: "Filename cannot contain |, [[, or ]]" },
	);

// Backlink format: [[filename|← displayName]]
export const CodexBacklinkSchema = z.templateLiteral([
	z.literal(OBSIDIAN_LINK_OPEN),
	FilenameSchema,
	z.literal(PIPE),
	z.literal(BACK_ARROW),
	z.literal(SPACE_F),
	NodeNameSchemaDeprecated,
	z.literal(OBSIDIAN_LINK_CLOSE),
]);

export type CodexBacklink = z.infer<typeof CodexBacklinkSchema>;
