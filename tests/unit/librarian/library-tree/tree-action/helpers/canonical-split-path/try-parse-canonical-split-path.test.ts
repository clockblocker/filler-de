import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeRegularSplitPathInsideLibrary,
	tryParseCanonicalSplitPathInsideLibrary,
} from "../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy({
		showScrollsInCodexesForDepth: 0,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("tryParseCanonicalSplitPath", () => {
	describe("SplitPathKind.Folder", () => {
		it("parses valid folder with no path parts", () => {
			const sp: SplitPathToFolder = {
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("Library");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([]);
				expect(result.value.pathParts).toEqual([]);
				expect(result.value.kind).toBe(SplitPathKind.Folder);
			}
		});

		it("parses valid folder with path parts", () => {
			const sp: SplitPathToFolder = {
				basename: "MyFolder",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("MyFolder");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([]);
				expect(result.value.pathParts).toEqual(["Library", "Section1", "Section2"]);
				expect(result.value.kind).toBe(SplitPathKind.Folder);
			}
		});

		it("returns error for invalid folder basename (contains delimiter)", () => {
			const sp: SplitPathToFolder = {
				basename: "My-Folder",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isErr()).toBe(true);
		});

		it("returns error for empty folder basename", () => {
			const sp: SplitPathToFolder = {
				basename: "",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isErr()).toBe(true);
		});

		it("returns error for invalid path part (contains delimiter)", () => {
			const sp: SplitPathToFolder = {
				basename: "MyFolder",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "Section1", "Section-2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isErr()).toBe(true);
		});
	});

	describe("SplitPathKind.File", () => {
		it("parses valid file with no suffix and no path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk() && result.value.kind === SplitPathKind.File) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("MyFile");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([]);
				expect(result.value.pathParts).toEqual(["Library"]);
				expect(result.value.kind).toBe(SplitPathKind.File);
				expect(result.value.extension).toBe("txt");
			}
		});

		it("parses valid file with matching suffix and path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section2-Section1",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("MyFile");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["Section2", "Section1"]);
				expect(result.value.pathParts).toEqual(["Library", "Section1", "Section2"]);
				expect(result.value.kind).toBe(SplitPathKind.File);
			}
		});

		it("returns error when suffix does not match reversed path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section1-Section2",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toContain("Basename does not match canonical format");
			}
		});

		it("returns error when suffix length does not match path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section1",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isErr()).toBe(true);
		});

		it("returns error for invalid node name in basename", () => {
			const sp: SplitPathToFile = {
				basename: "My-File",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isErr()).toBe(true);
		});

		it("returns error for invalid suffix part", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section-1",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section-1"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isErr()).toBe(true);
		});
	});

	describe("SplitPathKind.MdFile", () => {
		it("parses valid md file with no suffix and no path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk() && result.value.kind === SplitPathKind.MdFile) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("MyNote");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual([]);
				expect(result.value.pathParts).toEqual(["Library"]);
				expect(result.value.kind).toBe(SplitPathKind.MdFile);
				expect(result.value.extension).toBe("md");
			}
		});

		it("parses valid md file with matching suffix and path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote-Section2-Section1",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("MyNote");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["Section2", "Section1"]);
				expect(result.value.pathParts).toEqual(["Library", "Section1", "Section2"]);
				expect(result.value.kind).toBe(SplitPathKind.MdFile);
			}
		});

		it("returns error when suffix does not match reversed path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote-Section1-Section2",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isErr()).toBe(true);
		});

		it("handles custom suffix delimiter", () => {
			const customDelimiterConfig = {
				padded: false,
				symbol: "_",
			};
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettingsForUnitTests,
				suffixDelimiter: "_",
				suffixDelimiterConfig: customDelimiterConfig,
				suffixDelimiterPattern: /\s*_\s*/,
			});

			const sp: SplitPathToMdFile = {
				basename: "MyNote_Section2_Section1",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.separatedSuffixedBasename.coreName).toBe("MyNote");
				expect(result.value.separatedSuffixedBasename.suffixParts).toEqual(["Section2", "Section1"]);
				expect(result.value.pathParts).toEqual(["Library", "Section1", "Section2"]);
			}
		});
	});

	describe("roundtrip", () => {
		it("roundtrip for folder: canonical -> regular -> canonical", () => {
			const regular: SplitPathToFolder = {
				basename: "MyFolder",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const canonical1Res = tryParseCanonicalSplitPathInsideLibrary(regular);
			expect(canonical1Res.isOk()).toBe(true);
			if (!canonical1Res.isOk()) return;
			const canonical1 = canonical1Res.value;

			const regular2 = makeRegularSplitPathInsideLibrary(canonical1);
			const canonical2Res = tryParseCanonicalSplitPathInsideLibrary(regular2);
			expect(canonical2Res.isOk()).toBe(true);
			if (!canonical2Res.isOk()) return;
			const canonical2 = canonical2Res.value;

			expect(canonical2.pathParts).toEqual(canonical1.pathParts);
			expect(canonical2.separatedSuffixedBasename).toEqual(
				canonical1.separatedSuffixedBasename,
			);
			expect(canonical2.kind).toBe(canonical1.kind);
		});

		it("roundtrip for file: canonical -> regular -> canonical", () => {
			const regular: SplitPathToFile = {
				basename: "MyFile-Section2-Section1",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const canonical1Res = tryParseCanonicalSplitPathInsideLibrary(regular);
			expect(canonical1Res.isOk()).toBe(true);
			if (!canonical1Res.isOk()) return;
			const canonical1 = canonical1Res.value;

			const regular2 = makeRegularSplitPathInsideLibrary(canonical1);
			const canonical2Res = tryParseCanonicalSplitPathInsideLibrary(regular2);
			expect(canonical2Res.isOk()).toBe(true);
			if (!canonical2Res.isOk()) return;
			const canonical2 = canonical2Res.value;

			expect(canonical2.pathParts).toEqual(canonical1.pathParts);
			expect(canonical2.separatedSuffixedBasename).toEqual(
				canonical1.separatedSuffixedBasename,
			);
			expect(canonical2.kind).toBe(canonical1.kind);
			if (canonical2.kind === SplitPathKind.File) {
				expect(canonical2.extension).toBe(canonical1.extension);
			}
		});

		it("roundtrip for md file: canonical -> regular -> canonical", () => {
			const regular: SplitPathToMdFile = {
				basename: "MyNote-Section2-Section1",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const canonical1Res = tryParseCanonicalSplitPathInsideLibrary(regular);
			expect(canonical1Res.isOk()).toBe(true);
			if (!canonical1Res.isOk()) return;
			const canonical1 = canonical1Res.value;

			const regular2 = makeRegularSplitPathInsideLibrary(canonical1);
			const canonical2Res = tryParseCanonicalSplitPathInsideLibrary(regular2);
			expect(canonical2Res.isOk()).toBe(true);
			if (!canonical2Res.isOk()) return;
			const canonical2 = canonical2Res.value;

			expect(canonical2.pathParts).toEqual(canonical1.pathParts);
			expect(canonical2.separatedSuffixedBasename).toEqual(
				canonical1.separatedSuffixedBasename,
			);
			expect(canonical2.kind).toBe(canonical1.kind);
			if (canonical2.kind === SplitPathKind.MdFile) {
				expect(canonical2.extension).toBe(canonical1.extension);
			}
		});
	});
});

