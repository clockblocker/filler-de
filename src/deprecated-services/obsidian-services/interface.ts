import type { App } from "obsidian";
import type { Librarian } from "../../commanders/librarian/librarian";
import type { VaultActionManager } from "../../managers/obsidian/vault-action-manager";
import type { OpenedFileService } from "../../managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import type { ApiService } from "../../stateless-services/api-service";

export type TexfresserObsidianServices = {
	app: App;
	apiService: ApiService;
	librarian?: Librarian | null;
	openedFileService: OpenedFileService;
	vaultActionManager: VaultActionManager;
};
