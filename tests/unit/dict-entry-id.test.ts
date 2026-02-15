import { describe, expect, test } from "bun:test";
import {
	buildDictEntryId,
	DictEntryIdSchema,
	dictEntryIdHelper,
	parseDictEntryId,
} from "../../src/linguistics/common/dict-entry-id/dict-entry-id";

describe("DictEntryIdSchema", () => {
	test("accepts valid Lexem IDs", () => {
		expect(DictEntryIdSchema.safeParse("LX-LM-NOUN-1").success).toBe(true);
		expect(DictEntryIdSchema.safeParse("LX-IN-VERB-42").success).toBe(true);
		expect(DictEntryIdSchema.safeParse("LX-VA-ADJ-3").success).toBe(true);
	});

	test("accepts valid Phrasem/Morphem IDs", () => {
		expect(DictEntryIdSchema.safeParse("PH-LM-1").success).toBe(true);
		expect(DictEntryIdSchema.safeParse("MO-LM-5").success).toBe(true);
		expect(DictEntryIdSchema.safeParse("PH-IN-2").success).toBe(true);
		expect(DictEntryIdSchema.safeParse("MO-VA-10").success).toBe(true);
	});

	test("rejects invalid IDs", () => {
		expect(DictEntryIdSchema.safeParse("").success).toBe(false);
		expect(DictEntryIdSchema.safeParse("XX-LM-1").success).toBe(false);
		expect(DictEntryIdSchema.safeParse("LX-LM-BADPOS-1").success).toBe(
			false,
		);
		expect(DictEntryIdSchema.safeParse("LX-LM-NOUN-0").success).toBe(true); // 0 is a valid number
		expect(DictEntryIdSchema.safeParse("LX-LM-NOUN-").success).toBe(false); // missing index
	});

	test("schema is syntactic only — LX-LM-1 passes regex but parse rejects it", () => {
		// Regex allows optional POS group, so LX-LM-1 matches syntactically
		expect(DictEntryIdSchema.safeParse("LX-LM-1").success).toBe(true);
		// But semantic parse rejects Lexem without POS
		expect(parseDictEntryId("LX-LM-1")).toBeUndefined();

		// Similarly, PH-LM-NOUN-1 passes regex (POS group is optional position)
		// but parse rejects Phrasem with POS
		expect(DictEntryIdSchema.safeParse("PH-LM-NOUN-1").success).toBe(true);
		expect(parseDictEntryId("PH-LM-NOUN-1")).toBeUndefined();
	});
});

describe("parseDictEntryId", () => {
	test("parses Lexem IDs", () => {
		const result = parseDictEntryId("LX-LM-NOUN-1");
		expect(result).toEqual({
			index: 1,
			pos: "Noun",
			posTag: "NOUN",
			surfaceKind: "Lemma",
			surfaceKindTag: "LM",
			unitKind: "Lexem",
			unitKindTag: "LX",
		});
	});

	test("parses Lexem with different POS", () => {
		const result = parseDictEntryId("LX-IN-VERB-42");
		expect(result).toEqual({
			index: 42,
			pos: "Verb",
			posTag: "VERB",
			surfaceKind: "Inflected",
			surfaceKindTag: "IN",
			unitKind: "Lexem",
			unitKindTag: "LX",
		});
	});

	test("parses Phrasem IDs", () => {
		const result = parseDictEntryId("PH-LM-1");
		expect(result).toEqual({
			index: 1,
			pos: undefined,
			posTag: undefined,
			surfaceKind: "Lemma",
			surfaceKindTag: "LM",
			unitKind: "Phrasem",
			unitKindTag: "PH",
		});
	});

	test("parses Morphem IDs", () => {
		const result = parseDictEntryId("MO-VA-3");
		expect(result).toEqual({
			index: 3,
			pos: undefined,
			posTag: undefined,
			surfaceKind: "Variant",
			surfaceKindTag: "VA",
			unitKind: "Morphem",
			unitKindTag: "MO",
		});
	});

	test("returns undefined for invalid input", () => {
		expect(parseDictEntryId("garbage")).toBeUndefined();
		expect(parseDictEntryId("")).toBeUndefined();
	});

	test("returns undefined for Lexem without POS", () => {
		// Regex won't match LX-LM-1 because the POS group is optional but index requires dash
		// Actually LX-LM-1 would match as: unit=LX, surface=LM, pos=undefined, index=1
		// But parse should reject it because Lexem requires POS
		expect(parseDictEntryId("LX-LM-1")).toBeUndefined();
	});
});

describe("buildDictEntryId", () => {
	test("builds Lexem ID", () => {
		expect(
			buildDictEntryId({
				index: 1,
				pos: "Noun",
				surfaceKind: "Lemma",
				unitKind: "Lexem",
			}),
		).toBe("LX-LM-NOUN-1");
	});

	test("builds Phrasem ID", () => {
		expect(
			buildDictEntryId({
				index: 5,
				surfaceKind: "Lemma",
				unitKind: "Phrasem",
			}),
		).toBe("PH-LM-5");
	});

	test("builds Morphem ID", () => {
		expect(
			buildDictEntryId({
				index: 2,
				surfaceKind: "Variant",
				unitKind: "Morphem",
			}),
		).toBe("MO-VA-2");
	});
});

describe("round-trip: build → parse", () => {
	test("Lexem round-trip", () => {
		const id = buildDictEntryId({
			index: 7,
			pos: "Verb",
			surfaceKind: "Inflected",
			unitKind: "Lexem",
		});
		const parsed = parseDictEntryId(id);
		expect(parsed).toBeDefined();
		expect(parsed?.unitKind).toBe("Lexem");
		expect(parsed?.surfaceKind).toBe("Inflected");
		expect(parsed?.index).toBe(7);
		if (parsed?.unitKindTag === "LX") {
			expect(parsed?.pos).toBe("Verb");
		}
	});

	test("Phrasem round-trip", () => {
		const id = buildDictEntryId({
			index: 3,
			surfaceKind: "Lemma",
			unitKind: "Phrasem",
		});
		const parsed = parseDictEntryId(id);
		expect(parsed).toBeDefined();
		expect(parsed?.unitKind).toBe("Phrasem");
		expect(parsed?.index).toBe(3);
	});
});

describe("dictEntryIdHelper.nextIndex", () => {
	test("returns 1 for empty list", () => {
		expect(dictEntryIdHelper.nextIndex([], "LX-LM-NOUN-")).toBe(1);
	});

	test("returns max + 1 for existing IDs", () => {
		const ids = ["LX-LM-NOUN-1", "LX-LM-NOUN-3", "LX-LM-VERB-5"];
		expect(dictEntryIdHelper.nextIndex(ids, "LX-LM-NOUN-")).toBe(4);
	});

	test("ignores IDs with different prefix", () => {
		const ids = ["LX-LM-VERB-10", "PH-LM-2"];
		expect(dictEntryIdHelper.nextIndex(ids, "LX-LM-NOUN-")).toBe(1);
	});
});

describe("dictEntryIdHelper.buildPrefix", () => {
	test("builds Lexem prefix with POS", () => {
		expect(dictEntryIdHelper.buildPrefix("Lexem", "Lemma", "Noun")).toBe(
			"LX-LM-NOUN-",
		);
	});

	test("builds Phrasem prefix", () => {
		expect(dictEntryIdHelper.buildPrefix("Phrasem", "Lemma")).toBe(
			"PH-LM-",
		);
	});

	test("builds Morphem prefix", () => {
		expect(dictEntryIdHelper.buildPrefix("Morphem", "Variant")).toBe(
			"MO-VA-",
		);
	});
});
