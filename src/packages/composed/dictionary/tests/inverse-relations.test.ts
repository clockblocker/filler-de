import { describe, expect, test } from "bun:test";
import {
	crossroadNotePath,
	legacyLemmaNotePath,
} from "@textfresser/lemma-note-codec";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import type { PlannedChangeOp } from "dumdict";
import { type AddNewNoteRequest, createDumdictPlanner } from "dumdict/planning";
import type * as Dumling from "dumling/types";
import { readBundle, serializeBundle } from "../src/bundle";
import { noteMetadataHelper } from "../src/internal/note-metadata";
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
import { commit, openStore, seed } from "./support/store";

const planner = createDumdictPlanner("de");
const gehenPath = legacyLemmaNotePath(gehen).path;
const laufenPath = legacyLemmaNotePath(laufen).path;
const schreitenPath = legacyLemmaNotePath(schreiten).path;
const springenPath = legacyLemmaNotePath(springen).path;

/**
 * An inverse links its source's Lemma by its Unit Shadow: the Crossroad
 * note of its spelling (ADR-0015), as the store holds no resolution for it.
 */
const linkTo = (reading: Dumling.Reading<"de", "Lexeme", "VERB">) =>
	`[[${crossroadNotePath(reading.lemma.canonicalForm, "de").path.replace(/\.md$/u, "")}|${reading.lemma.canonicalForm}]]`;

/** The visible body, without the trailing blank lines the metadata pads it with. */
const visible = (content: string | undefined) =>
	noteMetadataHelper.body(content ?? "").trimEnd();

/** The lines of the note's `inverse_relation` renderings, if it has any. */
const inverseBlock = (content: string | undefined) => {
	if (content === undefined) return undefined;
	const lines = readBundle(content).segments.flatMap((segment) =>
		segment.type === "rendering" && segment.block === "inverse_relation"
			? segment.lines
			: [],
	);
	return lines.length === 0 ? undefined : lines.join("\n");
};

