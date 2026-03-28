import type { AnnotatedSentence } from "../../types";

/**
 * Horizontal rule info for tracking HRs extracted during segmentation.
 */
export type HRInfo = {
	sentence: AnnotatedSentence;
	originalIndex: number;
};
