/**
 * Breakdown and Source links move between a Unit Shadow and the one stored
 * Lemma it names (#267, ADR-0015 "The Lemma upgrade", texteater ADR 0050):
 * in the commit that adds or removes that Lemma, on publish, and when the
 * store converges after a hand edit or at startup. A link keeps its Shadow
 * through its Lemma (`unitShadowOf`), so it moves back as a relation does.
 */
import { describe, expect, test } from "bun:test";
import type { PlannedChangeOp, ReadingEntry } from "dumdict";
import { unitShadowOf } from "dumdict/pending";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import {
	moveOwnerLinks,
	resolverOver,
	settledEntry,
} from "../src/breakdown-links";
import { lemmaKeyOf, readingKeyOf, shadowKeyOf } from "../src/keys";
import { NoteIndex } from "../src/note-index";
import { classifyFile } from "../src/notes";
import { FakeVault } from "./support/fake-vault";
import { run } from "./support/files";
import {
	createLemma,
	createReading,
	laufen,
	readingEntry,
} from "./support/fixtures";
import { lemmaPath, readingPath } from "./support/paths";
import { commit, openStore, seed } from "./support/store";

type Lemma = Dumling.Lemma<"de">;
type Reading = Dumling.Reading<"de">;
type Store = Awaited<ReturnType<typeof openStore>>["store"];
type Piece = { readonly letters: string; readonly target?: Dumrel.LinkTarget };

const noun = (
	canonicalForm: string,
	gender: "Masc" | "Fem" | "Neut" = "Neut",
): Lemma => ({
	canonicalForm,
	coreFeatures: { gender },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
});
const shadow = (canonicalForm: string, kind = "NOUN"): Dumrel.UnitShadow =>
	({
		canonicalForm,
		family: "Lexeme",
		kind,
		language: "de",
	}) as Dumrel.UnitShadow;
const sense = (lemma: Lemma, emojiDescription = "🏭"): Reading =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Reading;

const kraftwerk = noun("Kraftwerk");
const kraftwerkReading = sense(kraftwerk);
const kohlekraftwerk = noun("Kohlekraftwerk");
const atomkraftwerk = noun("Atomkraftwerk");
const derSee = noun("See", "Masc");
const dieSee = noun("See", "Fem");
const seeufer = noun("Seeufer", "Neut");
/** A conversion: `Laufen` has the Source `laufen` (texteater ADR 0050). */
const dasLaufen = noun("Laufen");

/** A compound `<head><tail>`, whose two Constituents link by Shadow. */
const compoundPieces = (head: string, tail: string): Piece[] => [
	{ letters: head, target: shadow(head) },
	{ letters: tail.toLowerCase(), target: shadow(tail) },
];

const withKnowledge = (
	reading: Reading,
	knowledge: ReadingEntry<"de">["knowledge"],
): PlannedChangeOp<"de">[] => [
	createLemma(reading.lemma),
	createReading(readingEntry(reading, { knowledge })),
];
const compound = (lemma: Lemma, head: string, tail: string) =>
	withKnowledge(sense(lemma), {
		breakdown: { constituents: compoundPieces(head, tail) },
	});
const lemmaWithReading = (lemma: Lemma, emoji = "🏭") => [
	createLemma(lemma),
	createReading(readingEntry(sense(lemma, emoji))),
];

async function deleteLemma(store: Store, lemma: Lemma) {
	expect(
		await commit(store, [
			{
				lemma,
				preconditions: [{ kind: "lemmaExists", lemma }],
				type: "deleteLemma",
			},
		]),
	).toMatchObject({ status: "committed" });
}

async function entryOf(store: Store, reading: Reading) {
	const data = await run(store.lemmaNote(reading.lemma));
	return data?.readings.find(
		(entry) => readingKeyOf(entry.reading) === readingKeyOf(reading),
	);
}

/** The targets of a Reading's Constituents, as the store holds them. */
const constituentTargets = async (store: Store, reading: Reading) =>
	(await entryOf(store, reading))?.knowledge?.breakdown?.constituents?.map(
		({ target }) => target,
	);

/** What the store reads from the files alone, as a fresh startup does. */
const reopened = async (vault: FakeVault) => (await openStore(vault)).store;

