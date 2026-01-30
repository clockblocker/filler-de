/**
 * Go-back link module - utilities for library navigation links.
 */

export {
	// Legacy exports for backwards compatibility
	buildGoBackLink,
	buildGoBackLinkCapturePattern,
	buildGoBackLinkPattern,
	getGoBackLinkPrefix,
	goBackLinkHelper,
	isGoBackLine,
	parseGoBackLink,
	stripGoBackLink,
} from "./go-back-link";
export type { GoBackLinkInfo } from "./types";
