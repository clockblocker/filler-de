import { AboveSelectionToolbarService } from './atomic-services/above-selection-toolbar-service';
import { ApiService } from './atomic-services/api-service';
import { BackgroundFileService } from './atomic-services/background-file-service';
import { BottomToolbarService } from './atomic-services/bottom-toolbar-service';
import { OpenedFileService } from './atomic-services/opened-file-service';
import { SelectionService } from './atomic-services/selection-service';

export type TexfresserObsidianServices = {
	apiService: ApiService;
	openedFileService: OpenedFileService;
	backgroundFileService: BackgroundFileService;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;
};
