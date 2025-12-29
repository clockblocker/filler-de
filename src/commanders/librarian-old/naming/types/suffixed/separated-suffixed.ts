import z from "zod";
import { CODEX_CORE_NAME } from "../../../types/literals";
import {
	NodeNameSchemaDeprecated,
	SplitSuffixSchemaDeprecated,
} from "../../../types/schemas/node-name";

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
	nodeName: NodeNameSchemaDeprecated,
	splitSuffix: SplitSuffixSchemaDeprecated,
});

export const SeparatedSuffixedBasenameForFileSchema =
	SeparatedSuffixedBasenameSchema;

export const SeparatedSuffixedBasenameForCodexSchema = z.object({
	nodeName: NodeNameSchemaDeprecated.refine((s) => s === CODEX_CORE_NAME),
	splitSuffix: SplitSuffixSchemaDeprecated,
});

export const SeparatedSuffixedBasenameForSectionSchema = z.object({
	nodeName: NodeNameSchemaDeprecated,
	splitSuffix: SplitSuffixSchemaDeprecated.length(0),
});
