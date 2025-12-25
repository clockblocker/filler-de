import z from "zod";

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * "NoteName"
 *
 * @example
 * // For path "Library/parent/child/__-child-parent.md":
 * "__"
 */
export const CoreNameSchema = z.string();

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * ["child", "parent"]
 */
export const SplitSuffixSchema = z.array(CoreNameSchema);

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * ["parent", "child"]
 */
export const CoreNameChainFromRootSchema = z.array(CoreNameSchema);

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * { coreName: "NoteName", splitSuffix: ["child", "parent"] }
 *
 * @example
 * // For path "Library/parent/child/__-child-parent.md":
 * { coreName: "__", splitSuffix: ["child", "parent"] }
 *
 */
export const ParsedBasenameSchema = z.object({
	coreName: CoreNameSchema,
	splitSuffix: SplitSuffixSchema,
});

export type CoreName = z.infer<typeof CoreNameSchema>;
export type SplitSuffix = z.infer<typeof SplitSuffixSchema>;
export type CoreNameChainFromRoot = z.infer<typeof CoreNameChainFromRootSchema>;
export type ParsedBasename = z.infer<typeof ParsedBasenameSchema>;
