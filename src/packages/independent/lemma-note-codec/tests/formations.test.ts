/**
 * A Lemma note's Formations (texteater ADR 0050, #269): the stored words
 * built on the Lemma, grouped and ordered as tf-demo's `formationGroupOf`
 * groups them, each linking its Reading note. Rendered, never parsed.
 */
import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Result } from "effect";
import {
	type Formation,
	formationGroupOf,
	type LemmaRecords,
	MAX_FORMATIONS,
	type RenderOptions,
	renderLemmaNote,
	serializeLemmaNote,
} from "../src";
import { freeformTexts, parseLemma } from "./helpers";

type De = "de";

const lemma = (
	canonicalForm: string,
	kind: string,
	coreFeatures: Record<string, unknown> = {},
	family = "Lexeme",
): Dumling.Lemma<De> =>
	({
		canonicalForm,
		coreFeatures,
		family,
		kind,
		language: "de",
		unitKind: "Lemma",
	}) as Dumling.Lemma<De>;

const noun = (canonicalForm: string, gender: "Fem" | "Masc" | "Neut") =>
	lemma(canonicalForm, "NOUN", { gender });
const verb = (canonicalForm: string) => lemma(canonicalForm, "VERB");

const shadow = (
	canonicalForm: string,
	kind: string,
	family = "Lexeme",
): Dumrel.LinkTarget =>
	({ canonicalForm, family, kind, language: "de" }) as Dumrel.LinkTarget;
const prefix = (form: string) => shadow(form, "Prefix", "Morpheme");
const suffix = (form: string) => shadow(form, "Suffix", "Morpheme");

const readingOf = (of: Dumling.Lemma<De>, emoji: string) =>
	({
		emojiDescription: emoji,
		lemma: of,
		unitKind: "Reading",
	}) as Dumling.Reading<De>;

const built = (
	of: Dumling.Lemma<De>,
	emoji: string,
	constituents: { letters: string; target?: Dumrel.LinkTarget }[],
): Formation<De> => ({
	constituents,
	reading: readingOf(of, emoji),
	via: "constituents",
});
const sourced = (of: Dumling.Lemma<De>, emoji: string): Formation<De> => ({
	reading: readingOf(of, emoji),
	via: "source",
});

const kaufen = verb("kaufen");
const kohle = noun("Kohle", "Fem");
const kraftwerk = noun("Kraftwerk", "Neut");

const recordsOf = (of: Dumling.Lemma<De>): LemmaRecords<De> => ({
	lemmaRecord: { lemma: of },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		{
			attestationLinks: [],
			attestedTranslations: [],
			notes: "",
			reading: readingOf(of, "🛒"),
		},
	],
});

/** Bare links, `[[alias]]`, so a line reads as the note shows it. */
const bare: RenderOptions<De>["paths"] = {
	lemma: () => undefined,
	reading: () => undefined,
	spelling: () => undefined,
};

const optionsWith = (
	formations: readonly Formation<De>[],
	paths: RenderOptions<De>["paths"] = bare,
): RenderOptions<De> => ({ formations: () => formations, paths });

const TITLE =
	'<span class="note_block_title note_block_title_formations">Wortbildung</span>';

/** The Formations section's lines: its title to the end of the rendering. */
function formationsSection(body: string): string[] {
	const lines = body.split("\n");
	const start = lines.indexOf(TITLE);
	if (start < 0) return [];
	const section = lines.slice(start);
	const end = section.findIndex((line, at) => at > 0 && line === "");
	return end < 0 ? section : section.slice(0, end);
}

const render = (
	of: Dumling.Lemma<De>,
	formations: readonly Formation<De>[],
	paths?: RenderOptions<De>["paths"],
) =>
	Result.getOrThrow(
		renderLemmaNote(recordsOf(of), optionsWith(formations, paths)),
	);

describe("formationGroupOf, ported from tf-demo", () => {
	it("groups by the Kind of the other pieces", () => {
		const word = { family: "Lexeme" };
		expect(
			formationGroupOf(word, [
				{ letters: "ein", target: prefix("ein-") },
				{ letters: "kaufen", target: shadow("kaufen", "VERB") },
			]),
		).toBe("Prefixed");
		expect(
			formationGroupOf(word, [
				{ letters: "Liefer", target: shadow("liefern", "VERB") },
				{ letters: "ung", target: suffix("-ung") },
			]),
		).toBe("Derivations");
		expect(
			formationGroupOf(word, [
				{ letters: "wunder", target: shadow("Wunder", "NOUN") },
				{
					letters: "bar",
					target: shadow("-bar", "Suffixoid", "Morpheme"),
				},
			]),
		).toBe("Derivations");
		// An Interfix changes nothing: words alone make a compound.
		expect(
			formationGroupOf(word, [
				{ letters: "Kohle", target: shadow("Kohle", "NOUN") },
				{ letters: "kraftwerk", target: shadow("Kraftwerk", "NOUN") },
				{ letters: "s", target: shadow("-s-", "Interfix", "Morpheme") },
			]),
		).toBe("Compounds");
		// A Prefix wins over a Suffix.
		expect(
			formationGroupOf(word, [
				{ letters: "ver", target: prefix("ver-") },
				{ letters: "kauf", target: shadow("kaufen", "VERB") },
				{ letters: "ung", target: suffix("-ung") },
			]),
		).toBe("Prefixed");
		expect(
			formationGroupOf({ family: "Locution" }, [
				{ letters: "ein", target: prefix("ein-") },
			]),
		).toBe("Phrases");
		expect(formationGroupOf({ family: "Saying" }, [])).toBe("Phrases");
	});
});

