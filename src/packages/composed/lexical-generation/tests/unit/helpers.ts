import { lingSchemaFor } from "@textfresser/linguistics";
import {
	createLexicalMeta,
	type LexicalMeta,
	type ResolvedSelection,
} from "../../src";

const SelectionSchema = lingSchemaFor.Selection;

type LexemePos = keyof typeof SelectionSchema.German.Standard.Lemma.Lexeme;
type SurfaceKind = keyof typeof SelectionSchema.German.Standard;

export function makeLexemeSelection(params: {
	lemma: string;
	pos: LexemePos;
	surfaceKind?: Exclude<SurfaceKind, "Unknown">;
	spelledSurface?: string;
}): ResolvedSelection {
	const surfaceKind = params.surfaceKind ?? "Lemma";
	const spelledSurface = params.spelledSurface ?? params.lemma;
	const rawSelection = {
		language: "German" as const,
		orthographicStatus: "Standard" as const,
		selectionCoverage: "Full" as const,
		spelledSelection: spelledSurface,
		surface: {
			...(surfaceKind === "Inflection"
				? { inflectionalFeatures: {} }
				: {}),
			discriminators: {
				lemmaKind: "Lexeme" as const,
				lemmaSubKind: params.pos,
			},
			language: "German" as const,
			normalizedFullSurface: spelledSurface,
			surfaceKind,
			target: { canonicalLemma: params.lemma },
		},
	};

	const parsed = SelectionSchema.German.Standard[surfaceKind].Lexeme[
		params.pos
	].parse(rawSelection);
	return {
		...parsed,
		contextWithLinkedParts: `${spelledSurface} im Kontext`,
	};
}

export function makeLexemeMeta(params: {
	senseEmojis: string[];
	lemma: string;
	pos: LexemePos;
}): LexicalMeta {
	return createLexicalMeta({
		senseEmojis: params.senseEmojis,
		selection: makeLexemeSelection({
			lemma: params.lemma,
			pos: params.pos,
		}),
	})._unsafeUnwrap();
}
