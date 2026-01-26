/**
 * Overlay manager module exports.
 */

export {
	type ActionClickContext,
	dispatchActionClick,
} from "./action-click-dispatcher";
export {
	ACTION_DEFINITIONS,
	type ActionDefinition,
	type ComputedActions,
	computeAllowedActions,
	KNOWN_ACTION_IDS,
	OverlayActionKind,
	OverlayPlacement,
} from "./action-definitions";
export type { ActionConfig, BottomToolbar } from "./bottom-toolbar";
export { OverlayManager, type OverlayManagerDeps } from "./overlay-manager";
export {
	handleSelectionChanged,
	type SelectionHandlerContext,
	type SelectionHandlerResult,
} from "./selection-handler";
export type { SelectionToolbar } from "./selection-toolbar";
export {
	buildSplitPath,
	type ToolbarLifecycleContext,
	type ToolbarUpdateConfig,
	updateToolbarVisibility,
} from "./toolbar-lifecycle";
export type { BottomToolbarConfig, OverlayState, ToolbarButton } from "./types";
