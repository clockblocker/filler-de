import { describe, expect, it } from "bun:test";
import { createFolderActionsForPathParts } from "../../../../src/commanders/librarian/utils/folder-actions";
import {
	type VaultAction,
	VaultActionType,
} from "../../../../src/services/obsidian-services/file-services/background/background-vault-actions";

const toNames = (actions: VaultAction[]): string[] =>
	actions.map((a) => a.payload.prettyPath.basename);

describe("createFolderActionsForPathParts", () => {
	it("creates actions for missing segments after root", () => {
		const seen = new Set<string>(["Library"]);
		const actions = createFolderActionsForPathParts(
			["Library", "A", "B"],
			seen,
		);

		expect(actions.map((a) => a.type)).toEqual([
			VaultActionType.UpdateOrCreateFolder,
			VaultActionType.UpdateOrCreateFolder,
		]);
		expect(toNames(actions)).toEqual(["A", "B"]);
	});

	it("returns empty when all segments seen", () => {
		const seen = new Set<string>(["Library", "Library/A", "Library/A/B"]);
		const actions = createFolderActionsForPathParts(
			["Library", "A", "B"],
			seen,
		);
		expect(actions).toHaveLength(0);
	});

	it("handles shallow paths (no actions when length <=1)", () => {
		expect(
			createFolderActionsForPathParts(["Library"], new Set()).length,
		).toBe(0);
		expect(
			createFolderActionsForPathParts([], new Set()).length,
		).toBe(0);
	});
});
