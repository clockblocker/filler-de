import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - Dictionary reset", () => {
	// The modal first lists the vault's root folders, which Obsidian finds
	// as "/", not "": looking it up as "" failed with a blank notice (#117).
	it("opens its modal, offering the vault-root Worter/ as a source", async () => {
		await withObsidianScenario(
			{
				fixture: [{ content: "# Anchor", path: "Anchor.md" }],
				id: "dictionary-reset-modal",
				// An empty `Worter/` at the vault root, and no other.
				newNotesInDictionary: true,
				resetDictionary: true,
			},
			async ({ act, status }) => {
				expect((await status()).dictionaryReset).toBeNull();

				await act({ kind: "openDictionaryReset" });

				const opening = (await status()).dictionaryReset;
				expect(opening?.kind).toBe("Opened");
				if (opening?.kind !== "Opened") return;
				expect(opening.candidates[0]).toEqual({
					folder: "Worter",
					notes: 0,
					oldNotes: 0,
				});
			},
		);
	});
});
