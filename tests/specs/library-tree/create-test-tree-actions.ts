import  { type VaultAction, VaultActionType } from "../../../src/obsidian-vault-action-manager/types/vault-action";

/**
 * Create vault actions to build test tree structure:
 * Library
 * - Avarar
 *   - S1
 *     - E1-S1-Avarar.md
 *     - E2-S1-Avarar.md
 *   - S2
 *     - E1
 *       - 000_E1-E1-S2-Avarar.md
 *       - 001_E1-E1-S2-Avarar.md
 *     - E2-S1-Avarar.md
 */
export function createTestTreeActions(libraryRoot: string): VaultAction[] {
	const actions: VaultAction[] = [];

	// Create folders
	actions.push({
		payload: {
			splitPath: {
				basename: "Avarar",
				pathParts: [libraryRoot],
				type: "Folder",
			},
		},
		type: VaultActionType.CreateFolder,
	});

	actions.push({
		payload: {
			splitPath: {
				basename: "S1",
				pathParts: [libraryRoot, "Avarar"],
				type: "Folder",
			},
		},
		type: VaultActionType.CreateFolder,
	});

	actions.push({
		payload: {
			splitPath: {
				basename: "S2",
				pathParts: [libraryRoot, "Avarar"],
				type: "Folder",
			},
		},
		type: VaultActionType.CreateFolder,
	});

	actions.push({
		payload: {
			splitPath: {
				basename: "E1",
				pathParts: [libraryRoot, "Avarar", "S2"],
				type: "Folder",
			},
		},
		type: VaultActionType.CreateFolder,
	});

	// Create files
	actions.push({
		payload: {
			content: "",
			splitPath: {
				basename: "E1-S1-Avarar",
				extension: "md",
				pathParts: [libraryRoot, "Avarar", "S1"],
				type: "MdFile",
			},
		},
		type: VaultActionType.CreateMdFile,
	});

	actions.push({
		payload: {
			content: "",
			splitPath: {
				basename: "E2-S1-Avarar",
				extension: "md",
				pathParts: [libraryRoot, "Avarar", "S1"],
				type: "MdFile",
			},
		},
		type: VaultActionType.CreateMdFile,
	});

	actions.push({
		payload: {
			content: "",
			splitPath: {
				basename: "000_E1-E1-S2-Avarar",
				extension: "md",
				pathParts: [libraryRoot, "Avarar", "S2", "E1"],
				type: "MdFile",
			},
		},
		type: VaultActionType.CreateMdFile,
	});

	actions.push({
		payload: {
			content: "",
			splitPath: {
				basename: "001_E1-E1-S2-Avarar",
				extension: "md",
				pathParts: [libraryRoot, "Avarar", "S2", "E1"],
				type: "MdFile",
			},
		},
		type: VaultActionType.CreateMdFile,
	});

	actions.push({
		payload: {
			content: "",
			splitPath: {
				basename: "E2-S1-Avarar",
				extension: "md",
				pathParts: [libraryRoot, "Avarar", "S2"],
				type: "MdFile",
			},
		},
		type: VaultActionType.CreateMdFile,
	});

	return actions;
}
