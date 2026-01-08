import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { RenameIntent } from "../../../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/types";
import { ChangePolicy } from "../../../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/policy/types";
import { tryCanonicalizeSplitPathToDestination } from "../../../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator";
import * as globalState from "../../../../../../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../../../../../../src/global-state/parsed-settings";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathType } from "../../../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";

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
	getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

// Helper: create library-scoped split paths
const spMdFile = (
	pathParts: string[],
	basename: string,
): SplitPathToMdFile => ({
	basename,
	extension: "md",
	pathParts,
	type: SplitPathType.MdFile,
});

const spFolder = (
	pathParts: string[],
	basename: string,
): SplitPathToFolder => ({
	basename,
	pathParts,
	type: SplitPathType.Folder,
});

const spFile = (
	pathParts: string[],
	basename: string,
	extension = "txt",
): SplitPathToFile => ({
	basename,
	extension,
	pathParts,
	type: SplitPathType.File,
});

describe("tryCanonicalizeSplitPathToDestination", () => {
	describe("A) Create-like (intent undefined) — NameKing vs PathKing", () => {
		it("1. NameKing, flat import", () => {
			const sp = spMdFile(["Library"], "Note-Child-Parent");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				undefined,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Note");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["Child", "Parent"]);
				expect(result.value.pathParts).toEqual(["Library", "Parent", "Child"]);
			}
		});

		it("2. NameKing, single suffix", () => {
			const sp = spMdFile(["Library"], "pie-sweet");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				undefined,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("pie");
				// suffixParts=["sweet"] → reversed → ["sweet"]
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["sweet"]);
				expect(result.value.pathParts).toEqual(["Library", "sweet"]);
			}
		});

		it("3. PathKing, nested", () => {
			const sp = spMdFile(["Library", "Parent", "Child"], "Note-Child-Parent");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.PathKing,
				undefined,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Note");
				// PathKing: sectionNames from pathParts (Library included)
				expect(result.value.pathParts).toEqual(["Library", "Parent", "Child"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([
					"Child",
					"Parent",
				]);
			}
		});
	});

	describe("B) Rename intent = Rename (forces PathKing)", () => {
		it("4. Rename-in-place ignores suffix", () => {
			const sp = spMdFile(["Library", "Parent"], "Note-Parent");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing, // doesn't matter, Rename forces PathKing
				RenameIntent.Rename,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Note");
				// Rename forces PathKing: sectionNames from pathParts
				expect(result.value.pathParts).toEqual(["Library", "Parent"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["Parent"]);
			}
		});

		it("5. Rename-in-place root", () => {
			const sp = spMdFile(["Library"], "pies");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Rename,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("pies");
				expect(result.value.pathParts).toEqual(["Library"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([]);
			}
		});
	});

	// Move-by-name tests
	// NameKing Move: suffix reversed = path
	// coreName stays first segment, suffixParts define where to move
	describe("C) Move-by-name (intent Move + policy NameKing + suffixParts.length>0)", () => {
		it("6. Folder move-by-name basic", () => {
			// sweet-pie: coreName="sweet", suffix=["pie"]
			// suffix reversed = path => Library/pie/sweet
			const sp = spFolder(["Library"], "sweet-pie");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Move,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("sweet");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([]);
				expect(result.value.pathParts).toEqual(["Library", "pie"]);
			}
		});

		it("7. File move-by-name basic", () => {
			// sweet-pie: coreName="sweet", suffix=["pie"]
			// suffix reversed = path => Library/pie/sweet-pie.md
			const sp = spMdFile(["Library"], "sweet-pie");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Move,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("sweet");
				expect(result.value.pathParts).toEqual(["Library", "pie"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["pie"]);
			}
		});

		it("8. Move-by-name multi-part", () => {
			// sweet-berry-pie: coreName="sweet", suffix=["berry","pie"]
			// suffix reversed = path => Library/pie/berry/sweet-berry-pie.md
			const sp = spMdFile(["Library"], "sweet-berry-pie");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Move,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("sweet");
				expect(result.value.pathParts).toEqual(["Library", "pie", "berry"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["berry", "pie"]);
			}
		});

		it("9. Folder: sweet-berry-pie => Library/pie/berry/sweet", () => {
			// coreName="sweet", suffix=["berry","pie"]
			// suffix reversed = path => Library/pie/berry
			const sp = spFolder(["Library"], "sweet-berry-pie");
			const r = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Move,
			);
	
			expect(r.isOk()).toBe(true);
			if (r.isOk()) {
				expect(r.value.separatedSuffixedBasename.coreName).toBe("sweet");
				expect(r.value.separatedSuffixedBasename.suffixParts).toEqual([]);
				expect(r.value.pathParts).toEqual(["Library", "pie", "berry"]);
			}
		});

		it("10. Longer: sweet-very-berry-pie => Library/pie/berry/very/sweet", () => {
			// coreName="sweet", suffix=["very","berry","pie"]
			// suffix reversed = path => Library/pie/berry/very
			const sp = spFolder(["Library"], "sweet-very-berry-pie");
			const r = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Move,
			);
	
			expect(r.isOk()).toBe(true);
			if (r.isOk()) {
				expect(r.value.separatedSuffixedBasename.coreName).toBe("sweet");
				expect(r.value.separatedSuffixedBasename.suffixParts).toEqual([]);
				expect(r.value.pathParts).toEqual(["Library", "pie", "berry", "very"]);
			}
		});

		it("11. Move-by-name requires suffix (no suffix = fallback to regular NameKing)", () => {
			const sp = spMdFile(["Library"], "sweet");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Move,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("sweet");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([]);
				expect(result.value.pathParts).toEqual(["Library"]);
			}
		});

		it("12. Canonical suffix edit: Note-child2-parent-Test at Library/Test/parent/child1 => Library/Test/parent/child2", () => {
			// User edits suffix from child1 to child2 while staying in child1 folder
			const sp = spMdFile(
				["Library", "Test", "parent", "child1"],
				"Note-child2-parent-Test",
			);
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Move,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// Suffix is interpreted as reversed path since suffix root "Test" matches pathParts[1]
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Note");
				expect(result.value.pathParts).toEqual(["Library", "Test", "parent", "child2"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([
					"child2",
					"parent",
					"Test",
				]);
			}
		});

		it("13. Canonical suffix edit: Note-Test at Library/Test/parent/child1 => Library/Test (shortened suffix)", () => {
			// User shortens suffix from child1-parent-Test to just Test
			const sp = spMdFile(
				["Library", "Test", "parent", "child1"],
				"Note-Test",
			);
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Move,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// Suffix root "Test" matches pathParts[1], so interpret as reversed
				// suffixParts=["Test"] reversed = ["Test"] → path = Library/Test
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Note");
				expect(result.value.pathParts).toEqual(["Library", "Test"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["Test"]);
			}
		});

		it("13b. Same scenario but with RenameIntent.Rename (should use PathKing)", () => {
			// If intent is Rename, it forces PathKing which ignores suffix
			const sp = spMdFile(
				["Library", "Test", "parent", "child1"],
				"Note-Test",
			);
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Rename, // Forces PathKing
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// PathKing: path stays, suffix is rebuilt from path
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Note");
				expect(result.value.pathParts).toEqual(["Library", "Test", "parent", "child1"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([
					"child1",
					"parent",
					"Test",
				]);
			}
		});
	});

	describe("D) Obsidian duplicate marker handling", () => {
		it("14. PathKing preserves duplicate marker: Note-A 1 at Library/A => Note 1-A", () => {
			const sp = spMdFile(["Library", "A"], "Note-A 1");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.PathKing,
				undefined,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// Duplicate marker " 1" should be attached to coreName
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Note 1");
				expect(result.value.pathParts).toEqual(["Library", "A"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["A"]);
			}
		});

		it("15. PathKing preserves duplicate marker in nested path", () => {
			const sp = spMdFile(
				["Library", "Test", "parent", "child"],
				"Note-child-parent-Test 1",
			);
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.PathKing,
				undefined,
			);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Note 1");
				expect(result.value.pathParts).toEqual(["Library", "Test", "parent", "child"]);
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([
					"child",
					"parent",
					"Test",
				]);
			}
		});
	});

	describe("E) Error cases (validation)", () => {
		it("11. Invalid nodeName in basename (empty)", () => {
			const sp = spMdFile(["Library"], "");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				undefined,
			);

			expect(result.isErr()).toBe(true);
		});

		it("11b. Invalid nodeName in basename (starts with delimiter)", () => {
			const sp = spMdFile(["Library"], "-pie");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				undefined,
			);

			expect(result.isErr()).toBe(true);
		});

		it("12. Invalid section in pathParts (PathKing)", () => {
			const sp = spMdFile(["Library", "bad-name-with-delim"], "pie");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.PathKing,
				undefined,
			);

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				// NodeNameSchema returns "DelimiterInNodeName" for names with delimiter
				expect(result.error).toContain("DelimiterInNodeName");
			}
		});

		it("12b. Invalid section in pathParts (Rename forces PathKing)", () => {
			const sp = spMdFile(["Library", "bad-name-with-delim"], "pie");
			const result = tryCanonicalizeSplitPathToDestination(
				sp,
				ChangePolicy.NameKing,
				RenameIntent.Rename, // forces PathKing
			);

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				// NodeNameSchema returns "DelimiterInNodeName" for names with delimiter
				expect(result.error).toContain("DelimiterInNodeName");
			}
		});
	});
});

