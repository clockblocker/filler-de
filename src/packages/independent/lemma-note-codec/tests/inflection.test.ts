import { describe, expect, it } from "bun:test";
import type { DerivedTable, InflectionPack } from "dumdict/inflection";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import {
	DEFAULT_PATHS,
	defaultResolve,
	type InflectionHook,
	inflectionFromPack,
	type LemmaRecords,
	lemmaTables,
	linkRenderer,
	renderLemmaNote,
	renderReadingNote,
	sameTableVersions,
	serializeLemmaNote,
	sha256Hex,
	surfaceBlockIds,
	tableVersionsOf,
} from "../src";
import {
	licenceFixtures,
	mutterNut,
	mutterParent,
	nounData,
	sendenBroadcast,
	sendenMail,
} from "./fixtures";
import { parseLemma, valid } from "./helpers";

const CASES = ["Nom", "Acc", "Dat", "Gen"] as const;

/**
 * A toy German pack: a noun declines its plural variant, a verb lists its
 * preterite variants. It stands in for the German pack (texteater#1229).
 */
const toyPack: InflectionPack<"de", string, string> = {
	codec: { key: (form) => form.toLowerCase() },
	derive: ({ lemma, schema, selection }) => {
		const table: Record<string, DerivedTable<string>[string]> = {};
		if (schema.id === "toy/NOUN") {
			const plurals = (selection.plural ?? []).map(
				(variant) => variant.value,
			);
			for (const grammaticalCase of CASES) {
				table[`case=${grammaticalCase}|number=Sing`] = [
					{ form: lemma.canonicalForm, provenance: "Rule" },
				];
				table[`case=${grammaticalCase}|number=Plur`] = plurals.map(
					(form) => ({
						form:
							grammaticalCase === "Dat" && !form.endsWith("n")
								? `${form}n`
								: form,
						provenance: "Variant",
					}),
				);
			}
		} else
			table["number=Sing|person=3"] = (selection.preterite ?? []).map(
				(variant) => ({ form: variant.value, provenance: "Variant" }),
			);
		return table;
	},
	display: (form) => [{ role: "Form", text: form }],
	formOfSurface: (surface) => surface.normalizedSurface,
	labels: {
		axis: (bundle) => Object.values(bundle).join(" "),
		bundle: (bundle) =>
			Object.entries(bundle)
				.sort(([a], [b]) => (a < b ? -1 : 1))
				.map(([, value]) => value)
				.join("."),
		panel: (id) => (id === "preterite" ? "Präteritum" : ""),
	},
	language: "de",
	schemaFor: (lemma) =>
		lemma.kind === "NOUN"
			? {
					id: "toy/NOUN",
					keyFeatures: ["case", "number"],
					panels: [
						{
							columns: [
								{ bundle: { number: "Sing" } },
								{ bundle: { number: "Plur" } },
							],
							core: true,
							fixed: {},
							id: "declension",
							rows: CASES.map((grammaticalCase) => ({
								bundle: { case: grammaticalCase },
							})),
						},
					],
					version: 1,
				}
			: lemma.kind === "VERB"
				? {
						id: "toy/VERB",
						keyFeatures: ["number", "person"],
						panels: [
							{
								columns: [{ bundle: { number: "Sing" } }],
								core: true,
								fixed: {},
								id: "preterite",
								rows: [{ bundle: { person: "3" } }],
							},
						],
						version: 1,
					}
				: undefined,
	version: "toy-1",
};

const inflection = inflectionFromPack(toyPack);
/** A table form spelled as its Lemma links the Lemma note. */
const MUTTER = "[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]]";
const link = linkRenderer(defaultResolve, DEFAULT_PATHS);
const tablesOf = (
	records: LemmaRecords<"de">,
	hook: InflectionHook<"de"> = inflection,
) => lemmaTables(hook, { link, records: records as LemmaRecords<"de"> }).tables;

/** The Lemma note's lines from `^id`'s table up to its Block ID. */
function tableBlock(body: string, blockId: string): string[] {
	const lines = body.split("\n");
	const end = lines.indexOf(`^${blockId}`);
	let start = end;
	while (start > 0 && (lines[start - 1] ?? "") !== "") start--;
	return lines.slice(start, end + 1);
}

