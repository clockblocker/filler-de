/**
 * The store's notes across a dictionary's life: links that follow the
 * Lemmas a Shadow names, path collisions, Licence Groups that split and
 * merge, and the removal cascade with the user's text in it.
 */
import { describe, expect, test } from "bun:test";
import type { PlannedChangeOp } from "dumdict";
import { makeSurfaceId } from "dumdict";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import {
	type AddNewNoteRequest,
	createDumdictPlanner,
	type DumdictPlanOutcome,
} from "dumdict/planning";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { dictionaryProjections } from "../../../../stateless-helpers/dictionary-projections";
import { DictionaryPathOccupiedError, makeDumdictVaultStore } from "../src";
import { noteMetadataHelper } from "../src/internal/note-metadata";
import { FakeVault } from "./support/fake-vault";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	createLemma,
	createReading,
	gehen,
	readingEntry,
	synonym,
} from "./support/fixtures";
import { crossroadPath, lemmaPath, readingPath } from "./support/paths";
import { commit, openStore, seed } from "./support/store";

const planner = createDumdictPlanner("de");
type Store = Awaited<ReturnType<typeof openStore>>["store"];
type Noun = Dumling.Lemma<"de", "Lexeme", "NOUN">;

const noun = (
	canonicalForm: string,
	gender: "Masc" | "Fem" | "Neut",
): Noun => ({
	canonicalForm,
	coreFeatures: { gender },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
});
const sense = (lemma: Noun, emojiDescription: string) =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Dumling.Reading<
		"de",
		"Lexeme",
		"NOUN"
	>;

const derSee = noun("See", "Masc");
const dieSee = noun("See", "Fem");
const derSeeReading = sense(derSee, "💧");
const dieSeeReading = sense(dieSee, "🚢");
const teich = noun("Teich", "Masc");
const teichReading = sense(teich, "🦆");
const meer = noun("Meer", "Neut");
const meerReading = sense(meer, "🌊");
const seeShadow = {
	canonicalForm: "See",
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
} as const;

const linkTo = (path: string, shown: string) =>
	`[[${path.slice(0, -".md".length)}|${shown}]]`;
const seeCrossroadLink = linkTo(crossroadPath("See"), "See");

async function committed(store: Store, outcome: DumdictPlanOutcome<"de">) {
	if (outcome.status !== "planned") throw new Error(JSON.stringify(outcome));
	expect(await run(store.commitChanges(outcome.plan))).toMatchObject({
		status: "committed",
	});
	return outcome;
}

async function addNote(store: Store, reading: Dumling.Reading<"de">) {
	const request: AddNewNoteRequest<"de"> = {
		draft: {
			note: { attestationLinks: [], attestedTranslations: [], notes: "" },
			reading,
		},
	};
	const context = await run(
		store.loadReadingEntryContext(
			planner.contextRequest({ intent: "addNewNote", request }),
		),
	);
	if (context.intent !== "addNewNote") throw new Error("Expected addNewNote");
	return committed(store, planner.addNewNote(context, request));
}

