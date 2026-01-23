import type { App } from "obsidian";
import type { VaultActionManager } from "../../managers/obsidian/vault-action-manager";
import type { OpenedFileService } from "../../managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import type { ApiService } from "./atomic-services/api-service";

export type TexfresserObsidianServices = {
	app: App;
	apiService: ApiService;
	openedFileService: OpenedFileService;
	vaultActionManager: VaultActionManager;
};
