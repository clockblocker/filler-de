/**
 * @deprecated - Import from 'src/stateless-services/go-back-link-service' instead
 * Re-export for temporary backwards compatibility
 */

export type { GoBackLinkInfo } from "../../../stateless-services/go-back-link-service";
export {
	buildGoBackLink,
	buildGoBackLinkCapturePattern,
	buildGoBackLinkPattern,
	getGoBackLinkPrefix,
	isGoBackLine,
	parseGoBackLink,
	stripGoBackLink,
} from "../../../stateless-services/go-back-link-service";
