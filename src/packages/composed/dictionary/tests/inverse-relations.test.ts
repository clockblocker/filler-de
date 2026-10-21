import { describe, expect, test } from "bun:test";
import { linesOf, readBody } from "@textfresser/lemma-note-codec";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import type { PlannedChangeOp } from "dumdict";
import { type AddNewNoteRequest, createDumdictPlanner } from "dumdict/planning";
import type * as Dumling from "dumling/types";
import { writeReadingNote } from "../../../../stateless-helpers/dictionary-notes";
import {
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "../src/internal/note-metadata";
import { classifyFile } from "../src/notes";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	contribute,
	createLemma,
	createPending,
	createReading,
	gehen,
	gehenReading,
	laufen,
	laufenReading,
	pendingFrom,
	readingEntry,
	readingOf,
	schreiten,
	schreitenReading,
	springen,
	springenReading,
	synonym,
} from "./support/fixtures";
import { crossroadPath, lemmaPath, readingPath } from "./support/paths";
import { commit, openStore, seed } from "./support/store";

const planner = createDumdictPlanner("de");
const gehenPath = lemmaPath(gehen);
const gehenNote = readingPath(gehenReading);
const laufenNote = readingPath(laufenReading);
const schreitenNote = readingPath(schreitenReading);
const springenNote = readingPath(springenReading);

/**
 * An inverse links its source's Lemma by its Unit Shadow: the Lemma note
 * when the Shadow names one stored Lemma, as every source here does.
 */
const linkTo = (reading: Dumling.Reading<"de", "Lexeme", "VERB">) =>
	`[[${lemmaPath(reading.lemma).replace(/\.md$/u, "")}|${reading.lemma.canonicalForm}]]`;

/** The visible body, without the trailing blank lines the metadata pads it with. */
const visible = (content: string | undefined) =>
	noteMetadataHelper.body(content ?? "").trimEnd();

const segmentsOf = (content: string) =>
	readBody(
		noteMetadataHelper.body(content),
		noteMetadataHelper.read(content, ReadingNoteMetadata, "Hidden")
			?.rendering ?? [],
	);

/** The lines of the note's `inverse_relation` renderings, if it has any. */
const inverseBlock = (content: string | undefined) => {
	if (content === undefined) return undefined;
	const lines = segmentsOf(content).flatMap((segment) =>
		segment.type === "rendering" && segment.block === "inverse_relation"
			? segment.lines
			: [],
	);
	return lines.length === 0 ? undefined : lines.join("\n");
};

/** The visible body with its `inverse_relation` renderings cut out. */
const withoutInverseBlock = (content: string | undefined) => {
	if (content === undefined) return undefined;
	const cut = new Set(
		segmentsOf(content).flatMap((segment) =>
			segment.type === "rendering" && segment.block === "inverse_relation"
				? Array.from(
						{ length: segment.end - segment.start },
						(_, at) => segment.start + at,
					)
				: [],
		),
	);
	return linesOf(noteMetadataHelper.body(content))
		.filter((_, at) => !cut.has(at))
		.join("\n")
		.replace(/\n{3,}/gu, "\n\n\n")
		.trimEnd();
};

/** Types `text` at the end of the visible body, as a user would. */
const typeAtEnd = (content: string | undefined, text: string) =>
	noteMetadataHelper.mapBody((body) => `${body.trimEnd()}\n\n${text}\n`)(
		content ?? "",
	);

/** A Reading note's records, read from its file alone. */
const dataOf = (path: string, content: string | undefined) => {
	const entry = classifyFile(path, content ?? "");
	if (entry.kind !== "reading") throw new Error("Expected a Reading note");
	return entry.data;
};

const claim = (
	reading: Dumling.Reading<"de">,
	relation: "antonym" | "hypernym" | "synonym",
	target: Dumling.Lemma<"de">,
): PlannedChangeOp<"de"> => ({
	ops: [
		{
			envelope: {
				change: {
					aspect: "semanticRelations",
					kind: "Contribute",
					relation,
					value: [target],
				},
				reading,
			},
			kind: "applyKnowledgeChange",
		},
	],
	preconditions: [],
	reading,
	type: "patchReading",
});

