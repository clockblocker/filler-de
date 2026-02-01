/**
 * Overlay manager module exports.
 */

export { dispatchActionClick } from "./action-click-dispatcher/dispatcher";
export type { ActionClickContext } from "./action-click-dispatcher/types";

export { ACTION_DEFINITIONS, KNOWN_ACTION_IDS } from "./action-definitions/definitions";
export {
	type ComputedActions,
	computeAllowedActions,
	computeNavActions,
	type PageNavMetadata,
} from "./action-definitions/placement-utils";
export {
	type ActionDefinition,
	OverlayActionKind,
	OverlayActionKindSchema,
	OverlayPlacement,
	OverlayPlacementSchema,
} from "./action-definitions/types";

export { createBottomToolbar } from "./bottom-toolbar/bottom-toolbar";
export type {
	ActionConfig,
	BottomToolbar,
	CreateBottomToolbarOptions,
} from "./bottom-toolbar/types";

export { type ContextMenuDeps, setupContextMenu } from "./context-menu/context-menu";

export { createEdgeZones } from "./edge-zones/edge-zones";
export type {
	CreateEdgeZonesOptions,
	EdgeZoneLayoutState,
	EdgeZones,
	PaddingDetectionResult,
} from "./edge-zones/types";

export { OverlayManager, type OverlayManagerDeps } from "./overlay-manager";

export { handleSelectionChanged } from "./selection-handler/handler";
export type { SelectionHandlerContext, SelectionHandlerResult } from "./selection-handler/types";

export { createSelectionToolbar } from "./selection-toolbar/selection-toolbar";
export type {
	ActionConfig as SelectionActionConfig,
	CreateSelectionToolbarOptions,
	SelectionToolbar,
} from "./selection-toolbar/types";

export { updateToolbarVisibility } from "./toolbar-lifecycle/manager";
export { buildSplitPath } from "./toolbar-lifecycle/path-utils";
export type { ToolbarLifecycleContext, ToolbarUpdateConfig } from "./toolbar-lifecycle/types";

export type { BottomToolbarConfig, OverlayState, ToolbarButton } from "./types";
