import type { NodeName } from "../../../../../types/schemas/node-name";

/**
 * Separated suffixed basename (internal type).
 * Core name + suffix parts separated.
 */
export type SeparatedSuffixedBasename = {
	coreName: NodeName;
	suffixParts: NodeName[];
};
