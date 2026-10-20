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

type Realization = (typeof authoredRealizations)[number];

/** A plain spelling: no Shorthand or Fused member, nothing archaic or historical. */
function isStandard(realization: Realization): boolean {
	const { spelling } = realization;
	return (
		realization.orthography === undefined &&
		realization.historicalStatus === undefined &&
		!(
			spelling?.kind === "Variant" &&
			(spelling.variantTags as readonly string[]).includes("Historical")
		)
	);
}

let nonStandardForms: ReadonlySet<string> | undefined;

/** The auxiliaries' forms that are not plain spellings: hab, hätt, ward. */
function nonStandardAuxiliaryForms(): ReadonlySet<string> {
	nonStandardForms ??= new Set(
		authoredRealizations
			.filter(
				(realization) =>
					realization.member.lemma.kind === "AUX" &&
					!isStandard(realization),
			)
			.map(({ spelled }) => spelled),
	);
	return nonStandardForms;
}

/**
 * The forms of a VERB or AUX whose whole paradigm is closed (sein, haben,
 * werden and the modals), without shorthands, archaic forms or the
 * pre-reform ß spellings (muß beside muss).
 */
function closedVerbParadigm(
	canonicalForm: string,
): InflectionTable | undefined {
	if (!Object.hasOwn(closedVerbForms, canonicalForm)) return undefined;
	const forms = closedVerbForms[canonicalForm] ?? [];
	const nonStandard = nonStandardAuxiliaryForms();
	const cells = distinct(forms).filter(
		(form) =>
			!nonStandard.has(form) &&
			!(form.includes("ß") && forms.includes(form.replace(/ß/gu, "ss"))),
	);
	return cells.length === 0
		? undefined
		: { rows: [{ cells, label: "Formen" }] };
}

/**
 * A closed-class Lemma's paradigm from dumcorpus's Authored Inventory:
 *
 * - a declining DET or PRON stem (dieser, welcher) gets a case table from
 *   the cells its plain spellings realize, `N: dieser (m), dieses (n), …`;
 * - a VERB or AUX whose whole paradigm is closed (sein, haben, werden and
 *   the modals) lists its forms. The recipient-passive and causative AUX
 *   Lemmas share forms of several verbs, so they get none.
 *
 * A pillar Lemma that is one Paradigm Cell (der, ich) has no table of its
 * own, so it gets none. Undefined when dumcorpus has no paradigm.
 */
export function closedParadigm(
	lemma: Dumling.Lemma<"de">,
): InflectionTable | undefined {
	if (lemma.kind === "VERB" || lemma.kind === "AUX")
		return lemma.family === "Lexeme"
			? closedVerbParadigm(lemma.canonicalForm)
			: undefined;
	const members = authoredFor(lemma);
	if (members.length === 0) return undefined;
	const celled = authoredRealizations.filter(
		(realization) =>
			members.includes(realization.member) &&
			realization.inflection?.case !== undefined &&
			isStandard(realization),
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
