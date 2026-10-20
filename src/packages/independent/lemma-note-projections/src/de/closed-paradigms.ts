import {
	authoredFor,
	authoredRealizations,
	closedVerbForms,
} from "dumcorpus/inventories";
import type * as Dumling from "dumling/types";
import { distinct, type InflectionTable } from "../table";
import { CASE_LABELS, CASES } from "./articles";

const COLUMNS = [
	["Masc", "m"],
	["Neut", "n"],
	["Fem", "f"],
	["Plur", "pl"],
] as const;

/**
 * A closed-class Lemma's paradigm from dumcorpus's Authored Inventory:
 *
 * - a declining DET or PRON stem (dieser, welcher) gets a case table from
 *   the cells its spellings realize, `N: dieser (m), dieses/dies (n), …`;
 * - an AUX, or a VERB whose whole paradigm is closed (sein, haben, werden
 *   and the modals), lists its forms.
 *
 * A pillar Lemma that is one Paradigm Cell (der, ich) has no table of its
 * own, so it gets none. Undefined when dumcorpus has no paradigm.
 */
export function closedParadigm(
	lemma: Dumling.Lemma<"de">,
): InflectionTable | undefined {
	if (lemma.family === "Lexeme" && lemma.kind === "VERB") {
		const forms = closedVerbForms[lemma.canonicalForm];
		return forms === undefined
			? undefined
			: { rows: [{ cells: distinct(forms), label: "Formen" }] };
	}
	const members = authoredFor(lemma);
	if (members.length === 0) return undefined;
	const realizations = authoredRealizations.filter((realization) =>
		members.includes(realization.member),
	);
	if (lemma.kind === "AUX") {
		const forms = distinct(realizations.map(({ spelled }) => spelled));
		return forms.length === 0
			? undefined
			: { rows: [{ cells: forms, label: "Formen" }] };
	}
	const celled = realizations.filter(
		(realization) => realization.inflection?.case !== undefined,
	);
	if (celled.length === 0) return undefined;
	const rows = CASES.map((grammaticalCase) => ({
		cells: COLUMNS.flatMap(([column, abbreviation]) => {
			const spellings = distinct(
				celled
					.filter(({ inflection }) => {
						if (inflection?.case !== grammaticalCase) return false;
						return column === "Plur"
							? inflection.number === "Plur"
							: inflection.number !== "Plur" &&
									inflection.gender === column;
					})
					.map(({ spelled }) => spelled),
			);
			return spellings.length === 0
				? []
				: [`${spellings.join("/")} (${abbreviation})`];
		}),
		label: CASE_LABELS[grammaticalCase],
	}));
	return { rows };
}
