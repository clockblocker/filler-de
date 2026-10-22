/**
 * Classify's three writers, the occurrence commit, the unlink removal and
 * the Knowledge publication, each run as one store transaction, so running
 * them at once loses none of their updates.
 */
import { describe, expect, it } from "bun:test";
import { makeDumdictVaultStore } from "@textfresser/dictionary";
import { Effect } from "effect";
import {
	commitOccurrence,
	MAX_COMMIT_ATTEMPTS,
	planRemoval,
} from "../../../../src/commanders/classify/resolution/commit-occurrence";
import { publishKnowledge } from "../../../../src/commanders/classify/resolution/publish-knowledge";
import { attestationRefOf } from "../../../../src/commanders/classify/resolution/scroll-links";
import { FakeVault } from "../../../../src/packages/composed/dictionary/tests/support/fake-vault";
import {
	gehen,
	gehenReading,
	gehtSurfaceEntry,
} from "../../../../src/packages/composed/dictionary/tests/support/fixtures";
import { run } from "./support";

const ref = (block: number) =>
	attestationRefOf("Library/Story.md", String(block), `0000000${block}`);

const occurrence = (block: number, decision: "New" | "Reuse") => ({
	attestationRef: ref(block),
	decision,
	reading: gehenReading,
	surface: gehtSurfaceEntry.surface,
});

describe("Classify's store transactions", () => {
	it("commit, remove and publish at once without losing an update", async () => {
		const store = await run(makeDumdictVaultStore({ vault: new FakeVault() }));
		await run(commitOccurrence(store, occurrence(0, "New")));
		await run(commitOccurrence(store, occurrence(1, "Reuse")));

		const [committed, removed, published] = await run(
			Effect.all(
				[
					commitOccurrence(store, occurrence(2, "Reuse")),
					store.transact((view) => planRemoval(view, ref(0)), {
						maxAttempts: MAX_COMMIT_ATTEMPTS,
					}),
					publishKnowledge(store, {
						changes: [
							{ aspect: "definition", kind: "Contribute", value: "to walk" },
						],
						pendingRelations: [],
						reading: gehenReading,
					}),
				],
				{ concurrency: "unbounded" },
			),
		);
		expect(committed).toEqual({ _tag: "Committed", created: false });
		expect(removed).toBe("Removed");
		expect(published).toEqual({ dropped: 0 });

		const note = await run(store.lemmaNote(gehen));
		const [reading] = note?.readings ?? [];
		expect(reading?.attestationLinks.map((link) => link.ref).sort()).toEqual(
			[ref(1), ref(2)].sort(),
		);
		expect(reading?.knowledge?.definition).toBe("to walk");
	});
});
