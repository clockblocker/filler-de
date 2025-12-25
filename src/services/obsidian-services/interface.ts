import type { AboveSelectionToolbarService } from "./atomic-services/above-selection-toolbar-service";
import type { ApiService } from "./atomic-services/api-service";
import type { BottomToolbarService } from "./atomic-services/bottom-toolbar-service";
import type { SelectionService } from "./atomic-services/selection-service";

export type TexfresserObsidianServices = {
	apiService: ApiService;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;
};
