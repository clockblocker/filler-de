import type { ReadingEntry, SurfaceEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import type { projectSemanticRelations } from "dumrel";
import type * as Dumrel from "dumrel/types";
import { readingBlockId } from "./block-ids";
import type { TypedBlockKind } from "./blocks";
import { legacyLemmaNotePath, shadowNotePath } from "./path/legacy-note-path";

/**
 * Renders a wikilink to a Lemma, Reading or Shadow note. The default links
 * German targets by path, to the Reading's Block (ADR 0012, 0013), and
 * other languages by bare Canonical Form. It shows the Canonical Form alone,
 * as the legacy notes did, so a link reads `Kohle`, never its path.
 */
export type LinkRenderer = {
	readonly lemma: (lemma: Dumling.Lemma) => string;
	readonly reading: (reading: Dumling.Reading) => string;
	readonly shadow: (shadow: Dumrel.UnitShadow) => string;
};

/** One edge dumrel's `projectSemanticRelations` returns. */
export type SemanticRelationProjection = Extract<
	ReturnType<typeof projectSemanticRelations>,
	{ success: true }
>["value"][number];

/** What a Reading part's projections are rendered from. */
export type ReadingProjectionContext<L extends Dumling.Language> = {
	readonly lemma: Dumling.Lemma<L>;
	readonly entry: ReadingEntry<L>;
	readonly blockId: string;
	readonly ownedSurfaces: readonly SurfaceEntry<L>[];
	readonly links: LinkRenderer;
};

/**
 * The caller-supplied inputs of projection Blocks. The codec is pure: it
 * derives nothing beyond the note itself, so a Block whose input is absent
 * is left out.
 */
export type Projections<L extends Dumling.Language> = {
	/** Replaces the default header line; the codec appends the Block ID. */
	readonly header?: (context: ReadingProjectionContext<L>) => string;
	/**
	 * Inverse and inferred edges for one Reading, as dumrel's
	 * `projectSemanticRelations` returns them with this Reading as `source`
	 * (#59). The codec renders each `target` grouped by `relation`.
	 */
	readonly inverseRelations?: (
		context: ReadingProjectionContext<L>,
	) => readonly SemanticRelationProjection[] | undefined;
	/** The inflection table as Markdown, derived by the caller (#75). */
	readonly inflection?: (
		context: ReadingProjectionContext<L>,
	) => string | undefined;
	/** Tag names without `#`, derived by the caller (#75). */
	readonly tags?: (
		context: ReadingProjectionContext<L>,
	) => readonly string[] | undefined;
	readonly links?: Partial<LinkRenderer>;
	/** Visible section titles. They are cosmetic and never parsed. */
	readonly titles?: Partial<Record<SectionKind, string>>;
};

/**
 * A visible section of a part: a title line, as the dictionary notes wrote
 * it, over the renderings of its Blocks.
 */
export type SectionKind =
	| "kontexte"
	| "note"
	| "synonyme"
	| "morpheme"
	| "translations"
	| "definition"
	| "valenz"
	| "partizip"
	| "art"
	| "flexion"
	| "tags";

/** The dictionary notes' German section titles, and titles for the new ones. */
export const DEFAULT_TITLES: Readonly<Record<SectionKind, string>> = {
	art: "Art",
	definition: "Definition",
	flexion: "Flexion",
	kontexte: "Deine Kontexte",
	morpheme: "Morpheme",
	note: "Note",
	partizip: "Partizip von",
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
	kontexte: "kontexte",
	morpheme: "morpheme",
	note: "kontexte",
	partizip: "partizip",
	synonyme: "synonyme",
	tags: "tags",
	translations: "translations",
	valenz: "valenz",
};

/**
 * What a Reading part's Note section shows while the user has written
 * nothing there. It is a projection, never freeform, and serialize drops a
 * freeform Block that holds nothing else.
 */
export const NOTE_PLACEHOLDER = "*You can write here*";

/**
 * Where each typed Block shows. `head` Blocks stand with the part's marker
 * and its header or surface line; those other than `header` and `surface`
 * hold data only and render nothing, as the dictionary notes showed it: the
 * transcription in the header, the inflection classes and principal parts
 * in the Flexion table. Blocks of one section stand together in canonical
 * order, and the first one with a rendering carries the section's title.
 */
export const BLOCK_SECTIONS: Readonly<
	Record<TypedBlockKind, SectionKind | "head">
> = {
	attestation: "kontexte",
	attested_translation: "translations",
	conjugation_class: "head",
	definition: "definition",
	formula_role: "art",
	header: "head",
	identity: "head",
	inflection: "flexion",
	inverse_relation: "synonyme",
	locution_type: "art",
	morphology: "morpheme",
	notes: "note",
	notes_placeholder: "note",
	notes_title: "note",
	participle_source: "partizip",
	past_participle: "head",
	pending_relation: "synonyme",
	plural: "head",
	present_singular: "head",
	preterite: "head",
	reading: "head",
	relation: "synonyme",
	saying_type: "art",
	subjunctive_past: "head",
	surface: "head",
	tags: "tags",
	transcription: "head",
	translation: "translations",
	valency: "valenz",
};

const HTML_ESCAPES: Readonly<Record<string, string>> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
};

