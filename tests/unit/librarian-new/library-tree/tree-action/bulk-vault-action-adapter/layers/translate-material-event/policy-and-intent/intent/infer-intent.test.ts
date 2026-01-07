import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { inferRenameIntent } from "../../../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/infer-intent";
import { RenameIntent } from "../../../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/types";
import { MaterializedEventType } from "../../../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/types";
import * as globalState from "../../../../../../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../../../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../../../../../../../src/obsidian-vault-action-manager/types/split-path";

const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	showScrollsInCodexesForDepth: 0,
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathType.Folder,
	},
	suffixDelimiter: "-",
};

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(
		globalState,
		"getParsedUserSettings",
	).mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("inferRenameIntent", () => {
	describe("basename unchanged => Move", () => {
		it("path-based move (drag)", () => {
			const result = inferRenameIntent({
				kind: MaterializedEventType.Rename,
				from: {
					basename: "Note-A",
					extension: "md",
					pathParts: ["Library", "A"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "Note-A",
					extension: "md",
					pathParts: ["Library", "B"],
					type: SplitPathType.MdFile,
				},
			});
			expect(result).toBe(RenameIntent.Move);
		});
	});

	describe("basename changed, suffix matches path => Rename", () => {
		it("coreName change only (suffix matches)", () => {
			const result = inferRenameIntent({
				kind: MaterializedEventType.Rename,
				from: {
					basename: "Note-Test",
					extension: "md",
					pathParts: ["Library", "Test"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "NewNote-Test",
					extension: "md",
					pathParts: ["Library", "Test"],
					type: SplitPathType.MdFile,
				},
			});
			expect(result).toBe(RenameIntent.Rename);
		});

		it("nested path, suffix matches", () => {
			const result = inferRenameIntent({
				kind: MaterializedEventType.Rename,
				from: {
					basename: "Note-child-parent-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "NewNote-child-parent-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child"],
					type: SplitPathType.MdFile,
				},
			});
			expect(result).toBe(RenameIntent.Rename);
		});
	});

	describe("basename changed, no suffix => Rename", () => {
		it("root level file, no suffix", () => {
			const result = inferRenameIntent({
				kind: MaterializedEventType.Rename,
				from: {
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "NewNote",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
			});
			expect(result).toBe(RenameIntent.Rename);
		});
	});

	describe("basename changed, suffix differs from path => Move", () => {
		it("suffix changed (child1 -> child2)", () => {
			const result = inferRenameIntent({
				kind: MaterializedEventType.Rename,
				from: {
					basename: "Note-child1-parent-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child1"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "Note-child2-parent-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child1"],
					type: SplitPathType.MdFile,
				},
			});
			expect(result).toBe(RenameIntent.Move);
		});

		it("suffix shortened (child1-parent-Test -> Test)", () => {
			const result = inferRenameIntent({
				kind: MaterializedEventType.Rename,
				from: {
					basename: "Note-child1-parent-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child1"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "Note-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child1"],
					type: SplitPathType.MdFile,
				},
			});
			expect(result).toBe(RenameIntent.Move);
		});

		it("new suffix added at root", () => {
			const result = inferRenameIntent({
				kind: MaterializedEventType.Rename,
				from: {
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "Note-NewSection",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
			});
			expect(result).toBe(RenameIntent.Move);
		});
	});
});

