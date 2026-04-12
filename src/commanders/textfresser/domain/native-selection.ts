import type { ResolvedSelection } from "@textfresser/lexical-generation";
import type {
	LinguisticUnitKind,
	POS,
	SurfaceKind,
} from "./note-linguistic-policy";

export function isKnownSelection(
	selection: ResolvedSelection,
): selection is Exclude<ResolvedSelection, { orthographicStatus: "Unknown" }> {
	return selection.orthographicStatus !== "Unknown";
}

export function isLexemeSelection(
	selection: ResolvedSelection,
): selection is Extract<
	Exclude<ResolvedSelection, { orthographicStatus: "Unknown" }>,
	{ surface: { lemma: { lemmaKind: "Lexeme" } } }
> {
	return (
		isKnownSelection(selection) && selection.surface.lemma.lemmaKind === "Lexeme"
	);
}

export function isPhrasemeSelection(
	selection: ResolvedSelection,
): selection is Extract<
	Exclude<ResolvedSelection, { orthographicStatus: "Unknown" }>,
	{ surface: { lemma: { lemmaKind: "Phraseme" } } }
> {
	return (
		isKnownSelection(selection) &&
		selection.surface.lemma.lemmaKind === "Phraseme"
	);
}

export function getSelectionSurfaceKind(
	selection: ResolvedSelection,
): SurfaceKind | undefined {
	return isKnownSelection(selection) ? selection.surface.surfaceKind : undefined;
}

export function getSelectionUnitKind(
	selection: ResolvedSelection,
): LinguisticUnitKind | undefined {
	if (!isKnownSelection(selection)) {
		return undefined;
	}
	return selection.surface.lemma.lemmaKind;
}

export function getSelectionPos(selection: ResolvedSelection): POS | undefined {
	return isLexemeSelection(selection) ? selection.surface.lemma.pos : undefined;
}

export function getSpelledLemma(selection: ResolvedSelection): string | undefined {
	return isKnownSelection(selection) ? selection.surface.lemma.spelledLemma : undefined;
}

export function getSelectionDiscriminator(
	selection: ResolvedSelection,
): string | undefined {
	if (!isKnownSelection(selection)) {
		return undefined;
	}

	switch (selection.surface.lemma.lemmaKind) {
		case "Lexeme":
			return selection.surface.lemma.pos;
		case "Phraseme":
			return selection.surface.lemma.phrasemeKind;
		case "Morpheme":
			return selection.surface.lemma.morphemeKind;
	}
}
