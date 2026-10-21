import { describe, expect, test } from "bun:test";
import { legacyLemmaNotePath } from "@textfresser/lemma-note-codec";
import { readingIdentityKey } from "dumling";
import { Effect } from "effect";
import { readBundle, readingBlockIds, serializeBundle } from "../src/bundle";
import { insertFreeformBlock } from "../src/freeform";
import { noteMetadataHelper } from "../src/internal/note-metadata";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	contribute,
	createLemma,
	createReading,
	gehen,
	gehenReading,
	readingEntry,
} from "./support/fixtures";
import { openStore, seed } from "./support/store";

const gehenPath = legacyLemmaNotePath(gehen).path;
const PLACEHOLDER = "*You can write here*";
const NOTE_TITLE =
	'<span class="note_block_title note_block_title_kontexte">Note</span>';
const MEMO =
	"My own memo about gehen.\n\nIt has [[links]] and ![[Scroll#^3|^]].";

async function withGehen() {
	const opened = await openStore();
	await seed(opened.store, [
		createLemma(gehen),
		createReading(readingEntry(gehenReading)),
	]);
	const location = await run(opened.store.readingLocation(gehenReading));
	if (!location) throw new Error("gehen has no Reading block");
	return { ...opened, blockId: location.blockId };
}

describe("appendFreeform", () => {
	test("places text in the Reading's part as freeform, keeping the records and every other byte", async () => {
		const { blockId, store, vault } = await withGehen();
		const before = vault.content(gehenPath) ?? "";
		const outcome = await run(
			store.appendFreeform({
				path: gehenPath,
				readingBlockId: blockId,
				text: MEMO,
			}),
		);
		expect(outcome).toBe("Appended");
		const after = vault.content(gehenPath) ?? "";
		// The text takes the Note placeholder's place, under the Note title;
		// no other body line changes.
		expect(before).toContain(PLACEHOLDER);
		expect(noteMetadataHelper.body(after)).toBe(
			noteMetadataHelper
				.body(before)
				.replace(
					`${NOTE_TITLE}\n${PLACEHOLDER}\n`,
					`${NOTE_TITLE}\n${MEMO}\n`,
				),
		);
		const parsed = readBundle(after);
		expect(parsed.data.ok).toBe(true);
		const owner =
			parsed.readingKeys.indexOf(readingIdentityKey(gehenReading)) + 1;
		expect(
			parsed.segments.some(
				(segment) =>
					segment.owner === owner &&
					segment.type === "freeform" &&
					segment.text.includes("My own memo"),
			),
		).toBe(true);
		await expectIndexMatchesFiles(store, vault);
	});

	test("does not add the same text twice, and later commits keep it", async () => {
		const { blockId, store, vault } = await withGehen();
		await run(
			store.appendFreeform({
				path: gehenPath,
				readingBlockId: blockId,
				text: MEMO,
			}),
		);
		expect(
			await run(
				store.appendFreeform({
					path: gehenPath,
					readingBlockId: blockId,
					text: `${MEMO}\n`,
				}),
			),
		).toBe("AlreadyThere");
		await seed(store, [contribute(gehenReading, "to go on foot")]);
		const after = vault.content(gehenPath) ?? "";
		expect(after).toContain("to go on foot");
		expect(after).toContain(MEMO);
		await expectIndexMatchesFiles(store, vault);
	});

	test("reads an edit no event delivered before placing the text", async () => {
		const { blockId, store, vault } = await withGehen();
		const edited = noteMetadataHelper.mapBody(
			(body) => `${body}\nTyped by hand.\n`,
		)(vault.content(gehenPath) ?? "");
		vault.silentWrite(gehenPath, edited);
		await run(
			store.appendFreeform({
				path: gehenPath,
				readingBlockId: blockId,
				text: MEMO,
			}),
		);
		const after = vault.content(gehenPath) ?? "";
		expect(after).toContain("Typed by hand.");
		expect(after).toContain(MEMO);
	});

	test("refuses a path the store holds no Lemma note at, and writes nothing", async () => {
		const { store, vault } = await withGehen();
		const batches = vault.batches.length;
		const exit = await Effect.runPromiseExit(
			store.appendFreeform({ path: "Worter/de/nothing.md", text: MEMO }),
		);
		expect(exit._tag).toBe("Failure");
		expect(vault.batches.length).toBe(batches);
	});
});

describe("insertFreeformBlock", () => {
	const data = {
		lemmaRecord: { lemma: gehen },
		ownedSurfaceEntries: [],
		pendingRelations: [],
		readingEntries: [
			readingEntry(gehenReading, {
				knowledge: { translations: { en: ["go"] } },
			}),
		],
	};
	const note = serializeBundle(undefined, data, {}, "Hidden");
	const blockId =
		readingBlockIds([gehenReading]).get(readingIdentityKey(gehenReading)) ??
		"";
	const TRANSLATION_TITLE =
		'<span class="note_block_title note_block_title_translations">Übersetzung</span>';

	test("places text under the Note title, before the sections below it", () => {
		const placed = insertFreeformBlock(note, blockId, "memo");
		if (placed._tag !== "Inserted") throw new Error(placed._tag);
		const body = noteMetadataHelper.body(placed.content);
		expect(body).toContain(`${NOTE_TITLE}\nmemo\n\n\n${TRANSLATION_TITLE}`);
		expect(body).not.toContain(PLACEHOLDER);
		// It is what serialize writes for that freeform.
		expect(serializeBundle(placed.content, data, {}, "Hidden")).toBe(
			placed.content,
		);

		// Further text goes under it, a paragraph of its own.
		const more = insertFreeformBlock(placed.content, blockId, "more");
		if (more._tag !== "Inserted") throw new Error(more._tag);
		expect(noteMetadataHelper.body(more.content)).toContain(
			`${NOTE_TITLE}\nmemo\n\nmore\n\n\n${TRANSLATION_TITLE}`,
		);
		expect(insertFreeformBlock(more.content, blockId, "memo")).toEqual({
			_tag: "AlreadyThere",
		});
		expect(insertFreeformBlock(more.content, blockId, "mem")._tag).toBe(
			"Inserted",
		);
	});

	test("ends the Lemma part when no Reading has the Block ID", () => {
		const placed = insertFreeformBlock(note, "r-00000000", "memo");
		if (placed._tag !== "Inserted") throw new Error(placed._tag);
		const parsed = readBundle(placed.content);
		expect(
			parsed.segments.filter((segment) => segment.type === "freeform"),
		).toMatchObject([{ owner: 0, text: "memo" }]);
		expect(serializeBundle(placed.content, data, {}, "Hidden")).toBe(
			placed.content,
		);
	});

	test("refuses a note without a Lemma bundle", () => {
		expect(
			insertFreeformBlock("%%tf-part:lemma%%\n", undefined, "memo"),
		).toMatchObject({
			_tag: "Refused",
		});
	});
});

describe("rescan", () => {
	test("finds notes written past the store, as VAM's own moves are", async () => {
		const { store, vault } = await withGehen();
		const content = vault.content(gehenPath) ?? "";
		vault.files.delete(gehenPath);
		expect(await run(store.lemmaNote(gehen))).toBeDefined();
		await run(store.rescan);
		expect(await run(store.lemmaNote(gehen))).toBeUndefined();
		vault.silentWrite(gehenPath, content);
		await run(store.rescan);
		expect((await run(store.lemmaNote(gehen)))?.path).toBe(gehenPath);
	});
});
