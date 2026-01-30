/**
 * Re-export goBackLinkHelper from stateless-helpers for librarian usage.
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
} from "../../../stateless-helpers/go-back-link";
