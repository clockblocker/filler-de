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
export const NodeNameSchema = z.string();

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * ["child", "parent"]
 */
export const SplitSuffixSchema = z.array(NodeNameSchema);

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * ["parent", "child"]
 */
export const NodeNameChainSchema = z.array(NodeNameSchema);

/**
 * @example
 * // For path "Library/parent/child/NoteName-child-parent.md":
 * { nodeName: "NoteName", splitSuffix: ["child", "parent"] }
 *
 * @example
 * // For path "Library/parent/child/__-child-parent.md":
 * { nodeName: "__", splitSuffix: ["child", "parent"] }
 *
 */
export const ParsedBasenameSchema = z.object({
	nodeName: NodeNameSchema,
	splitSuffix: SplitSuffixSchema,
});

export type NodeName = z.infer<typeof NodeNameSchema>;
export type SplitSuffix = z.infer<typeof SplitSuffixSchema>;
export type NodeNameChain = z.infer<typeof NodeNameChainSchema>;
export type ParsedBasename = z.infer<typeof ParsedBasenameSchema>;