describe("one table per Licence Group", () => {
	it("Mutter 👩 / 🔩: two tables, each captioned and with a hash of its selectionKey", () => {
		const tables = tablesOf(nounData);
		expect(tables).toHaveLength(2);
		for (const table of tables)
			expect(table.blockId).toBe(
				`t-${sha256Hex(table.selectionKey).slice(0, 8)}`,
			);
		const body = renderLemmaNote(nounData, { inflection });
		const [mother, nut] = tables;
		if (!mother || !nut) throw new Error("two tables");
		expect(tableBlock(body, mother.blockId)).toEqual([
			"👩",
			`Nom: ${MUTTER}, Mütter`,
			`Acc: ${MUTTER}, Mütter`,
			`Dat: ${MUTTER}, Müttern`,
			`Gen: ${MUTTER}, Mütter`,
			`^${mother.blockId}`,
		]);
		expect(tableBlock(body, nut.blockId)).toEqual([
			"🔩",
			`Nom: ${MUTTER}, Muttern`,
			`Acc: ${MUTTER}, Muttern`,
			`Dat: ${MUTTER}, Muttern`,
			`Gen: ${MUTTER}, Muttern`,
			`^${nut.blockId}`,
		]);
	});

	it("each Reading note embeds its own group's table", () => {
		const [mother, nut] = tablesOf(nounData);
		const path = "Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter";
		expect(
			renderReadingNote(nounData, mutterParent, { inflection }),
		).toContain(
			`<span class="note_block_title note_block_title_flexion">Flexion</span>\n![[${path}#^${mother?.blockId}|Mutter]]`,
		);
		expect(
			renderReadingNote(nounData, mutterNut, { inflection }),
		).toContain(`![[${path}#^${nut?.blockId}|Mutter]]`);
	});

	it("melken: a Free Lemma has one table, ^t, which every Reading embeds", () => {
		const { melken } = licenceFixtures;
		expect(tablesOf(melken).map(({ blockId }) => blockId)).toEqual(["t"]);
		const body = renderLemmaNote(melken, { inflection });
		// One panel: its rows, without a caption.
		expect(tableBlock(body, "t")).toEqual([
			"🐄 💰",
			"3: melkte / molk",
			"^t",
		]);
		for (const { reading } of melken.readingEntries)
			expect(
				renderReadingNote(melken, reading, { inflection }),
			).toContain("#^t|melken]]");
	});

	it("senden: partial overlap gives two groups", () => {
		const { senden } = licenceFixtures;
		const tables = tablesOf(senden);
		expect(
			tables.map(({ readings }) =>
				readings.map((r) => readingIdentityKey(r)),
			),
		).toEqual(
			[
				[readingIdentityKey(sendenMail)],
				[readingIdentityKey(sendenBroadcast)],
			].sort(([a], [b]) => ((a ?? "") < (b ?? "") ? -1 : 1)),
		);
		const mail = tables.find(({ readings }) =>
			readings.some(
				(r) => readingIdentityKey(r) === readingIdentityKey(sendenMail),
			),
		);
		expect(mail?.lines).toEqual(["3: sandte / sendete"]);
	});

	it("keeps each table's Block ID whatever order the records list things in", () => {
		const reordered: LemmaRecords<"de"> = {
			...nounData,
			readingEntries: [...nounData.readingEntries].reverse(),
		};
		expect(
			tablesOf(reordered)
				.map(({ blockId }) => blockId)
				.sort(),
		).toEqual(
			tablesOf(nounData)
				.map(({ blockId }) => blockId)
				.sort(),
		);
	});

	it("makes each table one Obsidian block: blank lines around it, its Block ID last", () => {
		const body = renderLemmaNote(nounData, { inflection });
		for (const { blockId } of tablesOf(nounData)) {
			const lines = body.split("\n");
			const end = lines.indexOf(`^${blockId}`);
			const block = tableBlock(body, blockId);
			expect(lines[end + 1]).toBe("");
			expect(lines[end - block.length]).toBe("");
			expect(block.every((line) => line.trim().length > 0)).toBe(true);
		}
	});

	it("leaves out a group without lines, and its Readings embed nothing", () => {
		const empty: InflectionHook<"de"> = (input) => {
			const rendered = inflection(input);
			return (
				rendered && {
					...rendered,
					tables: rendered.tables.map((table, index) =>
						index === 0 ? { ...table, lines: [] } : table,
					),
				}
			);
		};
		const tables = tablesOf(nounData, empty);
		expect(tables).toHaveLength(1);
		// The ID is assigned over both groups, so it does not move.
		expect(tables[0]?.blockId).toBe(tablesOf(nounData)[1]?.blockId);
		const embeds = [mutterParent, mutterNut].map((reading) =>
			renderReadingNote(nounData, reading, {
				inflection: empty,
			}).includes("Mutter#^t"),
		);
		expect(embeds.filter(Boolean)).toHaveLength(1);
	});
});

