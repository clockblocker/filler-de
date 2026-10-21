/**
 * Crossroad notes (#114, ADR-0015): one per folded spelling, listing every
 * Lemma and every met Surface with it, filled as "not classified yet" when
 * nothing is left or a click leaves an empty note, and regenerated at
 * startup when missing or stale.
 */
import { describe, expect, test } from "bun:test";
import { sealOf } from "@textfresser/lemma-note-codec";
import { makeSurfaceId, type SurfaceEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import { CrossroadNoteMetadata } from "../src";
import { noteMetadataHelper } from "../src/internal/note-metadata";
import type { FakeVault } from "./support/fake-vault";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	createLemma,
	createReading,
	createSurface,
	readingEntry,
	verb,
} from "./support/fixtures";
import { crossroadPath, lemmaPath, readingPath } from "./support/paths";
import { commit, openStore, seed } from "./support/store";

type Store = Awaited<ReturnType<typeof openStore>>["store"];

const noun = (
	canonicalForm: string,
	gender: "Masc" | "Fem" | "Neut",
): Dumling.Lemma<"de"> => ({
	canonicalForm,
	coreFeatures: { gender },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
});
const adverb = (canonicalForm: string): Dumling.Lemma<"de"> => ({
	canonicalForm,
	coreFeatures: { comparable: null },
	family: "Lexeme",
	kind: "ADV",
	language: "de",
	unitKind: "Lemma",
});
const sense = (lemma: Dumling.Lemma<"de">, emojiDescription: string) =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Dumling.Reading<"de">;

function surfaceEntry(
	lemma: Dumling.Lemma<"de">,
	form: string,
): SurfaceEntry<"de"> {
	const surface = {
		inflectionalFeatures: null,
		language: "de",
		lemma,
		normalizedSurface: form,
		spelling: { kind: "Canonical" },
		surfaceFeatures: null,
		unitKind: "Surface",
	} as Dumling.Surface<"de">;
	return {
		attestations: [],
		attestedTranslations: [],
		id: makeSurfaceId("de", surface),
		notes: "",
		ownerLemma: lemma,
		surface,
	};
}

/** A Lemma with its Readings and met Surfaces, as one seed. */
const lemmaWith = (
	lemma: Dumling.Lemma<"de">,
	emojis: readonly string[],
	surfaces: readonly string[] = [],
) => [
	createLemma(lemma),
	...emojis.map((emoji) => createReading(readingEntry(sense(lemma, emoji)))),
	...surfaces.map((form) => createSurface(surfaceEntry(lemma, form))),
];

const link = (path: string, shown: string) =>
	`[[${path.slice(0, -".md".length)}|${shown}]]`;
const lemmaLink = (lemma: Dumling.Lemma<"de">) =>
	link(lemmaPath(lemma), lemma.canonicalForm);
const readingLink = (lemma: Dumling.Lemma<"de">, emoji: string) =>
	link(readingPath(sense(lemma, emoji)), emoji);

const EINTRAEGE =
	'<span class="note_block_title note_block_title_eintraege">Einträge</span>';
const FORMEN =
	'<span class="note_block_title note_block_title_surfaces">Begegnete Formen</span>';
const NOT_CLASSIFIED = `${EINTRAEGE}\n*Not classified yet*\n`;

/** A note's visible body, without its metadata or the padding before it. */
const visible = (content: string) =>
	`${noteMetadataHelper.body(content).trimEnd()}\n`;

/** A Crossroad note's visible body. */
const bodyOf = (vault: FakeVault, spelling: string) => {
	const content = vault.content(crossroadPath(spelling));
	return content === undefined ? undefined : visible(content);
};

const fahrer = noun("Fahrer", "Masc");
const tag = noun("Tag", "Masc");
const derSee = noun("See", "Masc");
const dieSee = noun("See", "Fem");
const derMorgen = noun("Morgen", "Masc");
const morgen = adverb("morgen");
const masse = noun("Masse", "Fem");
const masze = noun("Maße", "Neut");
const sucht = noun("Sucht", "Fem");
const suchen = verb("suchen");

