import { SelectionSchema } from "@textfresser/linguistics";
import {
	createLexicalMeta,
	type LexicalMeta,
	type ResolvedSelection,
} from "../../src";

type LexemePos = keyof (typeof SelectionSchema.German.Standard.Lemma.Lexeme);
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
		orthographicStatus: "Standard" as const,
		surface: {
			...(surfaceKind === "Inflection" ? { inflectionalFeatures: {} } : {}),
			lemma: {
				lemmaKind: "Lexeme" as const,
				pos: params.pos,
				spelledLemma: params.lemma,
			},
			spelledSurface,
			surfaceKind,
		},
	};

	return SelectionSchema.German.Standard[surfaceKind].Lexeme[
		params.pos
	].parse(rawSelection);
}

export function makeLexemeMeta(params: {
	emojiDescription: string[];
	lemma: string;
	pos: LexemePos;
}): LexicalMeta {
	return createLexicalMeta({
		emojiDescription: params.emojiDescription,
		selection: makeLexemeSelection({
			lemma: params.lemma,
			pos: params.pos,
		}),
	});
}
