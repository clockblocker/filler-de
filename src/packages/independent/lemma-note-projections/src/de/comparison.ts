import { germanSuppletiveComparisons } from "dumcorpus/inventories";
import { distinct, type InflectionTable } from "../table";
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
	/**
	 * Whether regular forms may be derived. An ADV's comparison is mostly
	 * suppletive or irregular (sehr, mehr; oft, öfter), so only an ADJ's is.
	 */
	readonly derive: boolean;
};

/** Polysyllables that umlaut anyway: gesund, gesünder. */
const UMLAUTING_POLYSYLLABLES: ReadonlySet<string> = new Set(["gesund"]);

/** The stem the comparison endings attach to: `dunkel` → `dunkl`, `leise` → `leis`. */
function comparativeStem(positive: string): string {
	const word = lower(positive);
	if (word.endsWith("el")) return `${positive.slice(0, -2)}l`;
	if (/(au|eu)er$/u.test(word)) return `${positive.slice(0, -2)}r`;
	if (word.endsWith("e")) return positive.slice(0, -1);
	return positive;
}

/**
 * A monosyllabic stem whose vowel is a, o, u or au may umlaut (alt, älter;
 * lange, länger; hoch, höher) or not (klar, klarer), which the stored data
 * cannot tell. Polysyllables rarely do.
 */
function mayUmlaut(positive: string): boolean {
	const word = lower(positive);
	const stem = word.endsWith("e") ? word.slice(0, -1) : word;
	return (
		UMLAUTING_POLYSYLLABLES.has(word) ||
		(syllableCount(stem) === 1 && /(^|[^eä])[aou]/u.test(stem))
	);
}

/**
 * The superlative takes `-esten` after d, t, s, ß, x, z, sch and a vowel
 * (am kältesten, am heißesten, am freiesten), except after the
 * participial `-end`, `-elt`, unstressed `-ert` and `-et` and after
 * `-isch` (am bedeutendsten, am begeistertsten, am gebildetsten, am
 * typischsten; but am interessiertesten).
 */
function superlative(positive: string): string {
	const word = lower(positive);
	const base = word.endsWith("e") ? positive.slice(0, -1) : positive;
	const folded = lower(base);
	const participial =
		syllableCount(folded) > 1 &&
		/(end|elt|[^i]ert|[dtnm]et)$/u.test(folded);
	const linking =
		!participial &&
		!folded.endsWith("isch") &&
		(/[dt]$/u.test(folded) ||
			endsWithSibilant(folded) ||
			folded.endsWith("sch") ||
			(endsWithVowel(folded) && !word.endsWith("e")));
	return `am ${base}${linking ? "esten" : "sten"}`;
}

/** dumcorpus's suppletive comparison of a positive, `gerne` read as `gern`. */
function suppletiveOf(positive: string) {
	const word = lower(positive);
	return germanSuppletiveComparisons.find(
		(entry) => entry.positive === word || `${entry.positive}e` === word,
	);
}

/**
 * An ADJ or ADV's comparison where its Core marks it `comparable`:
 * Positiv, Komparativ and Superlativ. Suppletive forms come from dumcorpus
 * (gut, besser, am besten), a stored comparative Surface comes next, and an
 * ADJ's regular forms are derived only where no umlaut can be in doubt.
 * Undefined when neither a comparative nor a superlative is known.
 */
export function compareGerman(
	input: GermanComparisonInput,
): InflectionTable | undefined {
	const { canonicalForm } = input;
	const suppletive = suppletiveOf(canonicalForm);
	const derivable = input.derive && !mayUmlaut(canonicalForm);
	const comparatives = suppletive
		? [suppletive.comparative]
		: input.storedComparatives.length > 0
			? distinct(input.storedComparatives)
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
