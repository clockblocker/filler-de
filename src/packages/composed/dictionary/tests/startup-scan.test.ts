/**
 * The startup scan over a generated vault of several thousand Reading
 * notes (#113). It runs only with `DICTIONARY_SCAN_BENCH=<lemmas>`, as
 *
 *     DICTIONARY_SCAN_BENCH=2000 bun test --preload ./tests/unit/setup.ts \
 *       src/packages/composed/dictionary/tests/startup-scan.test.ts
 *
 * and prints the time a cold scan and a cached scan take.
 */
import { expect, test } from "bun:test";
import type * as Dumling from "dumling/types";
import {
	writeLemmaNote,
	writeReadingNote,
} from "../../../../stateless-helpers/dictionary-notes";
import { createMemoryNoteCache } from "../src";
import { FakeVault } from "./support/fake-vault";
import { run } from "./support/files";
import { readingEntry, readingOf, verb } from "./support/fixtures";
import { crossroadPath, lemmaPath, readingPath } from "./support/paths";
import { openStore } from "./support/store";

const lemmaCount = Number(process.env.DICTIONARY_SCAN_BENCH ?? 0);
const EMOJIS = ["🚶", "🏃"] as const;

/** A word made of letters only, so every Lemma's path is distinct. */
function word(index: number): string {
	let name = "";
	for (let rest = index; ; rest = Math.floor(rest / 26) - 1) {
		name = String.fromCharCode(97 + (rest % 26)) + name;
		if (rest < 26) break;
	}
	return `${name}eln`;
}

function generatedVault(count: number): FakeVault {
	const files: Record<string, string> = {};
	const options = { format: "Hidden", language: "de" } as const;
	for (let index = 0; index < count; index++) {
		const lemma = verb(word(index));
		const readings = EMOJIS.map((emoji) =>
			readingEntry(readingOf(lemma, emoji), {
				knowledge: { definition: `${lemma.canonicalForm}, defined` },
			}),
		);
		const records = {
			lemmaRecord: { lemma: lemma as Dumling.Lemma<"de"> },
			ownedSurfaceEntries: [],
			pendingRelations: [],
			readingEntries: readings,
		};
		files[lemmaPath(lemma)] = writeLemmaNote(records, options)("");
		for (const entry of readings)
			files[readingPath(entry.reading)] = writeReadingNote(
				records,
				entry.reading,
				options,
			)("");
		files[crossroadPath(lemma.canonicalForm)] = "";
	}
	return new FakeVault(files);
}

test.skipIf(lemmaCount === 0)(
	"the startup scan over a generated vault",
	async () => {
		const vault = generatedVault(lemmaCount);
		const notes = vault.markdownPaths().length;
		const cache = createMemoryNoteCache();

		const coldStart = performance.now();
		const cold = await openStore(vault, cache);
		const coldMs = performance.now() - coldStart;
		expect((await run(cold.store.lemmaNotes)).length).toBe(lemmaCount);
		await run(cold.store.close);

		const warmStart = performance.now();
		const warm = await openStore(vault, cache);
		const warmMs = performance.now() - warmStart;
		expect((await run(warm.store.lemmaNotes)).length).toBe(lemmaCount);

		process.stdout.write(
			`[startup scan] ${notes} notes (${lemmaCount} Lemma notes, ${lemmaCount * EMOJIS.length} Reading notes, ${lemmaCount} Crossroad notes): cold ${coldMs.toFixed(0)} ms, cached ${warmMs.toFixed(0)} ms\n`,
		);
	},
	600_000,
);
