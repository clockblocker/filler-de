import type {
	LexicalMeta,
	LexicalPhrasemeKind,
	LexicalPos,
	LexicalSurfaceKind,
	ResolvedLemma,
} from "./public-types";

type ParsedLexicalMetaTag =
	| {
			linguisticUnit: "Lexem";
			posLikeKind: LexicalPos;
			surfaceKind: LexicalSurfaceKind;
	  }
	| {
			linguisticUnit: "Phrasem";
			posLikeKind: LexicalPhrasemeKind;
			surfaceKind: LexicalSurfaceKind;
	  };

const lexicalUnitToToken = {
	Lexem: "lx",
	Phrasem: "ph",
} as const;

const surfaceKindToToken = {
	Inflected: "inflected",
	Lemma: "lemma",
	Partial: "partial",
	Variant: "variant",
} as const satisfies Record<LexicalSurfaceKind, string>;

const posToToken = {
	Adjective: "adjective",
	Adverb: "adverb",
	Article: "article",
	Conjunction: "conjunction",
	InteractionalUnit: "interactional-unit",
	Noun: "noun",
	Particle: "particle",
	Preposition: "preposition",
	Pronoun: "pronoun",
	Verb: "verb",
} as const satisfies Record<LexicalPos, string>;

const phrasemeKindToToken = {
	Collocation: "collocation",
	CulturalQuotation: "cultural-quotation",
	DiscourseFormula: "discourse-formula",
	Idiom: "idiom",
	Proverb: "proverb",
} as const satisfies Record<LexicalPhrasemeKind, string>;

const lexicalUnitFromToken = {
	lx: "Lexem",
	ph: "Phrasem",
} as const;

const surfaceKindFromToken = {
	inflected: "Inflected",
	lemma: "Lemma",
	partial: "Partial",
	variant: "Variant",
} as const satisfies Record<string, LexicalSurfaceKind>;

const posFromToken = Object.fromEntries(
	Object.entries(posToToken).map(([pos, token]) => [token, pos]),
) as Record<(typeof posToToken)[keyof typeof posToToken], LexicalPos>;

const phrasemeKindFromToken = Object.fromEntries(
	Object.entries(phrasemeKindToToken).map(([kind, token]) => [token, kind]),
) as Record<
	(typeof phrasemeKindToToken)[keyof typeof phrasemeKindToToken],
	LexicalPhrasemeKind
>;

export function createMetaTagFromResolvedLemma(lemma: ResolvedLemma): string {
	const unitToken = lexicalUnitToToken[lemma.linguisticUnit];
	const posToken =
		lemma.linguisticUnit === "Lexem"
			? posToToken[lemma.posLikeKind]
			: phrasemeKindToToken[lemma.posLikeKind];
	const surfaceToken = surfaceKindToToken[lemma.surfaceKind];

	return `${unitToken}|${posToken}|${surfaceToken}`;
}

export function createLexicalMeta(params: {
	emojiDescription: string[];
	lemma: ResolvedLemma;
}): LexicalMeta {
	return {
		emojiDescription: params.emojiDescription,
		metaTag: createMetaTagFromResolvedLemma(params.lemma),
	};
}

export function parseLexicalMetaTag(
	metaTag: string,
): ParsedLexicalMetaTag | null {
	const [unitToken, posToken, surfaceToken, ...rest] = metaTag.split("|");
	if (
		typeof unitToken !== "string" ||
		typeof posToken !== "string" ||
		typeof surfaceToken !== "string" ||
		rest.length > 0
	) {
		return null;
	}

	const linguisticUnit =
		lexicalUnitFromToken[unitToken as keyof typeof lexicalUnitFromToken];
	const surfaceKind =
		surfaceKindFromToken[surfaceToken as keyof typeof surfaceKindFromToken];

	if (!linguisticUnit || !surfaceKind) {
		return null;
	}

	if (linguisticUnit === "Lexem") {
		const posLikeKind = posFromToken[posToken as keyof typeof posFromToken];
		if (!posLikeKind) {
			return null;
		}

		return {
			linguisticUnit,
			posLikeKind,
			surfaceKind,
		};
	}

	const posLikeKind =
		phrasemeKindFromToken[posToken as keyof typeof phrasemeKindFromToken];
	if (!posLikeKind) {
		return null;
	}

	return {
		linguisticUnit,
		posLikeKind,
		surfaceKind,
	};
}
