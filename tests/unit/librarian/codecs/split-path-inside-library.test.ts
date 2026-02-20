import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { makeSplitPathInsideLibraryCodecs } from "../../../../src/commanders/librarian/codecs/split-path-inside-library/make";
import type { SplitPathInsideLibraryCodecs } from "../../../../src/commanders/librarian/codecs/split-path-inside-library/make";
import { SplitPathKind } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { AnySplitPath } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { SplitPathToFolderInsideLibrary } from "../../../../src/commanders/librarian/codecs/split-path-inside-library";
import type { CodecRules } from "../../../../src/commanders/librarian/codecs/rules";
import { setupGetParsedUserSettingsSpy } from "../../common-utils/setup-spy";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";

function makeDefaultRules(): CodecRules {
	return {
		hideMetadata: defaultSettingsForUnitTests.hideMetadata,
		languages: defaultSettingsForUnitTests.languages,
		libraryRootName: "Library",
		libraryRootPathParts: [],
		showScrollBacklinks: defaultSettingsForUnitTests.showScrollBacklinks,
		suffixDelimiter: defaultSettingsForUnitTests.suffixDelimiter,
		suffixDelimiterConfig: defaultSettingsForUnitTests.suffixDelimiterConfig,
		suffixDelimiterPattern:
			defaultSettingsForUnitTests.suffixDelimiterPattern,
	};
}

describe("split-path-inside-library codecs", () => {
	let spy: ReturnType<typeof setupGetParsedUserSettingsSpy>;
	let codecs: SplitPathInsideLibraryCodecs;

	beforeEach(() => {
		spy = setupGetParsedUserSettingsSpy();
		codecs = makeSplitPathInsideLibraryCodecs(makeDefaultRules());
	});

	afterEach(() => {
		spy.mockRestore();
	});

	describe("checkIfInsideLibrary", () => {
		it("returns true for empty pathParts (library root)", () => {
			const sp: AnySplitPath = {
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};
			expect(codecs.checkIfInsideLibrary(sp)).toBe(true);
		});

		it("returns true for path starting with Library root", () => {
			const sp: AnySplitPath = {
				basename: "NoteName",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent"],
			};
			expect(codecs.checkIfInsideLibrary(sp)).toBe(true);
		});

		it("returns false for path not starting with Library root", () => {
			const sp: AnySplitPath = {
				basename: "SomeFile",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["OtherFolder", "child"],
			};
			expect(codecs.checkIfInsideLibrary(sp)).toBe(false);
		});

		it("returns false for path with single non-Library part", () => {
			const sp: AnySplitPath = {
				basename: "readme",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["docs"],
			};
			expect(codecs.checkIfInsideLibrary(sp)).toBe(false);
		});
	});

	describe("isInsideLibrary (type guard)", () => {
		it("narrows to SplitPathInsideLibraryCandidate for library paths", () => {
			const sp: AnySplitPath = {
				basename: "child",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
			};
			expect(codecs.isInsideLibrary(sp)).toBe(true);
		});

		it("does not narrow for non-library paths", () => {
			const sp: AnySplitPath = {
				basename: "file",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["outside"],
			};
			expect(codecs.isInsideLibrary(sp)).toBe(false);
		});
	});

	describe("toInsideLibrary", () => {
		it("accepts path with empty pathParts (library root)", () => {
			const sp: AnySplitPath = {
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};
			const result = codecs.toInsideLibrary(sp);
			expect(result.isOk()).toBe(true);
		});

		it("accepts path starting with Library root", () => {
			const sp: AnySplitPath = {
				basename: "Note",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent"],
			};
			const result = codecs.toInsideLibrary(sp);
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap().pathParts).toEqual([
				"Library",
				"parent",
			]);
		});

		it("returns error for path outside library", () => {
			const sp: AnySplitPath = {
				basename: "readme",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["docs"],
			};
			const result = codecs.toInsideLibrary(sp);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.kind).toBe("SplitPathError");
				expect((result.error as { reason: string }).reason).toBe(
					"OutsideLibrary",
				);
			}
		});
	});

	describe("fromInsideLibrary", () => {
		it("returns path as-is when pathParts is empty", () => {
			const sp: SplitPathToFolderInsideLibrary = {
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};
			const result = codecs.fromInsideLibrary(sp);
			expect(result.pathParts).toEqual([]);
		});

		it("adds Library root if not present", () => {
			const sp: SplitPathToFolderInsideLibrary = {
				basename: "child",
				kind: SplitPathKind.Folder,
				pathParts: ["parent"],
			};
			const result = codecs.fromInsideLibrary(sp);
			expect(result.pathParts).toEqual(["Library", "parent"]);
		});

		it("preserves pathParts if Library root already present", () => {
			const sp: SplitPathToFolderInsideLibrary = {
				basename: "child",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
			};
			const result = codecs.fromInsideLibrary(sp);
			expect(result.pathParts).toEqual(["Library", "parent"]);
		});
	});

	describe("toInsideLibrary / fromInsideLibrary roundtrip", () => {
		it("roundtrips a MdFile path", () => {
			const original: AnySplitPath = {
				basename: "Note-parent",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent"],
			};
			const inside = codecs.toInsideLibrary(original);
			expect(inside.isOk()).toBe(true);
			const back = codecs.fromInsideLibrary(inside._unsafeUnwrap());
			expect(back.pathParts).toEqual(original.pathParts);
			expect(back.basename).toBe(original.basename);
		});
	});
});
