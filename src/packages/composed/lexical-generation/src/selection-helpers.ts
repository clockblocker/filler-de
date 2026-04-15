import type {
	LemmaKind,
	MorphemeKind,
	PhrasemeKind,
	Pos,
	SurfaceKind,
} from "../../../../deprecated-linguistic-enums";
import type { Selection } from "@textfresser/linguistics";

export type GermanSelection = Selection<"German">;
export type KnownGermanSelection = Exclude<
	GermanSelection,
	{ orthographicStatus: "Unknown" }
>;
type UnknownSelection = Extract<
	GermanSelection,
	{ orthographicStatus: "Unknown" }
>;
export type SelectionDiscriminator = Pos | PhrasemeKind | MorphemeKind;

export function isUnknownSelection(
	selection: GermanSelection,
): selection is UnknownSelection {
	return selection.orthographicStatus === "Unknown";
}

export function isKnownSelection(
	selection: GermanSelection,
): selection is KnownGermanSelection {
	return selection.orthographicStatus !== "Unknown";
}

export function isLexemeSelection(
	selection: GermanSelection,
): selection is Extract<
	KnownGermanSelection,
	{ surface: { discriminators: { lemmaKind: "Lexeme" } } }
> {
	return (
		isKnownSelection(selection) &&
		selection.surface.discriminators.lemmaKind === "Lexeme"
	);
}

export function isPhrasemeSelection(
	selection: GermanSelection,
): selection is Extract<
	KnownGermanSelection,
	{ surface: { discriminators: { lemmaKind: "Phraseme" } } }
> {
	return (
		isKnownSelection(selection) &&
		selection.surface.discriminators.lemmaKind === "Phraseme"
	);
}

export function isMorphemeSelection(
	selection: GermanSelection,
): selection is Extract<
	KnownGermanSelection,
	{ surface: { discriminators: { lemmaKind: "Morpheme" } } }
> {
	return (
		isKnownSelection(selection) &&
		selection.surface.discriminators.lemmaKind === "Morpheme"
	);
}

export function getSpelledLemma(selection: GermanSelection): string | null {
	if (!isKnownSelection(selection)) {
		return null;
	}

	return hasHydratedLemmaTarget(selection.surface.target)
		? selection.surface.target.canonicalLemma
		: selection.surface.target.canonicalLemma;
}

export function getSpelledSurface(selection: GermanSelection): string | null {
	return isKnownSelection(selection)
		? selection.surface.normalizedFullSurface
		: null;
}

export function getLemmaKind(selection: GermanSelection): LemmaKind | null {
	return isKnownSelection(selection)
		? selection.surface.discriminators.lemmaKind
		: null;
}

export function getSurfaceKind(selection: GermanSelection): SurfaceKind | null {
	return isKnownSelection(selection) ? selection.surface.surfaceKind : null;
}

export function getSelectionDiscriminator(
	selection: GermanSelection,
): SelectionDiscriminator | null {
	if (!isKnownSelection(selection)) {
		return null;
	}

	return selection.surface.discriminators.lemmaSubKind;
}

function hasHydratedLemmaTarget(
	target: KnownGermanSelection["surface"]["target"],
): target is Extract<KnownGermanSelection["surface"]["target"], { lemmaKind: unknown }> {
	return (
		typeof target === "object" &&
		target !== null &&
		"lemmaKind" in target
	);
}
