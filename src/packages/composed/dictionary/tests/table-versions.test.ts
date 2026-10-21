/**
 * Re-rendering inflection tables when the pack or a Table Schema changes
 * (#121). Tables are projections (system ADR 0049): each Lemma note
 * records the versions it was rendered at, and every full read re-renders
 * the notes recorded at others, in the background, through the store's
 * compare-and-swap re-render.
 */
import { describe, expect, test } from "bun:test";
import { inflectionFromPack } from "@textfresser/lemma-note-codec";
import type { VaultAction } from "@textfresser/vault-action-manager";
import { inflectionPacks } from "dumcorpus/inflection";
import type { PlannedChangeOp } from "dumdict";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import {
	type DumdictVaultStore,
	makeDumdictVaultStore,
	type TablesRerendered,
} from "../src";
import {
	LemmaNoteMetadata,
	noteMetadataHelper,
} from "../src/internal/note-metadata";
import { FakeVault } from "./support/fake-vault";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	createLemma,
	createReading,
	gehen,
	gehenReading,
	readingEntry,
} from "./support/fixtures";
import { lemmaPath, readingPath } from "./support/paths";
import { seed } from "./support/store";

type Pack = typeof inflectionPacks.de;
const v1: Pack = inflectionPacks.de;

/** The German pack at version 2, whose labels changed. */
const v2: Pack = {
	...v1,
	labels: {
		...v1.labels,
		axis: (bundle) => `${v1.labels.axis(bundle)}°`,
		panel: (panelId) => `${v1.labels.panel(panelId)}°`,
	},
	version: "2",
};

/** The German pack at version 1 with the NOUN Table Schema at version 2. */
const nounSchemaBumped: Pack = {
	...v1,
	schemaFor: (lemma) => {
		const schema = v1.schemaFor(lemma);
		return schema?.id === "de/Lexeme/NOUN"
			? { ...schema, version: schema.version + 1 }
			: schema;
	},
};

async function open(
	vault: FakeVault,
	pack: Pack | undefined,
	reports: TablesRerendered[] = [],
): Promise<DumdictVaultStore> {
	return run(
		makeDumdictVaultStore({
			onTablesRerendered: (report) => reports.push(report),
			vault,
			...(pack
				? { projections: { inflection: inflectionFromPack(pack) } }
				: {}),
		}),
	);
}

/** Opens a store and waits for the table re-render its startup began. */
async function openSettled(vault: FakeVault, pack: Pack | undefined) {
	const reports: TablesRerendered[] = [];
	const store = await open(vault, pack, reports);
	const refreshed = await run(store.refreshTables);
	return { refreshed, reports, store };
}

/** Bank: 🪑 takes Bänke and 🏦 Banken, so each has a table of its own. */
const bank: Dumling.Lemma<"de", "Lexeme", "NOUN"> = {
	canonicalForm: "Bank",
	coreFeatures: { gender: "Fem" },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
};
const sense = (emojiDescription: string) =>
	({ emojiDescription, lemma: bank, unitKind: "Reading" }) as Dumling.Reading<
		"de",
		"Lexeme",
		"NOUN"
	>;
const bench = sense("🪑");
const moneyBank = sense("🏦");
const split = {
	dimensions: {
		plural: {
			licences: {
				[readingIdentityKey(bench)]: ["bänke"],
				[readingIdentityKey(moneyBank)]: ["banken"],
			},
			variants: ["Banken", "Bänke"].map((value) => ({
				id: value.toLowerCase(),
				provenance: "Produced",
				value,
			})),
		},
	},
} as unknown as Dumrel.LemmaParadigm;

const seedChanges: PlannedChangeOp<"de">[] = [
	{
		preconditions: [],
		record: { lemma: bank, paradigm: split },
		type: "createLemma",
	},
	createReading(readingEntry(bench)),
	createReading(readingEntry(moneyBank)),
	createLemma(gehen),
	createReading(readingEntry(gehenReading)),
];

