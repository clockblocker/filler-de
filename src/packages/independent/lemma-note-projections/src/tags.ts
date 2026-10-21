import { coreOf, type ProjectionInput } from "./context";

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
		lexicallyReflexive: { Acc: "reflexive-acc", Dat: "reflexive-dat" },
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
function routeTag(input: ProjectionInput): string {
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
 * value (`noun/masculine`, `verb/separable`, `verb/reflexive-acc`), and
 * the inflection class its principal parts give (`verb/weak`,
 * `noun/plural-only`). The old `common` and `compound` tags have no dumling
 * feature and are gone. A Reading with nothing to add gets its route alone.
 */
export function deriveTags(input: ProjectionInput): readonly string[] {
	const route = routeTag(input);
	const core = coreOf(input.lemma);
	const parts = Object.keys(core)
		.sort()
		.flatMap((feature) => featureParts(feature, core[feature]));
	const knowledge = input.principalParts;
	for (const value of knowledge?.conjugationClass ?? [])
		parts.push(CLASS_SLUGS[value] ?? slug(value));
	if (knowledge?.plural === "NoPlural") parts.push("singular-only");
	if (knowledge?.plural === "PluralOnly") parts.push("plural-only");
	const tags = [...new Set(parts)].map((part) => `${route}/${part}`);
	return tags.length === 0 ? [route] : tags;
}
