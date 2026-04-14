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
	{ surface: { discriminators: { lemmaKind: "Lexeme" } } }
> {
	return (
		isKnownSelection(selection) &&
		selection.surface.discriminators.lemmaKind === "Lexeme"
	);
}

export function isPhrasemeSelection(
	selection: ResolvedSelection,
): selection is Extract<
	Exclude<ResolvedSelection, { orthographicStatus: "Unknown" }>,
	{ surface: { discriminators: { lemmaKind: "Phraseme" } } }
> {
	return (
		isKnownSelection(selection) &&
		selection.surface.discriminators.lemmaKind === "Phraseme"
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
	return selection.surface.discriminators.lemmaKind;
}

export function getSelectionPos(selection: ResolvedSelection): POS | undefined {
	return isLexemeSelection(selection)
		? (selection.surface.discriminators.lemmaSubKind as POS)
		: undefined;
}

export function getSpelledLemma(selection: ResolvedSelection): string | undefined {
	if (!isKnownSelection(selection)) {
		return undefined;
	}

	return "spelledLemma" in selection.surface.target
		? selection.surface.target.spelledLemma
		: selection.surface.target.lemma.spelledLemma;
}

export function getSelectionDiscriminator(
	selection: ResolvedSelection,
): string | undefined {
	if (!isKnownSelection(selection)) {
		return undefined;
	}

	return selection.surface.discriminators.lemmaSubKind;
}
