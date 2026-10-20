import { describe, expect, test } from "bun:test";
import { lemmaNotePath, parse } from "@textfresser/lemma-note-codec";
import { Effect } from "effect";
import { insertFreeformBlock } from "../src/freeform";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	addAttestation,
	createLemma,
	createReading,
	gehen,
	gehenReading,
	readingEntry,
} from "./support/fixtures";
import { openStore, seed } from "./support/store";

const gehenPath = lemmaNotePath(gehen).path;
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
		// The Reading's part ends the note, so the text follows it after a blank line.
		expect(after).toBe(`${before}\n${MEMO}\n`);
		const parsed = parse(after, { language: "de" });
		expect(parsed.data.ok).toBe(true);
		const readingPart = parsed.document.parts.find(
			(part) => part.blockId === blockId,
		);
		expect(
			readingPart?.blocks.some(
				(block) =>
					block.type === "freeform" &&
					block.raw.includes("My own memo"),
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
		await seed(store, [addAttestation(gehenReading, "![[Scroll#^9|^]]")]);
		const after = vault.content(gehenPath) ?? "";
		expect(after).toContain("Scroll#^9");
		expect(after).toContain(MEMO);
		await expectIndexMatchesFiles(store, vault);
	});

	test("reads an edit no event delivered before placing the text", async () => {
		const { blockId, store, vault } = await withGehen();
		const edited = `${vault.content(gehenPath)}\nTyped by hand.\n`;
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
	test("finds placed text again only as whole paragraphs", () => {
		const note = "%%tf-part:lemma%%\n\nsay TODO here\n\nmemo\n";
		expect(insertFreeformBlock(note, undefined, "memo")).toEqual({
			_tag: "AlreadyThere",
		});
		expect(insertFreeformBlock(note, undefined, "TODO")._tag).toBe(
			"Inserted",
		);
	});

	test("ends the named Reading's part, before the next part's marker", () => {
		const note =
			"%%tf-part:lemma%%\n\n%%tf-part:reading r-1%%\n\n%%tf-part:reading r-2%%\n";
		expect(insertFreeformBlock(note, "r-1", "memo")).toEqual({
			_tag: "Inserted",
			content:
				"%%tf-part:lemma%%\n\n%%tf-part:reading r-1%%\n\nmemo\n\n%%tf-part:reading r-2%%\n",
		});
		expect(insertFreeformBlock(note, "r-9", "memo")).toEqual({
			_tag: "Inserted",
			content:
				"%%tf-part:lemma%%\n\nmemo\n\n%%tf-part:reading r-1%%\n\n%%tf-part:reading r-2%%\n",
		});
	});

	test("refuses text with a line that reads as a Block marker", () => {
		expect(
			insertFreeformBlock(
				"%%tf-part:lemma%%\n",
				undefined,
				"%%tf:notes%%\nsneaky",
			),
		).toMatchObject({ _tag: "Refused" });
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
