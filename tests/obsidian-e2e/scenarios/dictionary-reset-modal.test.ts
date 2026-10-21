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

/** One old entry note, whose attestation's Scroll is missing. */
const OLD_TEAM_NOTE = {
	content: [
		"🤝 👥 das [[Team]] ^LX-LM-NOUN-1",
		"",
		'<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>',
		"![[Morphologie#^4|^]]",
		"",
	].join("\n"),
	path: "de/lexem/lemma/t/tea/team/Team.md",
};

describe("Obsidian E2E - Dictionary reset dry run (#145, #146)", () => {
	// After a dry run the report offered only Copy and Close, so the user
	// had to run the command again to execute (#145).
	it("offers Execute beside the dry run's report", async () => {
		await withObsidianScenario(
			{
				dictionaryFixture: [OLD_TEAM_NOTE],
				fixture: [{ content: "# Anchor", path: "Anchor.md" }],
				id: "dictionary-reset-dry-run-execute",
				resetDictionary: true,
			},
			async ({ act, status }) => {
				await act({ kind: "dryRunDictionaryReset" });

				const run = (await status()).dictionaryResetRun;
				expect(run?.dryRun).toEqual({
					actions: ["Copy", "Close", "Execute…"],
					keyWarning: null,
					kind: "Report",
					source: "Worter",
				});
				expect(run?.execute).toBeNull();
			},
		);
	});

	// An expired OpenAI key failed every attestation only after Execute had
	// moved Worter/ to a backup (#146): the key check now stops it first.
	it("checks the provider keys, warning in the dry run and refusing Execute before it moves anything", async () => {
		await withObsidianScenario(
			{
				dictionaryFixture: [OLD_TEAM_NOTE],
				dumgen: {
					jev: {},
					keyCheck: {
						OpenAI: {
							body: '{\n  "error": {\n    "message": "Your API key has expired. Create a new API key to continue.",\n    "type": "invalid_request_error",\n    "code": "expired_secret_key",\n    "param": null\n  }\n}',
							status: 401,
						},
					},
				},
				fixture: [{ content: "# Anchor", path: "Anchor.md" }],
				id: "dictionary-reset-key-check",
				resetDictionary: true,
			},
			async ({ act, dictionary, status }) => {
				await act({ execute: true, kind: "dryRunDictionaryReset" });

				const { dictionaryResetRun: run, dumgenRequests } = await status();
				expect(run?.dryRun.kind).toBe("Report");
				if (run?.dryRun.kind !== "Report") return;
				expect(run.dryRun.keyWarning).toContain(
					"OpenAI rejected the API key (401 expired_secret_key)",
				);
				expect(run.execute).toEqual({
					kind: "Refused",
					notice: "⚠ Dictionary reset did not start: OpenAI rejected the API key (401 expired_secret_key). Fix the key in Textfresser's settings and run it again. Nothing changed.",
				});
				// Nothing moved, and no model was asked.
				expect(Object.keys((await dictionary()).markdown)).toEqual([
					`Worter/${OLD_TEAM_NOTE.path}`,
				]);
				expect(dumgenRequests).toEqual({ jev: {}, luna: {} });
			},
		);
	});
});
