/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";

export const testReadTreeFromVault = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const LIBRARY_ROOT = "Library";
		console.log("[test] Getting librarian API...");
		const librarianApi = await app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getLibrarianTestingApi?.();
		console.log("[test] librarianApi:", !!librarianApi, librarianApi ? Object.keys(librarianApi) : "null");
		if (!librarianApi) {
			return { error: "librarian testing api unavailable" };
		}

		const vaultActionManagerApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.();
		if (!vaultActionManagerApi) {
			return { error: "vault action manager testing api unavailable" };
		}

		console.log("[test] librarianApi.librarian:", !!librarianApi.librarian, typeof librarianApi.librarian);
		if (!librarianApi.librarian) {
			return { error: "librarian is undefined in api" };
		}
		if (!vaultActionManagerApi.manager) {
			return { error: "manager is undefined in api" };
		}

		const { librarian, splitPath } = librarianApi;
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

		// Verify root section exists
		const rootNode = tree.getNode([]);
		if (!rootNode || rootNode.type !== "Section") {
			return { error: "Root section not found" };
		}

		// Verify sections exist
		const avararSection = tree.getNode(["Avarar"]);
		const s1Section = tree.getNode(["Avarar", "S1"]);
		const s2Section = tree.getNode(["Avarar", "S2"]);
		const e1Section = tree.getNode(["Avarar", "S2", "E1"]);

		if (!avararSection || avararSection.type !== "Section") {
			return { error: "Avarar section not found" };
		}
		if (!s1Section || s1Section.type !== "Section") {
			return { error: "S1 section not found" };
		}
		if (!s2Section || s2Section.type !== "Section") {
			return { error: "S2 section not found" };
		}
		if (!e1Section || e1Section.type !== "Section") {
			return { error: "E1 section not found" };
		}

		// Verify files exist
		const e1S1Avarar = tree.getNode([
			"Avarar",
			"S1",
			"E1",
		]);
		const e2S1Avarar = tree.getNode([
			"Avarar",
			"S1",
			"E2",
		]);
		const file000 = tree.getNode([
			"Avarar",
			"S2",
			"E1",
			"000",
		]);
		const file001 = tree.getNode([
			"Avarar",
			"S2",
			"E1",
			"001",
		]);
		const e2S2Avarar = tree.getNode([
			"Avarar",
			"S2",
			"E2",
		]);

		if (!e1S1Avarar || e1S1Avarar.type !== "Scroll") {
			return { error: "E1-S1-Avarar.md not found" };
		}
		if (!e2S1Avarar || e2S1Avarar.type !== "Scroll") {
			return { error: "E2-S1-Avarar.md not found" };
		}
		if (!file000 || file000.type !== "Scroll") {
			return { error: "000_E1-E1-S2-Avarar.md not found" };
		}
		if (!file001 || file001.type !== "Scroll") {
			return { error: "001_E1-E1-S2-Avarar.md not found" };
		}
		if (!e2S2Avarar || e2S2Avarar.type !== "Scroll") {
			return { error: "E2-S1-Avarar.md in S2 not found" };
		}

		// Verify coreName extraction
		if (e1S1Avarar.coreName !== "E1") {
			return {
				error: `Expected coreName "E1", got "${e1S1Avarar.coreName}"`,
			};
		}
		if (e2S1Avarar.coreName !== "E2") {
			return {
				error: `Expected coreName "E2", got "${e2S1Avarar.coreName}"`,
			};
		}
		if (file000.coreName !== "000") {
			return {
				error: `Expected coreName "000", got "${file000.coreName}"`,
			};
		}

		// Verify coreNameChainToParent
		if (
			JSON.stringify(e1S1Avarar.coreNameChainToParent) !==
			JSON.stringify(["Avarar", "S1"])
		) {
			return {
				error: `Expected coreNameChainToParent ["Avarar", "S1"], got ${JSON.stringify(e1S1Avarar.coreNameChainToParent)}`,
			};
		}
		if (
			JSON.stringify(file000.coreNameChainToParent) !==
			JSON.stringify(["Avarar", "S2", "E1"])
		) {
			return {
				error: `Expected coreNameChainToParent ["Avarar", "S2", "E1"], got ${JSON.stringify(file000.coreNameChainToParent)}`,
			};
		}

		return {
			filesFound: 5,
			sectionsFound: 4,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.sectionsFound).toBe(4);
	expect(result.filesFound).toBe(5);
};
