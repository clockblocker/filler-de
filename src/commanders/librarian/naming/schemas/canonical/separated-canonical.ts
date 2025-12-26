import z from "zod";
import { CODEX_CORE_NAME, CodexCoreNameSchema } from "../../../types/literals";
import { NodeNameSchema, SplitSuffixSchema } from "../node-name";

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * { nodeName: "NoteName", splitSuffix: ["child", "parent"] }
 *
 * @example
 * // For path "Library/parent/child":
 * { nodeName: "child", splitSuffix: [] }
 */
export type SeparatedCanonicalBasename = z.infer<
	typeof SeparatedCanonicalBasenameSchema
>;

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * { nodeName: "NoteName", splitSuffix: ["child", "parent"] }
 */
export type SeparatedCanonicalBasenameForFile = z.infer<
	typeof SeparatedCanonicalBasenameForFileSchema
>;

/**
 * @example
 * // For path "Library/parent/child/__-child-parent.md":
 * { nodeName: "__", splitSuffix: ["child", "parent"] }
 */
export type SeparatedCanonicalBasenameForCodex = z.infer<
	typeof SeparatedCanonicalBasenameForCodexSchema
>;

/**
 * @example
 * // For path "Library/parent/child":
 * { nodeName: "child", splitSuffix: [] }
 */
export type SeparatedCanonicalBasenameForSection = z.infer<
	typeof SeparatedCanonicalBasenameForSectionSchema
>;

export const SeparatedCanonicalBasenameSchema = z.object({
	nodeName: NodeNameSchema,
	splitSuffix: SplitSuffixSchema,
});

export const SeparatedCanonicalBasenameForFileSchema =
	SeparatedCanonicalBasenameSchema;

export const SeparatedCanonicalBasenameForCodexSchema = z.object({
	nodeName: NodeNameSchema.refine((s) => s === CODEX_CORE_NAME),
	splitSuffix: SplitSuffixSchema,
});

export const SeparatedCanonicalBasenameForSectionSchema = z.object({
	nodeName: NodeNameSchema,
	splitSuffix: SplitSuffixSchema.length(0),
});