const retractSynonym = (
	reading: Dumling.Reading<"de">,
): PlannedChangeOp<"de"> => ({
	ops: [
		{
			envelope: {
				change: {
					aspect: "semanticRelations",
					kind: "Retract",
					relation: "synonym",
				},
				reading,
			},
			kind: "applyKnowledgeChange",
		},
	],
	preconditions: [],
	reading,
	type: "patchReading",
});

const schreitenDraft: AddNewNoteRequest<"de"> = {
	draft: {
		note: {
			attestationLinks: [],
			attestedTranslations: ["stride"],
			notes: "",
		},
		reading: schreitenReading,
	},
};

async function addSchreiten(
	store: Awaited<ReturnType<typeof openStore>>["store"],
) {
	const context = await run(
		store.loadReadingEntryContext(
			planner.contextRequest({
				intent: "addNewNote",
				request: schreitenDraft,
			}),
		),
	);
	if (context.intent !== "addNewNote") throw new Error("Expected addNewNote");
	const outcome = planner.addNewNote(context, schreitenDraft);
	if (outcome.status !== "planned") throw new Error(JSON.stringify(outcome));
	return run(store.commitChanges(outcome.plan));
}

/** The paths one batch writes or creates. */
const pathsOf = (batch: readonly { kind: string; payload: unknown }[]) =>
	batch.map(({ payload }) => {
		const { splitPath } = payload as {
			splitPath: { pathParts: string[]; basename: string };
		};
		return `${[...splitPath.pathParts, splitPath.basename].join("/")}.md`;
	});

