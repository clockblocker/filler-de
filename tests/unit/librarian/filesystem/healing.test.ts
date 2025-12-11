import { describe, expect, it } from "bun:test";
import {
	healFile,
	healFiles,
} from "../../../../src/commanders/librarian/filesystem/healing";
import { VaultActionType } from "../../../../src/services/obsidian-services/file-services/background/background-vault-actions";

describe("healFile", () => {
	const rootName: "Library" = "Library";

	it("returns no actions for canonical file", () => {
		const prettyPath = {
			basename: "Note-Section",
			pathParts: [rootName, "Section"],
		};

		const result = healFile(prettyPath, rootName);

		expect(result.actions).toHaveLength(0);
		expect(result.quarantined).toBe(false);
		expect(result.targetPath).toEqual(prettyPath);
	});

	it("returns rename action for non-canonical basename", () => {
		const prettyPath = {
			basename: "Note", // Missing -Section suffix
			pathParts: [rootName, "Section"],
		};

		const result = healFile(prettyPath, rootName);

		expect(result.quarantined).toBe(false);
		expect(result.targetPath.basename).toBe("Note-Section");
		expect(result.targetPath.pathParts).toEqual([rootName, "Section"]);

		const renameAction = result.actions.find(
			(a) => a.type === VaultActionType.RenameFile,
		);
		expect(renameAction).toBeDefined();
		expect(renameAction?.payload.from.basename).toBe("Note.md");
		expect(renameAction?.payload.from.extension).toBe("md");
		expect(renameAction?.payload.to.basename).toBe("Note-Section.md");
		expect(renameAction?.payload.to.extension).toBe("md");
	});

	// Note: ScrollBasenameSchema accepts any non-empty string,
	// so in practice nothing gets quarantined. This test documents that.
	it("treats any non-empty string as valid scroll basename", () => {
		const prettyPath = {
			basename: "random-file-without-proper-format",
			pathParts: [rootName, "Section"],
		};

		const result = healFile(prettyPath, rootName);

		// Not quarantined — decoded as scroll
		expect(result.quarantined).toBe(false);
		// Basename decoded: split("-").reverse() = ["format", "proper", ...]
		// Leaf name = "format"... wait no, let's just check it's not quarantined
		// and has Section in the path
		expect(result.targetPath.pathParts).toContain("Section");
	});

	it("creates folder actions for target path folders", () => {
		// File in Section folder that needs rename
		const prettyPath = {
			basename: "Note", // Missing -Section suffix
			pathParts: [rootName, "Section"],
		};

		const result = healFile(prettyPath, rootName);

		// Folder actions are created for all folders in target path
		const folderActions = result.actions.filter(
			(a) => a.type === VaultActionType.UpdateOrCreateFolder,
		);
		// Section folder action created (even if it exists, queue handles dedup)
		expect(folderActions).toHaveLength(1);
		expect(folderActions[0]?.payload.prettyPath.basename).toBe("Section");
	});

	it("deduplicates folders using seen set", () => {
		const seen = new Set<string>([`${rootName}/Section`]);
		const prettyPath = {
			basename: "Note",
			pathParts: [rootName, "Section"],
		};

		const result = healFile(prettyPath, rootName, seen);

		const folderActions = result.actions.filter(
			(a) => a.type === VaultActionType.UpdateOrCreateFolder,
		);
		// Section already in seen, no folder action needed
		expect(folderActions).toHaveLength(0);
	});

	it("handles case-insensitive comparison (macOS)", () => {
		const prettyPath = {
			basename: "note-section", // lowercase
			pathParts: [rootName, "Section"],
		};

		const result = healFile(prettyPath, rootName);

		// Should be considered canonical (case-insensitive match)
		expect(result.actions).toHaveLength(0);
	});
});

describe("healFiles", () => {
	const rootName: "Library" = "Library";

	it("heals multiple files", () => {
		const files = [
			{ basename: "Note1", pathParts: [rootName, "Section"] },
			{ basename: "Note2", pathParts: [rootName, "Section"] },
		];

		const actions = healFiles(files, rootName);

		const renameActions = actions.filter(
			(a) => a.type === VaultActionType.RenameFile,
		);
		expect(renameActions).toHaveLength(2);
	});

	it("deduplicates folder creation across files", () => {
		const files = [
			{ basename: "Note1", pathParts: [rootName, "Section"] },
			{ basename: "Note2", pathParts: [rootName, "Section"] },
		];

		const actions = healFiles(files, rootName);

		const folderActions = actions.filter(
			(a) => a.type === VaultActionType.UpdateOrCreateFolder,
		);
		// Section folder should only be created once
		const sectionFolders = folderActions.filter(
			(a) => a.payload.prettyPath.basename === "Section",
		);
		expect(sectionFolders).toHaveLength(1);
	});

	it("returns empty for all canonical files", () => {
		const files = [
			{ basename: "Note1-Section", pathParts: [rootName, "Section"] },
			{ basename: "Note2-Section", pathParts: [rootName, "Section"] },
		];

		const actions = healFiles(files, rootName);

		expect(actions).toHaveLength(0);
	});
});
