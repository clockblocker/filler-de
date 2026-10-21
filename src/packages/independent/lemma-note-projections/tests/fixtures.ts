import type * as Dumling from "dumling/types";
import type { PrincipalParts, ProjectionInput } from "../src";

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
	principalParts?: PrincipalParts,
	ownedSurfaces: ProjectionInput["ownedSurfaces"] = [],
): ProjectionInput {
	return { lemma, ownedSurfaces, principalParts };
}

/** An owned noun Surface in one case, as `ownedSurfaces` holds it. */
export function nounSurface(
	lemma: Dumling.Lemma<De, "Lexeme", "NOUN">,
	form: string,
	grammaticalCase: "Nom" | "Acc" | "Gen" | "Dat",
	number: "Sing" | "Plur" = "Sing",
	spelling: "Canonical" | "Variant" = "Canonical",
): ProjectionInput["ownedSurfaces"][number] {
	return {
		surface: {
			inflectionalFeatures: {
				case: grammaticalCase,
				gender: null,
				number,
			},
			language: "de",
			lemma,
			normalizedSurface: form,
			spelling:
				spelling === "Canonical"
					? { kind: "Canonical" }
					: { kind: "Variant", variantTags: ["Historical"] },
			surfaceFeatures: null,
			unitKind: "Surface",
		} as unknown as Dumling.Surface,
	};
}