describe("der See and die See: links follow the Lemmas a Shadow names", () => {
	test("one Classify moves every link its new Lemma touches, in one commit, and back when it goes", async () => {
		const { store, vault } = await openStore();
		// Teich names some See as its hypernym, before any See is stored;
		// Meer will be claimed by der See, so its note shows der See as an
		// inverse relation, linked by der See's Shadow.
		await seed(store, [
			createLemma(teich),
			createReading(readingEntry(teichReading)),
			{
				preconditions: [],
				record: createPendingSemanticRelationRecord(teichReading, {
					relation: "hypernym",
					target: seeShadow,
				}),
				type: "createPendingSemanticRelation",
			},
			createLemma(meer),
			createReading(readingEntry(meerReading)),
		]);
		const teichNote = readingPath(teichReading);
		const meerNote = readingPath(meerReading);
		expect(vault.content(teichNote)).toContain(seeCrossroadLink);

		// der See alone: the Shadow resolves, and Teich links its Lemma note.
		await addNote(store, derSeeReading);
		await seed(store, [synonym(derSeeReading, meer)]);
		const derSeeLink = linkTo(lemmaPath(derSee), "See");
		expect(vault.content(teichNote)).toContain(derSeeLink);
		expect(vault.content(meerNote)).toContain(`= ${derSeeLink}`);

		// die See joins: the Shadow names two Lemmas, so both links go back
		// to the Crossroad, written in the commit that adds die See.
		const start = vault.batches.length;
		await addNote(store, dieSeeReading);
		const written = vault.batches
			.slice(start)
			.flat()
			.map(({ payload }) => {
				const { splitPath } = payload as {
					splitPath: { pathParts: string[]; basename: string };
				};
				return `${[...splitPath.pathParts, splitPath.basename].join("/")}.md`;
			});
		expect(written).toEqual(
			expect.arrayContaining([
				lemmaPath(dieSee),
				readingPath(dieSeeReading),
				teichNote,
				meerNote,
				crossroadPath("See"),
			]),
		);
		expect(vault.content(teichNote)).toContain(seeCrossroadLink);
		expect(vault.content(teichNote)).not.toContain(derSeeLink);
		expect(vault.content(meerNote)).toContain(`= ${seeCrossroadLink}`);
		const crossroad = vault.content(crossroadPath("See")) ?? "";
		expect(crossroad).toContain(linkTo(lemmaPath(derSee), "See"));
		expect(crossroad).toContain(linkTo(lemmaPath(dieSee), "See"));
		await expectIndexMatchesFiles(store, vault);

		// die See's notes deleted by hand: the store re-evaluates, and the
		// links move forward to der See again.
		await vault.userDeleteAll([
			lemmaPath(dieSee),
			readingPath(dieSeeReading),
		]);
		expect(vault.content(teichNote)).toContain(derSeeLink);
		expect(vault.content(meerNote)).toContain(`= ${derSeeLink}`);
		expect(vault.content(crossroadPath("See"))).not.toContain(
			lemmaPath(dieSee).slice(0, -3),
		);
		expect(
			(await run(store.lemmaNote(teich)))?.readings[0]?.knowledge,
		).toEqual({ semanticRelations: { hypernym: [derSee] } });
		await expectIndexMatchesFiles(store, vault);
	});
});

describe("path collisions are reported, never overwritten", () => {
	test("two Lemmas whose note names fold together", async () => {
		const { store, vault } = await openStore();
		const c = noun("C", "Neut");
		const cSharp = noun("C#", "Neut");
		await seed(store, [createLemma(c)]);
		const files = vault.markdownPaths();
		const content = vault.content(lemmaPath(c));
		expect(lemmaPath(cSharp)).toBe(lemmaPath(c));
		const refused = await commit(store, [createLemma(cSharp)]).catch(
			(error: unknown) => error,
		);
		expect(refused).toBeInstanceOf(DictionaryPathOccupiedError);
		expect(vault.markdownPaths()).toEqual(files);
		expect(vault.content(lemmaPath(c))).toBe(content);
	});

	test("a folder the vault spells another way", async () => {
		const vault = new FakeVault({
			"Worter/de/Lexeme/VERB/G/note.md": "the user's own",
		});
		const { store } = await openStore(vault);
		const refused = await commit(store, [createLemma(gehen)]).catch(
			(error: unknown) => error,
		);
		expect(refused).toBeInstanceOf(DictionaryPathOccupiedError);
		expect(String((refused as Error).message)).toContain(
			"Worter/de/Lexeme/VERB/G",
		);
		expect(vault.markdownPaths()).toEqual([
			"Worter/de/Lexeme/VERB/G/note.md",
		]);
	});

	test("a case variant of a note path on disk", async () => {
		const vault = new FakeVault({
			[lemmaPath(gehen).replace("gehen.md", "Gehen.md")]: "mine",
		});
		const { store } = await openStore(vault);
		const refused = await commit(store, [createLemma(gehen)]).catch(
			(error: unknown) => error,
		);
		expect(refused).toBeInstanceOf(DictionaryPathOccupiedError);
	});
});

