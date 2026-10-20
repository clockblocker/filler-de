import { germanSuppletiveComparisons } from "dumcorpus/inventories";
import type { InflectionTable } from "../table";
import {
	endsWithSibilant,
	endsWithVowel,
	lower,
	syllableCount,
} from "./orthography";

export type GermanComparisonInput = {
	/** The positive, as the ADJ or ADV Lemma cites it. */
	readonly canonicalForm: string;
	/**
	 * Comparatives stored as owned Surfaces marking Degree Cmp and no case
	 * (`älter`). They win over derivation.
	 */
	readonly storedComparatives: readonly string[];
};

/**
 * A monosyllable whose vowel is a, o, u or au may umlaut (alt, älter; groß,
 * größer; hoch, höher) or not (klar, klarer), which the stored data cannot
 * tell. Polysyllables never do.
 */
function mayUmlaut(positive: string): boolean {
	return syllableCount(positive) === 1 && /[aou]/u.test(lower(positive));
}

/** The stem the comparison endings attach to: `dunkel` → `dunkl`, `leise` → `leis`. */
function comparativeStem(positive: string): string {
	const word = lower(positive);
	if (word.endsWith("el")) return `${positive.slice(0, -2)}l`;
	if (/(au|eu)er$/u.test(word)) return `${positive.slice(0, -2)}r`;
	if (word.endsWith("e")) return positive.slice(0, -1);
	return positive;
}

/**
 * The superlative takes `-esten` after d, t, s, ß, x, z, sch and a vowel
 * (am kältesten, am heißesten, am freiesten), except after the
 * participial `-end` and `-isch` (am bedeutendsten, am typischsten).
 */
function superlative(positive: string): string {
	const word = lower(positive);
	const base = word.endsWith("e") ? positive.slice(0, -1) : positive;
	const folded = lower(base);
	const linking =
		!/(end|isch)$/u.test(folded) &&
		(/[dt]$/u.test(folded) ||
			endsWithSibilant(folded) ||
			folded.endsWith("sch") ||
			(endsWithVowel(folded) && !word.endsWith("e")));
	return `am ${base}${linking ? "esten" : "sten"}`;
}

/**
 * An ADJ or ADV's comparison where its Core marks it `comparable`:
 * Positiv, Komparativ and Superlativ. Suppletive forms come from dumcorpus
 * (gut, besser, am besten), a stored comparative Surface comes next, and
 * the regular forms are derived only where no umlaut can be in doubt. A
 * monosyllable that may umlaut keeps just its stored forms.
 */
export function compareGerman(
	input: GermanComparisonInput,
): InflectionTable | undefined {
	const { canonicalForm } = input;
	const suppletive = germanSuppletiveComparisons.find(
		(entry) => entry.positive === lower(canonicalForm),
	);
	const derivable = !mayUmlaut(canonicalForm);
	const comparatives = suppletive
		? [suppletive.comparative]
		: input.storedComparatives.length > 0
			? input.storedComparatives
			: derivable
				? [`${comparativeStem(canonicalForm)}er`]
				: [];
	const superlatives = suppletive
		? [suppletive.superlative]
		: derivable
			? [superlative(canonicalForm)]
			: [];
	if (comparatives.length === 0 && superlatives.length === 0)
		return undefined;
	return {
		rows: [
			{ cells: [canonicalForm], label: "Positiv" },
			{ cells: comparatives, label: "Komparativ" },
			{ cells: superlatives, label: "Superlativ" },
		],
	};
}
