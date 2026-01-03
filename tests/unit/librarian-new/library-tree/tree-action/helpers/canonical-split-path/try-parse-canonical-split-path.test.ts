import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { tryParseCanonicalSplitPath } from "../../../../../../../src/commanders/librarian-new/library-tree/tree-action/utils/canonical-split-path-utils/try-parse-canonical-split-path";
import * as globalState from "../../../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../../../src/global-state/parsed-settings";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../../../src/obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../../../../../src/obsidian-vault-action-manager/types/split-path";

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

describe("tryParseCanonicalSplitPath", () => {
	describe("SplitPathType.Folder", () => {
		it("parses valid folder with no path parts", () => {
			const sp: SplitPathToFolder = {
				basename: "MyFolder",
				pathParts: [],
				type: SplitPathType.Folder,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.nodeName).toBe("MyFolder");
				expect(result.value.sectionNames).toEqual([]);
				expect(result.value.type).toBe(SplitPathType.Folder);
			}
		});

		it("parses valid folder with path parts", () => {
			const sp: SplitPathToFolder = {
				basename: "MyFolder",
				pathParts: ["Section1", "Section2"],
				type: SplitPathType.Folder,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.nodeName).toBe("MyFolder");
				expect(result.value.sectionNames).toEqual(["Section1", "Section2"]);
				expect(result.value.type).toBe(SplitPathType.Folder);
			}
		});

		it("returns error for invalid folder basename (contains delimiter)", () => {
			const sp: SplitPathToFolder = {
				basename: "My-Folder",
				pathParts: [],
				type: SplitPathType.Folder,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isErr()).toBe(true);
		});

		it("returns error for empty folder basename", () => {
			const sp: SplitPathToFolder = {
				basename: "",
				pathParts: [],
				type: SplitPathType.Folder,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isErr()).toBe(true);
		});

		it("returns error for invalid path part (contains delimiter)", () => {
			const sp: SplitPathToFolder = {
				basename: "MyFolder",
				pathParts: ["Section1", "Section-2"],
				type: SplitPathType.Folder,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isErr()).toBe(true);
		});
	});

	describe("SplitPathType.File", () => {
		it("parses valid file with no suffix and no path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile",
				extension: "txt",
				pathParts: [],
				type: SplitPathType.File,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk() && result.value.type === SplitPathType.File) {
				expect(result.value.nodeName).toBe("MyFile");
				expect(result.value.sectionNames).toEqual([]);
				expect(result.value.type).toBe(SplitPathType.File);
				expect(result.value.extension).toBe("txt");
			}
		});

		it("parses valid file with matching suffix and path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section2-Section1",
				extension: "txt",
				pathParts: ["Section1", "Section2"],
				type: SplitPathType.File,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.nodeName).toBe("MyFile");
				expect(result.value.sectionNames).toEqual(["Section1", "Section2"]);
				expect(result.value.type).toBe(SplitPathType.File);
			}
		});

		it("returns error when suffix does not match reversed path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section1-Section2",
				extension: "txt",
				pathParts: ["Section1", "Section2"],
				type: SplitPathType.File,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toContain("suffix does not match");
			}
		});

		it("returns error when suffix length does not match path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section1",
				extension: "txt",
				pathParts: ["Section1", "Section2"],
				type: SplitPathType.File,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isErr()).toBe(true);
		});

		it("returns error for invalid node name in basename", () => {
			const sp: SplitPathToFile = {
				basename: "My-File",
				extension: "txt",
				pathParts: [],
				type: SplitPathType.File,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isErr()).toBe(true);
		});

		it("returns error for invalid suffix part", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section-1",
				extension: "txt",
				pathParts: ["Section-1"],
				type: SplitPathType.File,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isErr()).toBe(true);
		});
	});

	describe("SplitPathType.MdFile", () => {
		it("parses valid md file with no suffix and no path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote",
				extension: "md",
				pathParts: [],
				type: SplitPathType.MdFile,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk() && result.value.type === SplitPathType.MdFile) {
				expect(result.value.nodeName).toBe("MyNote");
				expect(result.value.sectionNames).toEqual([]);
				expect(result.value.type).toBe(SplitPathType.MdFile);
				expect(result.value.extension).toBe("md");
			}
		});

		it("parses valid md file with matching suffix and path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote-Section2-Section1",
				extension: "md",
				pathParts: ["Section1", "Section2"],
				type: SplitPathType.MdFile,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.nodeName).toBe("MyNote");
				expect(result.value.sectionNames).toEqual(["Section1", "Section2"]);
				expect(result.value.type).toBe(SplitPathType.MdFile);
			}
		});

		it("returns error when suffix does not match reversed path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote-Section1-Section2",
				extension: "md",
				pathParts: ["Section1", "Section2"],
				type: SplitPathType.MdFile,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isErr()).toBe(true);
		});

		it("handles custom suffix delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "_",
			});

			const sp: SplitPathToMdFile = {
				basename: "MyNote_Section2_Section1",
				extension: "md",
				pathParts: ["Section1", "Section2"],
				type: SplitPathType.MdFile,
			};

			const result = tryParseCanonicalSplitPath(sp);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.nodeName).toBe("MyNote");
				expect(result.value.sectionNames).toEqual(["Section1", "Section2"]);
			}
		});
	});
});