describe("the Formations section of a Lemma note", () => {
	it("lists the groups in tf-demo's order", () => {
		const body = render(kaufen, [
			sourced(noun("Kauf", "Masc"), "🛍️"),
			built(verb("verkaufen"), "💰", [
				{ letters: "ver", target: prefix("ver-") },
				{ letters: "kaufen", target: kaufen },
			]),
			built(lemma("auf Pump kaufen", "VERB", {}, "Locution"), "💳", [
				{ letters: "auf", target: shadow("auf", "ADP") },
				{ letters: " " },
				{ letters: "Pump", target: shadow("Pump", "NOUN") },
				{ letters: " " },
				{ letters: "kaufen", target: kaufen },
			]),
			built(noun("Kaufhaus", "Neut"), "🏬", [
				{ letters: "Kauf", target: kaufen },
				{ letters: "haus", target: shadow("Haus", "NOUN") },
			]),
			built(verb("einkaufen"), "🛒", [
				{ letters: "ein", target: prefix("ein-") },
				{ letters: "kaufen", target: kaufen },
			]),
			built(noun("Käufer", "Masc"), "🧑", [
				{ letters: "Käuf", target: kaufen },
				{ letters: "er", target: suffix("-er") },
			]),
			built(verb("abkaufen"), "🤝", [
				{ letters: "ab", target: prefix("ab-") },
				{ letters: "kaufen", target: kaufen },
			]),
			built(lemma("käuflich", "ADJ"), "🏷️", [
				{ letters: "käuf", target: kaufen },
				{ letters: "lich", target: suffix("-lich") },
			]),
		]);
		expect(formationsSection(body)).toEqual([
			TITLE,
			"Präfixverben: [[abkaufen]], [[einkaufen]], [[verkaufen]]",
			"Komposita: [[Kaufhaus]]",
			"Ableitungen: [[Käufer]], [[käuflich]]",
			"Grundform von: [[Kauf]]",
			"Wendungen: [[auf Pump kaufen]]",
		]);
	});

	it("sorts each group as German sorts, an umlaut with its vowel", () => {
		const oel = noun("Öl", "Neut");
		const compound = (form: string, head: string) =>
			built(noun(form, "Neut"), "🛢️", [
				{ letters: head, target: oel },
				{
					letters: form.slice(head.length),
					target: shadow("X", "NOUN"),
				},
			]);
		const body = render(oel, [
			compound("Öltank", "Öl"),
			compound("Palmöl", "Palm"),
			compound("Olivenöl", "Oliven"),
		]);
		expect(formationsSection(body)).toEqual([
			TITLE,
			"Komposita: [[Olivenöl]], [[Öltank]], [[Palmöl]]",
		]);
	});

	it("labels prefixed words that are not all verbs", () => {
		const body = render(kaufen, [
			built(noun("Einkauf", "Masc"), "🛒", [
				{ letters: "Ein", target: prefix("ein-") },
				{ letters: "kauf", target: kaufen },
			]),
			built(verb("einkaufen"), "🛒", [
				{ letters: "ein", target: prefix("ein-") },
				{ letters: "kaufen", target: kaufen },
			]),
		]);
		expect(formationsSection(body)).toEqual([
			TITLE,
			"Präfixbildungen: [[Einkauf]], [[einkaufen]]",
		]);
	});

	it("links each formation's Reading note, its sense known", () => {
		const kohlekraftwerk = noun("Kohlekraftwerk", "Neut");
		const body = render(
			kohle,
			[
				built(kohlekraftwerk, "🏭", [
					{ letters: "Kohle", target: kohle },
					{ letters: "kraftwerk", target: kraftwerk },
				]),
			],
			{},
		);
		expect(formationsSection(body)).toEqual([
			TITLE,
			"Komposita: [[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/🏭 Kohlekraftwerk|Kohlekraftwerk]]",
		]);
	});

	it("tells two Readings shown alike apart by their emoji, and lists a Reading once", () => {
		const zugkraft = noun("Zugkraft", "Fem");
		const kraft = noun("Kraft", "Fem");
		const pieces = [
			{ letters: "Zug", target: shadow("Zug", "NOUN") },
			{ letters: "kraft", target: kraft },
		];
		const body = render(kraft, [
			built(zugkraft, "🚂", pieces),
			built(zugkraft, "🧲", pieces),
			sourced(zugkraft, "🧲"),
		]);
		expect(formationsSection(body)).toEqual([
			TITLE,
			"Komposita: [[Zugkraft 🚂]], [[Zugkraft 🧲]]",
		]);
	});

	it(`lists at most ${MAX_FORMATIONS}, and folds the rest`, () => {
		const name = (at: number) =>
			`Z${String.fromCharCode(97 + Math.floor(at / 26))}${String.fromCharCode(97 + (at % 26))}kohle`;
		const compounds = Array.from({ length: MAX_FORMATIONS - 1 }, (_, at) =>
			built(noun(name(at), "Fem"), "🪨", [
				{ letters: name(at).slice(0, 3), target: shadow("Z", "NOUN") },
				{ letters: "kohle", target: kohle },
			]),
		);
		const body = render(kohle, [
			...compounds,
			built(noun("Kohlenstoffverbindung", "Fem"), "🧪", [
				{ letters: "Kohlenstoff", target: kohle },
				{ letters: "verbind", target: shadow("verbinden", "VERB") },
				{ letters: "ung", target: suffix("-ung") },
			]),
			built(noun("Verkohlung", "Fem"), "🔥", [
				{ letters: "Verkohl", target: kohle },
				{ letters: "ung", target: suffix("-ung") },
			]),
			sourced(verb("kohlen"), "🔥"),
		]);
		const [, komposita, ableitungen, grundform] = formationsSection(body);
		expect(komposita?.split(", ")).toHaveLength(MAX_FORMATIONS - 1);
		expect(ableitungen).toBe(
			"Ableitungen: [[Kohlenstoffverbindung]] … 1 weitere",
		);
		expect(grundform).toBe("Grundform von: … 1 weitere");
	});

	it("stands after the Surface list, and a note without Formations shows none", () => {
		const records: LemmaRecords<De> = {
			...recordsOf(kohle),
			ownedSurfaceEntries: [
				{
					attestations: [],
					attestedTranslations: [],
					id: "s1",
					notes: "",
					ownerLemma: kohle,
					surface: {
						language: "de",
						lemma: kohle,
						normalizedSurface: "Kohlen",
						surfaceFeatures: null,
						unitKind: "Surface",
					},
				} as unknown as LemmaRecords<De>["ownedSurfaceEntries"][number],
			],
		};
		const formations = [sourced(verb("kohlen"), "🔥")];
		const body = Result.getOrThrow(
			renderLemmaNote(records, optionsWith(formations)),
		);
		const lines = body.split("\n");
		expect(lines.indexOf(TITLE)).toBeGreaterThan(
			lines.findIndex((line) => line.startsWith("- Kohlen")),
		);
		expect(lines.at(lines.indexOf(TITLE) - 1)).toBe("");
		expect(
			Result.getOrThrow(renderLemmaNote(records, { paths: bare })),
		).not.toContain("Wortbildung");
	});
});

