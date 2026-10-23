/**
 * The reset's Collect and plan stages (#65) over a fixture copied from the
 * dev vault's old `Worter/` notes: both metadata shapes (`entity` in
 * Fahrer, `lexicalMeta` in Team and aufpassen), a propagation stub
 * (fahren), an inflection host (Fahrern), a morpheme entry (k), a
 * freeform-only note (Atom), an empty note, and a made-up Gespenst whose
 * attestations cannot resolve.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Effect } from "effect";
import { dirResetVault } from "../../../scripts/dictionary-reset/dir-reset-vault";
import { dryRunReset } from "../../../src/commanders/dictionary-reset/execute";
import { locateAttestation } from "../../../src/commanders/dictionary-reset/locate-attestation";
import { readOldNote } from "../../../src/commanders/dictionary-reset/old-notes";
import {
	collectOldNotes,
	planReset,
	type ResetSources,
} from "../../../src/commanders/dictionary-reset/plan";
import { countPlan } from "../../../src/commanders/dictionary-reset/report";

const FIXTURE = join(import.meta.dir, "fixtures/vault");
const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

async function dryRun() {
	return run(dryRunReset(dirResetVault(FIXTURE)));
}

const noteAt = (
	plan: Awaited<ReturnType<typeof dryRun>>["plan"],
	suffix: string,
) => {
	const note = plan.collected.notes.find(({ path }) => path.endsWith(suffix));
	if (!note) throw new Error(`No note ${suffix}`);
	return note;
};

describe("Collect", () => {
	it("reads every old note's kind, metadata shape, headword and forms", async () => {
		const { plan } = await dryRun();
		const summary = Object.fromEntries(
			plan.collected.notes.map((note) => [
				note.path.replace(/^Worter\//u, ""),
				{
					headword: note.headword,
					kind: note.kind,
					metaShapes: note.metaShapes,
				},
			]),
		);
		expect(Object.keys(summary)).toHaveLength(9);
		expect(summary["Atom.md"]).toEqual({
			headword: "Atom",
			kind: "FreeformOnly",
			metaShapes: [],
		});
		expect(summary["Untitled.md"]).toEqual({
			headword: "Untitled",
			kind: "Empty",
			metaShapes: [],
		});
		expect(summary["de/lexem/lemma/f/fah/fahre/Fahrer.md"]).toEqual({
			headword: "Fahrer",
			kind: "Entry",
			metaShapes: ["Entity"],
		});
		expect(summary["de/lexem/lemma/t/tea/team/Team.md"]).toEqual({
			headword: "Team",
			kind: "Entry",
			metaShapes: ["LexicalMeta"],
		});
		expect(summary["de/lexeme/inflection/a/auf/aufpa/aufpassen.md"]).toEqual({
			headword: "aufpassen",
			kind: "Entry",
			metaShapes: ["LexicalMeta"],
		});
		expect(summary["de/lexem/lemma/f/fah/fahre/fahren.md"]).toEqual({
			headword: "fahren",
			kind: "Stub",
			metaShapes: [],
		});
		expect(summary["de/lexem/inflected/f/fah/fahre/Fahrern.md"]).toEqual({
			headword: "Fahrer",
			kind: "InflectionHost",
			metaShapes: [],
		});
		expect(summary["de/morphem/lemma/k/k/k/k.md"]).toEqual({
			headword: "k",
			kind: "Entry",
			metaShapes: [],
		});
		expect(noteAt(plan, "aufpassen.md").forms).toEqual([
			"aufpassen",
			"passe",
			"passte",
			"aufgepasst",
			"pässe",
			"pass",
		]);
		expect(noteAt(plan, "Fahrer.md").forms).toEqual(["Fahrer", "Fahrers", "Fahrern"]);
	});

	it("collects every attestation embed and every freeform Block, and nothing generated", async () => {
		const { plan } = await dryRun();
		expect(
			plan.collected.notes.flatMap(({ attestations, path }) =>
				attestations.map(({ embed }) => `${path.split("/").at(-1)}: ${embed}`),
			),
		).toEqual([
			"Fahrer.md: ![[Morphologie ;; test ;; Textfresser#^0|^]]",
			"Gespenst.md: ![[Missing scroll#^3|^]]",
			"Gespenst.md: ![[Morphologie ;; test ;; Textfresser#^99|^]]",
			"Gespenst.md: ![[Morphologie ;; test ;; Textfresser#^2|^]]",
			"Team.md: ![[Morphologie ;; test ;; Textfresser#^4|^]]",
			"aufpassen.md: ![[1.2 Sams Ankunft#^19|^]]",
		]);
		const freeform = Object.fromEntries(
			plan.collected.notes
				.filter(({ freeform }) => freeform.length > 0)
				.map(({ freeform, path }) => [
					path.split("/").at(-1),
					freeform.map(({ line, text }) => ({ line, text })),
				]),
		);
		expect(Object.keys(freeform).sort()).toEqual([
			"Atom.md",
			"Gespenst.md",
			"aufpassen.md",
		]);
		expect(freeform["Gespenst.md"]).toEqual([
			{ line: 9, text: "seen in a dream, not in a book" },
			{ line: 15, text: "My own mnemonic: a ghost that spends the night." },
		]);
		const [trailing] = freeform["aufpassen.md"] ?? [];
		expect(trailing?.line).toBe(34);
		// The sense emojis of the entry the text sits under, from its header
		// and its metadata: what finds its Reading note (#117).
		expect(
			noteAt(plan, "aufpassen.md").freeform.map(({ emojis }) => emojis),
		).toEqual([["✋", "👀"]]);
		expect(trailing?.text.startsWith("I [walked] in the park")).toBe(true);
		expect(trailing?.text.trimEnd().endsWith("aufpassen")).toBe(true);
		expect(trailing?.text).not.toContain("Flexion");
		expect(trailing?.text).not.toContain("textfresser_meta");
		expect(freeform["Atom.md"]?.[0]?.text).toContain("^14");
	});

	it("keeps lines after the metadata section, before the first entry and in Kontexte", () => {
		const note = readOldNote(
			"Worter/x.md",
			[
				"typed before the entry",
				"",
				"der [[See]] ^LX-LM-NOUN-1",
				"",
				'<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>',
				"![[Scroll#^a1|^]] and a remark",
				"",
				'<section id="textfresser_meta_keep_me_invisible">',
				"not json",
				"</section>",
				"after the metadata",
			].join("\n"),
		);
		expect(note.freeform.map(({ text }) => text)).toEqual([
			"typed before the entry",
			"![[Scroll#^a1|^]] and a remark",
			"after the metadata",
		]);
		expect(note.attestations.map(({ blockId, linkpath }) => [linkpath, blockId])).toEqual([
			["Scroll", "a1"],
		]);
		expect(note.unreadableMeta).toBe(true);
		expect(note.headword).toBe("See");
	});
});

describe("readOldNote reads an old metadata section's shapes", () => {
	const noteWith = (json: string) =>
		readOldNote(
			"Worter/x/Hund.md",
			[
				"🐕 der [[Hund]] ^LX-LM-NOUN-1",
				"",
				'<section id="textfresser_meta_keep_me_invisible">',
				json,
				"</section>",
			].join("\n"),
		);

	it("tells each entry's shape, keeping every entry ID", () => {
		const note = noteWith(
			JSON.stringify({
				entries: {
					"LX-LM-NOUN-1": {
						entity: { emojiDescription: ["🐕"], lemma: "Hund", more: 1 },
					},
					"LX-LM-NOUN-2": { lexicalMeta: { metaTag: "t" } },
					"LX-LM-NOUN-3": { entity: { lemma: 3 } },
					"LX-LM-NOUN-4": { lexicalMeta: { emojiDescription: null, metaTag: "t" } },
					"LX-LM-NOUN-5": [],
				},
			}),
		);
		expect(note.unreadableMeta).toBe(false);
		expect(note.metaShapes).toEqual([
			"Entity",
			"LexicalMeta",
			"Unrecognized",
			"Unrecognized",
			"Unrecognized",
		]);
	});

	it("reads entries that are not an object, or no JSON, as unreadable", () => {
		for (const json of ['{"entries":[]}', '{"entries":null}', "[]", "{"])
			expect(noteWith(json).unreadableMeta).toBe(true);
		expect(noteWith('{"entries":{}}').unreadableMeta).toBe(false);
	});

	it("keeps an entry ID JSON.parse makes an own __proto__", () => {
		const note = noteWith(
			'{"entries":{"__proto__":{"entity":{"lemma":"Proto"}}}}',
		);
		expect(note.metaShapes).toEqual(["Entity"]);
		expect(note.forms).toContain("Proto");
	});
});

describe("readOldNote keeps what the old generator did not write", () => {
	const title = (kind: string, text: string) =>
		`<span class="entry_section_title entry_section_title_${kind}">${text}</span>`;

	it("takes lines that do not fit their section's shape as freeform", () => {
		const note = readOldNote(
			"Worter/x/Gespenst.md",
			[
				"👻 das Gespenst, [ipa](https://youglish.com/x) ^LX-LM-NOUN-1",
				"",
				title("synonyme", "Semantische Beziehungen"),
				"= [[Geist]], [[Spuk]]",
				"",
				"a remark one blank line below",
				title("translations", "Übersetzung"),
				"ghost",
				"also: spook, mine",
				title("tags", "Tags"),
				"#noun/neuter",
				"right before the metadata",
				'<section id="textfresser_meta_keep_me_invisible">',
				'{"entries":{"LX-LM-NOUN-1":{"lexicalMeta":{"metaTag":"lx|noun|lemma"}}}}',
				"typed into a section that never closes",
			].join("\n"),
		);
		expect(note.freeform.map(({ line, text }) => [line, text])).toEqual([
			[6, "a remark one blank line below"],
			[9, "also: spook, mine"],
			[12, "right before the metadata"],
			[15, "typed into a section that never closes"],
		]);
		expect(note.metaShapes).toEqual(["LexicalMeta"]);
		// A header without a link and with several words falls back to the basename.
		expect(note.headword).toBe("Gespenst");
	});

	it("reads nothing from a note in the obsolete marker format", () => {
		const note = readOldNote(
			"Worter/de/Lexeme/NOUN/See.md",
			"%%tf-part:lemma%%\n\nmy notes\n![[Scroll#^1|^]]\n",
		);
		expect(note.kind).toBe("Obsolete");
		expect(note.freeform).toEqual([]);
		expect(note.attestations).toEqual([]);
		expect(readOldNote("Worter/de/Shadow/Lexeme/NOUN/See.md", "%%tf:shadow%%\n").kind).toBe(
			"Obsolete",
		);
	});

	it("tells a note of the current layout by its dictionary metadata", () => {
		const note = readOldNote(
			"Worter/s/see/see/see.md",
			[
				"*Not classified yet*",
				"",
				'<section id="textfresser_meta_keep_me_invisible">',
				'{"crossroadNote":{"schemaVersion":1,"key":"see","language":"de","rendering":[]}}',
				"</section>",
				"",
			].join("\n"),
		);
		expect(note.kind).toBe("NewFormat");
		expect(note.freeform).toEqual([]);
	});

	it("takes each entry's sense emojis for the text under it", () => {
		const note = readOldNote(
			"Worter/de/Bank.md",
			[
				"text before any entry",
				"🪑 die [[Bank]] ^LX-LM-NOUN-1",
				"",
				'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
				"bench",
				"",
				"",
				"I sat on it",
				"---",
				"🏦 die [[Bank]] ^LX-LM-NOUN-2",
				"",
				'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
				"bank",
				"",
				"",
				"I keep money there",
				"",
				'<section id="textfresser_meta_keep_me_invisible">',
				'{"entries":{"LX-LM-NOUN-2":{"lexicalMeta":{"emojiDescription":["🏦","💶"],"metaTag":"x"}}}}',
				"</section>",
			].join("\n"),
		);
		expect(note.freeform.map(({ emojis, text }) => [text, emojis])).toEqual([
			["text before any entry", []],
			["I sat on it", ["🪑"]],
			["I keep money there", ["🏦", "💶"]],
		]);
	});
});

describe("plan", () => {
	it("finds each attestation's Segment, or says why it cannot", async () => {
		const { plan } = await dryRun();
		expect(
			plan.attestations.map(({ headword, outcome }) =>
				outcome._tag === "Ready"
					? `${headword}: ${outcome.scrollPath} "${outcome.text}" by ${outcome.via}`
					: `${headword}: ${outcome._tag === "Unresolvable" ? outcome.reason : outcome._tag}`,
			),
		).toEqual([
			'Fahrer: Library/Textfresser/test/Morphologie ;; test ;; Textfresser.md "Fahrer" by Link',
			'Gespenst: no note "Missing scroll" exists',
			"Gespenst: its source has no block ^99",
			'Gespenst: none of "Gespenst" occurs in block ^2',
			'Team: Library/Textfresser/test/Morphologie ;; test ;; Textfresser.md "Team" by Link',
			'aufpassen: Texte/Extra/1.2 Sams Ankunft.md "Pass" by Link',
		]);
	});

	it("attaches freeform text only where a Lemma will be regenerated", async () => {
		const { plan, report } = await dryRun();
		expect(
			plan.freeform.map(({ headword, outcome }) => `${headword}: ${outcome._tag}`),
		).toEqual([
			"Atom: Unplaceable",
			"Gespenst: Unplaceable",
			"Gespenst: Unplaceable",
			"aufpassen: WouldAttach",
		]);
		expect(countPlan(plan)).toMatchObject({
			attachableFreeform: 1,
			attestations: 6,
			freeformBlocks: 4,
			notes: 9,
			readyAttestations: 3,
			unresolvableAttestations: 3,
		});
		expect(report).toContain("# Dictionary reset: dry run");
		expect(report).toContain("```text\nMy own mnemonic: a ghost that spends the night.\n```");
	});

	it("regenerates a Segment two old notes attest only once", async () => {
		const source = "Der [[Fahrer]] fährt. ^0\n";
		const sources: ResetSources = {
			read: (path) => Effect.succeed(path === "Story.md" ? source : undefined),
			resolveLink: (linkpath) =>
				Effect.succeed(linkpath === "Story" ? "Story.md" : undefined),
		};
		const note = (path: string) => ({
			content: `der [[Fahrer]] ^LX-LM-NOUN-1\n\n<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>\n![[Story#^0|^]]\n\n\nmemo from ${path}\n`,
			path,
		});
		const plan = await run(
			planReset(sources, {
				collected: collectOldNotes([
					note("Worter/a/Fahrer.md"),
					note("Worter/b/Fahrer.md"),
				]),
				source: "Worter",
			}),
		);
		expect(plan.attestations.map(({ outcome }) => outcome._tag)).toEqual([
			"Ready",
			"Duplicate",
		]);
		expect(plan.freeform.map(({ outcome }) => outcome._tag)).toEqual([
			"WouldAttach",
			"WouldAttach",
		]);
	});

	it("runs Execute's round-trip check on each freeform Block it would attach", async () => {
		const source = "Der [[Fahrer]] fährt. ^0\n";
		const sources: ResetSources = {
			read: (path) => Effect.succeed(path === "Story.md" ? source : undefined),
			resolveLink: (linkpath) =>
				Effect.succeed(linkpath === "Story" ? "Story.md" : undefined),
		};
		const entry = `der [[Fahrer]] ^LX-LM-NOUN-1\n\n<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>\n![[Story#^0|^]]\n\n\n`;
		const plan = await run(
			planReset(sources, {
				collected: collectOldNotes([
					{
						content: `${entry}first memo\n\n\n\nsecond [[See]] [walk] ✋ 👀\n`,
						path: "Worter/a/Fahrer.md",
					},
					{
						// The Note placeholder, which a note never reads as text.
						content: `${entry}*You can write here*\n`,
						path: "Worter/b/Fahrer.md",
					},
				]),
				source: "Worter",
			}),
		);
		expect(plan.freeform.map(({ outcome }) => outcome)).toEqual([
			{ _tag: "WouldAttach" },
			{
				_tag: "Unplaceable",
				reason:
					"its text cannot be placed in a note: the text would not read back whole from the note",
			},
		]);
	});

	it("never plans to classify inside a dictionary note", async () => {
		const sources: ResetSources = {
			read: () => Effect.succeed("Das Atom. ^13\n"),
			resolveLink: () => Effect.succeed("Worter/Atom.md"),
		};
		const plan = await run(
			planReset(sources, {
				collected: collectOldNotes([
					{
						content: "[[Atom]] ^LX-LM-NOUN-1\n\n![[Atom#^13|^]]\n",
						path: "Worter/de/Atom.md",
					},
				]),
				source: "Worter",
			}),
		);
		expect(plan.attestations[0]?.outcome).toMatchObject({
			_tag: "Unresolvable",
			reason: expect.stringContaining("dictionary note"),
		});
		// Nor inside the backup folder the old notes come from.
		const backup = "Worter backup 2026-10-21 05-43-21";
		const fromBackup = await run(
			planReset(
				{
					read: () => Effect.succeed("Das Atom. ^13\n"),
					resolveLink: () => Effect.succeed(`${backup}/Atom.md`),
				},
				{
					collected: collectOldNotes([
						{
							content: "[[Atom]] ^LX-LM-NOUN-1\n\n![[Atom#^13|^]]\n",
							path: `${backup}/de/Atom.md`,
						},
					]),
					source: backup,
				},
			),
		);
		expect(fromBackup.attestations[0]?.outcome).toMatchObject({
			_tag: "Unresolvable",
			reason: expect.stringContaining("dictionary note"),
		});
	});
	it("never plans to classify inside a protected source", async () => {
		const scroll = "Exemplar/Kohlekraftwerk/Sources/Atom.md";
		const plan = await run(
			planReset(
				{
					isProtected: (path) => path.startsWith("Exemplar/"),
					read: () => Effect.succeed("Das Atom. ^13\n"),
					resolveLink: () => Effect.succeed(scroll),
				},
				{
					collected: collectOldNotes([
						{
							content: "[[Atom]] ^LX-LM-NOUN-1\n\n![[Atom#^13|^]]\n",
							path: "Worter/de/Atom.md",
						},
					]),
					source: "Worter",
				},
			),
		);
		expect(plan.attestations[0]?.outcome).toEqual({
			_tag: "Unresolvable",
			reason: `its source ${scroll} lies in a protected folder, which Textfresser never writes to`,
		});
	});
});

describe("locateAttestation", () => {
	it("prefers a link to the form, then a whole word in the visible text", () => {
		const content = "Intro.\n\nDie [[Karte|Fahrkarten]] und die Karte gelten. ^5\n";
		expect(locateAttestation(content, "5", ["Karte"])).toMatchObject({
			_tag: "Located",
			text: "Fahrkarten",
			via: "Link",
		});
		expect(locateAttestation(content, "5", ["gelten"])).toMatchObject({
			_tag: "Located",
			text: "gelten",
			via: "Text",
		});
		// "art" inside "Fahrkarten" is not a whole word.
		expect(locateAttestation(content, "5", ["art"])._tag).toBe("FormMissing");
		expect(locateAttestation(content, "6", ["Karte"])._tag).toBe("BlockMissing");
	});
});
