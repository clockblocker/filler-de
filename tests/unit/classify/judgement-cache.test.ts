import { describe, expect, it } from "bun:test";
import { VamVaultIoError } from "@textfresser/vault-action-manager";
import type * as Dumling from "dumling/types";
import { Effect, Option } from "effect";
import {
	filesJudgementCache,
	JUDGEMENT_CACHE_FOLDER,
	type Judgement,
	judgementEntryPath,
	memoryJudgementCache,
} from "../../../src/commanders/classify/judgement-cache";
import type { CacheFiles } from "../../../src/commanders/classify/segmentation-cache";
import { sentenceKey } from "../../../src/commanders/classify/sentence-key";
import { attestationOf, unit } from "./resolution/support";

const see = unit({
	canonicalForm: "See",
	coreFeatures: { gender: "Masc" },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
} as Dumling.Lemma<"de">);

const JUDGEMENT: Judgement = {
	attestation: attestationOf(see, "See", ["See"], {
		articleEvidence: null,
		valencyEvidence: [],
	}),
	reading: unit({
		emojiDescription: "🌊",
		lemma: see,
		unitKind: "Reading",
	} as Dumling.Reading<"de">),
	sentence: {
		segments: [{ text: "Der" }, { text: " " }, { text: "See" }, { text: "." }],
		target: [2],
	},
};

const AT = {
	occurrence: "1a2b3c4d",
	sentenceKey: sentenceKey("v", "de", "Der See."),
};

/** Files in memory, as VAM's `hiddenFolder` gives them: writing into a missing folder fails. */
function memoryFiles() {
	const files = new Map<string, string>();
	const folders = new Set<string>();
	const cacheFiles: CacheFiles = {
		exists: (path) => Effect.sync(() => files.has(path) || folders.has(path)),
		mkdir: (path) =>
			Effect.sync(() => {
				folders.add(path);
			}),
		read: (path) =>
			Effect.suspend(() => {
				const content = files.get(path);
				return content === undefined
					? Effect.fail(
							new VamVaultIoError({
								cause: new Error("missing"),
								operation: "hiddenFolder.read",
								path,
							}),
						)
					: Effect.succeed(content);
			}),
		write: (path, data) =>
			Effect.suspend(() => {
				if (!folders.has(path.slice(0, path.lastIndexOf("/"))))
					return Effect.fail(
						new VamVaultIoError({
							cause: new Error("no folder"),
							operation: "hiddenFolder.write",
							path,
						}),
					);
				files.set(path, data);
				return Effect.void;
			}),
	};
	return { cacheFiles, files, folders };
}

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect);

describe("filesJudgementCache", () => {
	it("stores a judgement per occurrence and reads it back", async () => {
		const { cacheFiles, files, folders } = memoryFiles();
		const cache = filesJudgementCache(cacheFiles);
		expect(Option.isNone(await run(cache.get(AT)))).toBe(true);
		await run(cache.put(AT, JUDGEMENT));
		const path = `${JUDGEMENT_CACHE_FOLDER}/${AT.sentenceKey.slice(0, 2)}/${AT.sentenceKey}-${AT.occurrence}.json`;
		expect(judgementEntryPath(AT)).toBe(path);
		expect([...files.keys()]).toEqual([path]);
		expect([...folders]).toEqual([
			JUDGEMENT_CACHE_FOLDER,
			`${JUDGEMENT_CACHE_FOLDER}/${AT.sentenceKey.slice(0, 2)}`,
		]);
		expect(await run(cache.get(AT))).toEqual(Option.some(JUDGEMENT));
		// Another occurrence of the same Sentence has an entry of its own.
		expect(
			Option.isNone(await run(cache.get({ ...AT, occurrence: "ffffffff" }))),
		).toBe(true);
	});

	it("overwrites an occurrence judged again", async () => {
		const { cacheFiles } = memoryFiles();
		const cache = filesJudgementCache(cacheFiles);
		await run(cache.put(AT, JUDGEMENT));
		const again: Judgement = {
			...JUDGEMENT,
			reading: unit({ ...JUDGEMENT.reading, emojiDescription: "🏞" }),
		};
		await run(cache.put(AT, again));
		expect(await run(cache.get(AT))).toEqual(Option.some(again));
	});

	it("treats a corrupt, foreign or invalid entry as a miss", async () => {
		const { cacheFiles, files, folders } = memoryFiles();
		const cache = filesJudgementCache(cacheFiles);
		const path = judgementEntryPath(AT);
		folders.add(path.slice(0, path.lastIndexOf("/")));
		const stored = {
			attestation: JUDGEMENT.attestation,
			format: 1,
			occurrence: AT.occurrence,
			reading: JUDGEMENT.reading,
			sentence: JUDGEMENT.sentence,
			sentenceKey: AT.sentenceKey,
		};
		const miss = async (content: unknown) => {
			files.set(path, typeof content === "string" ? content : JSON.stringify(content));
			return Option.isNone(await run(cache.get(AT)));
		};
		expect(await miss(stored)).toBe(false);
		expect(await miss("{ not json")).toBe(true);
		expect(await miss({ ...stored, format: 2 })).toBe(true);
		expect(await miss({ ...stored, occurrence: "ffffffff" })).toBe(true);
		expect(await miss({ ...stored, sentenceKey: sentenceKey("v", "de", "Ein See.") })).toBe(true);
		// The units are swapped, or one is not dumling's.
		expect(await miss({ ...stored, attestation: JUDGEMENT.reading })).toBe(true);
		expect(await miss({ ...stored, reading: { ...JUDGEMENT.reading, lemma: { canonicalForm: "See" } } })).toBe(true);
		// The target names a Segment the Sentence does not have, or none.
		expect(await miss({ ...stored, sentence: { ...JUDGEMENT.sentence, target: [9] } })).toBe(true);
		expect(await miss({ ...stored, sentence: { ...JUDGEMENT.sentence, target: [] } })).toBe(true);
	});

	it("names no file for what is not an occurrence key", async () => {
		const { cacheFiles, files } = memoryFiles();
		const cache = filesJudgementCache(cacheFiles);
		const odd = { occurrence: "../../x", sentenceKey: AT.sentenceKey };
		await run(cache.put(odd, JUDGEMENT));
		expect(files.size).toBe(0);
		expect(Option.isNone(await run(cache.get(odd)))).toBe(true);
	});

	it("swallows a failing adapter, so its caller judges again", async () => {
		const gone = Effect.fail(
			new VamVaultIoError({
				cause: new Error("disk gone"),
				operation: "hiddenFolder.read",
				path: JUDGEMENT_CACHE_FOLDER,
			}),
		);
		const cache = filesJudgementCache({
			exists: () => gone,
			mkdir: () => gone,
			read: () => gone,
			write: () => gone,
		});
		await run(cache.put(AT, JUDGEMENT));
		expect(Option.isNone(await run(cache.get(AT)))).toBe(true);
	});
});

describe("memoryJudgementCache", () => {
	it("keeps one judgement per occurrence", async () => {
		const cache = memoryJudgementCache();
		await run(cache.put(AT, JUDGEMENT));
		expect(await run(cache.get(AT))).toEqual(Option.some(JUDGEMENT));
		expect(cache.entries.size).toBe(1);
	});
});
