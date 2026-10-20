import type { ReadingEntry, SurfaceEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import type { projectSemanticRelations } from "dumrel";
import type * as Dumrel from "dumrel/types";
import { readingBlockId } from "./block-ids";
import type { TypedBlockKind } from "./blocks";
import { lemmaNotePath, shadowNotePath } from "./path/note-path";

/**
 * Renders a wikilink to a Lemma, Reading or Shadow note. The default links
 * German targets by path, to the Reading's Block (ADR 0012, 0013), and
 * other languages by bare Canonical Form.
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
	/** Visible Block titles. They are cosmetic and never parsed. */
	readonly labels?: Partial<Record<TypedBlockKind, string>>;
};

export const DEFAULT_LABELS: Readonly<Record<TypedBlockKind, string>> = {
	attestation: "Attestations",
	attested_translation: "Attested",
	conjugation_class: "Conjugation",
	definition: "Definition",
	formula_role: "Formula",
	header: "",
	identity: "",
	inflection: "Inflection",
	inverse_relation: "Projected",
	locution_type: "Locution",
	morphology: "Morphology",
	notes: "Notes",
	participle_source: "From",
	pending_relation: "Pending",
	plural: "Plural",
	preterite: "Preterite",
	reading: "",
	relation: "Relations",
	saying_type: "Saying",
	surface: "Surface",
	tags: "Tags",
	transcription: "",
	translation: "Translation",
	valency: "Valency",
};

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
			return `[[${withoutExtension(lemmaNotePath(lemma as Dumling.Lemma<"de">).path)}|${lemma.canonicalForm}]]`;
		} catch {
			return bare(lemma.canonicalForm);
		}
	},
	reading(reading) {
		const { lemma } = reading;
		const emoji =
			"emojiDescription" in reading ? ` ${reading.emojiDescription}` : "";
		if (lemma.language !== "de") return bare(lemma.canonicalForm);
		try {
			const path = withoutExtension(
				lemmaNotePath(lemma as Dumling.Lemma<"de">).path,
			);
			return `[[${path}#^${readingBlockId(reading)}|${lemma.canonicalForm}${emoji}]]`;
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
 * Keeps a rendering inside its Block: blank lines would end the Block, and
 * `%%` would open an Obsidian comment, or a marker, in visible text.
 */
export function sanitizeRendering(text: string): string {
	return text
		.split(/\r\n?|\n/u)
		.filter((line) => line.trim().length > 0)
		.map((line) => line.replace(/%(?=%)/gu, "%\u200B"))
		.join("\n");
}

type Renderer = (value: unknown, links: LinkRenderer) => string | undefined;

const list = (value: unknown): readonly unknown[] =>
	Array.isArray(value) ? value : [];
const field = (value: unknown, key: string): unknown =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)[key]
		: undefined;
const text = (value: unknown): string =>
	typeof value === "string" ? value : JSON.stringify(value);

function renderTarget(target: unknown, links: LinkRenderer): string {
	if (field(target, "unitKind") === "Reading")
		return links.reading(target as Dumling.Reading);
	if (field(target, "unitKind") === "Lemma")
		return links.lemma(target as Dumling.Lemma);
	return links.shadow(target as Dumrel.UnitShadow);
}

function renderMorphNode(
	node: unknown,
	links: LinkRenderer,
	depth: number,
): string {
	switch (field(node, "nodeKind")) {
		case "morphemeReading":
			return links.reading(field(node, "reading") as Dumling.Reading);
		case "unitShadow":
			return links.shadow(field(node, "unitShadow") as Dumrel.UnitShadow);
		default: {
			const inner = list(field(node, "children"))
				.map((child) => renderMorphNode(child, links, depth + 1))
				.join(" + ");
			return depth === 0 ? inner : `(${inner})`;
		}
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

/** Visible renderings of serialized Blocks, derived from their payloads. */
export const RENDERERS: Partial<Record<TypedBlockKind, Renderer>> = {
	attestation: (value) => list(value).map(text).join("\n"),
	attested_translation: (value) => list(value).map(text).join(", "),
	conjugation_class: (value) => list(value).map(text).join(", "),
	definition: text,
	formula_role: text,
	locution_type: text,
	morphology: (value, links) =>
		renderMorphNode(field(value, "root"), links, 0),
	notes: text,
	participle_source: (value, links) =>
		`${links.lemma(field(value, "verb") as Dumling.Lemma)} (${text(field(value, "meaning"))})`,
	pending_relation: (value, links) =>
		list(value)
			.map(
				(pending) =>
					`${text(field(pending, "relation"))}: ${links.shadow(field(pending, "target") as Dumrel.UnitShadow)}`,
			)
			.join("\n"),
	plural: (value) =>
		Array.isArray(value) ? value.map(text).join(", ") : text(value),
	preterite: (value) => list(value).map(text).join(", "),
	relation: (value, links) =>
		Object.entries(value as Record<string, unknown>)
			.filter(([relation]) => relation !== "targetKind")
			.map(
				([relation, targets]) =>
					`${relation}: ${list(targets)
						.map((target) => renderTarget(target, links))
						.join(", ")}`,
			)
			.join("\n"),
	saying_type: (value) => {
		const attribution = field(value, "attribution");
		return `${text(field(value, "type"))}${attribution === undefined ? "" : ` (${text(attribution)})`}`;
	},
	translation: (value) =>
		Object.entries(value as Record<string, unknown>)
			.map(
				([language, words]) =>
					`${language}: ${list(words).map(text).join(", ")}`,
			)
			.join("; "),
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

export function defaultHeader<L extends Dumling.Language>({
	entry,
	lemma,
}: ReadingProjectionContext<L>): string {
	const article = articleOf(lemma);
	const name = `**${article === undefined ? "" : `${article} `}${lemma.canonicalForm}**`;
	const { reading } = entry;
	const emoji =
		"emojiDescription" in reading ? reading.emojiDescription : undefined;
	const transcription = entry.knowledge?.transcription;
	return [
		emoji,
		name,
		transcription === undefined ? undefined : `/${transcription}/`,
	]
		.filter((part) => part !== undefined)
		.join(" ");
}

export function renderInverseRelations(
	projections: readonly SemanticRelationProjection[],
	links: LinkRenderer,
): string {
	const byRelation = new Map<string, string[]>();
	for (const { relation, target } of projections) {
		byRelation.set(relation, [
			...(byRelation.get(relation) ?? []),
			renderTarget(target, links),
		]);
	}
	return [...byRelation]
		.map(([relation, targets]) => `${relation}: ${targets.join(", ")}`)
		.join("\n");
}
