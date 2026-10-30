import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import type { LinkRenderer } from "../links";
import { emojiOf } from "./common";

/**
 * A Lemma's Formations (texteater ADR 0050): the stored words built on it,
 * those whose Constituents link to it and those whose Source names it,
 * grouped as DWDS's word-formation panel groups them and as tf-demo ports
 * it (`formationGroupOf` in `app/tf-demo/convex/model/breakdownParts.ts`):
 *
 * ```
 * <span class="note_block_title note_block_title_formations">Wortbildung</span>
 * Präfixverben: [[…/🛒 einkaufen|einkaufen]], [[…/💰 verkaufen|verkaufen]]
 * Komposita: [[…/🏭 Kohlekraftwerk|Kohlekraftwerk]]
 * Grundform von: [[…/🏃 Lauf|Lauf]]
 * ```
 *
 * Each formation's sense is known, so it links its Reading note. They are
 * computed from the stored links, never stored, and the lines are rendered
 * and never parsed back.
 */

/** A Breakdown's pieces, as dumrel stores them. */
type Pieces = NonNullable<
	NonNullable<Dumrel.ReadingKnowledge["breakdown"]>["constituents"]
>;

/** One stored word built on a Lemma, and the link by which it names it. */
export type Formation<L extends Dumling.Language> =
	| {
			readonly reading: Dumling.Reading<L>;
			readonly via: "constituents";
			/** Its Constituents, whose other pieces decide its group. */
			readonly constituents: Pieces;
	  }
	| {
			readonly reading: Dumling.Reading<L>;
			/** Its Source names the Lemma: `Lauf` from `laufen`. */
			readonly via: "source";
	  };

/**
 * The groups of a Lemma's Formations, in the order its note lists them,
 * as tf-demo orders them. `Sourced` holds the words that name the Lemma as
 * their Source, DWDS's `als Grundform`.
 */
const FORMATION_GROUPS = [
	"Prefixed",
	"Compounds",
	"Derivations",
	"Sourced",
	"Phrases",
] as const;

export type FormationGroup = (typeof FORMATION_GROUPS)[number];

/**
 * Which group a formation joins, by the Kind of its other pieces, as
 * tf-demo's `formationGroupOf`: a phraseme is a phrase, a Prefix makes a
 * prefixed word, a Suffix or Suffixoid a derivation, and words alone a
 * compound. An Interfix changes nothing.
 */
export function formationGroupOf(
	owner: { readonly family: string },
	constituents: Pieces,
): FormationGroup {
	if (owner.family === "Locution" || owner.family === "Saying")
		return "Phrases";
	const formants = constituents.flatMap(({ target }) =>
		target?.family === "Morpheme" ? [target.kind] : [],
	);
	if (formants.includes("Prefix")) return "Prefixed";
	if (formants.includes("Suffix") || formants.includes("Suffixoid"))
		return "Derivations";
	return "Compounds";
}

/** The most formations a Lemma note lists, as tf-demo caps its references. */
export const MAX_FORMATIONS = 200;

const collator = new Intl.Collator("de");
const byCodeUnit = (left: string, right: string) =>
	left < right ? -1 : left > right ? 1 : 0;

/**
 * Formations by group, in {@link FORMATION_GROUPS}' order, each group's
 * Readings by Canonical Form as German sorts it, then by identity. A
 * Reading is listed once: a word whose Constituents name the Lemma is
 * never Sourced too, as tf-demo keeps it.
 */
function formationGroups<L extends Dumling.Language>(
	formations: readonly Formation<L>[],
): {
	readonly group: FormationGroup;
	readonly readings: readonly Dumling.Reading<L>[];
}[] {
	const groupOf = new Map<
		string,
		{ group: FormationGroup; reading: Dumling.Reading<L> }
	>();
	for (const formation of formations) {
		const key = readingIdentityKey(formation.reading);
		if (formation.via === "source") {
			if (!groupOf.has(key))
				groupOf.set(key, {
					group: "Sourced",
					reading: formation.reading,
				});
			continue;
		}
		groupOf.set(key, {
			group: formationGroupOf(
				formation.reading.lemma,
				formation.constituents,
			),
			reading: formation.reading,
		});
	}
	return FORMATION_GROUPS.flatMap((group) => {
		const readings = [...groupOf.values()]
			.filter((member) => member.group === group)
			.map(({ reading }) => reading)
			.sort(
				(left, right) =>
					collator.compare(
						left.lemma.canonicalForm,
						right.lemma.canonicalForm,
					) ||
					byCodeUnit(
						readingIdentityKey(left),
						readingIdentityKey(right),
					),
			);
		return readings.length === 0 ? [] : [{ group, readings }];
	});
}

/**
 * Each group's label, as the dictionary notes title their sections in
 * German: DWDS's panel, tf-demo's `Prefixed verbs`, `Compounds`,
 * `Derivations`, `Base of` and `Phrases`.
 */
function groupLabel(
	group: FormationGroup,
	readings: readonly Dumling.Reading[],
): string {
	switch (group) {
		case "Prefixed":
			return readings.every(({ lemma }) => lemma.kind === "VERB")
				? "Präfixverben"
				: "Präfixbildungen";
		case "Compounds":
			return "Komposita";
		case "Derivations":
			return "Ableitungen";
		case "Sourced":
			return "Grundform von";
		case "Phrases":
			return "Wendungen";
	}
}

/**
 * One line per group, `Komposita: [[…|Atomkraftwerk]], [[…|Kohlekraftwerk]]`,
 * each formation linking its Reading note by its Canonical Form, with its
 * Emoji Description when another formation shows the same form, as tf-demo
 * tells them apart. At most {@link MAX_FORMATIONS} are listed; a group cut
 * short ends with `… <n> weitere`, as DWDS folds its panel.
 */
export function formationLines<L extends Dumling.Language>(
	formations: readonly Formation<L>[],
	link: LinkRenderer<L>,
): string[] {
	const groups = formationGroups(formations);
	const shown = new Map<string, number>();
	for (const { readings } of groups)
		for (const { lemma } of readings)
			shown.set(
				lemma.canonicalForm,
				(shown.get(lemma.canonicalForm) ?? 0) + 1,
			);
	let left = MAX_FORMATIONS;
	return groups.map(({ group, readings }) => {
		const listed = readings.slice(0, Math.max(0, left));
		left -= listed.length;
		const links = listed.map((reading) => {
			const form = reading.lemma.canonicalForm;
			const emoji = emojiOf(reading);
			return link(
				{ names: { kind: "Reading", reading }, role: "formation" },
				(shown.get(form) ?? 0) > 1 && emoji !== undefined
					? `${form} ${emoji}`
					: form,
			);
		});
		const folded = readings.length - listed.length;
		const rest = folded > 0 ? [`… ${folded} weitere`] : [];
		return `${groupLabel(group, readings)}: ${[links.join(", "), ...rest].filter((part) => part.length > 0).join(" ")}`;
	});
}