describe("storing a Lemma moves the links waiting on its Shadow", () => {
	test("in every Reading that waits, in the same commit, and their notes are rewritten", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			...compound(kohlekraftwerk, "Kohle", "Kraftwerk"),
			...compound(atomkraftwerk, "Atom", "Kraftwerk"),
		]);
		const kohlePath = readingPath(sense(kohlekraftwerk));
		const before = vault.content(kohlePath);

		const result = await commit(store, lemmaWithReading(kraftwerk));

		expect(result).toMatchObject({ status: "committed" });
		// Nothing followed the commit: the links moved in it.
		expect(await run(store.revision)).toBe(
			result.status === "committed" ? result.nextRevision : "",
		);
		for (const [owner, head] of [
			[kohlekraftwerk, "Kohle"],
			[atomkraftwerk, "Atom"],
		] as const)
			expect(await constituentTargets(store, sense(owner))).toEqual([
				shadow(head),
				kraftwerk,
			]);
		expect(vault.content(kohlePath)).not.toBe(before);
		// The files hold the move.
		expect(
			await constituentTargets(
				await reopened(vault),
				sense(kohlekraftwerk),
			),
		).toEqual([shadow("Kohle"), kraftwerk]);
	});

	test("a Source moves like a piece", async () => {
		const { store } = await openStore();
		const reading = sense(dasLaufen, "🏃");
		await seed(
			store,
			withKnowledge(reading, {
				source: { target: shadow("laufen", "VERB") },
			}),
		);
		await seed(store, lemmaWithReading(laufen, "🏃"));
		expect((await entryOf(store, reading))?.knowledge?.source).toEqual({
			target: laufen,
		});
	});

	test("a Source never moves to a Lemma whose own Source names its owner (texteater #1279)", async () => {
		const { store } = await openStore();
		const lauf = noun("Lauf", "Masc");
		const laufReading = sense(lauf, "🏃");
		const laufenReading = sense(laufen, "🏃");
		await seed(
			store,
			withKnowledge(laufenReading, {
				source: { target: shadow("Lauf") },
			}),
		);
		await seed(
			store,
			withKnowledge(laufReading, {
				source: { target: shadow("laufen", "VERB") },
			}),
		);
		expect(
			(await entryOf(store, laufenReading))?.knowledge?.source,
		).toEqual({ target: shadow("Lauf") });
		expect((await entryOf(store, laufReading))?.knowledge?.source).toEqual({
			target: shadow("laufen", "VERB"),
		});
	});

	test("a Source moved to der See still counts as naming See when die See publishes a Source back to its owner", async () => {
		const { store, vault } = await openStore();
		const seegang = noun("Seegang", "Masc");
		const seegangReading = sense(seegang, "🌊");
		const dieSeeReading = sense(dieSee, "🌊");
		await seed(
			store,
			withKnowledge(seegangReading, {
				source: { target: shadow("See") },
			}),
		);
		await seed(store, lemmaWithReading(derSee, "🌊"));
		expect(
			(await entryOf(store, seegangReading))?.knowledge?.source,
		).toEqual({ target: derSee });

		// die See arrives with a Source to Seegang, whose stored Source names
		// See by its Shadow: neither moves to the other's Lemma.
		await seed(
			store,
			withKnowledge(dieSeeReading, {
				source: { target: shadow("Seegang") },
			}),
		);
		expect(
			(await entryOf(store, seegangReading))?.knowledge?.source,
		).toEqual({ target: unitShadowOf(derSee) });
		expect(
			(await entryOf(store, dieSeeReading))?.knowledge?.source,
		).toEqual({ target: shadow("Seegang") });

		// Settling again moves nothing.
		const batches = vault.batches.length;
		const again = await reopened(vault);
		expect(vault.batches.length).toBe(batches);
		expect(
			(await entryOf(again, dieSeeReading))?.knowledge?.source,
		).toEqual({ target: shadow("Seegang") });
	});

	test("a new Breakdown links the one stored Lemma its Shadow names as it is published", async () => {
		const { store } = await openStore();
		await seed(store, lemmaWithReading(kraftwerk));
		const reading = sense(kohlekraftwerk);
		await seed(store, lemmaWithReading(kohlekraftwerk));
		await seed(store, [
			{
				ops: [
					{
						envelope: {
							change: {
								aspect: "breakdown",
								kind: "Contribute",
								part: "constituents",
								value: compoundPieces("Kohle", "Kraftwerk"),
							},
							reading,
						},
						kind: "applyKnowledgeChange",
					},
				],
				preconditions: [],
				reading,
				type: "patchReading",
			} as PlannedChangeOp<"de">,
		]);
		expect(await constituentTargets(store, reading)).toEqual([
			shadow("Kohle"),
			kraftwerk,
		]);
	});
});

