import type * as Dumling from "dumling/types";
import type { ProjectedKnowledge, ProjectionInput } from "../src";

type De = "de";

export function noun(
	canonicalForm: string,
	gender: Dumling.Lemma<De, "Lexeme", "NOUN">["coreFeatures"]["gender"],
): Dumling.Lemma<De, "Lexeme", "NOUN"> {
	return {
		canonicalForm,
		coreFeatures: { gender },
		family: "Lexeme",
		kind: "NOUN",
		language: "de",
		unitKind: "Lemma",
	};
}

export function verb(
	canonicalForm: string,
	core: {
		readonly hasSepPrefix?: string;
		readonly lexicallyReflexive?: "Acc" | "Dat";
	} = {},
): Dumling.Lemma<De, "Lexeme", "VERB"> {
	return {
		canonicalForm,
		coreFeatures: {
			hasSepPrefix: core.hasSepPrefix ?? null,
			lexicallyReflexive: core.lexicallyReflexive ?? null,
		},
		family: "Lexeme",
		kind: "VERB",
		language: "de",
		unitKind: "Lemma",
	};
}

export function lexeme<K extends "ADJ" | "ADV" | "PROPN">(
	kind: K,
	canonicalForm: string,
	coreFeatures: Dumling.Lemma<De, "Lexeme", K>["coreFeatures"],
): Dumling.Lemma<De, "Lexeme", K> {
	return {
		canonicalForm,
		coreFeatures,
		family: "Lexeme",
		kind,
		language: "de",
		unitKind: "Lemma",
	} as Dumling.Lemma<De, "Lexeme", K>;
}

export function input(
	lemma: Dumling.Lemma,
	knowledge?: ProjectedKnowledge,
	ownedSurfaces: ProjectionInput["ownedSurfaces"] = [],
): ProjectionInput {
	return { entry: { knowledge }, lemma, ownedSurfaces };
}
