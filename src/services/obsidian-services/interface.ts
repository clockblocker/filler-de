import type { AboveSelectionToolbarService } from "./atomic-services/above-selection-toolbar-service";
import type { ApiService } from "./atomic-services/api-service";
import type { BottomToolbarService } from "./atomic-services/bottom-toolbar-service";
import type { SelectionService } from "./atomic-services/selection-service";
import type { LegacyOpenedFileService } from "./file-services/active-view/legacy-opened-file-service";
import type { LegacyBackgroundFileService } from "./file-services/background/background-file-service";

export type TexfresserObsidianServices = {
	apiService: ApiService;
	openedFileService: LegacyOpenedFileService;
	backgroundFileService: LegacyBackgroundFileService;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;
};
