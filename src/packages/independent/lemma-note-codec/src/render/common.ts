import type * as Dumling from "dumling/types";
import { type projectSemanticRelations, translationText } from "dumrel";
import type * as Dumrel from "dumrel/types";
import { Predicate } from "effect";
import type { LinkRenderer } from "../links";

/**
 * Renderings shared by both note kinds, in the user's dictionary layout
 * (spec: Layout; #103, #104). Visible text is never parsed.
 */

/**
 * A visible section: a title line, as the dictionary notes wrote it, over
 * the renderings of its Blocks.
 */
export type SectionKind =
	| "kontexte"
	| "note"
	| "synonyme"
	| "morpheme"
	| "translations"
	| "definition"
	| "valenz"
	| "art"
	| "flexion"
	| "tags"
	| "surfaces"
	| "formations";

/** The dictionary notes' German section titles, and titles for the new ones. */
export const DEFAULT_TITLES: Readonly<Record<SectionKind, string>> = {
	art: "Art",
	definition: "Definition",
	flexion: "Flexion",
	formations: "Wortbildung",
	kontexte: "Deine Kontexte",
	morpheme: "Morpheme",
	note: "Note",
	surfaces: "Begegnete Formen",
	synonyme: "Semantische Beziehungen",
	tags: "Tags",
	translations: "Übersetzung",
	valenz: "Valenz",
};

/**
 * Each section's title class suffix (`note_block_title_<suffix>`,
 * styles.css). The dictionary notes styled the Note title as Kontexte.
 */
const SECTION_CLASSES: Readonly<Record<SectionKind, string>> = {
	art: "art",
	definition: "definition",
	flexion: "flexion",
	formations: "formations",
	kontexte: "kontexte",
	morpheme: "morpheme",
	note: "kontexte",
	surfaces: "surfaces",
	synonyme: "synonyme",
	tags: "tags",
	translations: "translations",
	valenz: "valenz",
};

const HTML_ESCAPES: Readonly<Record<string, string>> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
};

/** The class every section's title line has. */
export const SECTION_TITLE_CLASS = "note_block_title";

/** The class that tells `kind`'s title line from the others'. */
export const sectionTitleClass = (kind: SectionKind): string =>
	`${SECTION_TITLE_CLASS}_${SECTION_CLASSES[kind]}`;

/**
 * A section's title line, `<span class="note_block_title …">…</span>`, or
 * none for an empty title.
 */
export function sectionTitle(
	kind: SectionKind,
	titles: Readonly<Record<SectionKind, string>>,
): string[] {
	const title = titles[kind].replace(/\s+/gu, " ").trim();
	if (title.length === 0) return [];
	const text = title.replace(/[&<>]/gu, (char) => HTML_ESCAPES[char] ?? char);
	return [
		`<span class="${SECTION_TITLE_CLASS} ${sectionTitleClass(kind)}">${text}</span>`,
	];
}

/** One edge dumrel's `projectSemanticRelations` returns. */
export type SemanticRelationProjection = Extract<
	ReturnType<typeof projectSemanticRelations>,
	{ success: true }
>["value"][number];

const field = (value: unknown, key: string): unknown =>
	Predicate.isObject(value)
		? (value as Record<string, unknown>)[key]
		: undefined;
const list = (value: unknown): readonly unknown[] =>
	Array.isArray(value) ? value : [];
export const text = (value: unknown): string =>
	Predicate.isString(value) ? value : JSON.stringify(value);

/**
 * The legacy notes' relation symbols: `⊃ [[Zeitraum]]` reads "Zeitraum is
 * a hypernym". dumrel's Near Antonym, Endonym and Exonym had none in the
 * legacy notes.
 */
const RELATION_SYMBOLS: Readonly<Record<string, string>> = {
	antonym: "≠",
	endonym: "⇒",
	exonym: "⇐",
	holonym: "∋",
	hypernym: "⊃",
	hyponym: "⊂",
	meronym: "∈",
	nearAntonym: "≉",
	nearSynonym: "≈",
	synonym: "=",
};

/** The order relation lines show in, as the legacy notes wrote them. */
const RELATION_ORDER: readonly string[] = [
	"synonym",
	"nearSynonym",
	"antonym",
	"nearAntonym",
	"hypernym",
	"hyponym",
	"holonym",
	"meronym",
	"endonym",
	"exonym",
];

const relationRank = (relation: string) => {
	const rank = RELATION_ORDER.indexOf(relation);
	return rank === -1 ? RELATION_ORDER.length : rank;
};

/** Relations to their rendered links, in first-seen order. */
export type RelationLinks = readonly (readonly [string, readonly string[]])[];

/**
 * One line per relation, `= [[a]], [[b]]`, in the symbols' order, each link
 * once and in first-seen order. `already` holds the links earlier lines of
 * the same section showed, so direct, pending and projected relations read
 * as one list with each target once.
 */
export function relationLines(
	entries: RelationLinks,
	already: Set<string> = new Set(),
): string[] {
	const byRelation = new Map<string, string[]>();
	for (const [relation, targets] of entries)
		byRelation.set(relation, [
			...(byRelation.get(relation) ?? []),
			...targets,
		]);
	return [...byRelation]
		.sort(([a], [b]) => relationRank(a) - relationRank(b))
		.flatMap(([relation, targets]) => {
			const fresh = [...new Set(targets)].filter(
				(target) => !already.has(`${relation}\u0000${target}`),
			);
			for (const target of fresh)
				already.add(`${relation}\u0000${target}`);
			return fresh.length === 0
				? []
				: [
						`${RELATION_SYMBOLS[relation] ?? `${relation}:`} ${fresh.join(", ")}`,
					];
		});
}