describe("a link moves only on a unique match, and back", () => {
	test("der See alone takes it; die See joining sends it back; removing die See moves it to der See again", async () => {
		const { store } = await openStore();
		const reading = sense(seeufer);
		await seed(store, compound(seeufer, "See", "Ufer"));

		await seed(store, lemmaWithReading(derSee, "🌊"));
		expect(await constituentTargets(store, reading)).toEqual([
			derSee,
			shadow("Ufer"),
		]);

		await seed(store, lemmaWithReading(dieSee, "🌊"));
		expect(await constituentTargets(store, reading)).toEqual([
			unitShadowOf(dieSee),
			shadow("Ufer"),
		]);

		await deleteLemma(store, dieSee);
		expect(await constituentTargets(store, reading)).toEqual([
			derSee,
			shadow("Ufer"),
		]);
	});

	test("two matching Lemmas stored together leave the piece on its Shadow", async () => {
		const { store } = await openStore();
		const reading = sense(seeufer);
		await seed(store, compound(seeufer, "See", "Ufer"));
		await seed(store, [
			...lemmaWithReading(derSee, "🌊"),
			...lemmaWithReading(dieSee, "🌊"),
		]);
		expect(await constituentTargets(store, reading)).toEqual([
			shadow("See"),
			shadow("Ufer"),
		]);
	});
});

describe("removing a Lemma moves its links back to the Shadow", () => {
	test("in the commit that removes it", async () => {
		const { store } = await openStore();
		await seed(store, [
			...lemmaWithReading(kraftwerk),
			...compound(kohlekraftwerk, "Kohle", "Kraftwerk"),
		]);
		await deleteLemma(store, kraftwerk);
		expect(await constituentTargets(store, sense(kohlekraftwerk))).toEqual([
			shadow("Kohle"),
			unitShadowOf(kraftwerk),
		]);
	});

	test("when its notes are deleted by hand", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			...lemmaWithReading(kraftwerk),
			...compound(kohlekraftwerk, "Kohle", "Kraftwerk"),
		]);
		await vault.userDeleteAll([
			readingPath(kraftwerkReading),
			lemmaPath(kraftwerk),
		]);
		expect(await constituentTargets(store, sense(kohlekraftwerk))).toEqual([
			shadow("Kohle"),
			unitShadowOf(kraftwerk),
		]);
	});
});

describe("startup converges the links", () => {
	/** The files a store writes for these changes, in a vault of their own. */
	async function filesOf(changes: PlannedChangeOp<"de">[]) {
		const { store, vault } = await openStore();
		await seed(store, changes);
		return Object.fromEntries(
			vault
				.markdownPaths()
				.map((path) => [path, vault.content(path) ?? ""]),
		);
	}

	test("a Lemma stored while the store was not running takes the links waiting on it, and a second start writes nothing", async () => {
		const vault = new FakeVault({
			...(await filesOf(compound(kohlekraftwerk, "Kohle", "Kraftwerk"))),
			...(await filesOf(lemmaWithReading(kraftwerk))),
		});
		const store = await reopened(vault);
		expect(await constituentTargets(store, sense(kohlekraftwerk))).toEqual([
			shadow("Kohle"),
			kraftwerk,
		]);

		const batches = vault.batches.length;
		const again = await reopened(vault);
		expect(vault.batches.length).toBe(batches);
		expect(await constituentTargets(again, sense(kohlekraftwerk))).toEqual([
			shadow("Kohle"),
			kraftwerk,
		]);
	});

	test("a Lemma whose notes are gone gives its links back to the Shadow", async () => {
		const files = await filesOf([
			...lemmaWithReading(kraftwerk),
			...compound(kohlekraftwerk, "Kohle", "Kraftwerk"),
		]);
		delete files[lemmaPath(kraftwerk)];
		delete files[readingPath(kraftwerkReading)];
		const store = await reopened(new FakeVault(files));
		expect(await constituentTargets(store, sense(kohlekraftwerk))).toEqual([
			shadow("Kohle"),
			unitShadowOf(kraftwerk),
		]);
	});
});

