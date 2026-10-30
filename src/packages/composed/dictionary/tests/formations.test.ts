/**
 * A Lemma note lists its Formations (#269, texteater ADR 0050): the stored
 * Readings whose Constituents or Source link to it, computed from the
 * index, never stored. The note is re-rendered in the commit that moves
 * one of those links, inside the fan-out's one cap.
 */
import { describe, expect, test } from "bun:test";
import { MAX_FORMATIONS } from "@textfresser/lemma-note-codec";
import type { PlannedChangeOp, ReadingEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { noteMetadataHelper } from "../src/internal/note-metadata";
import { lemmaKeyOf } from "../src/keys";
import { NoteIndex } from "../src/note-index";
import { classifyFile } from "../src/notes";
import { fanOutOf, MAX_FAN_OUT_NOTES } from "../src/render";
import type { FakeVault } from "./support/fake-vault";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	createLemma,
	createReading,
	laufen,
	readingEntry,
	verb,
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
const shadow = (
	canonicalForm: string,
	kind = "NOUN",
	family = "Lexeme",
): Dumrel.UnitShadow =>
	({ canonicalForm, family, kind, language: "de" }) as Dumrel.UnitShadow;
const sense = (lemma: Lemma, emojiDescription = "🏭"): Reading =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Reading;

const kohle = noun("Kohle", "Fem");
const kraftwerk = noun("Kraftwerk");
const kohlekraftwerk = noun("Kohlekraftwerk");
const derSee = noun("See", "Masc");
const dieSee = noun("See", "Fem");
const seeufer = noun("Seeufer");

const withKnowledge = (
	reading: Reading,
	knowledge: ReadingEntry<"de">["knowledge"],
): PlannedChangeOp<"de">[] => [
	createLemma(reading.lemma),
	createReading(readingEntry(reading, { knowledge })),
];
const built = (reading: Reading, constituents: Piece[]) =>
	withKnowledge(reading, { breakdown: { constituents } });
/** A compound `<head><tail>`, whose two Constituents link by Shadow. */
const compound = (lemma: Lemma, head: string, tail: string, emoji = "🏭") =>
	built(sense(lemma, emoji), [
		{ letters: head, target: shadow(head) },
		{ letters: tail.toLowerCase(), target: shadow(tail) },
	]);
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

const TITLE =
	'<span class="note_block_title note_block_title_formations">Wortbildung</span>';

/** The Formations lines of a Lemma's note, without the title. */
function formationsOf(vault: FakeVault, lemma: Lemma): string[] {
	const lines = noteMetadataHelper
		.body(vault.content(lemmaPath(lemma)) ?? "")
		.split("\n");
	const start = lines.indexOf(TITLE);
	if (start < 0) return [];
	const rest = lines.slice(start + 1);
	const end = rest.indexOf("");
	return end < 0 ? rest : rest.slice(0, end);
}

/** A link to a Reading note, as a Formation renders it. */
const readingLink = (reading: Reading, alias = reading.lemma.canonicalForm) =>
	`[[${readingPath(reading).replace(/\.md$/u, "")}|${alias}]]`;

describe("Kohle's note lists the words built on it", () => {
	test("once Kohlekraftwerk's Breakdown targets it, in the commit that publishes it", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			...lemmaWithReading(kohle, "🪨"),
			...lemmaWithReading(kraftwerk),
		]);
		expect(formationsOf(vault, kohle)).toEqual([]);

		const result = await commit(
			store,
			compound(kohlekraftwerk, "Kohle", "Kraftwerk"),
		);
		expect(result).toMatchObject({ status: "committed" });
		// One commit: no follow-up rendered the Formations after it.
		expect(await run(store.revision)).toBe(
			result.status === "committed" ? result.nextRevision : "",
		);
		expect(formationsOf(vault, kohle)).toEqual([
			`Komposita: ${readingLink(sense(kohlekraftwerk))}`,
		]);
		expect(formationsOf(vault, kraftwerk)).toEqual([
			`Komposita: ${readingLink(sense(kohlekraftwerk))}`,
		]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("once Kohle is stored after Kohlekraftwerk, as #267 re-points the piece", async () => {
		const { store, vault } = await openStore();
		await seed(store, compound(kohlekraftwerk, "Kohle", "Kraftwerk"));
		const result = await commit(store, lemmaWithReading(kohle, "🪨"));
		expect(result).toMatchObject({ status: "committed" });
		expect(await run(store.revision)).toBe(
			result.status === "committed" ? result.nextRevision : "",
		);
		expect(formationsOf(vault, kohle)).toEqual([
			`Komposita: ${readingLink(sense(kohlekraftwerk))}`,
		]);
	});

	test("and drops a formation that is removed, or whose notes are deleted by hand", async () => {
		const { store, vault } = await openStore();
		const atomkraftwerk = noun("Atomkraftwerk");
		await seed(store, [
			...lemmaWithReading(kraftwerk),
			...compound(kohlekraftwerk, "Kohle", "Kraftwerk"),
			...compound(atomkraftwerk, "Atom", "Kraftwerk", "☢️"),
		]);
		expect(formationsOf(vault, kraftwerk)).toEqual([
			`Komposita: ${readingLink(sense(atomkraftwerk, "☢️"))}, ${readingLink(sense(kohlekraftwerk))}`,
		]);

		await deleteLemma(store, atomkraftwerk);
		expect(formationsOf(vault, kraftwerk)).toEqual([
			`Komposita: ${readingLink(sense(kohlekraftwerk))}`,
		]);

		await vault.userDeleteAll([
			readingPath(sense(kohlekraftwerk)),
			lemmaPath(kohlekraftwerk),
		]);
		expect(formationsOf(vault, kraftwerk)).toEqual([]);
		await expectIndexMatchesFiles(store, vault);
	});
});

describe("a formation follows its link between Lemmas", () => {
	test("der See lists Seeufer; die See joining un-points it from both; removing die See points it back", async () => {
		const { store, vault } = await openStore();
		await seed(store, compound(seeufer, "See", "Ufer", "🏖️"));
		const listed = [`Komposita: ${readingLink(sense(seeufer, "🏖️"))}`];

		await seed(store, lemmaWithReading(derSee, "🌊"));
		expect(formationsOf(vault, derSee)).toEqual(listed);

		// Two Lemmas share the Shadow: Seeufer links the Crossroad, and
		// neither note claims it.
		await seed(store, lemmaWithReading(dieSee, "🌊"));
		expect(formationsOf(vault, derSee)).toEqual([]);
		expect(formationsOf(vault, dieSee)).toEqual([]);

		await deleteLemma(store, dieSee);
		expect(formationsOf(vault, derSee)).toEqual(listed);
		await expectIndexMatchesFiles(store, vault);
	});
	test("a link that stays on its Shadow still leaves der See's note when die See joins", async () => {
		const { store, vault } = await openStore();
		const seegang = noun("Seegang", "Masc");
		// der See's Source names Seegang, so Seegang's Source back to See
		// never moves to der See (texteater #1279): it stays on its Shadow,
		// which the note links to der See while der See is the only See.
		await seed(
			store,
			withKnowledge(sense(derSee, "🌊"), {
				source: { target: shadow("Seegang") },
			}),
		);
		await seed(
			store,
			withKnowledge(sense(seegang, "🌊"), {
				source: { target: shadow("See") },
			}),
		);
		expect(formationsOf(vault, derSee)).toEqual([
			`Grundform von: ${readingLink(sense(seegang, "🌊"))}`,
		]);

		await seed(store, lemmaWithReading(dieSee, "🌊"));
		expect(formationsOf(vault, derSee)).toEqual([]);
		await expectIndexMatchesFiles(store, vault);
	});
});

describe("groups", () => {
	test("a prefixed verb, a derivation and a compound, in tf-demo's order", async () => {
		const kaufen = verb("kaufen");
		const einkaufen = verb("einkaufen");
		const kaeufer = noun("Käufer", "Masc");
		const kaufhaus = noun("Kaufhaus");
		const { store, vault } = await openStore();
		await seed(store, [
			...lemmaWithReading(kaufen, "🛒"),
			...built(sense(kaufhaus, "🏬"), [
				{ letters: "Kauf", target: shadow("kaufen", "VERB") },
				{ letters: "haus", target: shadow("Haus") },
			]),
			...built(sense(kaeufer, "🧑"), [
				{ letters: "Käuf", target: shadow("kaufen", "VERB") },
				{ letters: "er", target: shadow("-er", "Suffix", "Morpheme") },
			]),
			...built(sense(einkaufen, "🛒"), [
				{
					letters: "ein",
					target: shadow("ein-", "Prefix", "Morpheme"),
				},
				{ letters: "kaufen", target: shadow("kaufen", "VERB") },
			]),
		]);
		expect(formationsOf(vault, kaufen)).toEqual([
			`Präfixverben: ${readingLink(sense(einkaufen, "🛒"))}`,
			`Komposita: ${readingLink(sense(kaufhaus, "🏬"))}`,
			`Ableitungen: ${readingLink(sense(kaeufer, "🧑"))}`,
		]);
	});

	test("a conversion lists under its Source: Lauf from laufen", async () => {
		const lauf = noun("Lauf", "Masc");
		const { store, vault } = await openStore();
		await seed(store, lemmaWithReading(laufen, "🏃"));
		await seed(
			store,
			withKnowledge(sense(lauf, "🏃"), {
				source: { target: shadow("laufen", "VERB") },
			}),
		);
		expect(formationsOf(vault, laufen)).toEqual([
			`Grundform von: ${readingLink(sense(lauf, "🏃"))}`,
		]);
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

describe("the fan-out", () => {
	test("re-renders the bases a changed Breakdown names, within the commit's one cap", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			...lemmaWithReading(kohle, "🪨"),
			...lemmaWithReading(kraftwerk),
		]);
		const before = indexOf(vault);
		await seed(store, compound(kohlekraftwerk, "Kohle", "Kraftwerk"));
		const after = indexOf(vault);
		const touched = [lemmaKeyOf(kohlekraftwerk)];
		const bases = [lemmaKeyOf(kohle), lemmaKeyOf(kraftwerk)].sort();

		const fan = fanOutOf(before, after, touched);
		expect([...fan.lemmas].sort()).toEqual(bases);
		expect(fan.overflow).toEqual([]);

		// Owners the commit moves use up the cap: the bases follow after it.
		const full = fanOutOf(before, after, touched, {
			moved: MAX_FAN_OUT_NOTES,
		});
		expect([...full.lemmas]).toEqual([]);
		expect([...full.overflow].sort()).toEqual(bases);

		// A base whose own links move after the commit is left to that move.
		const deferred = fanOutOf(before, after, touched, {
			deferred: new Set([lemmaKeyOf(kohle)]),
		});
		expect([...deferred.lemmas]).toEqual([lemmaKeyOf(kraftwerk)]);
	});

	test(`storing a base with more owners than the cap moves the rest after the commit, and its note lists ${MAX_FORMATIONS} and folds the rest`, async () => {
		const nameOf = (at: number) =>
			`Z${String.fromCharCode(97 + Math.floor(at / 26))}${String.fromCharCode(97 + (at % 26))}`;
		const owners = Array.from({ length: MAX_FAN_OUT_NOTES + 1 }, (_, at) =>
			noun(`${nameOf(at)}kraftwerk`),
		);
		const { store, vault } = await openStore();
		await seed(
			store,
			owners.flatMap((owner, at) =>
				compound(owner, nameOf(at), "Kraftwerk"),
			),
		);
		const result = await commit(store, lemmaWithReading(kraftwerk));
		expect(result).toMatchObject({ status: "committed" });
		const [line, ...rest] = formationsOf(vault, kraftwerk);
		expect(rest).toEqual([]);
		expect(line).toStartWith(
			`Komposita: ${readingLink(sense(owners[0] as Lemma))}, `,
		);
		expect(line).toEndWith(" … 1 weitere");
		expect(line?.split(", ")).toHaveLength(MAX_FORMATIONS);
		await expectIndexMatchesFiles(store, vault);
	}, 60_000);
});