/** A direct claim's targets as links: Lemmas, or exact Readings. */
export function claimLinks<L extends Dumling.Language>(
	relations: unknown,
	link: LinkRenderer<L>,
): RelationLinks {
	if (!Predicate.isObject(relations)) return [];
	const byReading = field(relations, "targetKind") === "reading";
	return Object.entries(relations)
		.filter(([relation]) => relation !== "targetKind")
		.map(([relation, targets]) => [
			relation,
			list(targets).map((target) =>
				link({
					names: byReading
						? {
								kind: "Reading",
								reading: target as Dumling.Reading<L>,
							}
						: { kind: "Lemma", lemma: target as Dumling.Lemma<L> },
					role: "relation",
				}),
			),
		]);
}

/**
 * A lexical reflexive Slot (texteater ADR 0052): `sich`, its case named
 * only when Dat, as Duden writes `sich (Dativ) etwas vorstellen` and as
 * tf-demo's Valency Line does, and inside a fixed phrase after the
 * preposition it follows: `[[außer]] sich (Dat)`.
 */
function reflexive<L extends Dumling.Language>(
	value: unknown,
	link: LinkRenderer<L>,
): string {
	const governedCase = field(value, "governedCase");
	const sich = governedCase === "Dat" ? "sich (Dat)" : "sich";
	const preposition = field(value, "preposition");
	return preposition === undefined
		? sich
		: `${link({ names: { kind: "Lemma", lemma: preposition as Dumling.Lemma<L> }, role: "valency" })} ${sich}`;
}

function complement<L extends Dumling.Language>(
	value: unknown,
	link: LinkRenderer<L>,
): string {
	switch (field(value, "kind")) {
		case "Case":
			return text(field(value, "governedCase"));
		case "Preposition":
			return `${link({ names: { kind: "Lemma", lemma: field(value, "preposition") as Dumling.Lemma<L> }, role: "valency" })} + ${text(field(value, "governedCase"))}`;
		case "Adverbial":
			return text(field(value, "standIn"));
		case "Predicative":
			return `${text(field(value, "of"))} ${text(field(value, "marker"))}`;
		case "Clause":
			return text(field(value, "form"));
		case "Reflexive":
			return reflexive(value, link);
		default:
			return text(value);
	}
}

/** A Valency Frame, one line per slot. */
export function valencyLines<L extends Dumling.Language>(
	frame: unknown,
	link: LinkRenderer<L>,
): string[] {
	return list(frame).map(
		(slot, index) =>
			`${index + 1}. ${text(field(slot, "status"))}: ${list(
				field(slot, "complements"),
			)
				.map((value) => complement(value, link))
				.join(" | ")}`,
	);
}

/** A Saying's type and attribution. */
export function sayingTypeLine(value: unknown): string {
	const attribution = field(value, "attribution");
	return `${text(field(value, "type"))}${attribution === undefined ? "" : ` (${text(attribution)})`}`;
}

/**
 * Translations: each one's text, its pieces joined (texteater ADR 0055),
 * prefixed by the language only when there are several.
 */
export function translationLines(
	translations: Partial<
		Record<Dumrel.TranslationLanguage, readonly Dumrel.Translation[]>
	> = {},
): string[] {
	const languages = Object.entries(translations);
	return languages.map(([language, equivalents]) => {
		const joined = (equivalents ?? []).map(translationText).join(", ");
		return languages.length === 1 ? joined : `${language}: ${joined}`;
	});
}

const ARTICLES: Readonly<Record<string, string>> = {
	Fem: "die",
	Masc: "der",
	Neut: "das",
};

/** A German noun's article from its Core gender, if it has one. */
export function articleOf(lemma: Dumling.Lemma): string | undefined {
	if (lemma.language !== "de" || lemma.kind !== "NOUN") return undefined;
	const gender = field(lemma.coreFeatures, "gender");
	if (Predicate.isString(gender)) return ARTICLES[gender];
	const mixed = list(field(gender, "mixed"))
		.map((member) => ARTICLES[text(member)])
		.filter(Predicate.isNotUndefined);
	return mixed.length > 0 ? mixed.join("/") : undefined;
}

/** YouGlish's name for each dumling language. */
const YOUGLISH_LANGUAGES: Readonly<Record<string, string>> = {
	de: "german",
	en: "english",
	he: "hebrew",
};

/**
 * A transcription as the dictionary header showed it: `[taːk ♫](youglish)`,
 * a link to hear the word spoken, or `/taːk/` for a language YouGlish lacks.
 */
export function pronunciation(
	lemma: Dumling.Lemma,
	transcription: string,
): string {
	const language = YOUGLISH_LANGUAGES[lemma.language];
	if (language === undefined) return `/${transcription}/`;
	const label = transcription.replace(/[[\]\\]/gu, "\\$&");
	return `[${label} ♫](https://youglish.com/pronounce/${encodeURIComponent(lemma.canonicalForm)}/${language})`;
}

/** The Emoji Description of a Reading, if it has one. */
export function emojiOf(reading: Dumling.Reading): string | undefined {
	return "emojiDescription" in reading
		? (reading.emojiDescription as string)
		: undefined;
}
