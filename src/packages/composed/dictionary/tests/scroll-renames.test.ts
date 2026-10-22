/**
 * A renamed Scroll's refs follow it (#99): whoever renames it, the store
 * rewrites every ref naming it, in one transaction, and Deine Kontexte
 * shows each ref once.
 */
import { describe, expect, test } from "bun:test";
import { freeformOf, parseReadingNote } from "@textfresser/lemma-note-codec";
import type { AttestationLink } from "dumdict";
import type * as Dumling from "dumling/types";
import {
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "../src/internal/note-metadata";
import { FakeVault, vamWrite } from "./support/fake-vault";
import { run } from "./support/files";
import {
	createLemma,
	createReading,
	createSurface,
	gehen,
	gehenReading,
	gehtSurfaceEntry,
	readingEntry,
	readingOf,
} from "./support/fixtures";
import { readingPath } from "./support/paths";
import { openStore, seed } from "./support/store";

const slowReading = readingOf(gehen, "🐌");
const WALK = readingPath(gehenReading);
const SLOW = readingPath(slowReading);

const ref = (linkpath: string, block: number, key: string) =>
	`![[${linkpath}#^${block}|^${key}]]`;
const STORY_0 = ref("Story", 0, "00000000");
const STORY_1 = ref("Story", 1, "11111111");
const OTHER_2 = ref("Other", 2, "22222222");
const STORY_3 = ref("Story", 3, "33333333");

const link = (
	reading: Dumling.Reading<"de">,
	attestationRef: string,
): AttestationLink<"de"> => ({
	reading,
	ref: attestationRef,
	surfaceId: gehtSurfaceEntry.id,
});

/**
 * gehen 🚶 with refs into Story, Other and Story again, in that order, and
 * 🐌 with one into Story, over a vault that holds those Scrolls and `extra`.
 */
async function dictionary(
	refs: {
		readonly walk?: readonly string[];
		readonly slow?: readonly string[];
	} = {},
	extra: Record<string, string> = {},
) {
	const vault = new FakeVault({
		"Library/Other.md": "Other",
		"Library/Story.md": "Story",
		...extra,
	});
	const opened = await openStore(vault);
	await seed(opened.store, [
		createLemma(gehen),
		createSurface(gehtSurfaceEntry),
		createReading(
			readingEntry(gehenReading, {
				attestationLinks: (
					refs.walk ?? [STORY_0, OTHER_2, STORY_3]
				).map((stored) => link(gehenReading, stored)),
			}),
		),
		createReading(
			readingEntry(slowReading, {
				attestationLinks: (refs.slow ?? [STORY_1]).map((stored) =>
					link(slowReading, stored),
				),
			}),
		),
	]);
	return opened;
}

const storedRefs = (content: string | undefined) =>
	(
		noteMetadataHelper.read(content ?? "", ReadingNoteMetadata, "Hidden")
			?.attestationLinks ?? []
	).map(({ ref: stored }) => stored);

/** The note's user text as the store reads it. */
const freeformIn = (content: string | undefined) =>
	freeformOf(
		parseReadingNote(
			{
				body: noteMetadataHelper.body(content ?? ""),
				metadata:
					noteMetadataHelper.read(
						content ?? "",
						ReadingNoteMetadata,
						"Hidden",
					) ?? undefined,
			},
			{ language: "de" },
		).document.segments,
	);

const count = (text: string | undefined, part: string) =>
	(text ?? "").split(part).length - 1;

/** Obsidian's link updater, after the Scroll moved: each embed of it by its new name. */
const retargetBody = (
	content: string | undefined,
	from: string,
	to: string,
): string =>
	noteMetadataHelper.mapBody((body) =>
		body.replaceAll(`![[${from}#^`, `![[${to}#^`),
	)(content ?? "");

describe("a renamed Scroll's refs", () => {
	test("follow a file rename in one commit, each Reading's links in their order", async () => {
		const { store, vault } = await dictionary();
		const before = vault.batches.length;
		await vault.userRename("Library/Story.md", "Library/Tale.md");

		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Tale", 0, "00000000"),
			OTHER_2,
			ref("Tale", 3, "33333333"),
		]);
		expect(storedRefs(vault.content(SLOW))).toEqual([
			ref("Tale", 1, "11111111"),
		]);
		// One transaction: one batch rewrote both Reading notes.
		expect(vault.batches.length - before).toBe(1);
		const body = noteMetadataHelper.body(vault.content(WALK) ?? "");
		expect(body).not.toContain("Story");
		expect(count(body, "![[Tale#^0|")).toBe(1);
		expect(freeformIn(vault.content(WALK))).toEqual([]);
		expect(
			(await run(store.attestationLinksWithRefPrefix("![[Tale#^")))
				.length,
		).toBe(3);
		expect(
			await run(store.attestationLinksWithRefPrefix("![[Story#^")),
		).toEqual([]);
	});

	test("are rewritten once: a rename heard again writes nothing", async () => {
		const { vault } = await dictionary();
		await vault.userRename("Library/Story.md", "Library/Tale.md");
		const written = vault.content(WALK);
		const before = vault.batches.length;
		await vault.announceRenames([["Library/Story.md", "Library/Tale.md"]]);
		expect(vault.batches.length).toBe(before);
		expect(vault.content(WALK)).toBe(written);
	});

	test("follow the Librarian's renames, one commit for the whole bulk, and a chain of renames", async () => {
		const { vault } = await dictionary();
		const before = vault.batches.length;
		await vault.userRenameAll(
			[
				["Library/Story.md", "Library/Story-Sec.md"],
				["Library/Other.md", "Library/Other-Sec.md"],
			],
			vamWrite("librarian"),
		);
		expect(vault.batches.length - before).toBe(1);
		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Story-Sec", 0, "00000000"),
			ref("Other-Sec", 2, "22222222"),
			ref("Story-Sec", 3, "33333333"),
		]);
		await vault.userRename("Library/Story-Sec.md", "Library/Tale.md");
		expect(storedRefs(vault.content(SLOW))).toEqual([
			ref("Tale", 1, "11111111"),
		]);
	});

	test("trade names when two Scrolls swap theirs in one rename", async () => {
		const { vault } = await dictionary();
		await vault.userRenameAll([
			["Library/Story.md", "Library/Tmp.md"],
			["Library/Other.md", "Library/Story.md"],
			["Library/Tmp.md", "Library/Other.md"],
		]);
		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Other", 0, "00000000"),
			ref("Story", 2, "22222222"),
			ref("Other", 3, "33333333"),
		]);
	});

	test("stay where Obsidian already rewrote their Kontexte, and show once", async () => {
		const { vault } = await dictionary();
		// The Librarian renamed the Scroll, and Obsidian's link updater
		// rewrote the embeds before the store heard the rename.
		vault.silentRename("Library/Story.md", "Library/Tale.md");
		await vault.userWrite(
			WALK,
			retargetBody(vault.content(WALK), "Story", "Tale"),
			{
				basis: "Predicted",
				kind: "LinkUpdate",
				operationId: "librarian#1",
			},
		);
		expect(freeformIn(vault.content(WALK))).toEqual([]);
		await vault.announceRenames(
			[["Library/Story.md", "Library/Tale.md"]],
			vamWrite("librarian"),
		);
		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Tale", 0, "00000000"),
			OTHER_2,
			ref("Tale", 3, "33333333"),
		]);
		const content = vault.content(WALK);
		expect(count(content, "![[Tale#^0|^00000000]]")).toBe(1);
		expect(count(content, "![[Tale#^3|^33333333]]")).toBe(1);
		expect(freeformIn(content)).toEqual([]);
	});

	test("follow a folder rename when they name the Scroll by its path", async () => {
		const qualified = ref("Library/Sec/Story", 0, "00000000");
		const { vault } = await dictionary(
			{ slow: [], walk: [qualified, STORY_1] },
			{ "Library/Sec/Story.md": "Story" },
		);
		await vault.userRenameFolder("Library/Sec", "Library/Part");
		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Library/Part/Story", 0, "00000000"),
			STORY_1,
		]);
	});

	test("are written nowhere but Worter/ when a protected Scroll moves", async () => {
		const { vault } = await dictionary(
			{ slow: [], walk: [ref("Kohle", 0, "00000000")] },
			{ "Exemplar/Kohle.md": "Kohle" },
		);
		const before = vault.batches.length;
		await vault.userRename("Exemplar/Kohle.md", "Exemplar/Kohlekraft.md");
		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Kohlekraft", 0, "00000000"),
		]);
		const paths = vault.batches
			.slice(before)
			.flat()
			.map((action) => JSON.stringify(action.payload));
		for (const path of paths) expect(path).not.toContain("Exemplar");
	});
});

