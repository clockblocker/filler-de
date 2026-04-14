import type {
	LemmaKind,
	MorphemeKind,
	PhrasemeKind,
	Pos,
	SurfaceKind,
} from "@textfresser/linguistics";
import type { LexicalMeta, ResolvedSelection } from "./public-types";
import {
	getLemmaKind,
	getSelectionDiscriminator,
	getSurfaceKind,
	isKnownSelection,
} from "./selection-helpers";

type ParsedLexicalMetaTag = {
	discriminator: MorphemeKind | PhrasemeKind | Pos;
	lemmaKind: LemmaKind;
	surfaceKind: SurfaceKind;
};

export function createMetaTagFromSelection(selection: ResolvedSelection): string {
	if (!isKnownSelection(selection)) {
		return "unknown";
	}

	const lemmaKind = getLemmaKind(selection);
	const discriminator = getSelectionDiscriminator(selection);
	const surfaceKind = getSurfaceKind(selection);
	if (!lemmaKind || !discriminator || !surfaceKind) {
		return "unknown";
	}

	return `${lemmaKind}|${discriminator}|${surfaceKind}`;
}

export function createLexicalMeta(params: {
	senseEmojis: string[];
	selection: ResolvedSelection;
}): LexicalMeta {
	return {
		senseEmojis: params.senseEmojis,
		metaTag: createMetaTagFromSelection(params.selection),
	};
}

export function parseLexicalMetaTag(
	metaTag: string,
): ParsedLexicalMetaTag | null {
	const [lemmaKind, discriminator, surfaceKind, ...rest] = metaTag.split("|");
	if (
		typeof lemmaKind !== "string" ||
		typeof discriminator !== "string" ||
		typeof surfaceKind !== "string" ||
		rest.length > 0
	) {
		return null;
	}

	if (
		(lemmaKind !== "Lexeme" &&
			lemmaKind !== "Phraseme" &&
			lemmaKind !== "Morpheme") ||
		(surfaceKind !== "Inflection" &&
			surfaceKind !== "Lemma" &&
			surfaceKind !== "Partial" &&
			surfaceKind !== "Variant")
	) {
		return null;
	}

	return {
		discriminator: discriminator as ParsedLexicalMetaTag["discriminator"],
		lemmaKind,
		surfaceKind,
	};
}
