/**
 * Action definitions module - types, definitions, and utilities for overlay actions.
 */

export { ACTION_DEFINITIONS, KNOWN_ACTION_IDS } from "./definitions";
export {
	type ComputedActions,
	computeAllowedActions,
	computeNavActions,
	type PageNavMetadata,
} from "./placement-utils";
export {
	type ActionDefinition,
	OverlayActionKind,
	OverlayActionKindSchema,
	OverlayPlacement,
	OverlayPlacementSchema,
} from "./types";
