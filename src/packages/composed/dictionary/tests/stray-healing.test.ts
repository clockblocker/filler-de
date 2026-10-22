/**
 * Healing displaced Crossroad notes (#115, ADR-0015): a stray Obsidian
 * creates as `Worter/<x>.md` for a click on an unresolved bare link moves to
 * its spelling's Crossroad path and is filled as a Crossroad note, keeping
 * its text below the rendering; one whose Crossroad note is already there
 * is merged into it and trashed; a Crossroad note moved away from its own
 * path moves back.
 */
import { describe, expect, test } from "bun:test";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import type * as Dumling from "dumling/types";
import { CrossroadNoteMetadata } from "../src";
import { noteMetadataHelper } from "../src/internal/note-metadata";
import { FakeVault } from "./support/fake-vault";
import { expectIndexMatchesFiles, run } from "./support/files";
import { createLemma, createReading, readingEntry } from "./support/fixtures";
import { crossroadPath, lemmaPath } from "./support/paths";
import { openStore, seed } from "./support/store";

const noun = (
	canonicalForm: string,
	gender: "Masc" | "Fem" | "Neut",
): Dumling.Lemma<"de"> => ({
	canonicalForm,
	coreFeatures: { gender },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
});
const sense = (lemma: Dumling.Lemma<"de">, emojiDescription: string) =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Dumling.Reading<"de">;
const lemmaWith = (lemma: Dumling.Lemma<"de">, emoji: string) => [
	createLemma(lemma),
	createReading(readingEntry(sense(lemma, emoji))),
];

const fahrer = noun("Fahrer", "Masc");
const fahrerLink = `[[${lemmaPath(fahrer).slice(0, -".md".length)}|Fahrer]]`;

const EINTRAEGE =
	'<span class="note_block_title note_block_title_eintraege">Einträge</span>';
const NOT_CLASSIFIED = `${EINTRAEGE}\n*Not classified yet*\n`;

/** A note's visible body, without its metadata or the padding before it. */
const visible = (content: string | undefined) =>
	content === undefined
		? undefined
		: `${noteMetadataHelper.body(content).trimEnd()}\n`;

const isCrossroad = (content: string | undefined) =>
	content !== undefined &&
	noteMetadataHelper.read(content, CrossroadNoteMetadata, "Hidden") !== null;

/** The store's moves, and whether each asked Obsidian to update links to it. */
const moves = (vault: FakeVault) =>
	vault.batches
		.flat()
		.flatMap((action) =>
			action.kind === VaultActionKind.RenameMdFile
				? [{ updateLinks: action.payload.updateLinks ?? true }]
				: [],
		);
const renames = (vault: FakeVault) => moves(vault).length;

