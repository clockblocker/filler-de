/**
 * The reset's source folder and freeform placement (#117): which folder
 * of old notes it suggests and accepts, and which regenerated note an old
 * freeform Block goes to.
 */
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { freeformTarget } from "../../../src/commanders/dictionary-reset/freeform-target";
import { ResetFailed, type ResetVault } from "../../../src/commanders/dictionary-reset/ports";
import {
	chooseSource,
	findSources,
} from "../../../src/commanders/dictionary-reset/source";

const OLD = "🚗 der [[Fahrer]] ^LX-LM-NOUN-1\n";
const OBSOLETE = "%%tf-part:lemma%%\n";

/** A read-only vault of Markdown files. */
function vaultOf(files: Record<string, string>): ResetVault {
	const paths = Object.keys(files);
	const under = (folder: string) =>
		paths.filter((path) => path.startsWith(`${folder}/`));
	const refused = () => Effect.fail(new ResetFailed({ cause: null, message: "read-only" }));
	return {
		createNote: refused,
		exists: (path) => Effect.succeed(path in files || under(path).length > 0),
		listFolder: (folder) =>
			Effect.succeed(
				under(folder).length === 0
					? undefined
					: {
							markdown: under(folder).map((path) => ({
								content: files[path] ?? "",
								path,
							})),
							other: [],
						},
			),
		listRootFolders: Effect.succeed([
			...new Set(paths.map((path) => path.split("/")[0] ?? "")),
		]),
		moveFolder: refused,
		read: (path) => Effect.succeed(files[path]),
		resolveLink: () => Effect.succeed(undefined),
	};
}

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

describe("the reset's source folder", () => {
	it("suggests the newest backup holding old notes once Worter/ holds none", async () => {
		const vault = vaultOf({
			"Library/Story.md": "Der Fahrer. ^0\n",
			"Worter backup 2026-10-20 20-44-26/de/Fahrer.md": OLD,
			"Worter backup 2026-10-21 05-43-21/de/Fahrer.md": OLD,
			"Worter backup 2026-10-21 05-43-21/Untitled.md": "",
			"Worter backup 2026-10-22 09-00-00/de/Lexeme/NOUN/Fahrer.md": OBSOLETE,
			"Worter backups old/Fahrer.md": OLD,
			"Worter/de/Lexeme/NOUN/Masc/Fahrer.md": OBSOLETE,
		});
		const choice = await run(findSources(vault));
		expect(choice.candidates).toEqual([
			{ folder: "Worter", notes: 1, oldNotes: 0 },
			{ folder: "Worter backup 2026-10-22 09-00-00", notes: 1, oldNotes: 0 },
			{ folder: "Worter backup 2026-10-21 05-43-21", notes: 2, oldNotes: 2 },
			{ folder: "Worter backup 2026-10-20 20-44-26", notes: 1, oldNotes: 1 },
		]);
		expect(choice.suggested).toBe("Worter backup 2026-10-21 05-43-21");
		expect(await run(chooseSource(vault, undefined))).toBe(
			"Worter backup 2026-10-21 05-43-21",
		);
	});

	it("suggests Worter/ while it holds old notes, and orders a taken name's copies", async () => {
		const vault = vaultOf({
			"Worter backup 2026-10-21 05-43-21 2/a.md": OLD,
			"Worter backup 2026-10-21 05-43-21/a.md": OLD,
			"Worter/de/lexem/lemma/f/fah/fahre/Fahrer.md": OLD,
		});
		const choice = await run(findSources(vault));
		expect(choice.candidates.map(({ folder }) => folder)).toEqual([
			"Worter",
			"Worter backup 2026-10-21 05-43-21 2",
			"Worter backup 2026-10-21 05-43-21",
		]);
		expect(choice.suggested).toBe("Worter");
	});

	it("takes only Worter/ or a backup folder at the root as an explicit source", async () => {
		const vault = vaultOf({ "Worter/a.md": OLD });
		expect(await run(chooseSource(vault, "Worter backup 2026-10-21 05-43-21/"))).toBe(
			"Worter backup 2026-10-21 05-43-21",
		);
		for (const folder of ["Library", "Archive/Worter backup 2026-10-21 05-43-21"]) {
			const exit = await Effect.runPromiseExit(chooseSource(vault, folder));
			expect(exit._tag).toBe("Failure");
		}
	});

	it("has nothing to suggest when no folder holds old notes", async () => {
		const vault = vaultOf({ "Worter/de/Lexeme/NOUN/Fahrer.md": OBSOLETE });
		expect((await run(findSources(vault))).suggested).toBeUndefined();
		const exit = await Effect.runPromiseExit(chooseSource(vault, undefined));
		expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
			"nothing to reset",
		);
	});
});

describe("where an old freeform Block goes", () => {
	const lemma = "Worter/de/Lexeme/NOUN/Fem/b/ban/bank/Bank.md";
	const bench = {
		lemmaPath: lemma,
		readingPath: "Worter/de/Lexeme/NOUN/Fem/b/ban/bank/🪑 Bank.md",
	};
	const money = {
		lemmaPath: lemma,
		readingPath: "Worter/de/Lexeme/NOUN/Fem/b/ban/bank/🏦 Bank.md",
	};

	it("goes to the only Reading its Lemma regenerated", () => {
		expect(freeformTarget([], [bench, bench])).toEqual({
			_tag: "Reading",
			path: bench.readingPath,
		});
	});

	it("goes to the Reading whose emoji its old entry names", () => {
		expect(freeformTarget(["🏦", "💶"], [bench, money])).toEqual({
			_tag: "Reading",
			path: money.readingPath,
		});
		// Variation selectors and skin tones do not keep emojis apart.
		const pointing = {
			lemmaPath: "Worter/de/Lexeme/VERB/z/zei/zeige/zeigen.md",
			readingPath: "Worter/de/Lexeme/VERB/z/zei/zeige/👉 zeigen.md",
		};
		const other = {
			lemmaPath: pointing.lemmaPath,
			readingPath: "Worter/de/Lexeme/VERB/z/zei/zeige/📺 zeigen.md",
		};
		expect(freeformTarget(["👉🏽"], [pointing, other])).toMatchObject({
			path: pointing.readingPath,
		});
	});

	it("falls back to the Lemma note when the sense is ambiguous", () => {
		expect(freeformTarget([], [bench, money])).toEqual({
			_tag: "Lemma",
			path: lemma,
		});
		expect(freeformTarget(["🪑", "🏦"], [bench, money])).toEqual({
			_tag: "Lemma",
			path: lemma,
		});
	});

	it("is not placed when even the Lemma is ambiguous, or nothing was regenerated", () => {
		const sea = {
			lemmaPath: "Worter/de/Lexeme/NOUN/Fem/s/see/see/See.md",
			readingPath: "Worter/de/Lexeme/NOUN/Fem/s/see/see/🌊 See.md",
		};
		const lake = {
			lemmaPath: "Worter/de/Lexeme/NOUN/Masc/s/see/see/See.md",
			readingPath: "Worter/de/Lexeme/NOUN/Masc/s/see/see/🏞️ See.md",
		};
		expect(freeformTarget([], [sea, lake])).toMatchObject({ _tag: "None" });
		expect(freeformTarget(["🏞"], [sea, lake])).toEqual({
			_tag: "Reading",
			path: lake.readingPath,
		});
		expect(freeformTarget(["🚗"], [])).toMatchObject({ _tag: "None" });
	});
});