describe("a renamed Scroll whose names other notes share", () => {
	test("leaves its refs when Obsidian opens another note for the old name", async () => {
		const { vault } = await dictionary(
			{},
			{ "Archive/Story.md": "another Story" },
		);
		const before = vault.batches.length;
		await vault.userRename("Library/Story.md", "Library/Tale.md");
		expect(vault.batches.length).toBe(before);
		expect(storedRefs(vault.content(WALK))).toEqual([
			STORY_0,
			OTHER_2,
			STORY_3,
		]);
	});

	test("names it by its path where another note wins its new name", async () => {
		const { vault } = await dictionary({}, { "Archive/Tale.md": "Tale" });
		await vault.userRename("Library/Story.md", "Library/Tale.md");
		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Library/Tale", 0, "00000000"),
			OTHER_2,
			ref("Library/Tale", 3, "33333333"),
		]);
	});

	test("keeps the refs it shadows on the note they named", async () => {
		const TALE_4 = ref("Tale", 4, "44444444");
		const { vault } = await dictionary(
			{ slow: [TALE_4], walk: [STORY_0] },
			{ "Zettel/Tale.md": "Tale" },
		);
		// The fake opens the first note by path for a shared name, as
		// Obsidian may: the renamed Scroll now wins "Tale".
		await vault.userRename("Library/Story.md", "Library/Tale.md");
		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Tale", 0, "00000000"),
		]);
		expect(storedRefs(vault.content(SLOW))).toEqual([
			ref("Zettel/Tale", 4, "44444444"),
		]);
	});

	test("leaves a ref whose new form the dictionary already holds", async () => {
		const TALE_0 = ref("Tale", 0, "00000000");
		const { vault } = await dictionary({ slow: [TALE_0], walk: [STORY_0] });
		await vault.userRename("Library/Story.md", "Library/Tale.md");
		expect(storedRefs(vault.content(WALK))).toEqual([STORY_0]);
		expect(storedRefs(vault.content(SLOW))).toEqual([TALE_0]);
	});
});

