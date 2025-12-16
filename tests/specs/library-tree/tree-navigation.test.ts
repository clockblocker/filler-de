/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";

export const testGetNodeHappyPath = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const LIBRARY_ROOT = "Library";
		const librarianApi = await app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getLibrarianTestingApi?.();
		if (!librarianApi) {
			return { error: "librarian testing api unavailable" };
		}

		const vaultActionManagerApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.();
		if (!vaultActionManagerApi) {
			return { error: "vault action manager testing api unavailable" };
		}

		if (!librarianApi.librarian) {
			return { error: "librarian is undefined in api" };
		}
		if (!vaultActionManagerApi.manager) {
			return { error: "manager is undefined in api" };
		}

		const { librarian } = librarianApi;
		const { manager } = vaultActionManagerApi;

		// Inline createTestTreeActions - can't import in e2e context
		const createTestTreeActions = (libraryRoot: string) => {
			const actions: any[] = [];
			actions.push({
				payload: { splitPath: { basename: "Avarar", pathParts: [libraryRoot], type: "Folder" } },
				type: "CreateFolder",
			});
			actions.push({
				payload: { splitPath: { basename: "S1", pathParts: [libraryRoot, "Avarar"], type: "Folder" } },
				type: "CreateFolder",
			});
			actions.push({
				payload: { splitPath: { basename: "S2", pathParts: [libraryRoot, "Avarar"], type: "Folder" } },
				type: "CreateFolder",
			});
			actions.push({
				payload: { splitPath: { basename: "E1", pathParts: [libraryRoot, "Avarar", "S2"], type: "Folder" } },
				type: "CreateFolder",
			});
			actions.push({
				payload: { content: "", splitPath: { basename: "E1-S1-Avarar", extension: "md", pathParts: [libraryRoot, "Avarar", "S1"], type: "MdFile" } },
				type: "CreateMdFile",
			});
			actions.push({
				payload: { content: "", splitPath: { basename: "E2-S1-Avarar", extension: "md", pathParts: [libraryRoot, "Avarar", "S1"], type: "MdFile" } },
				type: "CreateMdFile",
			});
			actions.push({
				payload: { content: "", splitPath: { basename: "000_E1-E1-S2-Avarar", extension: "md", pathParts: [libraryRoot, "Avarar", "S2", "E1"], type: "MdFile" } },
				type: "CreateMdFile",
			});
			actions.push({
				payload: { content: "", splitPath: { basename: "001_E1-E1-S2-Avarar", extension: "md", pathParts: [libraryRoot, "Avarar", "S2", "E1"], type: "MdFile" } },
				type: "CreateMdFile",
			});
			actions.push({
				payload: { content: "", splitPath: { basename: "E2-S1-Avarar", extension: "md", pathParts: [libraryRoot, "Avarar", "S2"], type: "MdFile" } },
				type: "CreateMdFile",
			});
			return actions;
		};

		// Create test structure
		const testActions = createTestTreeActions(LIBRARY_ROOT);
		await manager.dispatch(testActions);

		// Read tree from vault
		const tree = await librarian.readTreeFromVault();

		// Test: Get root node (empty chain)
		const rootNode = tree.getNode([]);
		if (!rootNode || rootNode.type !== "Section") {
			return { error: "Root node not found or not a Section" };
		}
		if (rootNode.coreName !== "") {
			return {
				error: `Expected root coreName "", got "${rootNode.coreName}"`,
			};
		}

		// Test: Get section node by chain
		const avararSection = tree.getNode(["Avarar"]);
		if (!avararSection || avararSection.type !== "Section") {
			return { error: "Avarar section not found or not a Section" };
		}
		if (avararSection.coreName !== "Avarar") {
			return {
				error: `Expected coreName "Avarar", got "${avararSection.coreName}"`,
			};
		}

		// Test: Get file node by chain
		const e1S1Avarar = tree.getNode(["Avarar", "S1", "E1"]);
		if (!e1S1Avarar || e1S1Avarar.type !== "Scroll") {
			return { error: "E1-S1-Avarar file not found or not a Scroll" };
		}
		if (e1S1Avarar.coreName !== "E1") {
			return {
				error: `Expected coreName "E1", got "${e1S1Avarar.coreName}"`,
			};
		}

		// Test: Get non-existent node
		const nonExistent = tree.getNode([
			"Avarar",
			"NonExistent",
		]);
		if (nonExistent !== null) {
			return { error: "Non-existent node should return null" };
		}

		return {
			fileFound: true,
			nonExistentReturnsNull: true,
			rootFound: true,
			sectionFound: true,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.rootFound).toBe(true);
	expect(result.sectionFound).toBe(true);
	expect(result.fileFound).toBe(true);
	expect(result.nonExistentReturnsNull).toBe(true);
};
