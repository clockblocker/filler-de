import { DeprecatedFileService } from '../../file';
import { AboveSelectionToolbarService } from './above-selection-toolbar-service';
import { ApiService } from './api-service';
import { BackgroundFileService } from './background-file-service';
import { BottomToolbarService } from './bottom-toolbar-service';
import { OpenedFileService } from './opened-file-service';
import { SelectionService } from './selection-service';

export type TexfresserObsidianServices = {
	apiService: ApiService;
	openedFileService: OpenedFileService;
	backgroundFileService: BackgroundFileService;
	selectionService: SelectionService;

	selectionToolbarService: AboveSelectionToolbarService;
	overlayService: BottomToolbarService;

	deprecatedFileService: DeprecatedFileService;
};
