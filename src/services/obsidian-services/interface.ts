import type { AboveSelectionToolbarService } from "./atomic-services/above-selection-toolbar-service";
import type { ApiService } from "./atomic-services/api-service";
import type { BottomToolbarService } from "./atomic-services/bottom-toolbar-service";
import type { SelectionService } from "./atomic-services/selection-service";
import type { OpenedFileService } from "./file-services/active-view/opened-file-service";
import type { BackgroundFileService } from "./file-services/background/background-file-service";

export type TexfresserObsidianServices = {
	apiService: ApiService;
	openedFileService: OpenedFileService;
	backgroundFileService: BackgroundFileService;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;
};