/** A section's title line: `<span class="note_block_title …">…</span>`. */
export function sectionTitle(kind: SectionKind, title: string): string {
	const text = title.replace(/[&<>]/gu, (char) => HTML_ESCAPES[char] ?? char);
	return `<span class="note_block_title note_block_title_${SECTION_CLASSES[kind]}">${text}</span>`;
}

/**
 * The lines that open every part after the first, as the dictionary notes
 * separated their entries. `***`, unlike `---`, never turns the line above
 * it into a heading.
 */
export const PART_SEPARATOR = "***\n***";

function bare(canonicalForm: string): string {
	return `[[${canonicalForm}]]`;
}

function withoutExtension(path: string): string {
	return path.replace(/\.md$/u, "");
}

/** Path-qualified links for German, bare ones where no path exists. */
export const DEFAULT_LINKS: LinkRenderer = {
	lemma(lemma) {
		if (lemma.language !== "de") return bare(lemma.canonicalForm);
		try {
			return `[[${withoutExtension(legacyLemmaNotePath(lemma as Dumling.Lemma<"de">).path)}|${lemma.canonicalForm}]]`;
		} catch {
			return bare(lemma.canonicalForm);
		}
	},
	reading(reading) {
		const { lemma } = reading;
		if (lemma.language !== "de") return bare(lemma.canonicalForm);
		try {
			const path = withoutExtension(
				legacyLemmaNotePath(lemma as Dumling.Lemma<"de">).path,
			);
			return `[[${path}#^${readingBlockId(reading)}|${lemma.canonicalForm}]]`;
		} catch {
			return bare(lemma.canonicalForm);
		}
	},
	shadow(shadow) {
		if (shadow.language !== "de") return bare(shadow.canonicalForm);
		try {
			const path = shadowNotePath(
				shadow as Extract<Dumrel.UnitShadow, { language: "de" }>,
			).path;
			return `[[${withoutExtension(path)}|${shadow.canonicalForm}]]`;
		} catch {
			return bare(shadow.canonicalForm);
		}
	},
};

/**
 * Keeps a rendering inside its Block: `%%` would open an Obsidian comment,
 * or a marker, in visible text. Blank lines go, unless `paragraphs` keeps
 * one between two lines that had any; the seal holds a rendering's blank
 * lines, but a blank line before its first line would end it there.
 */
export function sanitizeRendering(text: string, paragraphs = false): string {
	const lines: string[] = [];
	let gap = false;
	for (const line of text.split(/\r\n?|\n/u)) {
		if (line.trim().length === 0) {
			gap = paragraphs && lines.length > 0;
			continue;
		}
		if (gap) lines.push("");
		gap = false;
		lines.push(line.replace(/%(?=%)/gu, "%\u200B"));
	}
	return lines.join("\n");
}

/** Blocks whose renderings keep a blank line between paragraphs. */
export const PARAGRAPH_KINDS: ReadonlySet<TypedBlockKind> = new Set([
	"attestation",
]);

type Renderer = (value: unknown, links: LinkRenderer) => string | undefined;

const list = (value: unknown): readonly unknown[] =>
	Array.isArray(value) ? value : [];
const field = (value: unknown, key: string): unknown =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)[key]
		: undefined;
const text = (value: unknown): string =>
	typeof value === "string" ? value : JSON.stringify(value);

/** Each value once, in first-seen order. */
const distinct = (values: readonly string[]): string[] => [...new Set(values)];

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

/** A relation's place among the lines; unknown relations come last. */
const relationRank = (relation: string) => {
	const rank = RELATION_ORDER.indexOf(relation);
	return rank === -1 ? RELATION_ORDER.length : rank;
};

/**
 * One line per relation, `= [[a]], [[b]]`, in the symbols' order, each
 * link once and in first-seen order.
 */
function relationLines(
	entries: readonly (readonly [string, readonly string[]])[],
): string {
	const byRelation = new Map<string, string[]>();
	for (const [relation, targets] of entries)
		byRelation.set(relation, [
			...(byRelation.get(relation) ?? []),
			...targets,
		]);
	return [...byRelation]
		.filter(([, targets]) => targets.length > 0)
		.sort(([a], [b]) => relationRank(a) - relationRank(b))
		.map(
			([relation, targets]) =>
				`${RELATION_SYMBOLS[relation] ?? `${relation}:`} ${distinct(targets).join(", ")}`,
		)
		.join("\n");
}

function renderTarget(target: unknown, links: LinkRenderer): string {
	if (field(target, "unitKind") === "Reading")
		return links.reading(target as Dumling.Reading);
	if (field(target, "unitKind") === "Lemma")
		return links.lemma(target as Dumling.Lemma);
	return links.shadow(target as Dumrel.UnitShadow);
}

/** A morphological tree's leaves, in order, as the legacy notes listed them. */
function morphLeaves(node: unknown, links: LinkRenderer): string[] {
	switch (field(node, "nodeKind")) {
		case "morphemeReading":
			return [links.reading(field(node, "reading") as Dumling.Reading)];
		case "unitShadow":
			return [
				links.shadow(field(node, "unitShadow") as Dumrel.UnitShadow),
			];
		default:
			return list(field(node, "children")).flatMap((child) =>
				morphLeaves(child, links),
			);
	}
}

