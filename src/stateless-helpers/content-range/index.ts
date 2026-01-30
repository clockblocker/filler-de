/**
 * Content range service - pure text processing for selection and clipboard.
 */

import { calculateSmartRange } from "./smart-range";
import { splitFirstLine } from "./text-utils";

/**
 * Content range helper object with grouped functions.
 */
export const contentRangeHelper = {
	calculateSmartRange,
	splitFirstLine,
};

// Legacy exports for backwards compatibility
export { calculateSmartRange } from "./smart-range";
export { splitFirstLine } from "./text-utils";