describe("a Scroll renamed while the plugin was off", () => {
	test("has its refs take the names Obsidian gave them, at the next start, once", async () => {
		const { store, vault } = await dictionary();
		await run(store.close);
		// Obsidian renamed the Scroll and rewrote the embeds it could see.
		vault.silentRename("Library/Story.md", "Library/Tale.md");
		vault.silentWrite(
			WALK,
			retargetBody(vault.content(WALK), "Story", "Tale"),
		);
		const reopened = await openStore(vault);
		expect(storedRefs(vault.content(WALK))).toEqual([
			ref("Tale", 0, "00000000"),
			OTHER_2,
			ref("Tale", 3, "33333333"),
		]);
		expect(freeformIn(vault.content(WALK))).toEqual([]);
		// 🐌's note was not rewritten by Obsidian, so it keeps its stale ref.
		expect(storedRefs(vault.content(SLOW))).toEqual([STORY_1]);
		await run(reopened.store.close);
		const before = vault.batches.length;
		const again = await openStore(vault);
		expect(vault.batches.length).toBe(before);
		await run(again.store.close);
	});

	test("keeps a ref whose stored name still opens a note", async () => {
		const { store, vault } = await dictionary();
		await run(store.close);
		vault.silentWrite(
			WALK,
			retargetBody(vault.content(WALK), "Story", "Other"),
		);
		await openStore(vault);
		expect(storedRefs(vault.content(WALK))).toEqual([
			STORY_0,
			OTHER_2,
			STORY_3,
		]);
	});
});
