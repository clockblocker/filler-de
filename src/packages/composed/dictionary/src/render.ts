/**
 * What the store renders into its notes: link resolutions from its index,
 * the projected inverse relations, and the notes a change moves links in.
 */

import {
	type LinkResolver,
	type RenderOptions,
	shadowOf,
} from "@textfresser/lemma-note-codec";
import { resolveShadow, spellingTarget } from "dumdict";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import type { CrossroadContent } from "./crossroad";
import type { WriteOptions } from "./internal/dictionary-notes";
import type { MetadataFormat } from "./internal/note-metadata";
import {
	inverseRelationsHook,
	inverseRelationsReader,
} from "./inverse-relations";
import { formKeyOf, lemmaKeyOf, shadowKeyOf } from "./keys";
import { byCodeUnit, type NoteIndex, relationEdgesOf } from "./note-index";
import type { NoteData } from "./notes";

/** What a host renders into every note beyond the store's own projections. */
export type NoteProjections = Omit<
	RenderOptions<"de">,
	"paths" | "resolve" | "inverseRelations"
>;

/**
 * The resolution the store holds for each link (ADR-0015, texteater#1221):
 *
 * - an exact Reading goes to its Reading note;
 * - a direct claim's Lemma, a Reading note's own Lemma and a table's form
 *   spelled as its Lemma go to the Lemma note;
 * - a pending relation, which is rendered only while unresolved, and a
 *   Lemma note's own spelling go to the Crossroad note;
 * - every other sense-unknown link (a morpheme's Shadow, an inverse
 *   relation's source, a preposition or a participle's source verb not
 *   stored as named) goes to the Lemma note when its Unit Shadow matches
 *   exactly one stored Lemma, and to the Crossroad note otherwise.
 */
function linkResolver(view: NoteIndex): LinkResolver<"de"> {
	const byShadow = (shadow: Dumrel.UnitShadow & { language: "de" }) =>
		resolveShadow(
			shadow,
			view
				.lemmasNamedBy(shadowKeyOf(shadow))
				.flatMap((key) => view.lemmaData(key)?.lemmaRecord.lemma ?? []),
		);
	return ({ names, role }) => {
		switch (names.kind) {
			case "Reading":
				return { kind: "Reading", reading: names.reading };
			case "Shadow":
				return role === "pendingRelation" || role === "header"
					? spellingTarget(
							names.shadow.language,
							names.shadow.canonicalForm,
						)
					: byShadow(names.shadow);
			case "Lemma":
				// A table's form spelled as its own Lemma names that Lemma.
				if (
					role === "header" ||
					role === "relation" ||
					role === "inflection"
				)
					return { kind: "Lemma", lemma: names.lemma };
				if (
					role !== "inverseRelation" &&
					view.lemmaData(lemmaKeyOf(names.lemma))
				)
					return { kind: "Lemma", lemma: names.lemma };
				return byShadow(shadowOf(names.lemma));
		}
	};
}

/** The options every note write renders with, against one index version. */
export function renderOptionsFor(
	view: NoteIndex,
	projections: NoteProjections | undefined,
	format: MetadataFormat,
): { readonly options: WriteOptions<"de">; readonly failed: Set<string> } {
	const inverse = inverseRelationsReader(view);
	return {
		failed: inverse.failed,
		options: {
			...projections,
			format,
			inverseRelations: inverseRelationsHook(inverse.read),
			language: "de",
			resolve: linkResolver(view),
		},
	};
}

/** The form keys a Lemma's Crossroads are listed under: its own and its Surfaces'. */
function formKeysOf(data: NoteData): Set<string> {
	return new Set([
		formKeyOf(data.lemmaRecord.lemma.canonicalForm, "de"),
		...data.ownedSurfaceEntries.map(({ surface }) =>
			formKeyOf(surface.normalizedSurface, "de"),
		),
	]);
}

/** The Lemmas whose notes show inverse relations of these records' claims. */
function claimTargets(data: NoteData | undefined, into: Set<string>) {
	for (const entry of data?.readingEntries ?? [])
		for (const { targetLemmaKey } of relationEdgesOf(entry))
			into.add(targetLemmaKey);
}

/**
 * What a change to these Lemmas moves in other notes, from the index before
 * to the index after it:
 *
 * - the notes of every Lemma their claims target, which show inverse
 *   relations;
 * - when a Lemma comes or goes, the notes that link by its Unit Shadow,
 *   whose uniqueness it changes, and the targets of every claim made by a
 *   Lemma with that Shadow, whose inverse links name it;
 * - the Crossroads of every spelling the Lemmas or their Surfaces have.
 *
 * It answers more than may change; a re-render that changes nothing writes
 * nothing.
 */
export function fanOutOf(
	before: NoteIndex,
	after: NoteIndex,
	touched: Iterable<string>,
): { readonly lemmas: Set<string>; readonly formKeys: Set<string> } {
	const lemmas = new Set<string>();
	const formKeys = new Set<string>();
	const shadows = new Set<string>();
	const own = new Set(touched);
	for (const key of own) {
		const was = before.lemmaData(key);
		const is = after.lemmaData(key);
		for (const data of [was, is]) {
			if (data) for (const form of formKeysOf(data)) formKeys.add(form);
			claimTargets(data, lemmas);
		}
		const lemma = (is ?? was)?.lemmaRecord.lemma;
		if (lemma && Boolean(was) !== Boolean(is))
			shadows.add(shadowKeyOf(lemma));
	}
	for (const shadow of shadows) {
		for (const view of [before, after]) {
			for (const key of view.dependentsOf(shadow)) lemmas.add(key);
			for (const key of view.lemmasNamedBy(shadow))
				claimTargets(
					after.lemmaData(key) ?? before.lemmaData(key),
					lemmas,
				);
		}
	}
	for (const key of own) lemmas.delete(key);
	return {
		formKeys,
		lemmas: new Set([...lemmas].filter((key) => after.lemmaData(key))),
	};
}

/** What the Crossroad note of a form key lists, from the index. */
export function crossroadContentOf(
	view: NoteIndex,
	key: string,
): CrossroadContent {
	const lemmas: {
		lemma: Dumling.Lemma<"de">;
		readings: Dumling.Reading<"de">[];
	}[] = [];
	const surfaces: { form: string; lemma: Dumling.Lemma<"de"> }[] = [];
	for (const lemmaKey of view.lemmasWithForm(key)) {
		const data = view.lemmaData(lemmaKey);
		if (!data) continue;
		const { lemma } = data.lemmaRecord;
		if (formKeyOf(lemma.canonicalForm, "de") === key) {
			lemmas.push({
				lemma,
				readings: data.readingEntries.map(({ reading }) => reading),
			});
			continue;
		}
		const forms = new Set(
			data.ownedSurfaceEntries
				.map(({ surface }) => surface.normalizedSurface)
				.filter((form) => formKeyOf(form, "de") === key),
		);
		for (const form of [...forms].sort(byCodeUnit))
			surfaces.push({ form, lemma });
	}
	return { key, lemmas, surfaces };
}
