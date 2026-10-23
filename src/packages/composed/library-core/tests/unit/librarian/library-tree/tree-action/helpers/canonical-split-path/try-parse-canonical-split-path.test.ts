import { describe, expect, it } from "bun:test";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "@textfresser/vault-action-manager";
import { MD, SplitPathKind } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import {
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../../../src/codecs";
import {
	makeRegularSplitPathInsideLibrary,
	tryParseCanonicalSplitPathInsideLibrary,
} from "../../../../../../../src/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec";
import { defaultSettingsForUnitTests } from "../../../../../common-utils/consts";

const codecs: Codecs = makeCodecs(
	makeCodecRulesFromSettings({
		...defaultSettingsForUnitTests,

		showScrollsInCodexesForDepth: 0,
	}),
);

describe("tryParseCanonicalSplitPath", () => {
	describe("SplitPathKind.Folder", () => {
		it("parses valid folder with no path parts", () => {
			const sp: SplitPathToFolder = {
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isSuccess(result)).toBe(true);
			if (Result.isSuccess(result)) {
				expect(result.success.separatedSuffixedBasename.coreName).toBe(
					"Library",
				);
				expect(
					result.success.separatedSuffixedBasename.suffixParts,
				).toEqual([]);
				expect(result.success.pathParts).toEqual([]);
				expect(result.success.kind).toBe(SplitPathKind.Folder);
			}
		});

		it("parses valid folder with path parts", () => {
			const sp: SplitPathToFolder = {
				basename: "MyFolder",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isSuccess(result)).toBe(true);
			if (Result.isSuccess(result)) {
				expect(result.success.separatedSuffixedBasename.coreName).toBe(
					"MyFolder",
				);
				expect(
					result.success.separatedSuffixedBasename.suffixParts,
				).toEqual([]);
				expect(result.success.pathParts).toEqual([
					"Library",
					"Section1",
					"Section2",
				]);
				expect(result.success.kind).toBe(SplitPathKind.Folder);
			}
		});

		it("returns error for invalid folder basename (contains delimiter)", () => {
			const sp: SplitPathToFolder = {
				basename: "My-Folder",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isFailure(result)).toBe(true);
		});

		it("returns error for empty folder basename", () => {
			const sp: SplitPathToFolder = {
				basename: "",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isFailure(result)).toBe(true);
		});

		it("returns error for invalid path part (contains delimiter)", () => {
			const sp: SplitPathToFolder = {
				basename: "MyFolder",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "Section1", "Section-2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isFailure(result)).toBe(true);
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

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isSuccess(result)).toBe(true);
			if (
				Result.isSuccess(result) &&
				result.success.kind === SplitPathKind.File
			) {
				expect(result.success.separatedSuffixedBasename.coreName).toBe(
					"MyFile",
				);
				expect(
					result.success.separatedSuffixedBasename.suffixParts,
				).toEqual([]);
				expect(result.success.pathParts).toEqual(["Library"]);
				expect(result.success.kind).toBe(SplitPathKind.File);
				expect(result.success.extension).toBe("txt");
			}
		});

		it("parses valid file with matching suffix and path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section2-Section1",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isSuccess(result)).toBe(true);
			if (Result.isSuccess(result)) {
				expect(result.success.separatedSuffixedBasename.coreName).toBe(
					"MyFile",
				);
				expect(
					result.success.separatedSuffixedBasename.suffixParts,
				).toEqual(["Section2", "Section1"]);
				expect(result.success.pathParts).toEqual([
					"Library",
					"Section1",
					"Section2",
				]);
				expect(result.success.kind).toBe(SplitPathKind.File);
			}
		});

		it("returns error when suffix does not match reversed path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section1-Section2",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result)) {
				expect(result.failure).toContain(
					"Basename does not match canonical format",
				);
			}
		});

		it("returns error when suffix length does not match path parts", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section1",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isFailure(result)).toBe(true);
		});

		it("returns error for invalid node name in basename", () => {
			const sp: SplitPathToFile = {
				basename: "My-File",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isFailure(result)).toBe(true);
		});

		it("returns error for invalid suffix part", () => {
			const sp: SplitPathToFile = {
				basename: "MyFile-Section-1",
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Section-1"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isFailure(result)).toBe(true);
		});
	});

	describe("SplitPathKind.MdFile", () => {
		it("parses valid md file with no suffix and no path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isSuccess(result)).toBe(true);
			if (
				Result.isSuccess(result) &&
				result.success.kind === SplitPathKind.MdFile
			) {
				expect(result.success.separatedSuffixedBasename.coreName).toBe(
					"MyNote",
				);
				expect(
					result.success.separatedSuffixedBasename.suffixParts,
				).toEqual([]);
				expect(result.success.pathParts).toEqual(["Library"]);
				expect(result.success.kind).toBe(SplitPathKind.MdFile);
				expect(result.success.extension).toBe("md");
			}
		});

		it("parses valid md file with matching suffix and path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote-Section2-Section1",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isSuccess(result)).toBe(true);
			if (Result.isSuccess(result)) {
				expect(result.success.separatedSuffixedBasename.coreName).toBe(
					"MyNote",
				);
				expect(
					result.success.separatedSuffixedBasename.suffixParts,
				).toEqual(["Section2", "Section1"]);
				expect(result.success.pathParts).toEqual([
					"Library",
					"Section1",
					"Section2",
				]);
				expect(result.success.kind).toBe(SplitPathKind.MdFile);
			}
		});

		it("returns error when suffix does not match reversed path parts", () => {
			const sp: SplitPathToMdFile = {
				basename: "MyNote-Section1-Section2",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(sp, codecs);

			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result)) {
				expect(result.failure).toContain(
					"Basename does not match canonical format",
				);
			}
		});

		it("handles custom suffix delimiter", () => {
			const customDelimiterConfig = {
				padded: false,
				symbol: "_",
			};
			const customCodecs = makeCodecs(
				makeCodecRulesFromSettings({
					...defaultSettingsForUnitTests,
					suffixDelimiter: "_",
					suffixDelimiterConfig: customDelimiterConfig,
					suffixDelimiterPattern: /\s*_\s*/,
				}),
			);

			const sp: SplitPathToMdFile = {
				basename: "MyNote_Section2_Section1",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const result = tryParseCanonicalSplitPathInsideLibrary(
				sp,
				customCodecs,
			);

			expect(Result.isSuccess(result)).toBe(true);
			if (Result.isSuccess(result)) {
				expect(result.success.separatedSuffixedBasename.coreName).toBe(
					"MyNote",
				);
				expect(
					result.success.separatedSuffixedBasename.suffixParts,
				).toEqual(["Section2", "Section1"]);
				expect(result.success.pathParts).toEqual([
					"Library",
					"Section1",
					"Section2",
				]);
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

			const canonical1Res = tryParseCanonicalSplitPathInsideLibrary(
				regular,
				codecs,
			);
			expect(Result.isSuccess(canonical1Res)).toBe(true);
			if (!Result.isSuccess(canonical1Res)) return;
			const canonical1 = canonical1Res.success;

			const regular2 = makeRegularSplitPathInsideLibrary(
				canonical1,
				codecs,
			);
			const canonical2Res = tryParseCanonicalSplitPathInsideLibrary(
				regular2,
				codecs,
			);
			expect(Result.isSuccess(canonical2Res)).toBe(true);
			if (!Result.isSuccess(canonical2Res)) return;
			const canonical2 = canonical2Res.success;

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

			const canonical1Res = tryParseCanonicalSplitPathInsideLibrary(
				regular,
				codecs,
			);
			expect(Result.isSuccess(canonical1Res)).toBe(true);
			if (!Result.isSuccess(canonical1Res)) return;
			const canonical1 = canonical1Res.success;

			const regular2 = makeRegularSplitPathInsideLibrary(
				canonical1,
				codecs,
			);
			const canonical2Res = tryParseCanonicalSplitPathInsideLibrary(
				regular2,
				codecs,
			);
			expect(Result.isSuccess(canonical2Res)).toBe(true);
			if (!Result.isSuccess(canonical2Res)) return;
			const canonical2 = canonical2Res.success;

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
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1", "Section2"],
			};

			const canonical1Res = tryParseCanonicalSplitPathInsideLibrary(
				regular,
				codecs,
			);
			expect(Result.isSuccess(canonical1Res)).toBe(true);
			if (!Result.isSuccess(canonical1Res)) return;
			const canonical1 = canonical1Res.success;

			const regular2 = makeRegularSplitPathInsideLibrary(
				canonical1,
				codecs,
			);
			const canonical2Res = tryParseCanonicalSplitPathInsideLibrary(
				regular2,
				codecs,
			);
			expect(Result.isSuccess(canonical2Res)).toBe(true);
			if (!Result.isSuccess(canonical2Res)) return;
			const canonical2 = canonical2Res.success;

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
