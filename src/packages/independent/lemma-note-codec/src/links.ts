import { type LinkTarget, spellingTarget } from "dumdict";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import {
	crossroadNotePath,
	lemmaNotePath,
	readingNotePath,
} from "./path/note-path";

/**
 * Links (spec: Links). The codec decides no link target itself: each link
 * it renders is a {@link LinkSubject}, what the note's data names and why,
 * and the caller's {@link LinkResolver} answers the dumdict `LinkTarget`
 * the store holds for it. The default resolver is what a note knows
 * without a lookup.
 */

/** Why a note links something. */
export type LinkRole =
	/** A Reading note's header names its Lemma; a Lemma note's names its spelling. */
	| "header"
	/** A Lemma note's link to one of its own Reading notes. */
	| "reading"
	/** A direct Semantic Relation claim, by Lemma or by exact Reading. */
	| "relation"
	/** A Pending Semantic Relation, by its Unit Shadow. */
	| "pendingRelation"
	/** The source of a claim on this Reading, by its Lemma's Unit Shadow. */
	| "inverseRelation"
	/** A Valency Frame's preposition. */
	| "valency"
	/** An inflection table's form spelled as its own Lemma: `N: die [[Mutter]], die Mütter`. */
	| "inflection"
	/** A Breakdown piece or a Source: a Lemma, or a Unit Shadow while pending (ADR 0050). */
	| "breakdown"
	/** A Lemma note's Formation: the exact Reading whose Constituents or Source name the Lemma. */
	| "formation";

/** What the note's data names. */
export type LinkNamed<L extends Dumling.Language = Dumling.Language> =
	| { readonly kind: "Lemma"; readonly lemma: Dumling.Lemma<L> }
	| { readonly kind: "Reading"; readonly reading: Dumling.Reading<L> }
	| {
			readonly kind: "Shadow";
			readonly shadow: Dumrel.UnitShadow & { readonly language: L };
	  };

export type LinkSubject<L extends Dumling.Language = Dumling.Language> = {
	readonly role: LinkRole;
	readonly names: LinkNamed<L>;
};

/** Where a link goes: the resolution the store holds for it (texteater#1221). */
export type LinkResolver<L extends Dumling.Language = Dumling.Language> = (
	subject: LinkSubject<L>,
) => LinkTarget<L>;

/** A Lemma's Unit Shadow: what a sense-unknown link knows of it. */
export function shadowOf<L extends Dumling.Language>(
	lemma: Dumling.Lemma<L>,
): Dumrel.UnitShadow & { readonly language: L } {
	return {
		canonicalForm: lemma.canonicalForm,
		family: lemma.family,
		kind: lemma.kind,
		language: lemma.language,
	} as Dumrel.UnitShadow & { readonly language: L };
}

/**
 * What a note knows without a lookup:
 *
 * - an exact Reading, which only an exact claim names, goes to its Reading
 *   note;
 * - a Lemma a direct claim names, a Reading note's own Lemma, a table's
 *   form spelled as its Lemma, and a Breakdown piece's or a Source's Lemma,
 *   go to the Lemma note: dumdict holds a direct claim only on a stored
 *   Lemma, a table is its own Lemma's, and a Breakdown targets a Lemma once
 *   it is stored (ADR 0050);
 * - everything else goes to its spelling's Crossroad note: Unit Shadows,
 *   inverse sources, a preposition that may be stored nowhere, and a Lemma
 *   note's own spelling.
 */
export function defaultResolve<L extends Dumling.Language>({
	names,
	role,
}: LinkSubject<L>): LinkTarget<L> {
	if (names.kind === "Reading")
		return { kind: "Reading", reading: names.reading };
	if (
		names.kind === "Lemma" &&
		(role === "relation" ||
			role === "header" ||
			role === "inflection" ||
			role === "breakdown")
	)
		return { kind: "Lemma", lemma: names.lemma };
	const { canonicalForm, language } =
		names.kind === "Shadow" ? names.shadow : names.lemma;
	return spellingTarget(language as L, canonicalForm);
}

/**
 * Where each kind of target lives, as a link path without `.md`, optionally
 * with a `#` subpath. Undefined renders a bare link to the alias. The
 * default is the path module (ADR-0015): Lemma and Reading notes for
 * German, and the Crossroad note of any language.
 */
export type NotePaths<L extends Dumling.Language = Dumling.Language> = {
	readonly lemma: (lemma: Dumling.Lemma<L>) => string | undefined;
	readonly reading: (reading: Dumling.Reading<L>) => string | undefined;
	readonly spelling: (language: L, key: string) => string | undefined;
};

const withoutExtension = (path: string) => path.replace(/\.md$/u, "");

function attempt(path: () => string): string | undefined {
	try {
		return withoutExtension(path());
	} catch {
		return undefined;
	}
}

export const DEFAULT_PATHS: NotePaths = {
	lemma: (lemma) =>
		lemma.language === "de"
			? attempt(() => lemmaNotePath(lemma as Dumling.Lemma<"de">).path)
			: undefined,
	reading: (reading) =>
		reading.lemma.language === "de"
			? attempt(
					() =>
						readingNotePath(reading as Dumling.Reading<"de">).path,
				)
			: undefined,
	spelling: (language, key) =>
		attempt(() => crossroadNotePath(key, language).path),
};

/** An alias without what would end or split a wikilink. */
const aliasText = (alias: string) => alias.replace(/[[\]|]/gu, "");

/** `[[path|alias]]`, or `[[alias]]` without a path. */
export function wikilink(path: string | undefined, alias: string): string {
	const shown = aliasText(alias);
	return path === undefined ? `[[${shown}]]` : `[[${path}|${shown}]]`;
}

/** Renders a subject as a wikilink: its resolution, at its path, with an alias. */
export type LinkRenderer<L extends Dumling.Language = Dumling.Language> = (
	subject: LinkSubject<L>,
	alias?: string,
) => string;

/** The form a subject shows, as the legacy notes linked: `Kohle`, never a path. */
function shownForm({ names }: LinkSubject): string {
	switch (names.kind) {
		case "Lemma":
			return names.lemma.canonicalForm;
		case "Reading":
			return names.reading.lemma.canonicalForm;
		case "Shadow":
			return names.shadow.canonicalForm;
	}
}

function languageOf<L extends Dumling.Language>({ names }: LinkSubject<L>): L {
	switch (names.kind) {
		case "Lemma":
			return names.lemma.language as L;
		case "Reading":
			return names.reading.lemma.language as L;
		case "Shadow":
			return names.shadow.language;
	}
}

/**
 * Renders each subject as `[[path|alias]]`: the target `resolve` answers,
 * at the path `paths` gives it, aliased by the subject's spelling unless
 * the caller names another alias.
 */
export function linkRenderer<L extends Dumling.Language>(
	resolve: LinkResolver<L>,
	paths: NotePaths<L>,
): LinkRenderer<L> {
	return (subject, alias = shownForm(subject)) => {
		const target = resolve(subject);
		switch (target.kind) {
			case "Lemma":
				return wikilink(paths.lemma(target.lemma), alias);
			case "Reading":
				return wikilink(paths.reading(target.reading), alias);
			case "Spelling":
				return wikilink(
					paths.spelling(target.language, target.key),
					alias,
				);
			case "Surface":
				// A Surface link needs its owner's Lemma note; no rendering of
				// the codec's resolves to one, so it falls back to the spelling.
				return wikilink(
					paths.spelling(languageOf(subject), alias),
					alias,
				);
		}
	};
}
