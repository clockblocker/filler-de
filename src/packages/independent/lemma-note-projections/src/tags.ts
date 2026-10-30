import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { germanConjugationClass, licensed } from "dumrel";
import type * as Dumrel from "dumrel/types";

/**
 * A Reading's Tags (spec: Tags), the one projection the plugin derives
 * itself: Tags are Obsidian's, not the batteries'. Inflection tables come
 * from the batteries' Inflection Packs (#120).
 */

/**
 * What a Reading's Tags read: its Lemma, what its own Licences give it, and
 * its Valency Frame's lexical reflexive.
 */
export type TagInput = {
	readonly lemma: Dumling.Lemma;
	/**
	 * The Reading's Reflexive Slot (texteater ADR 0052): its case, or null
	 * for a reflexive that names none, as English's does.
	 */
	readonly reflexive?: { readonly governedCase: "Acc" | "Dat" | null };
	/** The conjugation class of each Präteritum variant the Reading licenses. */
	readonly conjugationClasses?: readonly Dumrel.ConjugationClass[];
	/** The plural marker the Reading licenses instead of a plural form. */
	readonly pluralMarker?: "NoPlural" | "PluralOnly";
};

const KIND_SLUGS: Readonly<Record<string, string>> = {
	ADJ: "adjective",
	ADP: "adposition",
	ADV: "adverb",
	AUX: "auxiliary",
	CCONJ: "coordinating-conjunction",
	DET: "determiner",
	INTJ: "interjection",
	NOUN: "noun",
	NUM: "numeral",
	PART: "particle",
	PRON: "pronoun",
	PROPN: "proper-noun",
	PUNCT: "punctuation",
	SCONJ: "subordinating-conjunction",
	SYM: "symbol",
	X: "other",
};

/** Readable tag parts for Core Feature values, by feature. */
const VALUE_SLUGS: Readonly<Record<string, Readonly<Record<string, string>>>> =
	{
		article: { Definite: "with-article" },
		case: {
			Acc: "accusative",
			Dat: "dative",
			Gen: "genitive",
			Nom: "nominative",
		},
		comparable: { Yes: "comparable" },
		gender: { Fem: "feminine", Masc: "masculine", Neut: "neuter" },
		number: { Plur: "plural", Sing: "singular" },
		person: { 1: "person-1", 2: "person-2", 3: "person-3" },
		polite: { Form: "polite" },
		poss: { Yes: "possessive" },
		pronType: {
			Art: "article",
			Dem: "demonstrative",
			Ind: "indefinite",
			Int: "interrogative",
			Neg: "negative",
			Prs: "personal",
			Rcp: "reciprocal",
			Rel: "relative",
			Tot: "total",
		},
	};

const CLASS_SLUGS: Readonly<Record<string, string>> = {
	Mixed: "mixed",
	Strong: "strong",
	Weak: "weak",
};

/** An Obsidian tag part: lowercase letters, digits and hyphens. */
function slug(text: string): string {
	return text
		.replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
		.toLocaleLowerCase("en")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/gu, "");
}

/** `noun`, or `locution/noun` for a Family other than Lexeme. */
function routeTag(input: TagInput): string {
	const { family, kind } = input.lemma;
	const kindSlug = KIND_SLUGS[kind] ?? slug(kind);
	return family === "Lexeme" ? kindSlug : `${slug(family)}/${kindSlug}`;
}

function featureParts(feature: string, value: unknown): string[] {
	if (value === null || value === undefined) return [];
	if (feature === "hasSepPrefix")
		return typeof value === "string" ? ["separable"] : [];
	if (typeof value === "object") {
		const members = (value as { mixed?: unknown }).mixed;
		return Array.isArray(members)
			? members.flatMap((member) => featureParts(feature, member))
			: [];
	}
	const text = String(value);
	return [VALUE_SLUGS[feature]?.[text] ?? `${slug(feature)}-${slug(text)}`];
}

