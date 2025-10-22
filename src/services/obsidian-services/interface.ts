import type { AboveSelectionToolbarService } from "./atomic-services/above-selection-toolbar-service";
import type { ApiService } from "./atomic-services/api-service";
import type { BackgroundFileService } from "./atomic-services/background-file-service";
import type { BottomToolbarService } from "./atomic-services/bottom-toolbar-service";
import type { OpenedFileService } from "./atomic-services/opened-file-service";
import type { SelectionService } from "./atomic-services/selection-service";

export type TexfresserObsidianServices = {
	apiService: ApiService;
	openedFileService: OpenedFileService;
	backgroundFileService: BackgroundFileService;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;
};
