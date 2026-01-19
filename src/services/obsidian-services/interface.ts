import type { ApiService } from "./atomic-services/api-service";
import type { SelectionService } from "./atomic-services/selection-service";

export type TexfresserObsidianServices = {
	apiService: ApiService;
	selectionService: SelectionService;
};