/**
 * A Reading's Tags, without `#`: its route, one nested tag per Core Feature
 * value (`noun/masculine`, `verb/separable`), its reflexive's case
 * (`verb/reflexive-acc`), and the inflection class its Licences give
 * (`verb/weak`, `noun/plural-only`).
 * The old `common` and `compound` tags have no dumling feature and are
 * gone. A Reading with nothing to add gets its route alone.
 */
export function deriveTags(input: TagInput): readonly string[] {
	const route = routeTag(input);
	const core: Readonly<Record<string, unknown>> = input.lemma.coreFeatures;
	const parts = Object.keys(core)
		.sort()
		.flatMap((feature) => featureParts(feature, core[feature]));
	if (input.reflexive !== undefined) {
		const { governedCase } = input.reflexive;
		parts.push(
			governedCase === null
				? "reflexive"
				: `reflexive-${governedCase.toLowerCase()}`,
		);
	}
	for (const value of input.conjugationClasses ?? [])
		parts.push(CLASS_SLUGS[value] ?? slug(value));
	if (input.pluralMarker === "NoPlural") parts.push("singular-only");
	if (input.pluralMarker === "PluralOnly") parts.push("plural-only");
	const tags = [...new Set(parts)].map((part) => `${route}/${part}`);
	return tags.length === 0 ? [route] : tags;
}

/** The values of the variants a Reading licenses in one dimension, in variant order. */
function licensedValues(
	paradigm: Dumrel.LemmaParadigm | undefined,
	dimension: Dumrel.DimensionId,
	reading: Dumling.Reading,
): string[] {
	if (paradigm === undefined) return [];
	const taken = new Set(
		licensed(paradigm, dimension, readingIdentityKey(reading)),
	);
	return (paradigm.dimensions[dimension]?.variants ?? [])
		.filter(({ id }) => taken.has(id))
		.map(({ value }) => value);
}

/**
 * The Reflexive Slot of a Valency Frame, Required or Optional, or none. A
 * Reading with no frame yet has none.
 */
function reflexiveOf(
	valency: Dumrel.ValencyFrame | undefined,
): TagInput["reflexive"] {
	for (const slot of valency ?? [])
		for (const complement of slot.complements)
			if (complement.kind === "Reflexive")
				return {
					governedCase:
						"governedCase" in complement
							? complement.governedCase
							: null,
				};
	return undefined;
}

/**
 * The Lemma note codec's `tags` hook: one Reading's Tags, from its Lemma,
 * the Paradigm Variants its own Licences take and its Knowledge's Valency
 * Frame. Each Präteritum variant gives its conjugation class (`fuhr`:
 * Strong), a licensed `NoPlural` or `PluralOnly` its plural class, and a
 * Reflexive Slot its case.
 */
export function readingTags(context: {
	readonly records: {
		readonly lemmaRecord: {
			readonly lemma: Dumling.Lemma;
			readonly paradigm?: Dumrel.LemmaParadigm;
		};
	};
	readonly entry: {
		readonly reading: Dumling.Reading;
		readonly knowledge?: { readonly valency?: Dumrel.ValencyFrame };
	};
}): readonly string[] {
	const { lemma, paradigm } = context.records.lemmaRecord;
	const { reading } = context.entry;
	const reflexive = reflexiveOf(context.entry.knowledge?.valency);
	const marker = licensedValues(paradigm, "plural", reading).find(
		(value) => value === "NoPlural" || value === "PluralOnly",
	);
	return deriveTags({
		conjugationClasses: [
			...new Set(
				licensedValues(paradigm, "preterite", reading).map((form) =>
					germanConjugationClass(lemma.canonicalForm, form),
				),
			),
		],
		lemma,
		...(marker === undefined ? {} : { pluralMarker: marker }),
		...(reflexive === undefined ? {} : { reflexive }),
	});
}
