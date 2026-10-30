import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	FIRST_SELECTION,
	SECOND_SELECTION,
	STORY,
} from "./classify-resolution-script";
import { linkpath } from "./dictionary-layout";

/** An occurrence's Attestation Ref in block `^<block>` of the Story. */
const kontext = (block: number) =>
	new RegExp(`!\\[\\[Story#\\^${block}\\|\\^[0-9a-f]{8}\\]\\]`, "gu");

const countOf = (text: string | undefined, pattern: RegExp) =>
	[...(text ?? "").matchAll(pattern)].length;

/** Every Attestation Ref into the Story a note shows. */
const ANY_KONTEXT = /!\[\[Story#\^\d+\|\^[0-9a-f]{8}\]\]/gu;

describe("Obsidian E2E - Classify attests on click (#281)", () => {
	it("attests only the occurrence the user clicks, once, in Live Preview, from a split pane, with Cmd, with the middle button and in Reading view", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [
					{ content: STORY, path: "Story.md" },
					// Another note, long enough that the Story's offsets fall in it.
					{ content: `${"Ganz andere Worte stehen hier. ".repeat(12)}\n`, path: "Other.md" },
				],
				id: "classify-attest-on-click",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				await act({ kind: "runClassify", path: "Story.md", selection: FIRST_SELECTION });
				const targets = ((await status()).classify?.resolved ?? []).map((unit) => {
					if (!("readingPath" in unit))
						throw new Error(`A unit stayed pending: ${unit.pending}`);
					return unit.readingPath;
				});
				const [hund, anfangen, heute, aufJedenFall] = targets;
				if (!hund || !anfangen || !heute || !aufJedenFall)
					throw new Error("Classify resolved fewer units than it reported");
				await act({ kind: "runClassify", path: "Story.md", selection: SECOND_SELECTION });

				// Classify links both "Der Hund"s and attests neither.
				let notes = (await dictionary()).markdown;
				for (const path of targets) expect(countOf(notes[path], ANY_KONTEXT)).toBe(0);
				const linked = (await snapshot()).markdown["Story.md"] ?? "";
				expect(countOf(linked, new RegExp(`\\[\\[${linkpath(hund)}\\|`, "gu"))).toBe(2);

				// A click on the second one attests it alone.
				await act({ kind: "clickScrollLink", linkpath: linkpath(hund), nth: 1, path: "Story.md" });
				notes = (await dictionary()).markdown;
				expect(countOf(notes[hund], kontext(1))).toBe(1);
				expect(countOf(notes[hund], kontext(0))).toBe(0);

				// A second click on it changes nothing.
				const once = await dictionary();
				const scroll = (await snapshot()).markdown["Story.md"];
				await act({ kind: "clickScrollLink", linkpath: linkpath(hund), nth: 1, path: "Story.md" });
				expect((await dictionary()).markdown).toEqual(once.markdown);
				expect((await snapshot()).markdown["Story.md"]).toBe(scroll);

				// The user types above the links, then clicks the first one while
				// another note is active in a split pane: the link's own note and
				// where it stands now name its occurrence.
				const text = scroll ?? "";
				const firstLine = text.lastIndexOf("\n", text.indexOf(`[[${linkpath(hund)}|`)) + 1;
				await act({
					content: `${text.slice(0, firstLine)}Neu getippt.\n\n${text.slice(firstLine)}`,
					kind: "modifyFile",
					path: "Story.md",
				});
				await act({
					activeElsewhere: "Other.md",
					kind: "clickScrollLink",
					linkpath: linkpath(hund),
					nth: 0,
					path: "Story.md",
				});
				notes = (await dictionary()).markdown;
				expect(countOf(notes[hund], ANY_KONTEXT)).toBe(2);
				expect((await snapshot()).markdown["Other.md"]).not.toContain("^");
				expect(countOf(notes[hund], kontext(1))).toBe(1);

				// A Cmd-click, which Obsidian opens in a new tab, attests too.
				await act({ kind: "clickScrollLink", linkpath: linkpath(heute), path: "Story.md", press: "mod" });
				expect(countOf((await dictionary()).markdown[heute], ANY_KONTEXT)).toBe(1);

				// So does a middle click, on one piece of the separable verb.
				await act({
					kind: "clickScrollLink",
					linkpath: linkpath(anfangen),
					nth: 1,
					path: "Story.md",
					press: "middle",
				});
				expect(countOf((await dictionary()).markdown[anfangen], ANY_KONTEXT)).toBe(1);

				// And a click in Reading view.
				await act({
					kind: "clickScrollLink",
					linkpath: linkpath(aufJedenFall),
					path: "Story.md",
					view: "reading",
				});
				notes = (await dictionary()).markdown;
				expect(countOf(notes[aufJedenFall], ANY_KONTEXT)).toBe(1);
				// Nothing else gained an Attestation along the way.
				expect(countOf(notes[hund], ANY_KONTEXT)).toBe(2);
				expect(countOf(notes[heute], ANY_KONTEXT)).toBe(1);
				expect(countOf(notes[anfangen], ANY_KONTEXT)).toBe(1);
			},
		);
	});
});
