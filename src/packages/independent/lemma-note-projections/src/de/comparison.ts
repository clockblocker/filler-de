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

/**
 * The adjectives that umlaut in comparison (alt, älter; gesund, gesünder).
 * A compound ending in one may too (altklug, altklüger; lebensnah,
 * lebensnäher).
 */
const UMLAUTING_HEADS: readonly string[] = [
	"alt",
	"arg",
	"arm",
	"bang",
	"blass",
	"dumm",
	"fromm",
	"gesund",
	"glatt",
	"grob",
	"groß",
	"hart",
	"hoch",
	"jung",
	"kalt",
	"karg",
	"klug",
	"krank",
	"krumm",
	"kurz",
	"lang",
	"nah",
	"nass",
	"rot",
	"scharf",
	"schmal",
	"schwach",
	"schwarz",
	"stark",
	"warm",
];

/**
 * Latin adjectives in `-er` that drop its `e` before the comparative ending
 * (integer, integrer), which no rule here tells from those that keep it
 * (sauber, sauberer).
 */
const E_DROPPING: ReadonlySet<string> = new Set([
	"illuster",
	"integer",
	"makaber",
	"sinister",
]);

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
 * cannot tell. A polysyllable does only when it ends in an umlauting
 * adjective (kerngesund, altklug).
 */
function mayUmlaut(positive: string): boolean {
	const word = lower(positive);
	const stem = word.endsWith("e") ? word.slice(0, -1) : word;
	if (syllableCount(stem) === 1) return /(^|[^eä])[aou]/u.test(stem);
	return UMLAUTING_HEADS.some((head) => stem.endsWith(head));
}

/**
 * The superlative takes `-esten` after d, t, s, ß, x, z, sch and a vowel
 * (am kältesten, am heißesten, am freiesten), except after the
 * participial `-end`, `-elt`, unstressed `-ert` and `-et` and after
 * `-isch` (am bedeutendsten, am begeistertsten, am gebildetsten, am
 * typischsten; but am interessiertesten). Undefined after the unstressed
 * `-igt` and `-icht` (berechtigt, töricht), where no rule here is sure of
 * the `e`.
 */
function superlative(positive: string): string | undefined {
	const word = lower(positive);
	const base = word.endsWith("e") ? positive.slice(0, -1) : positive;
	const folded = lower(base);
	if (syllableCount(folded) > 1 && /i(g|ch)t$/u.test(folded))
		return undefined;
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
			: derivable && !E_DROPPING.has(lower(canonicalForm))
				? [`${comparativeStem(canonicalForm)}er`]
				: [];
	const derivedSuperlative = derivable
		? superlative(canonicalForm)
		: undefined;
	const superlatives = suppletive
		? [suppletive.superlative]
		: derivedSuperlative === undefined
			? []
			: [derivedSuperlative];
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
