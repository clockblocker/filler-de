import { beforeEach, describe, expect, it } from "bun:test";
import { Result } from "effect";
import type { SuffixCodecs } from "../../../src/codecs/internal/suffix";
import { makeSuffixCodecs } from "../../../src/codecs/internal/suffix";
import type { CodecRules } from "../../../src/codecs/rules";
import type { NodeName } from "../../../src/types/schemas/node-name";
import { defaultSettingsForUnitTests } from "../common-utils/consts";

// Default rules with "-" delimiter, no padding
function makeDefaultRules(): CodecRules {
	return {
		languages: defaultSettingsForUnitTests.languages,
		libraryRootName: "Library",
		libraryRootPathParts: [],
		maxSectionDepth: defaultSettingsForUnitTests.maxSectionDepth,
		metadataFormat: () => "Hidden",
		showScrollBacklinks: defaultSettingsForUnitTests.showScrollBacklinks,
		showScrollsInCodexesForDepth:
			defaultSettingsForUnitTests.showScrollsInCodexesForDepth,
		suffixDelimiter: defaultSettingsForUnitTests.suffixDelimiter,
		suffixDelimiterConfig:
			defaultSettingsForUnitTests.suffixDelimiterConfig,
		suffixDelimiterPattern:
			defaultSettingsForUnitTests.suffixDelimiterPattern,
	};
}

