import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { MaterializedEventType } from "../../../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/types";
import { inferRenameIntent } from "../../../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/infer-intent";
import { RenameIntent } from "../../../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/types";
import { SplitPathType } from "../../../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../../../../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy({
		showScrollsInCodexesForDepth: 0,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("inferRenameIntent", () => {
	describe("basename unchanged => Move", () => {
		it("path-based move (drag)", () => {
			const result = inferRenameIntent({
				from: {
					basename: "Note-A",
					extension: "md",
					pathParts: ["Library", "A"],
					type: SplitPathType.MdFile,
				},
				kind: MaterializedEventType.Rename,
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
				from: {
					basename: "Note-Test",
					extension: "md",
					pathParts: ["Library", "Test"],
					type: SplitPathType.MdFile,
				},
				kind: MaterializedEventType.Rename,
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
				from: {
					basename: "Note-child-parent-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child"],
					type: SplitPathType.MdFile,
				},
				kind: MaterializedEventType.Rename,
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
				from: {
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				kind: MaterializedEventType.Rename,
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
				from: {
					basename: "Note-child1-parent-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child1"],
					type: SplitPathType.MdFile,
				},
				kind: MaterializedEventType.Rename,
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
				from: {
					basename: "Note-child1-parent-Test",
					extension: "md",
					pathParts: ["Library", "Test", "parent", "child1"],
					type: SplitPathType.MdFile,
				},
				kind: MaterializedEventType.Rename,
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
				from: {
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				kind: MaterializedEventType.Rename,
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

