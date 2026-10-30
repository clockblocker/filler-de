import { describe, expect, it } from "bun:test";
import type { SegmentedSentence } from "dumgen";
import { Effect, Option } from "effect";
import { rememberedReads } from "../../../../src/commanders/classify/resolution/occurrence-keys";
import { memorySegmentationCache } from "../../../../src/commanders/classify/segmentation-cache";

const SENTENCE: SegmentedSentence = {
	segments: [{ kind: "ResolvableText", text: "See" }],
	text: "See",
	units: [{ route: { family: "Lexeme", kind: "NOUN", language: "de" }, segments: [0] }],
};

/** A cache in memory that counts the reads that reach it. */
function countingCache() {
	const cache = memorySegmentationCache();
	const reached: string[] = [];
	return {
		cache: {
			...cache,
			get: (key: string) =>
				Effect.suspend(() => {
					reached.push(key);
					return cache.get(key);
				}),
		},
		reached,
	};
}

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect);

describe("rememberedReads", () => {
	it("reads a hit once, and a miss once until its misses are forgotten", async () => {
		const { cache, reached } = countingCache();
		await run(cache.put("a", SENTENCE));
		const reads = rememberedReads(cache);
		for (let time = 0; time < 3; time++) {
			expect(await run(reads.get("a"))).toEqual(Option.some(SENTENCE));
			expect(Option.isNone(await run(reads.get("b")))).toBe(true);
		}
		expect(reached).toEqual(["a", "b"]);

		// Classify fills the miss; the next check reads it again.
		await run(cache.put("b", SENTENCE));
		reads.forgetMisses();
		expect(await run(reads.get("b"))).toEqual(Option.some(SENTENCE));
		expect(await run(reads.get("a"))).toEqual(Option.some(SENTENCE));
		expect(reached).toEqual(["a", "b", "b"]);
	});

	it("keeps only the latest hits it has room for", async () => {
		const { cache, reached } = countingCache();
		for (const key of ["a", "b", "c"]) await run(cache.put(key, SENTENCE));
		const reads = rememberedReads(cache, 2);
		for (const key of ["a", "b", "a", "c", "a", "b"]) await run(reads.get(key));
		// "b" was the oldest when "c" came, so it is read again.
		expect(reached).toEqual(["a", "b", "c", "b"]);
	});
});