describe("suffix codecs", () => {
	let codecs: SuffixCodecs;
	let rules: CodecRules;

	beforeEach(() => {
		rules = makeDefaultRules();
		codecs = makeSuffixCodecs(rules);
	});

	describe("parseSeparatedSuffix", () => {
		it("parses basename with no suffix parts", () => {
			const result = codecs.parseSeparatedSuffix("NoteName");
			expect(Result.isSuccess(result)).toBe(true);
			expect(Result.getOrThrow(result)).toEqual({
				coreName: "NoteName",
				suffixParts: [],
			});
		});

		it("parses basename with one suffix part", () => {
			const result = codecs.parseSeparatedSuffix("NoteName-parent");
			expect(Result.isSuccess(result)).toBe(true);
			expect(Result.getOrThrow(result)).toEqual({
				coreName: "NoteName",
				suffixParts: ["parent"],
			});
		});

		it("parses basename with multiple suffix parts", () => {
			const result = codecs.parseSeparatedSuffix("NoteName-child-parent");
			expect(Result.isSuccess(result)).toBe(true);
			expect(Result.getOrThrow(result)).toEqual({
				coreName: "NoteName",
				suffixParts: ["child", "parent"],
			});
		});

		it("handles flexible spacing around delimiter", () => {
			const result = codecs.parseSeparatedSuffix(
				"NoteName - child - parent",
			);
			expect(Result.isSuccess(result)).toBe(true);
			expect(Result.getOrThrow(result)).toEqual({
				coreName: "NoteName",
				suffixParts: ["child", "parent"],
			});
		});

		it("returns error for empty string", () => {
			const result = codecs.parseSeparatedSuffix("");
			expect(Result.isFailure(result)).toBe(true);
		});
	});

	describe("serializeSeparatedSuffix", () => {
		it("serializes with no suffix parts", () => {
			const result = codecs.serializeSeparatedSuffix({
				coreName: "NoteName" as NodeName,
				suffixParts: [],
			});
			expect(result).toBe("NoteName");
		});

		it("serializes with one suffix part", () => {
			const result = codecs.serializeSeparatedSuffix({
				coreName: "NoteName" as NodeName,
				suffixParts: ["parent" as NodeName],
			});
			expect(result).toBe("NoteName-parent");
		});

		it("serializes with multiple suffix parts", () => {
			const result = codecs.serializeSeparatedSuffix({
				coreName: "NoteName" as NodeName,
				suffixParts: ["child" as NodeName, "parent" as NodeName],
			});
			expect(result).toBe("NoteName-child-parent");
		});
	});

	describe("serializeSeparatedSuffixUnchecked", () => {
		it("validates and serializes valid inputs", () => {
			const result = codecs.serializeSeparatedSuffixUnchecked({
				coreName: "NoteName",
				suffixParts: ["parent"],
			});
			expect(Result.isSuccess(result)).toBe(true);
			expect(Result.getOrThrow(result)).toBe("NoteName-parent");
		});

		it("returns error for empty coreName", () => {
			const result = codecs.serializeSeparatedSuffixUnchecked({
				coreName: "",
				suffixParts: [],
			});
			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result)) {
				expect(result.failure.kind).toBe("SuffixError");
			}
		});

		it("returns error for empty suffix part", () => {
			const result = codecs.serializeSeparatedSuffixUnchecked({
				coreName: "NoteName",
				suffixParts: [""],
			});
			expect(Result.isFailure(result)).toBe(true);
		});
	});

	describe("splitBySuffixDelimiter", () => {
		it("splits single part", () => {
			const result = codecs.splitBySuffixDelimiter("NoteName");
			expect(Result.isSuccess(result)).toBe(true);
			expect(Result.getOrThrow(result)).toEqual(["NoteName"]);
		});

		it("splits multiple parts", () => {
			const result = codecs.splitBySuffixDelimiter(
				"NoteName-child-parent",
			);
			expect(Result.isSuccess(result)).toBe(true);
			expect(Result.getOrThrow(result)).toEqual([
				"NoteName",
				"child",
				"parent",
			]);
		});

		it("returns error for empty string", () => {
			const result = codecs.splitBySuffixDelimiter("");
			expect(Result.isFailure(result)).toBe(true);
		});
	});

	describe("pathPartsToSuffixParts / suffixPartsToPathParts", () => {
		it("reverses path parts to suffix parts", () => {
			const result = codecs.pathPartsToSuffixParts(["grandpa", "father"]);
			expect(result).toEqual(["father", "grandpa"]);
		});

		it("handles empty array", () => {
			const result = codecs.pathPartsToSuffixParts([]);
			expect(result).toEqual([]);
		});

		it("handles single element", () => {
			const result = codecs.pathPartsToSuffixParts(["only"]);
			expect(result).toEqual(["only"]);
		});

		it("reverses suffix parts to path parts", () => {
			const result = codecs.suffixPartsToPathParts([
				"father" as NodeName,
				"grandpa" as NodeName,
			]);
			expect(result).toEqual(["grandpa", "father"]);
		});

		it("roundtrip: pathParts -> suffixParts -> pathParts", () => {
			const original = ["a", "b", "c"];
			const suffixParts = codecs.pathPartsToSuffixParts(original);
			const roundtripped = codecs.suffixPartsToPathParts(suffixParts);
			expect(roundtripped).toEqual(original);
		});
	});

	describe("pathPartsWithRootToSuffixParts", () => {
		it("drops Library root and reverses", () => {
			const result = codecs.pathPartsWithRootToSuffixParts([
				"Library",
				"grandpa",
				"father",
			]);
			expect(result).toEqual(["father", "grandpa"]);
		});

		it("returns empty for Library root only", () => {
			const result = codecs.pathPartsWithRootToSuffixParts(["Library"]);
			expect(result).toEqual([]);
		});
	});

	describe("parse/serialize roundtrip", () => {
		it("roundtrips basename with suffix", () => {
			const original = "NoteName-child-parent";
			const parsed = codecs.parseSeparatedSuffix(original);
			expect(Result.isSuccess(parsed)).toBe(true);
			const serialized = codecs.serializeSeparatedSuffix(
				Result.getOrThrow(parsed),
			);
			expect(serialized).toBe(original);
		});

		it("roundtrips basename without suffix", () => {
			const original = "NoteName";
			const parsed = codecs.parseSeparatedSuffix(original);
			expect(Result.isSuccess(parsed)).toBe(true);
			const serialized = codecs.serializeSeparatedSuffix(
				Result.getOrThrow(parsed),
			);
			expect(serialized).toBe(original);
		});
	});

	describe("with padded delimiter config", () => {
		let paddedCodecs: SuffixCodecs;

		beforeEach(() => {
			const paddedConfig = { padded: true, symbol: "-" };
			const paddedRules: CodecRules = {
				...rules,
				suffixDelimiter: " - ",
				suffixDelimiterConfig: paddedConfig,
				suffixDelimiterPattern: /\s*-\s*/,
			};
			paddedCodecs = makeSuffixCodecs(paddedRules);
		});

		it("serializes with padded delimiter", () => {
			const result = paddedCodecs.serializeSeparatedSuffix({
				coreName: "NoteName" as NodeName,
				suffixParts: ["child" as NodeName, "parent" as NodeName],
			});
			expect(result).toBe("NoteName - child - parent");
		});

		it("parses with padded delimiter", () => {
			const result = paddedCodecs.parseSeparatedSuffix(
				"NoteName - child - parent",
			);
			expect(Result.isSuccess(result)).toBe(true);
			expect(Result.getOrThrow(result)).toEqual({
				coreName: "NoteName",
				suffixParts: ["child", "parent"],
			});
		});
	});
});