describe("a stray Obsidian created for an unresolved bare link", () => {
	test("an empty stray moves to its Crossroad path and is filled as not classified yet", async () => {
		const { store, vault } = await openStore();
		await vault.userWrite("Worter/Kraftwerk.md", "");
		const path = crossroadPath("Kraftwerk");
		expect(path).toBe("Worter/k/kra/kraft/kraftwerk.md");
		expect(vault.content("Worter/Kraftwerk.md")).toBeUndefined();
		expect(visible(vault.content(path))).toBe(NOT_CLASSIFIED);
		expect(isCrossroad(vault.content(path))).toBe(true);
		// Moved without Obsidian's link updater, which would rewrite the bare
		// `[[Kraftwerk]]` links to it as `[[kraftwerk]]`; they resolve by name.
		expect(moves(vault)).toEqual([{ updateLinks: false }]);
		const diagnostics = await run(store.diagnostics);
		expect(diagnostics.strays).toEqual([]);
		expect(diagnostics.healingBlocked).toEqual([]);
		expect(await run(store.lemmaNotes)).toEqual([]);
	});

	test("a stray's text stays in the Crossroad note, below the rendering", async () => {
		const { vault } = await openStore();
		await vault.userWrite("Worter/Kraftwerk.md", "Notes on power.\n");
		expect(visible(vault.content(crossroadPath("Kraftwerk")))).toBe(
			`${NOT_CLASSIFIED}\nNotes on power.\n`,
		);
	});

	test("a stray of a stored spelling whose Crossroad note is gone lists its Lemma", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const path = crossroadPath("Fahrer");
		await vault.userDelete(path);
		await vault.userWrite("Worter/Fahrer.md", "Mine.");
		const body = visible(vault.content(path)) ?? "";
		expect(body).toContain(`- der ${fahrerLink}`);
		expect(body).toContain("Mine.");
		expect(vault.content("Worter/Fahrer.md")).toBeUndefined();
		await expectIndexMatchesFiles(store, vault);
	});

	test("a stray whose Crossroad note is there is merged into it and trashed, once", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const path = crossroadPath("Fahrer");
		const before = visible(vault.content(path)) ?? "";
		await vault.userWrite("Worter/fahrer.md", "Mine.\n\nAnd more.");
		expect(vault.content("Worter/fahrer.md")).toBeUndefined();
		expect(visible(vault.content(path))).toBe(
			`${before}\nMine.\n\nAnd more.\n`,
		);
		expect(renames(vault)).toBe(0);
		expect((await run(store.diagnostics)).strays).toEqual([]);

		// The same text again is not added twice.
		const merged = vault.content(path);
		await vault.userWrite("Worter/Fahrer.md", "Mine.\n\nAnd more.");
		expect(vault.content("Worter/Fahrer.md")).toBeUndefined();
		expect(vault.content(path)).toBe(merged);
	});

	test("an empty stray whose Crossroad note is there is trashed, leaving the note alone", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const path = crossroadPath("Fahrer");
		const before = vault.content(path);
		await vault.userWrite("Worter/Fahrer.md", "");
		expect(vault.content("Worter/Fahrer.md")).toBeUndefined();
		expect(vault.content(path)).toBe(before);
	});

	test("a stray with properties stays when its Crossroad note is there, and is reported", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const path = crossroadPath("Fahrer");
		const before = vault.content(path);
		const stray = "---\ntags: [beruf]\n---\nMine.\n";
		await vault.userWrite("Worter/Fahrer.md", stray);
		expect(vault.content("Worter/Fahrer.md")).toBe(stray);
		expect(vault.content(path)).toBe(before);
		const diagnostics = await run(store.diagnostics);
		expect(diagnostics.strays).toEqual(["Worter/Fahrer.md"]);
		expect(diagnostics.healingBlocked).toMatchObject([
			{ canonicalPath: path, path: "Worter/Fahrer.md" },
		]);
	});

	test("a stray with properties keeps them when it moves", async () => {
		const { vault } = await openStore();
		const stray = "---\ntags: [beruf]\n---\nMine.\n";
		await vault.userWrite("Worter/Kraftwerk.md", stray);
		const content = vault.content(crossroadPath("Kraftwerk")) ?? "";
		expect(content.startsWith("---\ntags: [beruf]\n---\n")).toBe(true);
		expect(content).toContain("Mine.");
		expect(isCrossroad(content)).toBe(true);
	});

	test("a note Obsidian named as new is no spelling and stays a stray", async () => {
		const { store, vault } = await openStore();
		await vault.userWrite("Worter/Untitled.md", "");
		await vault.userWrite("Worter/Untitled 3.md", "draft");
		expect(vault.content("Worter/Untitled.md")).toBe("");
		expect(vault.content("Worter/Untitled 3.md")).toBe("draft");
		expect((await run(store.diagnostics)).strays).toEqual([
			"Worter/Untitled 3.md",
			"Worter/Untitled.md",
		]);
	});

	test("never moves a stray into a folder the vault spells another way", async () => {
		const { store, vault } = await openStore(
			new FakeVault({ "Worter/K/notes.md": "mine" }),
		);
		await vault.userWrite("Worter/Kraftwerk.md", "Mine.");
		expect(vault.content("Worter/Kraftwerk.md")).toBe("Mine.");
		expect(vault.content(crossroadPath("Kraftwerk"))).toBeUndefined();
		expect((await run(store.diagnostics)).healingBlocked).toMatchObject([
			{ path: "Worter/Kraftwerk.md" },
		]);
	});

	test("strays left while the plugin was off are healed at startup, and a second start writes nothing", async () => {
		const vault = new FakeVault({
			"Worter/Pass.md": "",
			"Worter/See.md": "Am See.",
			"Worter/Untitled.md": "",
		});
		const { store } = await openStore(vault);
		expect(visible(vault.content(crossroadPath("Pass")))).toBe(
			NOT_CLASSIFIED,
		);
		expect(visible(vault.content(crossroadPath("See")))).toBe(
			`${NOT_CLASSIFIED}\nAm See.\n`,
		);
		expect(vault.markdownPaths()).toEqual([
			"Worter/Untitled.md",
			crossroadPath("Pass"),
			crossroadPath("See"),
		]);
		await run(store.close);
		const writes = vault.batches.length;
		await openStore(vault);
		expect(vault.batches).toHaveLength(writes);
	});

	test("two strays of one spelling: the first moves, the second merges into it", async () => {
		// Two files on a case-sensitive file system, one spelling.
		const vault = new FakeVault({
			"Worter/See.md": "first",
			"Worter/see.md": "second",
		});
		await openStore(vault);
		const path = crossroadPath("See");
		expect(visible(vault.content(path))).toBe(
			`${NOT_CLASSIFIED}\nfirst\n\nsecond\n`,
		);
		expect(vault.markdownPaths()).toEqual([path]);
	});
});