async function seeded(changes: Parameters<typeof seed>[1]) {
	const opened = await openStore();
	await seed(opened.store, changes);
	return opened;
}

async function deleteLemma(store: Store, lemma: Dumling.Lemma<"de">) {
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

describe("what a Crossroad note lists", () => {
	test("a Lemma with its Readings, and a met Surface linking its Lemma", async () => {
		const { vault } = await seeded(lemmaWith(fahrer, ["🚗"], ["Fahrern"]));
		expect(crossroadPath("Fahrer")).toBe("Worter/f/fah/fahre/fahrer.md");
		expect(bodyOf(vault, "Fahrer")).toBe(
			`${EINTRAEGE}\n- der ${lemmaLink(fahrer)}: ${readingLink(fahrer, "🚗")}\n`,
		);
		expect(bodyOf(vault, "Fahrern")).toBe(
			`${FORMEN}\n- Fahrern → der ${lemmaLink(fahrer)}\n`,
		);
	});

	test("one spelling with two Lemmas: der See and die See", async () => {
		const { vault } = await seeded([
			...lemmaWith(derSee, ["💧"]),
			...lemmaWith(dieSee, ["🚢"]),
		]);
		const lines = (bodyOf(vault, "See") ?? "").split("\n");
		expect(lines[0]).toBe(EINTRAEGE);
		expect(lines.slice(1).sort()).toEqual([
			"",
			`- der ${lemmaLink(derSee)}: ${readingLink(derSee, "💧")}`,
			`- die ${lemmaLink(dieSee)}: ${readingLink(dieSee, "🚢")}`,
		]);
	});

	test("spellings that differ only by case share one Crossroad: Morgen and morgen", async () => {
		const { vault } = await seeded([
			...lemmaWith(derMorgen, ["🌅"]),
			...lemmaWith(morgen, ["📅"]),
		]);
		expect(crossroadPath("Morgen")).toBe(crossroadPath("morgen"));
		expect(crossroadPath("Morgen")).toBe("Worter/m/mor/morge/morgen.md");
		const body = bodyOf(vault, "morgen") ?? "";
		expect(body).toContain(
			`- der ${lemmaLink(derMorgen)}: ${readingLink(derMorgen, "🌅")}`,
		);
		expect(body).toContain(
			`- ${lemmaLink(morgen)} (ADV): ${readingLink(morgen, "📅")}`,
		);
		expect(
			vault
				.markdownPaths()
				.filter((path) => path.startsWith("Worter/m/")),
		).toEqual(["Worter/m/mor/morge/morgen.md"]);
	});

	test("spellings that differ by ß get separate Crossroads: Maße and Masse", async () => {
		const { vault } = await seeded([
			...lemmaWith(masze, ["📏"]),
			...lemmaWith(masse, ["🧱"]),
		]);
		expect(crossroadPath("Maße")).toBe("Worter/m/maß/maße/maße.md");
		expect(crossroadPath("Masse")).toBe("Worter/m/mas/masse/masse.md");
		expect(bodyOf(vault, "Maße")).toBe(
			`${EINTRAEGE}\n- das ${lemmaLink(masze)}: ${readingLink(masze, "📏")}\n`,
		);
		expect(bodyOf(vault, "Masse")).toBe(
			`${EINTRAEGE}\n- die ${lemmaLink(masse)}: ${readingLink(masse, "🧱")}\n`,
		);
	});

	test("a Surface whose spelling is another Lemma's Canonical Form", async () => {
		const { vault } = await seeded([
			...lemmaWith(sucht, ["💉"]),
			...lemmaWith(suchen, ["🔍"], ["sucht"]),
		]);
		expect(bodyOf(vault, "sucht")).toBe(
			[
				EINTRAEGE,
				`- die ${lemmaLink(sucht)}: ${readingLink(sucht, "💉")}`,
				FORMEN,
				`- sucht → ${lemmaLink(suchen)} (VERB)`,
				"",
			].join("\n"),
		);
	});

	test("a Surface alone: Tage → Tag", async () => {
		const { vault } = await seeded(lemmaWith(tag, ["📆"], ["Tage"]));
		expect(bodyOf(vault, "Tage")).toBe(
			`${FORMEN}\n- Tage → der ${lemmaLink(tag)}\n`,
		);
	});
});

describe("not classified yet", () => {
	test("a spelling that loses its last Lemma goes back to not classified yet, keeping its text", async () => {
		const { store, vault } = await seeded(lemmaWith(fahrer, ["🚗"]));
		const path = crossroadPath("Fahrer");
		await vault.userWrite(path, `${vault.content(path)}\nMy own note.\n`);
		await deleteLemma(store, fahrer);
		expect(vault.content(lemmaPath(fahrer))).toBeUndefined();
		const body = bodyOf(vault, "Fahrer") ?? "";
		expect(body.startsWith(NOT_CLASSIFIED)).toBe(true);
		expect(body).toContain("My own note.");
		await expectIndexMatchesFiles(store, vault);
	});

	test("a spelling whose note was never there gets none when it loses its last Lemma", async () => {
		const { store, vault } = await seeded(lemmaWith(fahrer, ["🚗"]));
		await vault.userDelete(crossroadPath("Fahrer"));
		await deleteLemma(store, fahrer);
		expect(vault.content(crossroadPath("Fahrer"))).toBeUndefined();
	});

	test("an empty file a click left at a Crossroad path is filled as not classified yet", async () => {
		const { store, vault } = await seeded(lemmaWith(fahrer, ["🚗"]));
		const revision = await run(store.revision);
		const path = crossroadPath("Kraftwerk");
		await vault.userWrite(path, "");
		expect(bodyOf(vault, "Kraftwerk")).toBe(NOT_CLASSIFIED);
		// It holds no records, so it generates no Knowledge and no Lemma.
		expect(await run(store.lemmaNotes)).toEqual([
			{ lemma: fahrer, path: lemmaPath(fahrer) },
		]);
		const diagnostics = await run(store.diagnostics);
		expect(diagnostics.quarantined).toEqual([]);
		expect(diagnostics.strays).toEqual([]);
		// Classifying the word later lists it in the same note.
		const kraftwerk = noun("Kraftwerk", "Neut");
		await seed(store, lemmaWith(kraftwerk, ["🏭"]));
		expect(bodyOf(vault, "Kraftwerk")).toBe(
			`${EINTRAEGE}\n- das ${lemmaLink(kraftwerk)}: ${readingLink(kraftwerk, "🏭")}\n`,
		);
		expect(await run(store.revision)).not.toBe(revision);
	});

	test("an empty file a click left at a stored spelling's Crossroad path lists it", async () => {
		const { store, vault } = await seeded(lemmaWith(fahrer, ["🚗"]));
		const path = crossroadPath("Fahrer");
		await vault.userDelete(path);
		await vault.userWrite(path, "");
		expect(bodyOf(vault, "Fahrer")).toBe(
			`${EINTRAEGE}\n- der ${lemmaLink(fahrer)}: ${readingLink(fahrer, "🚗")}\n`,
		);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a hand edit of a Crossroad note is left to its editor", async () => {
		const { vault } = await seeded(lemmaWith(fahrer, ["🚗"]));
		const path = crossroadPath("Fahrer");
		const edited = (vault.content(path) ?? "").replace(
			"- der",
			"- the driver, der",
		);
		const writes = vault.batches.length;
		await vault.userWrite(path, edited);
		expect(vault.content(path)).toBe(edited);
		expect(vault.batches).toHaveLength(writes);
	});
});

describe("regeneration at startup", () => {
	test("regenerates missing and stale Crossroads, keeping user text, and a second run writes nothing", async () => {
		const { store, vault } = await seeded([
			...lemmaWith(fahrer, ["🚗"], ["Fahrern"]),
			...lemmaWith(tag, ["📆"], ["Tage"]),
		]);
		await run(store.close);
		const fahrerPath = crossroadPath("Fahrer");
		const fresh = vault.content(fahrerPath);
		const tagePath = crossroadPath("Tage");
		// Missing: deleted while the plugin was off.
		vault.files.delete(fahrerPath);
		// Stale: an older layout's rendering, sealed, with the user's text.
		const old = "- Tage → [[Worter/old|Tag]] (NOUN)";
		vault.silentWrite(
			tagePath,
			noteMetadataHelper.write(
				CrossroadNoteMetadata,
				{
					key: "tage",
					language: "de",
					rendering: [
						sealOf({ block: "crossroad_surface", lines: [old] }),
					],
				},
				"Hidden",
			)(`${old}\n\nMine.\n`),
		);
		// Without metadata: a file a click left, or one written by hand.
		const clicked = crossroadPath("Kraftwerk");
		vault.silentWrite(clicked, "");
		const byHand = crossroadPath("Werk");
		vault.silentWrite(byHand, "Notes on Werk.\n");

		const reopened = await openStore(vault);
		expect(vault.content(fahrerPath)).toBe(fresh);
		const tage = visible(vault.content(tagePath) ?? "");
		expect(tage).toContain(`${FORMEN}\n- Tage → der ${lemmaLink(tag)}\n`);
		expect(tage).toContain("Mine.");
		expect(tage).not.toContain(old);
		expect(visible(vault.content(clicked) ?? "")).toBe(NOT_CLASSIFIED);
		expect(visible(vault.content(byHand) ?? "")).toBe(
			`${NOT_CLASSIFIED}\nNotes on Werk.\n`,
		);
		await expectIndexMatchesFiles(reopened.store, vault);

		await run(reopened.store.close);
		const writes = vault.batches.length;
		const again = await openStore(vault);
		expect(vault.batches).toHaveLength(writes);
		await run(again.store.rescan);
		expect(vault.batches).toHaveLength(writes);
	});

	test("a rescan regenerates a Crossroad deleted while the store watched", async () => {
		const { store, vault } = await seeded(lemmaWith(fahrer, ["🚗"]));
		const path = crossroadPath("Fahrer");
		const fresh = vault.content(path);
		await vault.userDelete(path);
		// A Crossroad the user deletes stays deleted until the next full read.
		expect(vault.content(path)).toBeUndefined();
		await run(store.rescan);
		expect(vault.content(path)).toBe(fresh);
	});

	test("two spellings whose names are one path keep one Crossroad note, never flipping between them", async () => {
		// `toNameSegment` drops `#`, so C# and c both name `Worter/c/c/c/c.md`.
		const cSharp = noun("C#", "Neut");
		const c = adverb("c");
		expect(crossroadPath("C#")).toBe(crossroadPath("c"));
		const path = crossroadPath("c");
		const { store, vault } = await seeded(lemmaWith(cSharp, ["🎹"]));
		await seed(store, lemmaWith(c, ["🔤"]));
		// The first spelling's note keeps its path; the other is reported.
		expect(bodyOf(vault, "C#")).toContain(lemmaLink(cSharp));
		expect(bodyOf(vault, "C#")).not.toContain(lemmaLink(c));
		await run(store.close);
		let writes = vault.batches.length;
		await run((await openStore(vault)).store.close);
		expect(vault.batches).toHaveLength(writes);

		// Both missing at once: one is created, and the next start leaves it.
		vault.files.delete(path);
		const reopened = await openStore(vault);
		expect(vault.content(path)).toBeDefined();
		await run(reopened.store.close);
		writes = vault.batches.length;
		await openStore(vault);
		expect(vault.batches).toHaveLength(writes);
	});

	test("never creates a Crossroad over a folder the vault spells another way", async () => {
		const { store, vault } = await seeded(lemmaWith(fahrer, ["🚗"]));
		await run(store.close);
		const path = crossroadPath("Fahrer");
		vault.files.delete(path);
		// `Worter/F/` is `Worter/f/` on a case-insensitive file system.
		vault.silentWrite("Worter/F/notes.md", "mine");
		const writes = vault.batches.length;
		await openStore(vault);
		expect(vault.content(path)).toBeUndefined();
		expect(vault.batches).toHaveLength(writes);
	});
});
