import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	FIRST_SELECTION,
	SECOND_SELECTION,
	STORY,
} from "./classify-resolution-script";
import { expectHiddenMetadata, linkTo } from "./dictionary-layout";

const kontext = (name: string, block: number) =>
	new RegExp(`!\\[\\[${name}#\\^${block}\\|\\^[0-9a-f]{8}\\]\\]`, "gu");

const countOf = (text: string | undefined, pattern: RegExp) =>
	[...(text ?? "").matchAll(pattern)].length;

describe("Obsidian E2E - a renamed Scroll's refs (#99)", () => {
	it("follow a Scroll the user renames, show once in Deine Kontexte, and still unlink", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "scroll-rename-refs",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				await act({ kind: "runClassify", path: "Story.md", selection: FIRST_SELECTION });
				await act({ kind: "runClassify", path: "Story.md", selection: SECOND_SELECTION });
				const [hund] = ((await status()).classify?.resolved ?? []).map((unit) => {
					if (!("readingPath" in unit))
						throw new Error(`A unit stayed pending: ${unit.pending}`);
					return unit.readingPath;
				});
				if (!hund) throw new Error("Classify resolved no unit");
				expect(countOf((await dictionary()).markdown[hund], kontext("Story", 1))).toBe(1);

				await act({ from: "Story.md", kind: "renamePath", to: "Tale.md" });

				const notes = (await dictionary()).markdown;
				const note = notes[hund];
				expectHiddenMetadata(note, "readingNote");
				// Obsidian's link updater and the store both moved the embed:
				// it shows once, by the new name, and the metadata agrees.
				expect(countOf(note, kontext("Tale", 0))).toBe(1);
				expect(countOf(note, kontext("Tale", 1))).toBe(1);
				expect(note).not.toContain("Story");
				for (const content of Object.values(notes))
					expect(content).not.toMatch(/Story#/u);

				// The user unlinks the second "Der Hund" in the renamed Scroll.
				const tale = (await snapshot()).markdown["Tale.md"] ?? "";
				const unlinked = tale.replace(
					`${linkTo(hund, "Der Hund")} schläft.`,
					"Der Hund schläft.",
				);
				expect(unlinked).not.toBe(tale);
				await act({ content: unlinked, kind: "modifyFile", path: "Tale.md" });
				const after = (await dictionary()).markdown[hund];
				expect(countOf(after, kontext("Tale", 0))).toBe(1);
				expect(countOf(after, kontext("Tale", 1))).toBe(0);
			},
		);
	});

	it("follow the Librarian when it heals a Scroll moved into a Section", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [
					{ content: STORY, path: "Story.md" },
					{ content: "# Tiere", path: "Tiere/Anchor.md" },
				],
				id: "scroll-rename-refs-librarian",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				await act({ kind: "runClassify", path: "Story.md", selection: FIRST_SELECTION });
				const [hund] = ((await status()).classify?.resolved ?? []).map((unit) => {
					if (!("readingPath" in unit))
						throw new Error(`A unit stayed pending: ${unit.pending}`);
					return unit.readingPath;
				});
				if (!hund) throw new Error("Classify resolved no unit");

				await act({ from: "Story.md", kind: "renamePath", to: "Tiere/Story.md" });

				const vault = await snapshot();
				expect(vault.markdown["Tiere/Story-Tiere.md"]).toBeDefined();
				const note = (await dictionary()).markdown[hund];
				expect(countOf(note, kontext("Story-Tiere", 0))).toBe(1);
				expect(note).not.toMatch(/Story#/u);
			},
		);
	});
});
