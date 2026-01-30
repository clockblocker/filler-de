/**
 * Content range service - pure text processing for selection and clipboard.
 */

import { stripContentForClipboard } from "./content-stripper";
import { calculateSmartRange } from "./smart-range";
import { splitFirstLine, splitFrontmatter } from "./text-utils";

/**
 * Content range helper object with grouped functions.
 */
export const contentRangeHelper = {
	calculateSmartRange,
	splitFirstLine,
	splitFrontmatter,
	stripForClipboard: stripContentForClipboard,
};

// Legacy exports for backwards compatibility
export { stripContentForClipboard } from "./content-stripper";
export { calculateSmartRange } from "./smart-range";
export { splitFirstLine, splitFrontmatter } from "./text-utils";