describe("the Surfaces met so far", () => {
	it("lists every owned Surface with its Surface Axes and its ^s- anchor", () => {
		const body = renderLemmaNote(nounData, { inflection });
		const ids = surfaceBlockIds(nounData.ownedSurfaceEntries);
		const [surface] = nounData.ownedSurfaceEntries;
		if (!surface) throw new Error("fixture");
		expect(body).toContain(
			`<span class="note_block_title note_block_title_surfaces">Begegnete Formen</span>\n- Mütter: Nom.Plur ^${ids.get(surface.id)}`,
		);
		expect(ids.get(surface.id)).toBe(
			`s-${sha256Hex(surface.id).slice(0, 8)}`,
		);
		// The parse returns the same anchors, recomputed from the data.
		const parsed = parseLemma(serializeLemmaNote(nounData, { inflection }));
		valid(parsed.data);
		if (!parsed.data.ok) throw new Error("valid");
		expect(parsed.data.blockIds.surfaces).toEqual(ids);
	});

	it("lists a Surface with its form alone when the hook gives no axes", () => {
		expect(renderLemmaNote(nounData)).toMatch(
			/\n- Mütter \^s-[0-9a-f]{8}\n/u,
		);
	});
});

describe("a Lemma without tables", () => {
	it("shows no Flexion in either note", () => {
		const foreignish = {
			...nounData,
			lemmaRecord: { lemma: nounData.lemmaRecord.lemma },
		};
		const none: InflectionHook<"de"> = () => undefined;
		expect(renderLemmaNote(foreignish, { inflection: none })).not.toContain(
			"Flexion",
		);
		expect(
			renderReadingNote(
				foreignish,
				mutterParent as Dumling.Reading<"de">,
				{
					inflection: none,
				},
			),
		).not.toContain("Flexion");
	});
});

describe("table versions (#121)", () => {
	it("a Lemma note records the pack's version and its Table Schema's id and version", () => {
		const { metadata } = serializeLemmaNote(nounData, { inflection });
		expect(metadata.tables).toEqual({
			pack: "toy-1",
			schema: { id: "toy/NOUN", version: 1 },
		});
		expect(tableVersionsOf(inflection, nounData.lemmaRecord.lemma)).toEqual(
			metadata.tables,
		);
		expect(
			parseLemma({ body: "", metadata }).document.metadata?.tables,
		).toEqual(metadata.tables);
	});

	it("a Lemma without a schema records the pack's version alone", () => {
		const lemma = { ...nounData.lemmaRecord.lemma, kind: "PROPN" };
		expect(
			tableVersionsOf(inflection, lemma as Dumling.Lemma<"de">),
		).toEqual({ pack: "toy-1" });
	});

	it("a hook that names no versions records none", () => {
		const bare: InflectionHook<"de"> = (input) => inflection(input);
		expect(
			serializeLemmaNote(nounData, { inflection: bare }).metadata.tables,
		).toBeUndefined();
		expect(serializeLemmaNote(nounData).metadata.tables).toBeUndefined();
	});

	it("a version bump changes the recorded versions, never a table's Block ID", () => {
		const bumped = inflectionFromPack({ ...toyPack, version: "toy-2" });
		const before = tablesOf(nounData).map(({ blockId }) => blockId);
		expect(
			tablesOf(nounData, bumped).map(({ blockId }) => blockId),
		).toEqual(before);
		const was = serializeLemmaNote(nounData, { inflection }).metadata
			.tables;
		const is = serializeLemmaNote(nounData, { inflection: bumped }).metadata
			.tables;
		expect(sameTableVersions(was, is)).toBe(false);
		expect(sameTableVersions(is, { ...is, pack: "toy-2" })).toBe(true);
		expect(sameTableVersions(undefined, undefined)).toBe(true);
		expect(sameTableVersions(was, undefined)).toBe(false);
	});
});
