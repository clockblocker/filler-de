import { describe, expect, it } from "bun:test";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import {
	createVaultActionManager,
	VamVaultIoError,
} from "@textfresser/vault-action-manager";
import type { SegmentedSentence } from "dumgen";
import { Effect, Option } from "effect";
import { pinnedJevModel } from "../../../.texteater/battery/dumgen/src/segment/jev";
import { TEXTEATER_LINK } from "../../../scripts/link-texteater";
import {
	type CacheFiles,
	cacheEntryPath,
	filesSegmentationCache,
	HIDDEN_FOLDER,
	SEGMENTATION_CACHE_FOLDER,
} from "../../../src/commanders/classify/segmentation-cache";
import { segmenterSourceHash } from "../../../src/commanders/classify/segmenter-source-hash";
import {
	DUMGEN_SEGMENTER_VERSION,
	sentenceKey,
} from "../../../src/commanders/classify/sentence-key";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";

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

/**
 * An adapter over in-memory files, as Obsidian's: `mkdir` makes the
 * folder's parents too, and writing into a missing folder fails.
 */
function memoryAdapter() {
	const files = new Map<string, string>();
	const folders = new Set<string>();
	const adapter = {
		exists: async (file: string) => files.has(file) || folders.has(file),
		mkdir: async (folder: string) => {
			const parts = folder.split("/");
			for (const [index] of parts.entries())
				folders.add(parts.slice(0, index + 1).join("/"));
		},
		read: async (file: string) => {
			const content = files.get(file);
			if (content === undefined) throw new Error(`${file} is missing`);
			return content;
		},
		write: async (file: string, data: string) => {
			if (!folders.has(file.slice(0, file.lastIndexOf("/"))))
				throw new Error(`${file}'s folder is missing`);
			files.set(file, data);
		},
	};
	return { adapter, files, folders };
}

/** The cache's files through VAM's `hiddenFolder`, over `memoryAdapter`. */
function memoryFiles() {
	const memory = memoryAdapter();
	const vault = makeObsidianVault({});
	(vault.app.vault as unknown as { adapter: unknown }).adapter = memory.adapter;
	(vault.app.vault as unknown as { configDir: string }).configDir = ".obsidian";
	const { manager } = createVaultActionManager(vault.app);
	return { ...memory, cacheFiles: manager.hiddenFolder(HIDDEN_FOLDER) };
}

const KEY = sentenceKey("v", "de", SENTENCE.text);

describe("filesSegmentationCache", () => {
	it("stores an entry in the hidden folder and reads it back", async () => {
		const { cacheFiles, files, folders } = memoryFiles();
		const cache = filesSegmentationCache(cacheFiles);
		expect(Option.isNone(await Effect.runPromise(cache.get(KEY)))).toBe(true);
		await Effect.runPromise(cache.put(KEY, SENTENCE));
		expect([...files.keys()]).toEqual([
			`.textfresser/segmentation/${KEY.slice(0, 2)}/${KEY}.json`,
		]);
		expect(`${HIDDEN_FOLDER}/${SEGMENTATION_CACHE_FOLDER}`).toBe(".textfresser/segmentation");
		expect([...folders]).toEqual([
			".textfresser",
			".textfresser/segmentation",
			`.textfresser/segmentation/${KEY.slice(0, 2)}`,
		]);
		expect(await Effect.runPromise(cache.get(KEY))).toEqual(
			Option.some(SENTENCE),
		);
	});

	it("reads an entry as dumgen's order wrote it, and writes such an entry byte for byte", async () => {
		// Every optional field, in the key order dumgen's units have: a
		// Surface, a possessive identity with no pronoun type, variants, and
		// an Unresolved unit.
		const key = sentenceKey("v", "de", "Unsere Bank");
		const stored = `{"format":1,"key":"${key}","sentence":{"segments":[{"kind":"ResolvableText","text":"Unsere","surface":"unser"},{"kind":"Whitespace","text":" "},{"kind":"OpaqueText","text":"Bank"}],"text":"Unsere Bank","units":[{"identity":{"kind":"DET","canonicalForm":"unser","pronType":null,"poss":"Yes"},"route":{"family":"Lexeme","kind":"DET","language":"de"},"segments":[0]},{"route":"Unresolved","segments":[2],"variants":[{"family":"Lexeme","kind":"NOUN","language":"de"},{"family":"Lexeme","kind":"PROPN","language":"de"}]}]}}`;
		const { cacheFiles, files } = memoryFiles();
		const cache = filesSegmentationCache(cacheFiles);
		const path = `${HIDDEN_FOLDER}/${cacheEntryPath(key)}`;
		files.set(path, stored);

		const read = Option.getOrThrow(await Effect.runPromise(cache.get(key)));
		expect(read).toEqual(JSON.parse(stored).sentence);
		// Decoded in the schema's key order, as Effect Schema decoded it.
		expect(Object.keys(read.segments[0] ?? {})).toEqual([
			"kind",
			"surface",
			"text",
		]);

		files.clear();
		await Effect.runPromise(cache.put(key, JSON.parse(stored).sentence));
		expect(files.get(path)).toBe(stored);
	});

	it("never stores a failed segmentation", async () => {
		const { cacheFiles, files } = memoryFiles();
		await Effect.runPromise(
			filesSegmentationCache(cacheFiles).put(KEY, { ...SENTENCE, failed: true }),
		);
		expect(files.size).toBe(0);
	});

	it("treats a corrupt, foreign or inconsistent entry as a miss", async () => {
		const { cacheFiles, files } = memoryFiles();
		const cache = filesSegmentationCache(cacheFiles);
		const path = `${HIDDEN_FOLDER}/${cacheEntryPath(KEY)}`;
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
		const gone = Effect.fail(
			new VamVaultIoError({
				cause: new Error("disk gone"),
				operation: "hiddenFolder.read",
				path: HIDDEN_FOLDER,
			}),
		);
		const failing: CacheFiles = {
			exists: () => gone,
			mkdir: () => gone,
			read: () => gone,
			write: () => gone,
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
			`dumgen@${manifest.version}+${pinnedJevModel}+src-${segmenterSourceHash()}`,
		);
		expect(segmenterSourceHash()).toMatch(/^[0-9a-f]{12}$/);
	});
});
