import { AboveSelectionToolbarService } from './services/above-selection-toolbar-service';
import { ApiService } from './services/api-service';
import { BackgroundFileService } from './services/background-file-service';
import { BottomToolbarService } from './services/bottom-toolbar-service';
import { OpenedFileService } from './services/opened-file-service';
import { SelectionService } from './services/selection-service';

export type TexfresserObsidianServices = {
	apiService: ApiService;
	openedFileService: OpenedFileService;
	backgroundFileService: BackgroundFileService;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	bottomToolbarService: BottomToolbarService;
};