/** The visible body with its `inverse_relation` renderings cut out. */
const withoutInverseBlock = (content: string | undefined) => {
	if (content === undefined) return undefined;
	const read = readBundle(content);
	const cut = new Set(
		read.segments.flatMap((segment) =>
			segment.type === "rendering" && segment.block === "inverse_relation"
				? Array.from(
						{ length: segment.end - segment.start },
						(_, at) => segment.start + at,
					)
				: [],
		),
	);
	return read.lines
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

const dataOf = (content: string | undefined) => {
	const { data } = readBundle(content ?? "");
	if (!data.ok) throw new Error("Expected a valid note");
	return data.data;
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

const schreitenNote: AddNewNoteRequest<"de"> = {
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
				request: schreitenNote,
			}),
		),
	);
	if (context.intent !== "addNewNote") throw new Error("Expected addNewNote");
	const outcome = planner.addNewNote(context, schreitenNote);
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
		expect(vault.markdownPaths()).toEqual([gehenPath]);

		expect(await addSchreiten(store)).toMatchObject({
			status: "committed",
		});

		// A holds the direct claim, and keeps its Shadow relation resolved
		// to B (texteater#1221).
		expect(
			dataOf(vault.content(gehenPath)).readingEntries[0]?.knowledge,
		).toEqual({ semanticRelations: { synonym: [schreiten] } });
		expect(dataOf(vault.content(gehenPath)).pendingRelations).toEqual([
			{ ...pendingFrom(gehenReading), resolvedLemma: schreiten },
		]);

		// B renders A as a projection, linked to A's Crossroad, and stores
		// no relation of its own.
		const schreitenContent = vault.content(schreitenPath);
		expect(inverseBlock(schreitenContent)).toMatch(
			new RegExp(
				`\\n= ${linkTo(gehenReading).replace(/[[\]^|.]/gu, "\\$&")}$`,
				"u",
			),
		);
		const stored = dataOf(schreitenContent);
		expect(stored.readingEntries[0]?.knowledge).toBeUndefined();
		expect(stored.pendingRelations).toEqual([]);
		// A's note shows no projection: nothing claims a relation on A.
		expect(inverseBlock(vault.content(gehenPath))).toBeUndefined();
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
		const typed = typeAtEnd(vault.content(schreitenPath), words);
		await vault.userWrite(schreitenPath, typed);
		const before = vault.content(schreitenPath);
		vault.batches.length = 0;

		await seed(store, [synonym(gehenReading, schreiten)]);

		// A's own rewrite, then B's re-render once it landed, both CAS
		// transforms.
		expect(vault.batches.map(pathsOf)).toEqual([
			[gehenPath],
			[schreitenPath],
		]);
		expect(
			vault.batches
				.flat()
				.every(({ kind }) => kind === VaultActionKind.ProcessMdFile),
		).toBe(true);

		const after = vault.content(schreitenPath);
		expect(after).not.toBe(before);
		expect(inverseBlock(after)).toContain(`= ${linkTo(gehenReading)}`);
		// The data stays, and so does every other byte, except that the
		// typed text moves under the Note title, where freeform stands.
		expect(dataOf(after)).toEqual(dataOf(before));
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
		const bare = vault.content(schreitenPath);
		await seed(store, [synonym(gehenReading, schreiten)]);
		expect(inverseBlock(vault.content(schreitenPath))).toBeDefined();

		await seed(store, [retractSynonym(gehenReading)]);
		expect(inverseBlock(vault.content(schreitenPath))).toBeUndefined();
		expect(vault.content(schreitenPath)).toBe(bare);
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
		expect(vault.batches.flatMap(pathsOf)).toEqual([gehenPath]);
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
		expect(vault.batches.flatMap(pathsOf)).toEqual([gehenPath]);
		expect(inverseBlock(vault.content(schreitenPath))).toBeUndefined();
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
		expect(inverseBlock(vault.content(schreitenPath))).toContain(
			`= ${[gehenReading, laufenReading].map(linkTo).join(", ")}`,
		);
		expect(inverseBlock(vault.content(laufenPath))).toBeUndefined();
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
		const edited = typeAtEnd(vault.content(schreitenPath), typedText);
		vault.silentWrite(schreitenPath, edited);

		expect(
			await commit(store, [synonym(gehenReading, schreiten)]),
		).toMatchObject({ status: "committed" });
		const after = vault.content(schreitenPath);
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
		vault.failNextWrite((_, path) => path === schreitenPath, 3);

		expect(
			await commit(store, [synonym(gehenReading, schreiten)]),
		).toMatchObject({ status: "committed" });
		expect(
			dataOf(vault.content(gehenPath)).readingEntries[0]?.knowledge,
		).toEqual({ semanticRelations: { synonym: [schreiten] } });
		expect(inverseBlock(vault.content(schreitenPath))).toBeUndefined();

		// The next commit that reaches it repairs the stale projection.
		await seed(store, [contribute(gehenReading, "sich fortbewegen")]);
		expect(inverseBlock(vault.content(schreitenPath))).toContain(
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
		expect(inverseBlock(vault.content(schreitenPath))).toContain(
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
		const block = inverseBlock(vault.content(schreitenPath)) ?? "";
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
		const block = inverseBlock(vault.content(schreitenPath)) ?? "";
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
		const bare = vault.content(schreitenPath);
		await seed(store, [synonym(gehenReading, schreiten)]);
		expect(inverseBlock(vault.content(schreitenPath))).toBeDefined();

		await vault.userDelete(gehenPath);
		expect(vault.content(schreitenPath)).toBe(bare);
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
		expect(inverseBlock(vault.content(schreitenPath))).toBeDefined();
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
		const current = vault.content(schreitenPath) ?? "";
		const data = dataOf(current);
		vault.silentWrite(
			schreitenPath,
			serializeBundle(
				current,
				{
					...data,
					readingEntries: data.readingEntries.map((entry) => ({
						...entry,
						knowledge: {
							semanticRelations: { antonym: [springen] },
						},
					})),
				},
				{},
				"Hidden",
			),
		);

		// gehen's claim reaches schreiten, whose file is ahead of the index.
		const result = await commit(store, [contribute(gehenReading, "gehen")]);
		expect(result.status).toBe("committed");
		expect(inverseBlock(vault.content(springenPath))).toContain(
			`≠ ${linkTo(schreitenReading)}`,
		);
		// The edit the commit never planned against moves the revision past it.
		expect(await run(store.revision)).not.toBe(
			"nextRevision" in result ? result.nextRevision : undefined,
		);
		await expectIndexMatchesFiles(store, vault);
	});
});