/** Bank: 🪑 takes Bänke and 🏦 Banken, so each has a table of its own. */
const bank = noun("Bank", "Fem");
const bench = sense(bank, "🪑");
const moneyBank = sense(bank, "🏦");
const variant = (value: string) => ({
	id: value.toLowerCase(),
	provenance: "Produced" as const,
	value,
});
const paradigmOf = (
	licences: Readonly<Record<string, readonly string[]>>,
	values: readonly string[],
): Dumrel.LemmaParadigm =>
	({
		dimensions: {
			plural: {
				licences: Object.fromEntries(
					Object.entries(licences).map(([key, ids]) => [
						key,
						[...ids],
					]),
				),
				variants: values.map(variant),
			},
		},
	}) as Dumrel.LemmaParadigm;
const split = paradigmOf(
	{
		[readingIdentityKey(bench)]: ["bänke"],
		[readingIdentityKey(moneyBank)]: ["banken"],
	},
	["Banken", "Bänke"],
);
const merged = paradigmOf(
	{
		[readingIdentityKey(bench)]: ["bänke"],
		[readingIdentityKey(moneyBank)]: ["bänke"],
	},
	["Bänke"],
);
const setParadigm = (
	paradigm: Dumrel.LemmaParadigm,
): PlannedChangeOp<"de"> => ({
	lemma: bank,
	paradigm,
	preconditions: [],
	type: "setLemmaParadigm",
});

