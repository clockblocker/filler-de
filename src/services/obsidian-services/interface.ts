import type { App } from "obsidian";
import type { VaultActionManager } from "../../managers/obsidian/vault-action-manager";
import type { ApiService } from "./atomic-services/api-service";
import type { SelectionService } from "./atomic-services/selection-service";

export type TexfresserObsidianServices = {
	app: App;
	apiService: ApiService;
	selectionService: SelectionService;
	vaultActionManager: VaultActionManager;
};
