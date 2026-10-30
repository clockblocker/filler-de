/**
 * dumdict refuses to plan from a slice that holds a claim on a Lemma no
 * readable note holds, such as a quarantined one (system ADR 0011). The
 * store keeps such claims, so a Shadow re-evaluation chunk that loads one
 * fails; the chunks after it still run.
 */
import { describe, expect, test } from "bun:test";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import { directSemanticRelationValues } from "dumrel";
import {
	LemmaNoteMetadata,
	noteMetadataHelper,
} from "../src/internal/note-metadata";
import { run } from "./support/files";
import {
	createLemma,
	createPending,
	createReading,
	gehen,
	gehenReading,
	laufen,
	laufenReading,
	readingEntry,
	readingOf,
	schreiten,
	schreitenReading,
	springen,
	springenReading,
	synonym,
	verb,
} from "./support/fixtures";
import { lemmaPath } from "./support/paths";
import { openStore, seed } from "./support/store";

const huepfen = verb("hüpfen");
const rennen = verb("rennen");
const shadowOf = (lemma: typeof springen) => ({
	canonicalForm: lemma.canonicalForm,
	family: lemma.family,
	kind: lemma.kind,
	language: lemma.language,
});

describe("Shadow re-evaluation runs every chunk", () => {
	test("a chunk dumdict refuses to plan is skipped, and a later one still resolves", async () => {
		// One chunk is 8 records: gehen's 8 fill the first, laufen's 1 the next.
		const relations = directSemanticRelationValues.filter(
			(relation) => relation !== "synonym",
		);
		const gehenPending = [
			...relations.map((relation) =>
				createPendingSemanticRelationRecord(gehenReading, {
					relation,
					target: shadowOf(springen),
				}),
			),
			...["synonym" as const, "antonym" as const]
				.slice(0, 8 - relations.length)
				.map((relation) =>
					createPendingSemanticRelationRecord(gehenReading, {
						relation,
						target: shadowOf(huepfen),
					}),
				),
		];
		expect(gehenPending).toHaveLength(8);
		const laufenPending = createPendingSemanticRelationRecord(
			laufenReading,
			{
				relation: "synonym",
				target: shadowOf(rennen),
			},
		);
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
			synonym(gehenReading, schreiten),
			...gehenPending.map(createPending),
			createLemma(laufen),
			createReading(readingEntry(laufenReading)),
			createPending(laufenPending),
		]);
		// A hand edit breaks schreiten's Lemma note: the store quarantines
		// it and keeps gehen's claim on it.
		const path = lemmaPath(schreiten);
		await vault.userWrite(
			path,
			noteMetadataHelper.update(
				LemmaNoteMetadata,
				(value) =>
					value === null
						? null
						: { ...value, lemma: { canonicalForm: 1 } },
				"Hidden",
			)(vault.content(path) ?? ""),
		);

		// The Lemmas every Shadow names arrive. A store opened on the vault
		// then re-evaluates every Shadow relation they settle.
		await seed(store, [
			createLemma(springen),
			createReading(readingEntry(springenReading)),
			createLemma(huepfen),
			createReading(readingEntry(readingOf(huepfen, "🐇"))),
			createLemma(rennen),
			createReading(readingEntry(readingOf(rennen, "💨"))),
		]);

		const reopened = (await openStore(vault)).store;
		const pendingOf = async (lemma: typeof gehen) =>
			(await run(reopened.lemmaNote(lemma)))?.pendingRelations ?? [];
		// gehen's chunk loads its claim on schreiten, so it stays unresolved.
		expect(
			(await pendingOf(gehen)).every(
				({ resolvedLemma }) => resolvedLemma === undefined,
			),
		).toBe(true);
		// laufen's chunk comes after it and resolves.
		expect(await pendingOf(laufen)).toEqual([
			{ ...laufenPending, resolvedLemma: rennen },
		]);
	});
});