/** The table Block ID a Reading note's Flexion embed names. */
const embedOf = (content: string | undefined) =>
	/!\[\[[^\]#]+#\^(t[^|\]]*)\|/u.exec(content ?? "")?.[1];

describe("Licence Groups", () => {
	test("a split rewrites each Reading note's embed to its own table, and a merge back to one", async () => {
		const vault = new FakeVault();
		const store = await run(
			makeDumdictVaultStore({
				projections: dictionaryProjections,
				vault,
			}),
		);
		await seed(store, [
			{
				preconditions: [],
				record: { lemma: bank, paradigm: merged },
				type: "createLemma",
			},
			createReading(readingEntry(bench)),
			createReading(readingEntry(moneyBank)),
		]);
		expect(embedOf(vault.content(readingPath(bench)))).toBe("t");
		expect(embedOf(vault.content(readingPath(moneyBank)))).toBe("t");

		await seed(store, [setParadigm(split)]);
		const benchTable = embedOf(vault.content(readingPath(bench)));
		const bankTable = embedOf(vault.content(readingPath(moneyBank)));
		expect(benchTable).toMatch(/^t-[0-9a-f]{8}$/u);
		expect(bankTable).toMatch(/^t-[0-9a-f]{8}$/u);
		expect(benchTable).not.toBe(bankTable);
		const lemmaNote = vault.content(lemmaPath(bank)) ?? "";
		expect(lemmaNote).toContain(`^${benchTable}`);
		expect(lemmaNote).toContain(`^${bankTable}`);

		await seed(store, [setParadigm(merged)]);
		expect(embedOf(vault.content(readingPath(bench)))).toBe("t");
		expect(embedOf(vault.content(readingPath(moneyBank)))).toBe("t");
		await expectIndexMatchesFiles(store, vault);
	});
});

const baenke: Dumling.Surface<"de", "Lexeme", "NOUN"> = {
	inflectionalFeatures: { case: "Nom", gender: null, number: "Plur" },
	language: "de",
	lemma: bank,
	normalizedSurface: "Bänke",
	spelling: { kind: "Canonical" },
	surfaceFeatures: null,
	unitKind: "Surface",
};
const banken: Dumling.Surface<"de", "Lexeme", "NOUN"> = {
	...baenke,
	normalizedSurface: "Banken",
};

async function record(
	store: Store,
	ref: string,
	reading: Dumling.Reading<"de">,
	surface: Dumling.Surface<"de">,
) {
	const request = {
		link: { reading, ref, surfaceId: makeSurfaceId("de", surface) },
		surface,
	};
	const context = await run(
		store.loadReadingEntryContext(
			planner.contextRequest({ intent: "recordOccurrence", request }),
		),
	);
	if (context.intent !== "recordOccurrence")
		throw new Error("Expected recordOccurrence");
	return committed(store, planner.recordOccurrence(context, request));
}

async function remove(store: Store, ref: string) {
	const slice = await run(
		store.loadOccurrenceSlice(planner.occurrenceSliceRequest({ ref })),
	);
	return committed(store, planner.removeOccurrence(slice, { ref }));
}

const typeInto = (vault: FakeVault, path: string, text: string) =>
	vault.userWrite(
		path,
		noteMetadataHelper.mapBody((body) => `${body.trimEnd()}\n\n${text}\n`)(
			vault.content(path) ?? "",
		),
	);

describe("the removal cascade", () => {
	test("removes notes as their records go, and moves the user's text to a note that stays", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			{
				preconditions: [],
				record: { lemma: bank, paradigm: split },
				type: "createLemma",
			},
			createReading(readingEntry(bench)),
			createReading(readingEntry(moneyBank)),
		]);
		await record(store, "![[Park#^1|^]]", bench, baenke);
		await record(store, "![[Geld#^2|^]]", moneyBank, banken);
		expect(vault.content(readingPath(moneyBank))).toContain(
			"![[Geld#^2|^]]",
		);
		await typeInto(vault, readingPath(moneyBank), "Money memo.");
		await typeInto(vault, readingPath(bench), "Bench memo.");
		await typeInto(vault, lemmaPath(bank), "Bank memo.");

		// 🏦 loses its last occurrence: its note goes, its text stays in the
		// Lemma note, and Banken, which nothing links now, is forgotten.
		const first = await remove(store, "![[Geld#^2|^]]");
		expect(first.affected.removed?.readings).toEqual([moneyBank]);
		expect(vault.content(readingPath(moneyBank))).toBeUndefined();
		const lemmaNote = vault.content(lemmaPath(bank)) ?? "";
		expect(lemmaNote).toContain("Money memo.");
		expect(lemmaNote).toContain("Bank memo.");
		expect(lemmaNote).not.toContain("🏦");
		expect(
			(await run(store.lemmaNote(bank)))?.ownedSurfaces.map(
				({ surface }) => surface.normalizedSurface,
			),
		).toEqual(["Bänke"]);
		await expectIndexMatchesFiles(store, vault);

		// 🪑 loses its last one: the Lemma goes, and every text its notes
		// held moves to its spelling's Crossroad note, which stays.
		const second = await remove(store, "![[Park#^1|^]]");
		expect(second.affected.removed?.lemmas).toEqual([bank]);
		expect(vault.content(lemmaPath(bank))).toBeUndefined();
		expect(vault.content(readingPath(bench))).toBeUndefined();
		const crossroad = vault.content(crossroadPath("Bank")) ?? "";
		for (const memo of ["Money memo.", "Bench memo.", "Bank memo."])
			expect(crossroad).toContain(memo);
		expect(crossroad).toContain("*Not classified yet*");
		expect(await run(store.lemmaNote(bank))).toBeUndefined();
		await expectIndexMatchesFiles(store, vault);
	});
});

/** Bank with both Readings, each holding one occurrence and a memo. */
async function bankWithMemos() {
	const opened = await openStore();
	const { store, vault } = opened;
	await seed(store, [
		{
			preconditions: [],
			record: { lemma: bank, paradigm: split },
			type: "createLemma",
		},
		createReading(readingEntry(bench)),
		createReading(readingEntry(moneyBank)),
	]);
	await record(store, "![[Park#^1|^]]", bench, baenke);
	await record(store, "![[Geld#^2|^]]", moneyBank, banken);
	await typeInto(vault, readingPath(moneyBank), "Money memo.");
	await typeInto(vault, readingPath(bench), "Bench memo.");
	return opened;
}