describe("a stray that changes while it is merged (#201)", () => {
	const stray = "Worter/fahrer.md";
	const path = crossroadPath("Fahrer");

	/**
	 * Runs `edit` just before each of the first `times` trashes of the
	 * stray, as text typed into it then refuses the trash.
	 */
	const atTrash = (
		vault: FakeVault,
		edit: (index: number) => void,
		times = 1,
	) => {
		let seen = 0;
		vault.failNextWrite((action, target) => {
			if (
				seen < times &&
				action.kind === "TrashMdFile" &&
				target === stray
			) {
				edit(seen);
				seen += 1;
			}
			return false;
		});
		return () => seen;
	};

	test("an edited paragraph replaces its copy, which the store wrote and no one changed", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const before = visible(vault.content(path)) ?? "";
		const trashes = atTrash(vault, () =>
			vault.silentWrite(stray, "Mine.\n\nFoo bar baz"),
		);
		await vault.userWrite(stray, "Mine.\n\nFoo bar");
		expect(trashes()).toBe(1);
		// Merged again at once, and trashed: the old copy is gone.
		expect(vault.content(stray)).toBeUndefined();
		expect(visible(vault.content(path))).toBe(
			`${before}\nMine.\n\nFoo bar baz\n`,
		);
		expect((await run(store.diagnostics)).healingBlocked).toEqual([]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("text added to it is merged once, with what it held", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const before = visible(vault.content(path)) ?? "";
		atTrash(vault, () =>
			vault.silentWrite(stray, "Mine.\n\nTyped at the trash."),
		);
		await vault.userWrite(stray, "Mine.");
		expect(vault.content(stray)).toBeUndefined();
		expect(visible(vault.content(path))).toBe(
			`${before}\nMine.\n\nTyped at the trash.\n`,
		);
	});

	test("text the Crossroad note held before the merge stays, however the stray changes", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		await vault.userWrite(
			path,
			noteMetadataHelper.mapBody(
				(body) => `${body.trimEnd()}\n\nFoo bar\n`,
			)(vault.content(path) ?? ""),
		);
		const before = visible(vault.content(path)) ?? "";
		atTrash(vault, () => vault.silentWrite(stray, "Foo bar baz"));
		await vault.userWrite(stray, "Foo bar\n\nMine.");
		expect(vault.content(stray)).toBeUndefined();
		// Its own "Foo bar" was never the store's copy, so it stays.
		expect(visible(vault.content(path))).toBe(`${before}\nFoo bar baz\n`);
	});

	test("a stray that keeps changing waits, whole, for the next merge", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const untouched = vault.content(path);
		const trashes = atTrash(
			vault,
			(index) => vault.silentWrite(stray, `Foo bar ${index}`),
			Number.POSITIVE_INFINITY,
		);
		await vault.userWrite(stray, "Foo bar");
		expect(trashes()).toBe(3);
		// Each copy was taken back: its text stands in the stray alone.
		expect(vault.content(stray)).toBe("Foo bar 2");
		expect(vault.content(path)).toBe(untouched);
		expect((await run(store.diagnostics)).healingBlocked).toMatchObject([
			{ canonicalPath: path, path: stray },
		]);
		await expectIndexMatchesFiles(store, vault);

		vault.failNextWrite(() => false);
		await vault.userWrite(stray, "Foo bar 3");
		expect(vault.content(stray)).toBeUndefined();
		expect(visible(vault.content(path))).toBe(
			`${visible(untouched)}\nFoo bar 3\n`,
		);
		expect((await run(store.diagnostics)).healingBlocked).toEqual([]);
	});

	test("a copy the user edited in the Crossroad note too stays beside the stray's new text", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const before = visible(vault.content(path)) ?? "";
		atTrash(vault, () => {
			vault.silentWrite(stray, "Foo bar baz");
			vault.silentWrite(
				path,
				(vault.content(path) ?? "").replace("Foo bar", "Foo bar qux"),
			);
		});
		await vault.userWrite(stray, "Foo bar");
		expect(vault.content(stray)).toBeUndefined();
		// Neither edit is dropped.
		expect(visible(vault.content(path))).toBe(
			`${before}\nFoo bar qux\n\nFoo bar baz\n`,
		);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a copy is not taken back from a Crossroad note the user edited meanwhile", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const before = visible(vault.content(path)) ?? "";
		atTrash(
			vault,
			(index) => {
				vault.silentWrite(stray, `Foo bar ${index}`);
				if (index === 2)
					vault.silentWrite(
						path,
						noteMetadataHelper.mapBody(
							(body) => `${body.trimEnd()}\n\nTheirs.\n`,
						)(vault.content(path) ?? ""),
					);
			},
			3,
		);
		await vault.userWrite(stray, "Foo bar");
		expect(vault.content(stray)).toBe("Foo bar 2");
		expect(visible(vault.content(path))).toBe(
			`${before}\nFoo bar 1\n\nTheirs.\n`,
		);

		// The next merge keeps every version.
		await vault.userWrite(stray, "Foo bar 3");
		expect(vault.content(stray)).toBeUndefined();
		expect(visible(vault.content(path))).toBe(
			`${before}\nFoo bar 1\n\nTheirs.\n\nFoo bar 3\n`,
		);
	});

	test("a stray that takes properties meanwhile stays, and its copy is taken back", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const untouched = vault.content(path);
		const withProperties = "---\ntags: [beruf]\n---\nMine.\n";
		atTrash(vault, () => vault.silentWrite(stray, withProperties));
		await vault.userWrite(stray, "Mine.");
		expect(vault.content(stray)).toBe(withProperties);
		expect(vault.content(path)).toBe(untouched);
		expect((await run(store.diagnostics)).healingBlocked).toMatchObject([
			{ canonicalPath: path, path: stray },
		]);
	});
});

