import type { ResolvedSelection } from "@textfresser/lexical-generation";
import type { Attestation } from "../../common/attestation/types";
import {
	getSelectionDiscriminator,
	getSelectionPos,
	getSelectionSurfaceKind,
	getSelectionUnitKind,
	getSpelledLemma,
	isLexemeSelection,
	isPhrasemeSelection,
} from "../../domain/native-selection";
import type {
	POS,
	SurfaceKind,
} from "../../domain/note-linguistic-policy";

type LemmaLocalState = {
	attestation: Attestation;
	/** null = new sense or first encounter */
	disambiguationResult: { matchedIndex: number } | null;
	/** Emoji description precomputed by Disambiguate prompt when it detects a new sense. */
	precomputedEmojiDescription?: string[];
};

type KnownSelection = Exclude<ResolvedSelection, { orthographicStatus: "Unknown" }>;
type LexemeSelection = Extract<
	KnownSelection,
	{ surface: { lemma: { lemmaKind: "Lexeme" } } }
>;
type PhrasemeSelection = Extract<
	KnownSelection,
	{ surface: { lemma: { lemmaKind: "Phraseme" } } }
>;

export type LexemeLemmaResult = LexemeSelection &
	LemmaLocalState & {
		lemma: string;
		linguisticUnit: "Lexeme";
		posLikeKind: POS;
		surfaceKind: SurfaceKind;
	};

export type PhrasemeLemmaResult = PhrasemeSelection &
	LemmaLocalState & {
		lemma: string;
		linguisticUnit: "Phraseme";
		posLikeKind: null;
		surfaceKind: SurfaceKind;
	};

export type LemmaResult = LexemeLemmaResult | PhrasemeLemmaResult;

export function getLexemePos(
	result: LemmaResult,
) {
	return getSelectionPos(result);
}

export function getLemmaText(result: LemmaResult) {
	return getSpelledLemma(result);
}

export function getLemmaUnitKind(result: LemmaResult) {
	return getSelectionUnitKind(result);
}

export function getLemmaSurfaceKind(result: LemmaResult) {
	return getSelectionSurfaceKind(result);
}

export function getLemmaDiscriminator(result: LemmaResult) {
	return getSelectionDiscriminator(result);
}

export function isLexemeResult(result: LemmaResult) {
	return isLexemeSelection(result);
}

export function isPhrasemeResult(result: LemmaResult) {
	return isPhrasemeSelection(result);
}