const countOf = (content: string | undefined, text: string) =>
	(content ?? "").split(text).length - 1;

describe("a stopped commit never loses or doubles the user's text", () => {
	test("text moving to a Crossroad note lands before its notes go, or they stay", async () => {
		const { store, vault } = await bankWithMemos();
		await remove(store, "![[Geld#^2|^]]");
		vault.failNextWrite(
			(_action, path) => path === crossroadPath("Bank"),
			1000,
		);
		const failed = await remove(store, "![[Park#^1|^]]").catch(
			(error: unknown) => error,
		);
		expect(failed).toBeInstanceOf(Error);
		// The Crossroad could not take the text, so the notes holding it stay.
		expect(vault.content(lemmaPath(bank))).toContain("Money memo.");
		expect(vault.content(readingPath(bench))).toContain("Bench memo.");
		await expectIndexMatchesFiles(store, vault);

		// Once it can, the text moves there once, however often it was tried.
		vault.failNextWrite(() => false);
		await remove(store, "![[Park#^1|^]]");
		const crossroad = vault.content(crossroadPath("Bank"));
		expect(countOf(crossroad, "Money memo.")).toBe(1);
		expect(countOf(crossroad, "Bench memo.")).toBe(1);
		expect(vault.content(lemmaPath(bank))).toBeUndefined();
	});

	test("a removal finished after a failed trash moves the text once", async () => {
		const { store, vault } = await bankWithMemos();
		vault.failNextWrite(
			(action, path) =>
				action.kind === "TrashMdFile" &&
				path === readingPath(moneyBank),
		);
		await remove(store, "![[Geld#^2|^]]");
		expect(vault.content(readingPath(moneyBank))).toBeUndefined();
		expect(countOf(vault.content(lemmaPath(bank)), "Money memo.")).toBe(1);
		await expectIndexMatchesFiles(store, vault);
	});

	test("text typed into a removed note while the commit runs is moved too", async () => {
		const { store, vault } = await bankWithMemos();
		let typed = false;
		vault.failNextWrite((_action, path) => {
			if (!typed && path === lemmaPath(bank)) {
				typed = true;
				vault.silentWrite(
					readingPath(moneyBank),
					noteMetadataHelper.mapBody(
						(body) => `${body.trimEnd()}\n\nTyped just now.\n`,
					)(vault.content(readingPath(moneyBank)) ?? ""),
				);
			}
			return false;
		});
		await remove(store, "![[Geld#^2|^]]");
		expect(vault.content(readingPath(moneyBank))).toBeUndefined();
		const lemmaNote = vault.content(lemmaPath(bank));
		expect(lemmaNote).toContain("Typed just now.");
		expect(countOf(lemmaNote, "Money memo.")).toBe(1);
		await expectIndexMatchesFiles(store, vault);
	});

	test("text typed into a removed note just as its trash runs is moved, not lost", async () => {
		const { store, vault } = await bankWithMemos();
		let typed = false;
		vault.failNextWrite((action, path) => {
			// The commit read the note and planned its trash; the user types
			// into it between that check and the trash itself.
			if (
				!typed &&
				action.kind === "TrashMdFile" &&
				path === readingPath(moneyBank)
			) {
				typed = true;
				vault.silentWrite(
					readingPath(moneyBank),
					noteMetadataHelper.mapBody(
						(body) => `${body.trimEnd()}\n\nTyped at the trash.\n`,
					)(vault.content(readingPath(moneyBank)) ?? ""),
				);
			}
			return false;
		});
		await remove(store, "![[Geld#^2|^]]");
		expect(typed).toBe(true);
		expect(vault.content(readingPath(moneyBank))).toBeUndefined();
		const lemmaNote = vault.content(lemmaPath(bank));
		expect(lemmaNote).toContain("Typed at the trash.");
		expect(countOf(lemmaNote, "Money memo.")).toBe(1);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a removed Lemma's duplicate note goes with it, its text kept", async () => {
		const { store, vault } = await bankWithMemos();
		const copy = "Worter/de/Lexeme/NOUN/Fem/copy.md";
		await vault.userWrite(
			copy,
			noteMetadataHelper.mapBody(
				(body) => `${body.trimEnd()}\n\nCopy memo.\n`,
			)(vault.content(lemmaPath(bank)) ?? ""),
		);
		await remove(store, "![[Geld#^2|^]]");
		await remove(store, "![[Park#^1|^]]");
		expect(await run(store.lemmaNote(bank))).toBeUndefined();
		expect(vault.content(copy)).toBeUndefined();
		expect(vault.content(crossroadPath("Bank"))).toContain("Copy memo.");
	});
});

