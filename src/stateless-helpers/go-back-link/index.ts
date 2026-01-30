/**
 * Go-back link module - utilities for library navigation links.
 */

export {
	goBackLinkHelper,
	// Legacy exports for backwards compatibility
	buildGoBackLink,
	buildGoBackLinkCapturePattern,
	buildGoBackLinkPattern,
	getGoBackLinkPrefix,
	isGoBackLine,
	parseGoBackLink,
	stripGoBackLink,
} from "./go-back-link";
export type { GoBackLinkInfo } from "./types";