const notePaths = [
	lemmaPath(bank),
	readingPath(bench),
	readingPath(moneyBank),
	lemmaPath(gehen),
	readingPath(gehenReading),
];

/** A vault holding Bank's and gehen's notes, rendered with `pack`. */
async function seededVault(pack: Pack | undefined): Promise<FakeVault> {
	const vault = new FakeVault();
	const store = await open(vault, pack);
	await seed(store, seedChanges);
	await run(store.close);
	return vault;
}

const recorded = (content: string | undefined) =>
	noteMetadataHelper.read(content ?? "", LemmaNoteMetadata, "Hidden")?.tables;

const blockIds = (content: string | undefined) =>
	[...(content ?? "").matchAll(/\^(t(?:-[0-9a-f]+)?)$/gmu)].map(
		([, id]) => id,
	);

const embedOf = (content: string | undefined) =>
	/!\[\[[^\]#]+#\^(t[^|\]]*)\|/u.exec(content ?? "")?.[1];

const contents = (vault: FakeVault) =>
	new Map(vault.markdownPaths().map((path) => [path, vault.content(path)]));

/** The paths a batch of actions writes. */
const writtenIn = (batch: readonly VaultAction[]) =>
	batch.map((action) => {
		const { splitPath } = action.payload as {
			splitPath: { pathParts: string[]; basename: string };
		};
		return `${[...splitPath.pathParts, splitPath.basename].join("/")}.md`;
	});

describe("recording versions", () => {
	test("a Lemma note records its pack and Table Schema versions; Reading notes record none", async () => {
		const vault = await seededVault(v1);
		expect(recorded(vault.content(lemmaPath(bank)))).toEqual({
			pack: "1",
			schema: { id: "de/Lexeme/NOUN", version: 1 },
		});
		expect(recorded(vault.content(lemmaPath(gehen)))).toEqual({
			pack: "1",
			schema: { id: "de/Lexeme/VERB", version: 1 },
		});
		expect(vault.content(readingPath(bench))).not.toContain('"tables"');
	});

	test("a store without a pack records nothing and finds nothing stale", async () => {
		const vault = await seededVault(undefined);
		expect(recorded(vault.content(lemmaPath(bank)))).toBeUndefined();
		const { refreshed } = await openSettled(vault, undefined);
		expect(refreshed).toEqual({ lemmas: 0, notes: 0, remaining: 0 });
	});
});

describe("re-rendering stale tables", () => {
	test("a pack bump re-renders every Lemma note, keeps Block IDs and embeds, and a second run writes nothing", async () => {
		const vault = await seededVault(v1);
		const before = contents(vault);
		const batches = vault.batches.length;

		const { refreshed, reports, store } = await openSettled(vault, v2);
		expect(refreshed).toEqual({ lemmas: 2, notes: 2, remaining: 0 });
		expect(reports).toEqual([refreshed]);

		for (const lemma of [bank, gehen]) {
			const path = lemmaPath(lemma);
			const content = vault.content(path);
			expect(content).not.toBe(before.get(path));
			expect(content).toContain("°");
			expect(recorded(content)?.pack).toBe("2");
			// Table Block IDs hash selection keys, never versions.
			expect(blockIds(content)).toEqual(blockIds(before.get(path)));
		}
		expect(blockIds(vault.content(lemmaPath(bank)))).toHaveLength(2);
		// Reading notes embed the same Blocks, so none is written.
		for (const reading of [bench, moneyBank, gehenReading])
			expect(vault.content(readingPath(reading))).toBe(
				before.get(readingPath(reading)),
			);
		expect(embedOf(vault.content(readingPath(bench)))).toMatch(
			/^t-[0-9a-f]{8}$/u,
		);
		expect(vault.batches.slice(batches).flatMap(writtenIn).sort()).toEqual(
			[lemmaPath(bank), lemmaPath(gehen)].sort(),
		);
		await expectIndexMatchesFiles(store, vault);

		// Idempotent: the same run again, and a fresh startup, write nothing.
		const after = vault.batches.length;
		expect(await run(store.refreshTables)).toEqual({
			lemmas: 0,
			notes: 0,
			remaining: 0,
		});
		await run(store.close);
		const again = await openSettled(vault, v2);
		expect(again.refreshed).toEqual({ lemmas: 0, notes: 0, remaining: 0 });
		expect(again.reports).toEqual([]);
		expect(vault.batches).toHaveLength(after);
		await run(again.store.close);
	});

	test("a Table Schema bump re-renders only the Lemmas of that schema", async () => {
		const vault = await seededVault(v1);
		const before = contents(vault);
		const batches = vault.batches.length;
		const { refreshed, store } = await openSettled(vault, nounSchemaBumped);
		expect(refreshed).toEqual({ lemmas: 1, notes: 1, remaining: 0 });
		expect(vault.batches.slice(batches).flatMap(writtenIn)).toEqual([
			lemmaPath(bank),
		]);
		expect(recorded(vault.content(lemmaPath(bank)))).toEqual({
			pack: "1",
			schema: { id: "de/Lexeme/NOUN", version: 2 },
		});
		// The labels did not change, so only the metadata did.
		expect(
			noteMetadataHelper.body(vault.content(lemmaPath(bank)) ?? ""),
		).toBe(noteMetadataHelper.body(before.get(lemmaPath(bank)) ?? ""));
		for (const path of notePaths.filter((path) => path !== lemmaPath(bank)))
			expect(vault.content(path)).toBe(before.get(path));
		await run(store.close);
	});

	test("notes rendered without versions get their tables once, Reading notes before their Lemma note", async () => {
		const vault = await seededVault(undefined);
		expect(embedOf(vault.content(readingPath(bench)))).toBeUndefined();
		const batches = vault.batches.length;
		const { refreshed, store } = await openSettled(vault, v1);
		expect(refreshed).toEqual({ lemmas: 2, notes: 5, remaining: 0 });
		// The Lemma notes, which record the versions, land last.
		const order = vault.batches
			.slice(batches)
			.map((batch) => writtenIn(batch).sort());
		expect(order).toEqual([
			[
				readingPath(bench),
				readingPath(moneyBank),
				readingPath(gehenReading),
			].sort(),
			[lemmaPath(bank), lemmaPath(gehen)].sort(),
		]);
		expect(embedOf(vault.content(readingPath(bench)))).toMatch(
			/^t-[0-9a-f]{8}$/u,
		);
		expect(embedOf(vault.content(readingPath(gehenReading)))).toBe("t");
		expect(recorded(vault.content(lemmaPath(bank)))?.pack).toBe("1");
		await run(store.close);
	});
});

describe("user text and concurrent writers", () => {
	test("freeform and an edited rendering survive a re-render", async () => {
		const vault = await seededVault(v1);
		const path = lemmaPath(bank);
		const original = vault.content(path) ?? "";
		const body = noteMetadataHelper.body(original);
		// The user writes below the note, and into the first table's caption.
		const edited = original
			.replace(
				body,
				`${body.replace("🪑\n", "🪑 my bench\n")}\n\nMy own words.\n`,
			)
			.replace(/\n{3,}/gu, "\n\n");
		vault.silentWrite(path, edited);

		const { refreshed, store } = await openSettled(vault, v2);
		expect(refreshed.lemmas).toBe(2);
		const content = vault.content(path) ?? "";
		expect(content).toContain("My own words.");
		expect(content).toContain("🪑 my bench");
		expect(recorded(content)?.pack).toBe("2");
		// Each table Block ID stays once, on the fresh rendering.
		expect(blockIds(content).sort()).toEqual(
			[...new Set(blockIds(original))].sort(),
		);
		expect(await run(store.refreshTables)).toEqual({
			lemmas: 0,
			notes: 0,
			remaining: 0,
		});
		await run(store.close);
	});

	test("an edit that lands between the read and the write is kept, and the table re-rendered over it", async () => {
		const vault = await seededVault(v1);
		const path = lemmaPath(bank);
		const dispatch = vault.dispatchStopOnFirstFailure;
		let raced = false;
		vault.dispatchStopOnFirstFailure = (actions) => {
			if (!raced && writtenIn(actions).includes(path)) {
				raced = true;
				const content = vault.content(path) ?? "";
				const at = content.indexOf("<section");
				vault.silentWrite(
					path,
					`${content.slice(0, at).trimEnd()}\n\nTyped meanwhile.\n\n${content.slice(at)}`,
				);
			}
			return dispatch(actions);
		};

		const { refreshed, store } = await openSettled(vault, v2);
		expect(raced).toBe(true);
		expect(refreshed).toEqual(
			expect.objectContaining({ lemmas: 2, remaining: 0 }),
		);
		const content = vault.content(path) ?? "";
		expect(content).toContain("Typed meanwhile.");
		expect(content).toContain("°");
		expect(recorded(content)?.pack).toBe("2");
		await expectIndexMatchesFiles(store, vault);
		await run(store.close);
	});

	test("a note whose writes keep failing stays stale until the next full read", async () => {
		const vault = await seededVault(v1);
		const path = lemmaPath(gehen);
		vault.failNextWrite((_action, at) => at === path, 3);
		const { refreshed, reports, store } = await openSettled(vault, v2);
		expect(refreshed).toEqual({ lemmas: 1, notes: 1, remaining: 1 });
		expect(reports).toEqual([refreshed]);
		expect(recorded(vault.content(path))?.pack).toBe("1");

		await run(store.rescan);
		expect(await run(store.refreshTables)).toEqual({
			lemmas: 1,
			notes: 1,
			remaining: 0,
		});
		expect(recorded(vault.content(path))?.pack).toBe("2");
		await run(store.close);
	});

	test("commits go between the chunks of a large re-render", async () => {
		const { vault, verbs } = await manyVerbs(80);
		const store = await open(vault, v2);
		const late = verbNamed("zuletzteln");
		await seed(store, [createLemma(late)]);
		// The commit landed while the re-render still had Lemmas to go.
		expect(rerendered(vault, verbs)).toBeLessThan(verbs.length);
		expect(recorded(vault.content(lemmaPath(late)))?.pack).toBe("2");

		expect(await run(store.refreshTables)).toMatchObject({
			lemmas: verbs.length,
			remaining: 0,
		});
		expect(rerendered(vault, verbs)).toBe(verbs.length);
		await run(store.close);
	});

	test("closing the store stops a re-render between chunks", async () => {
		const { vault, verbs } = await manyVerbs(80);
		const store = await open(vault, v2);
		await run(store.close);
		await new Promise((resolve) => setTimeout(resolve, 20));
		const batches = vault.batches.length;
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(vault.batches).toHaveLength(batches);
		expect(rerendered(vault, verbs)).toBeLessThan(verbs.length);
	});
});

/** A vault of `count` verbs with a Reading each, rendered with the version 1 pack. */
async function manyVerbs(count: number) {
	const vault = new FakeVault();
	const writer = await open(vault, v1);
	const verbs = Array.from({ length: count }, (_, index) =>
		verbNamed(
			`${String.fromCharCode(97 + (index % 26))}${String.fromCharCode(97 + Math.floor(index / 26))}eln`,
		),
	);
	await seed(
		writer,
		verbs.flatMap((lemma) => [
			createLemma(lemma),
			createReading(
				readingEntry({
					emojiDescription: "🚶",
					lemma,
					unitKind: "Reading",
				} as Dumling.Reading<"de">),
			),
		]),
	);
	await run(writer.close);
	return { vault, verbs };
}

/** How many of these Lemmas' notes record the version 2 pack. */
const rerendered = (vault: FakeVault, lemmas: readonly Dumling.Lemma<"de">[]) =>
	lemmas.filter(
		(lemma) => recorded(vault.content(lemmaPath(lemma)))?.pack === "2",
	).length;

function verbNamed(
	canonicalForm: string,
): Dumling.Lemma<"de", "Lexeme", "VERB"> {
	return { ...gehen, canonicalForm };
}
