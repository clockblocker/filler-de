import { describe, expect, it } from "bun:test";
import {
	computeShardedFolderParts,
	computeShardSegments,
} from "../../../src/commanders/textfresser/common/sharded-path";

describe("computeShardSegments", () => {
	it("returns [first, prefix, shard] for a normal word", () => {
		expect(computeShardSegments("anfangen")).toEqual(["a", "anf", "anfan"]);
	});

	it("lowercases the input", () => {
		expect(computeShardSegments("Anfangen")).toEqual(["a", "anf", "anfan"]);
	});

	it("handles a 3-char word (prefix == shard)", () => {
		expect(computeShardSegments("das")).toEqual(["d", "das", "das"]);
	});

	it("handles a 1-char word (first == prefix == shard)", () => {
		expect(computeShardSegments("a")).toEqual(["a", "a", "a"]);
	});

	it("handles an empty string with underscore fallback", () => {
		expect(computeShardSegments("")).toEqual(["_", "_", "_"]);
	});

	it("handles a 2-char word", () => {
		expect(computeShardSegments("zu")).toEqual(["z", "zu", "zu"]);
	});

	it("handles a long word (shard truncated at 5)", () => {
		expect(computeShardSegments("Kohlekraftwerk")).toEqual([
			"k",
			"koh",
			"kohle",
		]);
	});

	it("handles umlauts", () => {
		expect(computeShardSegments("Übergang")).toEqual(["ü", "übe", "überg"]);
	});
});

describe("computeShardedFolderParts", () => {
	it("produces correct path for German/Lexem/Lemma", () => {
		expect(
			computeShardedFolderParts("anfangen", "German", "Lexem", "Lemma"),
		).toEqual(["Worter", "de", "lexem", "lemma", "a", "anf", "anfan"]);
	});

	it("produces correct path for English/Phrasem/Inflected", () => {
		expect(
			computeShardedFolderParts("break up", "English", "Phrasem", "Inflected"),
		).toEqual(["Worter", "en", "phrasem", "inflected", "b", "bre", "break"]);
	});

	it("produces correct path for German/Morphem/Variant", () => {
		expect(
			computeShardedFolderParts("ver", "German", "Morphem", "Variant"),
		).toEqual(["Worter", "de", "morphem", "variant", "v", "ver", "ver"]);
	});

	it("lowercases unit and surface kind in path", () => {
		const parts = computeShardedFolderParts(
			"Haus",
			"German",
			"Lexem",
			"Lemma",
		);
		expect(parts[2]).toBe("lexem");
		expect(parts[3]).toBe("lemma");
	});
});
