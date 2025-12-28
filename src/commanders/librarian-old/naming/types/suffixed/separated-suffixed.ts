import z from "zod";
import { CODEX_CORE_NAME } from "../../../../librarin-shared/types/literals";
import {
	NodeNameSchema,
	SplitSuffixSchema,
} from "../../../../librarin-shared/types/node-name";

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * { nodeName: "NoteName", splitSuffix: ["child", "parent"] }
 *
 * @example
 * // For path "Library/parent/child":
 * { nodeName: "child", splitSuffix: [] }
 */
export type SeparatedSuffixedBasename = z.infer<
	typeof SeparatedSuffixedBasenameSchema
>;

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * { nodeName: "NoteName", splitSuffix: ["child", "parent"] }
 */
export type SeparatedSuffixedBasenameForFile = z.infer<
	typeof SeparatedSuffixedBasenameForFileSchema
>;

/**
 * @example
 * // For path "Library/parent/child/__-child-parent.md":
 * { nodeName: "__", splitSuffix: ["child", "parent"] }
 */
export type SeparatedSuffixedBasenameForCodex = z.infer<
	typeof SeparatedSuffixedBasenameForCodexSchema
>;

/**
 * @example
 * // For path "Library/parent/child":
 * { nodeName: "child", splitSuffix: [] }
 */
export type SeparatedSuffixedBasenameForSection = z.infer<
	typeof SeparatedSuffixedBasenameForSectionSchema
>;

export const SeparatedSuffixedBasenameSchema = z.object({
	nodeName: NodeNameSchema,
	splitSuffix: SplitSuffixSchema,
});

export const SeparatedSuffixedBasenameForFileSchema =
	SeparatedSuffixedBasenameSchema;

export const SeparatedSuffixedBasenameForCodexSchema = z.object({
	nodeName: NodeNameSchema.refine((s) => s === CODEX_CORE_NAME),
	splitSuffix: SplitSuffixSchema,
});

export const SeparatedSuffixedBasenameForSectionSchema = z.object({
	nodeName: NodeNameSchema,
	splitSuffix: SplitSuffixSchema.length(0),
});