function renderComplement(complement: unknown, links: LinkRenderer): string {
	switch (field(complement, "kind")) {
		case "Case":
			return text(field(complement, "governedCase"));
		case "Preposition":
			return `${links.lemma(field(complement, "preposition") as Dumling.Lemma)} + ${text(field(complement, "governedCase"))}`;
		case "Adverbial":
			return text(field(complement, "standIn"));
		case "Predicative":
			return `${text(field(complement, "of"))} ${text(field(complement, "marker"))}`;
		case "Clause":
			return text(field(complement, "form"));
		default:
			return text(complement);
	}
}

/**
 * Visible renderings of serialized Blocks, derived from their payloads. A
 * kind with none, such as `plural`, keeps its payload out of sight.
 */
export const RENDERERS: Partial<Record<TypedBlockKind, Renderer>> = {
	// A blank line between embeds, as the dictionary notes spaced them.
	attestation: (value) => list(value).map(text).join("\n\n"),
	attested_translation: (value) => {
		const words = list(value).map(text);
		return words.length === 0 ? undefined : `*${words.join(", ")}*`;
	},
	definition: text,
	formula_role: text,
	locution_type: text,
	morphology: (value, links) =>
		morphLeaves(field(value, "root"), links).join("|"),
	notes: text,
	participle_source: (value, links) =>
		`${links.lemma(field(value, "verb") as Dumling.Lemma)} (${text(field(value, "meaning"))})`,
	pending_relation: (value, links) =>
		relationLines(
			list(value).map((pending) => [
				text(field(pending, "relation")),
				[links.shadow(field(pending, "target") as Dumrel.UnitShadow)],
			]),
		),
	relation: (value, links) =>
		relationLines(
			Object.entries(value as Record<string, unknown>)
				.filter(([relation]) => relation !== "targetKind")
				.map(([relation, targets]) => [
					relation,
					list(targets).map((target) => renderTarget(target, links)),
				]),
		),
	saying_type: (value) => {
		const attribution = field(value, "attribution");
		return `${text(field(value, "type"))}${attribution === undefined ? "" : ` (${text(attribution)})`}`;
	},
	translation: (value) => {
		const languages = Object.entries(value as Record<string, unknown>);
		return languages
			.map(([language, words]) => {
				const joined = list(words).map(text).join(", ");
				return languages.length === 1
					? joined
					: `${language}: ${joined}`;
			})
			.join("\n");
	},
	valency: (value, links) =>
		list(value)
			.map(
				(slot, index) =>
					`${index + 1}. ${text(field(slot, "status"))}: ${list(
						field(slot, "complements"),
					)
						.map((complement) =>
							renderComplement(complement, links),
						)
						.join(" | ")}`,
			)
			.join("\n"),
};

const ARTICLES: Readonly<Record<string, string>> = {
	Fem: "die",
	Masc: "der",
	Neut: "das",
};

/** A German noun's article from its Core gender, if it has one. */
function articleOf(lemma: Dumling.Lemma): string | undefined {
	if (lemma.language !== "de" || lemma.kind !== "NOUN") return undefined;
	const gender = field(lemma.coreFeatures, "gender");
	if (typeof gender === "string") return ARTICLES[gender];
	const mixed = list(field(gender, "mixed"))
		.map((member) => ARTICLES[text(member)])
		.filter((article) => article !== undefined);
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
function pronunciation(lemma: Dumling.Lemma, transcription: string): string {
	const language = YOUGLISH_LANGUAGES[lemma.language];
	if (language === undefined) return `/${transcription}/`;
	const label = transcription.replace(/[[\]\\]/gu, "\\$&");
	return `[${label} ♫](https://youglish.com/pronounce/${encodeURIComponent(lemma.canonicalForm)}/${language})`;
}

/**
 * The dictionary header: `🏭 das [[Kohlekraftwerk]], [ˈkoːlə… ♫](youglish)`, the
 * Emoji Description, a noun's article, a link to the note itself and the
 * transcription.
 */
export function defaultHeader<L extends Dumling.Language>({
	entry,
	lemma,
	links,
}: ReadingProjectionContext<L>): string {
	const article = articleOf(lemma);
	const name = `${article === undefined ? "" : `${article} `}${links.lemma(lemma)}`;
	const { reading } = entry;
	const emoji =
		"emojiDescription" in reading ? reading.emojiDescription : undefined;
	const transcription = entry.knowledge?.transcription;
	const headword =
		transcription === undefined
			? name
			: `${name}, ${pronunciation(lemma, transcription)}`;
	return emoji === undefined ? headword : `${emoji} ${headword}`;
}

/** Inverse relation edges as symbol lines, grouped by relation. */
export function renderInverseRelations(
	projections: readonly SemanticRelationProjection[],
	links: LinkRenderer,
): string {
	return relationLines(
		projections.map(({ relation, target }) => [
			relation,
			[renderTarget(target, links)],
		]),
	);
}
