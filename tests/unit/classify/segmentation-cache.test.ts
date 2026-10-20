import { describe, expect, it } from "bun:test";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { SegmentedSentence } from "dumgen";
import { Effect, Option } from "effect";
import { pinnedJevModel } from "../../../.texteater/battery/dumgen/src/segment/jev";
import { TEXTEATER_LINK } from "../../../scripts/link-texteater";
import {
	type CacheFiles,
	cacheEntryPath,
	filesSegmentationCache,
	SEGMENTATION_CACHE_FOLDER,
} from "../../../src/commanders/classify/segmentation-cache";
import {
	DUMGEN_SEGMENTER_VERSION,
	sentenceKey,
} from "../../../src/commanders/classify/sentence-key";

const SENTENCE: SegmentedSentence = {
	segments: [
		{ kind: "ResolvableText", text: "Er" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "gibt" },
		{ kind: "Whitespace", text: " " },
		{ kind: "ResolvableText", text: "auf" },
		{ kind: "Punctuation", text: "." },
	],
	text: "Er gibt auf.",
	units: [
		{
			identity: { canonicalForm: "er", kind: "PRON", pronType: "Prs" },
			route: { family: "Lexeme", kind: "PRON", language: "de" },
			segments: [0],
		},
		{
			route: { family: "Lexeme", kind: "VERB", language: "de" },
			segments: [2, 4],
		},
	],
};

function memoryFiles() {
	const files = new Map<string, string>();
	const folders = new Set<string>();
	const adapter: CacheFiles = {
		exists: async (file) => files.has(file) || folders.has(file),
		mkdir: async (folder) => {
			folders.add(folder);
		},
		read: async (file) => {
			const content = files.get(file);
			if (content === undefined) throw new Error(`${file} is missing`);
			return content;
		},
		write: async (file, data) => {
			if (!folders.has(file.slice(0, file.lastIndexOf("/"))))
				throw new Error(`${file}'s folder is missing`);
			files.set(file, data);
		},
	};
	return { adapter, files, folders };
}

const KEY = sentenceKey("v", "de", SENTENCE.text);

describe("filesSegmentationCache", () => {
	it("stores an entry in the hidden folder and reads it back", async () => {
		const { adapter, files, folders } = memoryFiles();
		const cache = filesSegmentationCache(adapter);
		expect(Option.isNone(await Effect.runPromise(cache.get(KEY)))).toBe(true);
		await Effect.runPromise(cache.put(KEY, SENTENCE));
		expect([...files.keys()]).toEqual([
			`${SEGMENTATION_CACHE_FOLDER}/${KEY.slice(0, 2)}/${KEY}.json`,
		]);
		expect(SEGMENTATION_CACHE_FOLDER.startsWith(".")).toBe(true);
		expect([...folders]).toEqual([
			".textfresser",
			".textfresser/segmentation",
			`.textfresser/segmentation/${KEY.slice(0, 2)}`,
		]);
		expect(await Effect.runPromise(cache.get(KEY))).toEqual(
			Option.some(SENTENCE),
		);
	});

	it("never stores a failed segmentation", async () => {
		const { adapter, files } = memoryFiles();
		await Effect.runPromise(
			filesSegmentationCache(adapter).put(KEY, { ...SENTENCE, failed: true }),
		);
		expect(files.size).toBe(0);
	});

	it("treats a corrupt, foreign or inconsistent entry as a miss", async () => {
		const { adapter, files } = memoryFiles();
		const cache = filesSegmentationCache(adapter);
		const path = cacheEntryPath(KEY);
		const miss = async (content: string) => {
			files.set(path, content);
			return Option.isNone(await Effect.runPromise(cache.get(KEY)));
		};
		expect(await miss("{ not json")).toBe(true);
		expect(
			await miss(JSON.stringify({ format: 1, key: "other", sentence: SENTENCE })),
		).toBe(true);
		expect(
			await miss(
				JSON.stringify({
					format: 1,
					key: KEY,
					sentence: { ...SENTENCE, text: "Er gibt nicht auf." },
				}),
			),
		).toBe(true);
		expect(
			await miss(
				JSON.stringify({
					format: 1,
					key: KEY,
					sentence: { ...SENTENCE, units: [{ route: "Unresolved", segments: [9] }] },
				}),
			),
		).toBe(true);
	});

	it("swallows a failing adapter, so Classify segments again", async () => {
		const failing: CacheFiles = {
			exists: () => Promise.reject(new Error("disk gone")),
			mkdir: () => Promise.reject(new Error("disk gone")),
			read: () => Promise.reject(new Error("disk gone")),
			write: () => Promise.reject(new Error("disk gone")),
		};
		const cache = filesSegmentationCache(failing);
		await Effect.runPromise(cache.put(KEY, SENTENCE));
		expect(Option.isNone(await Effect.runPromise(cache.get(KEY)))).toBe(true);
	});
});

describe("sentenceKey", () => {
	it("folds whitespace and Unicode forms, and depends on version and language", () => {
		const key = sentenceKey("v", "de", "Müde  bin ich.");
		expect(sentenceKey("v", "de", " Müde bin\tich. ")).toBe(key);
		expect(sentenceKey("w", "de", "Müde bin ich.")).not.toBe(key);
		expect(sentenceKey("v", "en", "Müde bin ich.")).not.toBe(key);
		expect(key).toMatch(/^[0-9a-f]{64}$/);
	});

	it("names the linked dumgen version and its pinned jev model", () => {
		const manifest = JSON.parse(
			readFileSync(
				path.join(realpathSync(TEXTEATER_LINK), "battery/dumgen/package.json"),
				"utf8",
			),
		) as { version: string };
		expect(DUMGEN_SEGMENTER_VERSION).toBe(
			`dumgen@${manifest.version}+${pinnedJevModel}`,
		);
	});
});