describe("inverse relations are projected, never stored", () => {
	test("A with synonym → B, then B created: B shows A only as a projection", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
			createPending(pendingFrom(gehenReading)),
		]);
		expect(vault.markdownPaths()).toEqual(
			[gehenPath, gehenNote, crossroadPath("gehen")].sort(),
		);

		expect(await addSchreiten(store)).toMatchObject({
			status: "committed",
		});

		// A holds the direct claim, and keeps its Shadow relation resolved
		// to B (texteater#1221).
		expect(
			dataOf(gehenNote, vault.content(gehenNote)).readingEntry.knowledge,
		).toEqual({ semanticRelations: { synonym: [schreiten] } });
		expect(
			dataOf(gehenNote, vault.content(gehenNote)).pendingRelations,
		).toEqual([{ ...pendingFrom(gehenReading), resolvedLemma: schreiten }]);

		// B renders A as a projection, linked to A's Crossroad, and stores
		// no relation of its own.
		const schreitenContent = vault.content(schreitenNote);
		expect(inverseBlock(schreitenContent)).toMatch(
			new RegExp(
				`\\n= ${linkTo(gehenReading).replace(/[[\]^|.]/gu, "\\$&")}$`,
				"u",
			),
		);
		const stored = dataOf(schreitenNote, schreitenContent);
		expect(stored.readingEntry.knowledge).toBeUndefined();
		expect(stored.pendingRelations).toEqual([]);
		// A's note shows no projection: nothing claims a relation on A.
		expect(inverseBlock(vault.content(gehenNote))).toBeUndefined();
		await expectIndexMatchesFiles(store, vault);
	});

	test("A's commit writes B only to re-render B's projection, keeping B's text", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading, { notes: "mine" })),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		const words = "My own words about schreiten.";
		const typed = typeAtEnd(vault.content(schreitenNote), words);
		await vault.userWrite(schreitenNote, typed);
		const before = vault.content(schreitenNote);
		vault.batches.length = 0;

		await seed(store, [synonym(gehenReading, schreiten)]);

		// A's own rewrite, then B's re-render in the next batch, both
		// compare-and-swaps.
		expect(vault.batches.map(pathsOf)).toEqual([
			[gehenNote],
			[schreitenNote],
		]);
		expect(
			vault.batches
				.flat()
				.every(({ kind }) => kind === VaultActionKind.ProcessMdFile),
		).toBe(true);

		const after = vault.content(schreitenNote);
		expect(after).not.toBe(before);
		expect(inverseBlock(after)).toContain(`= ${linkTo(gehenReading)}`);
		// The data stays, and so does every other byte, except that the
		// typed text moves under the Note title, where freeform stands.
		expect(dataOf(schreitenNote, after)).toEqual(
			dataOf(schreitenNote, before),
		);
		expect(withoutInverseBlock(after)).toBe(
			visible(before)
				.replace(`\n\n${words}`, "")
				.replace("\nmine", `\nmine\n${words}`),
		);
		expect(after?.split(words)).toHaveLength(2);
		await expectIndexMatchesFiles(store, vault);
	});

	test("removing the claim re-renders B without the projection", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		const bare = vault.content(schreitenNote);
		await seed(store, [synonym(gehenReading, schreiten)]);
		expect(inverseBlock(vault.content(schreitenNote))).toBeDefined();

		await seed(store, [retractSynonym(gehenReading)]);
		expect(inverseBlock(vault.content(schreitenNote))).toBeUndefined();
		expect(vault.content(schreitenNote)).toBe(bare);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a commit that changes no claim on B leaves B's file alone", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
			synonym(gehenReading, schreiten),
		]);
		vault.batches.length = 0;

		await seed(store, [contribute(gehenReading, "to go on foot")]);
		expect(vault.batches.flatMap(pathsOf)).toEqual([gehenNote]);
	});

	test("a Lemma target on a homonymous Lemma projects nothing (ADR 0011)", async () => {
		const otherSchreiten = readingOf(schreiten, "🪜");
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createReading(readingEntry(otherSchreiten)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		vault.batches.length = 0;
		await seed(store, [synonym(gehenReading, schreiten)]);
		expect(vault.batches.flatMap(pathsOf)).toEqual([gehenNote]);
		expect(inverseBlock(vault.content(schreitenNote))).toBeUndefined();
	});

	test("every claim on B shows, each linked to its source Reading", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
			createLemma(laufen),
			createReading(readingEntry(laufenReading)),
		]);
		await seed(store, [
			synonym(gehenReading, schreiten),
			synonym(laufenReading, schreiten),
		]);
		expect(inverseBlock(vault.content(schreitenNote))).toContain(
			`= ${[gehenReading, laufenReading].map(linkTo).join(", ")}`,
		);
		expect(inverseBlock(vault.content(laufenNote))).toBeUndefined();
	});

	test("a target whose file is ahead of the index is re-read and still re-rendered", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		const typedText = "Typed behind VAM's back.";
		const edited = typeAtEnd(vault.content(schreitenNote), typedText);
		vault.silentWrite(schreitenNote, edited);

		expect(
			await commit(store, [synonym(gehenReading, schreiten)]),
		).toMatchObject({ status: "committed" });
		const after = vault.content(schreitenNote);
		expect(after).toContain("Typed behind VAM's back.");
		// The typed text takes the Note placeholder's place.
		expect(withoutInverseBlock(after)).toBe(
			visible(edited)
				.replace(`\n\n${typedText}`, "")
				.replace("*You can write here*", typedText),
		);
		expect(inverseBlock(after)).toContain(`= ${linkTo(gehenReading)}`);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a re-render that loses a race never fails the commit", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		vault.failNextWrite((_, path) => path === schreitenNote, 1000);

		expect(
			await commit(store, [synonym(gehenReading, schreiten)]),
		).toMatchObject({ status: "committed" });
		vault.failNextWrite(() => false);
		expect(
			dataOf(gehenNote, vault.content(gehenNote)).readingEntry.knowledge,
		).toEqual({ semanticRelations: { synonym: [schreiten] } });
		expect(inverseBlock(vault.content(schreitenNote))).toBeUndefined();

		// The next commit that reaches it repairs the stale projection.
		await seed(store, [contribute(gehenReading, "sich fortbewegen")]);
		expect(inverseBlock(vault.content(schreitenNote))).toContain(
			`= ${linkTo(gehenReading)}`,
		);
		await expectIndexMatchesFiles(store, vault);
	});

	test("an asymmetric claim projects its inverse: hypernym shows as hyponym", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		await seed(store, [claim(gehenReading, "hypernym", schreiten)]);
		expect(inverseBlock(vault.content(schreitenNote))).toContain(
			`⊂ ${linkTo(gehenReading)}`,
		);
	});

	test("a source Lemma whose Readings both make the claim shows once", async () => {
		const gehenOnFoot = readingOf(gehen, "🦵");
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
			createReading(readingEntry(gehenOnFoot)),
		]);
		await seed(store, [
			synonym(gehenReading, schreiten),
			synonym(gehenOnFoot, schreiten),
		]);
		const block = inverseBlock(vault.content(schreitenNote)) ?? "";
		expect(block).toContain(`= ${linkTo(gehenReading)}`);
		expect(block.split(linkTo(gehenOnFoot))).toHaveLength(2);
	});

	test("only inverses show: a substitution through a synonym does not", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(springen),
			createReading(readingEntry(springenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		await seed(store, [
			synonym(gehenReading, schreiten),
			claim(gehenReading, "antonym", springen),
			claim(springenReading, "hypernym", schreiten),
		]);
		const block = inverseBlock(vault.content(schreitenNote)) ?? "";
		expect(block).toContain(`= ${linkTo(gehenReading)}`);
		expect(block).toContain(`⊂ ${linkTo(springenReading)}`);
		expect(block).not.toContain("antonym");
	});

	test("deleting the source note by hand re-renders its targets", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		const bare = vault.content(schreitenNote);
		await seed(store, [synonym(gehenReading, schreiten)]);
		expect(inverseBlock(vault.content(schreitenNote))).toBeDefined();

		await vault.userDelete(gehenPath);
		expect(vault.content(schreitenNote)).toBe(bare);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a commit returns its own revision, which re-renders do not move", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		const result = await commit(store, [synonym(gehenReading, schreiten)]);
		expect(inverseBlock(vault.content(schreitenNote))).toBeDefined();
		expect(result).toEqual({
			nextRevision: await run(store.revision),
			status: "committed",
		});
	});

	test("a hand edit a re-render finds on disk re-renders the notes it claims on", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(schreiten),
			createReading(readingEntry(schreitenReading)),
			createLemma(springen),
			createReading(readingEntry(springenReading)),
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
			synonym(gehenReading, schreiten),
		]);
		const current = vault.content(schreitenNote) ?? "";
		const { readingEntry: entry } = dataOf(schreitenNote, current);
		vault.silentWrite(
			schreitenNote,
			writeReadingNote(
				{
					lemmaRecord: { lemma: schreiten },
					ownedSurfaceEntries: [],
					pendingRelations: [],
					readingEntries: [
						{
							...entry,
							knowledge: {
								semanticRelations: { antonym: [springen] },
							},
						},
					],
				},
				schreitenReading,
				{ format: "Hidden", language: "de" },
			)(current),
		);

		// gehen's claim reaches schreiten, whose file is ahead of the index.
		const result = await commit(store, [contribute(gehenReading, "gehen")]);
		expect(result.status).toBe("committed");
		expect(inverseBlock(vault.content(springenNote))).toContain(
			`≠ ${linkTo(schreitenReading)}`,
		);
		// The edit the commit never planned against moves the revision past it.
		expect(await run(store.revision)).not.toBe(
			"nextRevision" in result ? result.nextRevision : undefined,
		);
		await expectIndexMatchesFiles(store, vault);
	});
});
