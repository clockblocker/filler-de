import type {
	AnySelection,
	LemmaKind,
	MorphemeKind,
	PhrasemeKind,
	Pos,
	UnknownSelection,
} from "@textfresser/linguistics";

export type GermanSelection = AnySelection<"German">;
export type KnownGermanSelection = Exclude<
	GermanSelection,
	{ orthographicStatus: "Unknown" }
>;
export type SelectionDiscriminator = Pos | PhrasemeKind | MorphemeKind;
export type SelectionWithContext = GermanSelection & {
	contextWithLinkedParts?: string;
};

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
): selection is Extract<KnownGermanSelection, { surface: { lemma: { lemmaKind: "Lexeme" } } }> {
	return (
		isKnownSelection(selection) && selection.surface.lemma.lemmaKind === "Lexeme"
	);
}

export function isPhrasemeSelection(
	selection: GermanSelection,
): selection is Extract<
	KnownGermanSelection,
	{ surface: { lemma: { lemmaKind: "Phraseme" } } }
> {
	return (
		isKnownSelection(selection) &&
		selection.surface.lemma.lemmaKind === "Phraseme"
	);
}

export function isMorphemeSelection(
	selection: GermanSelection,
): selection is Extract<
	KnownGermanSelection,
	{ surface: { lemma: { lemmaKind: "Morpheme" } } }
> {
	return (
		isKnownSelection(selection) &&
		selection.surface.lemma.lemmaKind === "Morpheme"
	);
}

export function getSpelledLemma(selection: GermanSelection): string | null {
	return isKnownSelection(selection) ? selection.surface.lemma.spelledLemma : null;
}

export function getSpelledSurface(selection: GermanSelection): string | null {
	return isKnownSelection(selection) ? selection.surface.spelledSurface : null;
}

export function getLemmaKind(selection: GermanSelection): LemmaKind | null {
	return isKnownSelection(selection) ? selection.surface.lemma.lemmaKind : null;
}

export function getSurfaceKind(
	selection: GermanSelection,
): KnownGermanSelection["surface"]["surfaceKind"] | null {
	return isKnownSelection(selection) ? selection.surface.surfaceKind : null;
}

export function getSelectionDiscriminator(
	selection: GermanSelection,
): SelectionDiscriminator | null {
	if (!isKnownSelection(selection)) {
		return null;
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