describe("render, parse and render again", () => {
	const formations = [
		built(noun("Kohlekraftwerk", "Neut"), "🏭", [
			{ letters: "Kohle", target: kohle },
			{ letters: "kraftwerk", target: kraftwerk },
		]),
		sourced(verb("kohlen"), "🔥"),
	];

	it("is byte-stable, and reads no line of the section as data or freeform", () => {
		const options = optionsWith(formations, {});
		const first = Result.getOrThrow(
			serializeLemmaNote(recordsOf(kohle), options),
		);
		const parsed = parseLemma(first);
		expect(freeformTexts(parsed)).toEqual([]);
		const again = Result.getOrThrow(
			serializeLemmaNote(recordsOf(kohle), {
				...options,
				previous: parsed.document,
			}),
		);
		expect(again).toEqual(first);
	});

	it("replaces the section when the Formations change, and keeps a line the user edited as freeform", () => {
		const first = Result.getOrThrow(
			serializeLemmaNote(recordsOf(kohle), optionsWith(formations)),
		);
		const edited = first.body.replace(
			"Grundform von: [[kohlen]]",
			"Grundform von: [[kohlen]] (my note)",
		);
		const parsed = parseLemma({ ...first, body: edited });
		const next = Result.getOrThrow(
			serializeLemmaNote(recordsOf(kohle), {
				...optionsWith(formations.slice(0, 1)),
				previous: parsed.document,
			}),
		);
		expect(formationsSection(next.body)).toEqual([
			TITLE,
			"Komposita: [[Kohlekraftwerk]]",
		]);
		expect(next.body.trimEnd().split("\n").at(-1)).toBe(
			"Grundform von: [[kohlen]] (my note)",
		);
	});
});
