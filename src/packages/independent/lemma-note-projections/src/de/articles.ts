import { authoredMembers } from "dumcorpus/inventories";

export type Case = "Nom" | "Acc" | "Gen" | "Dat";
export type Gender = "Masc" | "Fem" | "Neut";
export type GrammaticalNumber = "Sing" | "Plur";

/** The case rows in the order a German table lists them. */
export const CASES: readonly Case[] = ["Nom", "Acc", "Gen", "Dat"];

export const CASE_LABELS: Readonly<Record<Case, string>> = {
	Acc: "A",
	Dat: "D",
	Gen: "G",
	Nom: "N",
};

const key = (
	grammaticalCase: string,
	number: string,
	gender: string | null,
): string => `${grammaticalCase}|${number}|${gender ?? ""}`;

let definite: ReadonlyMap<string, string> | undefined;

/**
 * The definite article cells of dumcorpus's article pillars, one DET Lemma
 * per Paradigm Cell (system ADR 0032); the ein-words are left out.
 */
function definiteArticles(): ReadonlyMap<string, string> {
	if (definite !== undefined) return definite;
	const cells = new Map<string, string>();
	for (const { lemma } of authoredMembers) {
		const core = lemma.coreFeatures as Readonly<Record<string, unknown>>;
		if (
			lemma.kind !== "DET" ||
			core.pronType !== "Art" ||
			lemma.canonicalForm.startsWith("ein")
		)
			continue;
		const gender = typeof core.gender === "string" ? core.gender : null;
		cells.set(
			key(String(core.case), String(core.number), gender),
			lemma.canonicalForm,
		);
	}
	definite = cells;
	return cells;
}

/** The definite article of a cell; a plural cell marks no gender. */
export function definiteArticle(
	grammaticalCase: Case,
	number: GrammaticalNumber,
	gender: Gender | null,
): string | undefined {
	return definiteArticles().get(
		key(grammaticalCase, number, number === "Plur" ? null : gender),
	);
}
