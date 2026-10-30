import type * as Dumling from "dumling/types";
import { propagateMorphemes } from "dumrel";
import type * as Dumrel from "dumrel/types";
import type { LinkNamed, LinkRenderer } from "../links";

/**
 * A Reading's Breakdown and Source (texteater ADR 0050, ADR 0051) as its
 * note's Morpheme section shows them, in the Kohlekraftwerk exemplar's
 * lines:
 *
 * ```
 * [[Kohle]]|[[kraft]]|[[werk]]
 * [[Kohle]] + [[Kraftwerk]]
 * ```
 *
 * Each piece links its target, a Lemma or a Unit Shadow, never a Reading
 * (phylosophy.md, Breakdown-link rule). The lines are rendered from the
 * metadata and never parsed back.
 */

/**
 * The class of the empty span that opens the morphemes line, so the hover
 * reveal (#270) finds the line in the editor and in Reading view. Each
 * morpheme after it is one `|`-separated piece: a link, or plain letters.
 */
export const MORPHEMES_LINE_CLASS = "tf-morphemes";

const MORPHEMES_MARKER = `<span class="${MORPHEMES_LINE_CLASS}"></span>`;

/** No language's Endings or zero ending: a host passes its language's policy. */
const NO_POLICY: Dumrel.MorphemePolicy = {
	endings: new Map(),
	zeroEndingKinds: new Set(),
};

const isLemma = (target: Dumrel.LinkTarget): target is Dumling.Lemma =>
	"unitKind" in target;

/** What a Breakdown target names: its Lemma, or its Unit Shadow while pending. */
function namesOf<L extends Dumling.Language>(
	target: Dumrel.LinkTarget,
): LinkNamed<L> {
	return isLemma(target)
		? { kind: "Lemma", lemma: target as Dumling.Lemma<L> }
		: {
				kind: "Shadow",
				shadow: target as Dumrel.UnitShadow & { language: L },
			};
}

/** Plain letters as visible text: nothing that opens a link or a comment. */
const plain = (letters: string) =>
	letters.replace(/[[\]]/gu, "").replace(/%(?=%)/gu, "%​");

export type BreakdownInputs<L extends Dumling.Language> = {
	readonly reading: Dumling.Reading<L>;
	readonly knowledge: Dumrel.ReadingKnowledge | undefined;
	readonly link: LinkRenderer<L>;
	readonly lookup?: Dumrel.LookupMorphemeSources;
	readonly policy?: Dumrel.MorphemePolicy;
};

/**
 * The morphemes line: dumrel's `propagateMorphemes` walk, its pieces joined
 * by `|`. A Morpheme links its target, an Unsplit chunk links the part it
 * stands for when it has one, and a Filler is plain text. A zero ending
 * shows no letters, so it is left out, as the exemplar shows `Kohle|kraft|
 * werk`. None for a phraseme, and for a word with no Breakdown or Source.
 */
export function morphemesLine<L extends Dumling.Language>({
	reading,
	knowledge,
	link,
	lookup = () => [],
	policy = NO_POLICY,
}: BreakdownInputs<L>): string[] {
	if (knowledge?.breakdown === undefined && knowledge?.source === undefined)
		return [];
	const shown = propagateMorphemes(
		{
			knowledge: {
				breakdown: knowledge.breakdown,
				source: knowledge.source,
			},
			reading,
		},
		lookup,
		policy,
	);
	const pieces = (shown ?? [])
		.filter(({ letters }) => letters.length > 0)
		.map((piece) =>
			piece.kind === "Filler" || piece.target === undefined
				? plain(piece.letters)
				: link(
						{ names: namesOf<L>(piece.target), role: "breakdown" },
						piece.letters,
					),
		);
	return pieces.length === 0
		? []
		: [`${MORPHEMES_MARKER}${pieces.join("|")}`];
}

/** A Breakdown's pieces, as dumrel stores them. */
type Pieces = NonNullable<
	NonNullable<Dumrel.ReadingKnowledge["breakdown"]>["constituents"]
>;

const isPhraseme = (reading: Dumling.Reading) =>
	reading.lemma.family === "Locution" || reading.lemma.family === "Saying";

/**
 * A phraseme's Constituents as its wording reads, as tf-demo shows them:
 * each word links its unit with the letters it shows, ` · ` stands for a
 * space between words, other filler is plain text, and a fused word keeps
 * its letters together with each component linked apart (`[[in|i]][[Pfeffer|m
 * Pfeffer]]`).
 */
function wordingLine<L extends Dumling.Language>(
	constituents: Pieces,
	link: LinkRenderer<L>,
): string {
	return constituents
		.map(({ letters, target }) => {
			if (target !== undefined)
				return link(
					{ names: namesOf<L>(target), role: "breakdown" },
					letters.trim(),
				);
			return /^\s+$/u.test(letters) ? " · " : plain(letters);
		})
		.join("")
		.trim();
}

/**
 * The constituents line: the stored Constituents, one level down. A word's
 * parts show their Canonical Forms joined by ` + `, as the exemplar does
 * (`[[Kohle]] + [[Kraftwerk]]`); a filler with letters, such as a citation
 * ending, is plain text, and a hyphen or a space is left out. A phraseme's
 * show its wording (`[[Faden|den Faden]] · [[verlieren]]`).
 */
export function constituentsLine<L extends Dumling.Language>({
	reading,
	knowledge,
	link,
}: BreakdownInputs<L>): string[] {
	const constituents = knowledge?.breakdown?.constituents;
	if (constituents === undefined) return [];
	if (isPhraseme(reading)) {
		const wording = wordingLine(constituents, link);
		return wording.length === 0 ? [] : [wording];
	}
	const pieces = constituents.flatMap(({ letters, target }) => {
		if (target === undefined)
			return /\p{L}/u.test(letters) ? [plain(letters.trim())] : [];
		return [
			link(
				{ names: namesOf<L>(target), role: "breakdown" },
				target.canonicalForm,
			),
		];
	});
	return pieces.length === 0 ? [] : [pieces.join(" + ")];
}

/**
 * The Source line, tf-demo's Grundform: `← [[laufen]]` for a conversion,
 * a clipping, an acronym or a participle, and `← *historically the
 * participle of* [[lassen]]` for a participle whose meaning Drifted (texteater
 * ADR 0036).
 */
export function sourceLine<L extends Dumling.Language>({
	knowledge,
	link,
}: BreakdownInputs<L>): string[] {
	const source = knowledge?.source;
	if (source === undefined) return [];
	const target = link(
		{ names: namesOf<L>(source.target), role: "breakdown" },
		source.target.canonicalForm,
	);
	return [
		source.meaning === "Drifted"
			? `← *historically the participle of* ${target}`
			: `← ${target}`,
	];
}