describe("re-evaluation is idempotent", () => {
	test("settling settled links moves nothing, and a later commit writes no owner again", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			...compound(kohlekraftwerk, "Kohle", "Kraftwerk"),
			...lemmaWithReading(kraftwerk),
		]);
		const entry = await entryOf(store, sense(kohlekraftwerk));
		if (!entry) throw new Error("Kohlekraftwerk is not stored");
		const index = indexOf(vault);
		expect(
			settledEntry(
				entry,
				resolverOver(index, () => true),
			),
		).toBe(undefined);

		const content = vault.content(readingPath(sense(kohlekraftwerk)));
		await seed(store, lemmaWithReading(noun("Kohle")));
		// Kohle's own piece moved, so the note was rewritten once more; a
		// commit that moves nothing leaves it as it is.
		const moved = vault.content(readingPath(sense(kohlekraftwerk)));
		expect(moved).not.toBe(content);
		await seed(store, lemmaWithReading(noun("Ufer")));
		expect(vault.content(readingPath(sense(kohlekraftwerk)))).toBe(moved);
	});
});

/** An index built from the vault's files alone. */
function indexOf(vault: FakeVault): NoteIndex {
	const index = new NoteIndex();
	for (const path of vault.markdownPaths())
		if (path.startsWith("Worter/"))
			index.set(path, classifyFile(path, vault.content(path) ?? ""));
	return index;
}

/** Letters-only names, so each owner is a valid German noun of its own. */
const nameOf = (at: number) =>
	`Z${String.fromCharCode(97 + Math.floor(at / 26))}${String.fromCharCode(97 + (at % 26))}`;

describe("the fan-out is capped", () => {
	test("a commit moves at most the cap's owners and reports the rest", async () => {
		const { store, vault } = await openStore();
		const owners = [0, 1, 2].map((at) => noun(`${nameOf(at)}kraftwerk`));
		await seed(
			store,
			owners.flatMap((owner, at) =>
				compound(owner, nameOf(at), "Kraftwerk"),
			),
		);
		const view = indexOf(vault);
		const moved = moveOwnerLinks({
			cap: 2,
			resolver: resolverOver(
				view,
				() => false,
				new Map([
					[
						lemmaKeyOf(kraftwerk),
						{
							lemmaRecord: { lemma: kraftwerk },
							ownedSurfaceEntries: [],
							pendingRelations: [],
							readingEntries: [],
						},
					],
				]),
			),
			shadowKeys: [shadowKeyOf(kraftwerk)],
			view,
		});
		expect(moved.moved).toBe(3);
		expect([...moved.intended.keys()]).toHaveLength(2);
		expect([...moved.leftOver]).toEqual([shadowKeyOf(kraftwerk)]);
	});

	test("owners over the store's cap of 200 move in a follow-up commit", async () => {
		const { store } = await openStore();
		const owners = Array.from({ length: 201 }, (_, at) =>
			noun(`${nameOf(at)}kraftwerk`),
		);
		await seed(
			store,
			owners.flatMap((owner, at) =>
				compound(owner, nameOf(at), "Kraftwerk"),
			),
		);
		const result = await commit(store, lemmaWithReading(kraftwerk));
		expect(result).toMatchObject({ status: "committed" });
		// The follow-up moved the rest after the commit.
		expect(await run(store.revision)).not.toBe(
			result.status === "committed" ? result.nextRevision : "",
		);
		for (const [at, owner] of owners.entries())
			expect(await constituentTargets(store, sense(owner))).toEqual([
				shadow(nameOf(at)),
				kraftwerk,
			]);
	}, 60_000);
});