describe("a Crossroad note moved away from its own path", () => {
	test("moves back", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const path = crossroadPath("Fahrer");
		const fresh = vault.content(path);
		await vault.userRename(path, "Worter/Elsewhere.md");
		expect(vault.content("Worter/Elsewhere.md")).toBeUndefined();
		expect(vault.content(path)).toBe(fresh);
		await vault.userRename(path, "Worter/de/Fahrer.md");
		expect(vault.content(path)).toBe(fresh);
		// Its links are path-qualified and aliased, so they follow it back.
		expect(moves(vault)).toEqual([
			{ updateLinks: true },
			{ updateLinks: true },
		]);
		await expectIndexMatchesFiles(store, vault);
		expect((await run(store.diagnostics)).quarantined).toEqual([]);
	});

	test("merges into the Crossroad note that took its path meanwhile", async () => {
		const { store, vault } = await openStore();
		await seed(store, lemmaWith(fahrer, "🚗"));
		const path = crossroadPath("Fahrer");
		const fresh = vault.content(path) ?? "";
		await run(store.close);
		// A copy moved away, with the user's text, while its path was regenerated.
		vault.silentWrite(
			"Worter/Elsewhere.md",
			noteMetadataHelper.mapBody(
				(body) => `${body.trimEnd()}\n\nMine.\n`,
			)(fresh),
		);
		const reopened = await openStore(vault);
		expect(vault.content("Worter/Elsewhere.md")).toBeUndefined();
		const body = visible(vault.content(path)) ?? "";
		expect(body).toBe(`${visible(fresh)}\nMine.\n`);
		await expectIndexMatchesFiles(reopened.store, vault);
		expect((await run(reopened.store.diagnostics)).healingBlocked).toEqual(
			[],
		);
	});
});