describe("a stopped commit never overwrites another writer", () => {
	test("records another writer changed meanwhile are not finished over", async () => {
		const { store, vault } = await openStore();
		const fahrer = noun("Fahrer", "Masc");
		const driver = sense(fahrer, "🚗");
		await seed(store, [
			createLemma(fahrer),
			createReading(
				readingEntry(driver, { attestedTranslations: ["driver"] }),
			),
		]);
		const note = readingPath(driver);
		let synced = false;
		vault.failNextWrite((_action, path) => {
			if (synced || path !== lemmaPath(fahrer)) return false;
			synced = true;
			// Sync writes the Reading note's records while the commit runs.
			vault.silentWrite(
				note,
				(vault.content(note) ?? "").replace(
					'"attestedTranslations":["driver"]',
					'"attestedTranslations":["driver","chauffeur"]',
				),
			);
			return true;
		});
		const failed = await commit(store, [
			setParadigmOf(fahrer, driver),
			{
				ops: [
					{
						envelope: {
							change: {
								aspect: "definition",
								kind: "Contribute",
								value: "jemand, der fährt",
							},
							reading: driver,
						},
						kind: "applyKnowledgeChange",
					},
				],
				preconditions: [],
				reading: driver,
				type: "patchReading",
			},
		]).catch((error: unknown) => error);
		expect(failed).toBeInstanceOf(Error);
		expect(
			(await run(store.lemmaNote(fahrer)))?.readings[0]
				?.attestedTranslations,
		).toEqual(["driver", "chauffeur"]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a Lemma note that is there but unreadable keeps the claims on it", async () => {
		const { store, vault } = await openStore();
		const fahrer = noun("Fahrer", "Masc");
		const driver = sense(fahrer, "🚗");
		await seed(store, [
			createLemma(teich),
			createReading(readingEntry(teichReading)),
			createLemma(fahrer),
			createReading(readingEntry(driver)),
			{
				ops: [
					{
						envelope: {
							change: {
								aspect: "semanticRelations",
								kind: "Contribute",
								relation: "synonym",
								targetKind: "reading",
								value: [driver],
							},
							reading: teichReading,
						},
						kind: "applyKnowledgeChange",
					},
				],
				preconditions: [],
				reading: teichReading,
				type: "patchReading",
			} as PlannedChangeOp<"de">,
		]);
		const original = vault.content(lemmaPath(fahrer)) ?? "";
		vault.silentWrite(
			lemmaPath(fahrer),
			original.replace('"lemmaNote":{', '"lemmaNote":{"bogus":1,'),
		);
		await run(store.rescan);
		vault.silentWrite(lemmaPath(fahrer), original);
		await run(store.rescan);
		expect(
			(await run(store.lemmaNote(teich)))?.readings[0]?.knowledge
				?.semanticRelations,
		).toEqual({ synonym: [driver], targetKind: "reading" });
	});
});

/** A Paradigm for `lemma`'s one Reading, as a change: the Lemma note changes. */
function setParadigmOf(
	lemma: Noun,
	reading: Dumling.Reading<"de">,
): PlannedChangeOp<"de"> {
	return {
		lemma,
		paradigm: paradigmOf(
			{
				[readingIdentityKey(reading)]: [
					lemma.canonicalForm.toLowerCase(),
				],
			},
			[lemma.canonicalForm],
		),
		preconditions: [],
		type: "setLemmaParadigm",
	};
}
