/**
 * The Dictionary reset (#117) end to end without Obsidian: the plugin's
 * dumgen service with the `classify-resolution` script, the real resolver and
 * dictionary store over a fake vault, and the dev vault's situation in
 * small. The old notes sit in the first reset's backup folder, and
 * `Worter/` holds that reset's obsolete marker-format Lemma and Shadow
 * notes. Execute backs up the obsolete notes, regenerates from the backup
 * into Lemma, Reading and Crossroad notes, re-attaches the freeform text to
 * the Reading note, and never writes a Shadow note.
 */
import { describe, expect, it } from "bun:test";
import { makeDumdictVaultStore } from "@textfresser/dictionary";
import { type Answer, operations } from "dumgen";
import { Deferred, Effect, Layer } from "effect";
import { ClassifySegmenter } from "../../../src/commanders/classify/classify-selection";
import { dumgenUnitResolver } from "../../../src/commanders/classify/resolution/dumgen-unit-resolver";
import { makeKnowledgeQueue } from "../../../src/commanders/classify/resolution/knowledge-queue";
import { produceKnowledge } from "../../../src/commanders/classify/resolution/produce-knowledge";
import {
	memorySegmentationCache,
	SegmentationCache,
} from "../../../src/commanders/classify/segmentation-cache";
import { UnitResolver } from "../../../src/commanders/classify/unit-resolver";
import {
	dryRunReset,
	executeReset,
} from "../../../src/commanders/dictionary-reset/execute";
import {
	type ResetDictionary,
	ResetFailed,
	type ResetVault,
} from "../../../src/commanders/dictionary-reset/ports";
import {
	FakeVault,
	vamWrite,
} from "../../../src/packages/composed/dictionary/tests/support/fake-vault";
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	LEMMA_PATHS,
	STORY,
} from "../../obsidian-e2e/scenarios/classify-resolution-script";
import { inScope } from "../../support/scoped";
import { MemoryScroll } from "../../unit/classify/resolution/support";
import { dumgenServiceOver, unreachable } from "../../unit/dumgen/dumgen-support";

const SCROLL = "Library/Story.md";
const SOURCE = "Worter backup 2026-10-21 05-43-21";
const STAMP = "2026-10-22 09-00-00";
const NEW_BACKUP = `Worter backup ${STAMP}`;

const OLD_HUND = [
	"🐕 der [[Hund]], [hʊnt](https://youglish.com/pronounce/Hund/german) ^LX-LM-NOUN-1",
	"",
	'<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>',
	"![[Story#^1|^]]",
	"",
	'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
	"dog",
	"",
	"",
	"Mein Hund heißt Bello.",
	"",
	"",
	"",
	"Er bellt [laut] ✋ 👀, wie [[See]].",
	"",
].join("\n");

/** What the first reset left: the old notes in its backup, obsolete notes in Worter/. */
const VAULT: Record<string, string> = {
	[`${SOURCE}/de/lexem/lemma/h/hun/hund/Hund.md`]: OLD_HUND,
	[`${SOURCE}/Untitled.md`]: "a scratch note\n",
	"Worter/de/Lexeme/NOUN/Masc/Hund.md":
		'%%tf-part:lemma%%\n%%tf:identity {"canonicalForm":"Hund"}%%\n\n%%tf-part:reading r-1a2b3c4d%%\n🐕 der [[Worter/de/Lexeme/NOUN/Masc/Hund|Hund]] ^r-1a2b3c4d\n',
	"Worter/de/Shadow/Lexeme/NOUN/Köter.md": "%%tf:shadow%%\n",
};

function answersOf(
	script: Readonly<Record<string, string | number>>,
): Record<string, Answer> {
	return Object.fromEntries(
		Object.entries(script).map(([id, answer]) => [
			id,
			typeof answer === "number"
				? { noul: answer, type: "noul" }
				: {
						choice: answer,
						confidence: 1,
						probabilities: { [answer]: 1 },
						type: "choice",
					},
		]),
	);
}

/**
 * The reset's vault port over the store's fake vault, with the Scroll in
 * memory. Its writes reach the store as another VAM caller's would, with no
 * rescan.
 */
function resetVault(vault: FakeVault, scroll: MemoryScroll): ResetVault {
	const paths = () => [...vault.files.keys(), scroll.path];
	const under = (folder: string) =>
		paths().filter((path) => path.startsWith(`${folder}/`));
	return {
		createNote: (path, content) =>
			Effect.suspend(() => {
				if (vault.files.has(path))
					return Effect.fail(new ResetFailed({ cause: path, message: "exists" }));
				return Effect.promise(() =>
					vault.userWrite(path, content, vamWrite("reset")),
				);
			}),
		exists: (path) =>
			Effect.sync(() => paths().includes(path) || under(path).length > 0),
		listFolder: (folder) =>
			Effect.sync(() => {
				const inside = under(folder);
				if (inside.length === 0) return undefined;
				return {
					markdown: inside
						.filter((path) => path.endsWith(".md"))
						.map((path) => ({
							content: vault.content(path) ?? "",
							path,
						})),
					other: inside.filter((path) => !path.endsWith(".md")),
				};
			}),
		listRootFolders: Effect.sync(() => [
			...new Set(
				paths().flatMap((path) =>
					path.includes("/") ? [path.split("/")[0] ?? ""] : [],
				),
			),
		]),
		// As VAM's link-preserving rename: no event reaches the store.
		moveFolder: (from, to) =>
			Effect.promise(() =>
				vault.userRenameFolder(from, to, vamWrite("reset")),
			),
		read: (path) =>
			Effect.sync(() =>
				path === scroll.path ? scroll.content : vault.content(path),
			),
		resolveLink: (linkpath) =>
			Effect.sync(() => (linkpath === "Story" ? scroll.path : undefined)),
	};
}

async function setUp() {
	const dumgen = dumgenServiceOver(unreachable, () => ({
		openaiApiKey: "",
		typesafeApiKey: "",
	}));
	Effect.runSync(
		dumgen.testing.useScripted({
		jev: answersOf(CLASSIFY_RESOLUTION_DUMGEN.jev),
		luna: CLASSIFY_RESOLUTION_DUMGEN.luna,
		}),
	);
	// Obsidian knows the Scroll, so refs name it by its basename.
	const vault = new FakeVault({ ...VAULT, [SCROLL]: STORY });
	const store = await Effect.runPromise(makeDumdictVaultStore({ vault }));
	// The old Hund note's attestation, with the link the user wrote then (#148).
	const scroll = new MemoryScroll(
		SCROLL,
		STORY.replace("Der Hund schläft.", "Der [[Hund]] schläft."),
	);
	const { value: queue } = await inScope(
		makeKnowledgeQueue({
			notify: () => undefined,
			run: (job) =>
				produceKnowledge(
					{ dumgen: operations, store, translationLanguages: ["en"] },
					job,
				).pipe(dumgen.provideBackground),
		}),
	);
	const dictionary: ResetDictionary = {
		appendFreeform: (request) =>
			store.appendFreeform(request).pipe(
				Effect.mapError(
					(error) => new ResetFailed({ cause: error, message: error.message }),
				),
			),
		caughtUp: store.caughtUp,
		settleKnowledge: queue.whenIdle,
	};
	const layer = Layer.mergeAll(
		Layer.succeed(SegmentationCache, memorySegmentationCache()),
		Layer.succeed(
			UnitResolver,
			dumgenUnitResolver({
				dumgen: operations,
				knowledge: queue,
				scroll,
				store: Effect.succeed(store),
			}),
		),
		Layer.succeed(ClassifySegmenter, { segmenterVersion: "test-segmenter" }),
	);
	const execute = () =>
		Effect.runPromiseExit(
			executeReset({
				cancel: Deferred.makeUnsafe<void>(),
				dictionary,
				source: SOURCE,
				stamp: STAMP,
				vault: resetVault(vault, scroll),
			}).pipe(Effect.provide(layer), dumgen.provide),
		);
	return { execute, scroll, store, vault };
}

describe("the Dictionary reset regenerates into the Lemma, Reading and Crossroad layout", () => {
	it("backs up the obsolete notes, regenerates from the backup, and writes no Shadow note", async () => {
		const { execute, scroll, store, vault } = await setUp();
		const dryRun = await Effect.runPromise(
			dryRunReset(resetVault(vault, scroll)),
		);
		expect(dryRun.plan.source).toBe(SOURCE);
		expect(dryRun.report).toContain("- Notes: 2 (2 Obsolete)");

		const exit = await execute();
		if (exit._tag !== "Success") throw new Error(String(exit.cause));
		const { execution, report, reportPath } = exit.value;

		// The obsolete notes are in the new backup, byte for byte, and the
		// source backup is as it was.
		for (const [path, content] of Object.entries(VAULT))
			expect(
				vault.content(
					path.startsWith("Worter/")
						? `${NEW_BACKUP}${path.slice("Worter".length)}`
						: path,
				),
			).toBe(content);
		expect(execution.backupFolder).toBe(NEW_BACKUP);

		// Worter/ holds the new layout only.
		const worter = vault
			.markdownPaths()
			.filter((path) => path.startsWith("Worter/"));
		const readingPath = LEMMA_PATHS.hund.replace(/Hund\.md$/u, "🐕 Hund.md");
		expect(worter).toContain(LEMMA_PATHS.hund);
		expect(worter).toContain(readingPath);
		expect(worter).toContain("Worter/h/hun/hund/hund.md");
		expect(worter.filter((path) => path.includes("/Shadow/"))).toEqual([]);
		expect(execution.layout).toMatchObject({
			lemmaNotes: [LEMMA_PATHS.hund],
			readingNotes: [readingPath],
			shadowNotes: [],
		});
		expect(execution.layout?.crossroadNotes).toContain(
			"Worter/h/hun/hund/hund.md",
		);

		// The occurrence is linked to the Reading note, its old link
		// replaced, and recorded with a per-occurrence ref; the freeform text
		// sits in the Reading note.
		expect(scroll.content).toContain(
			`\n\n[[${readingPath.slice(0, -3)}|Der Hund]] schläft. ^1`,
		);
		expect(execution.regenerations).toMatchObject([
			{ _tag: "Regenerated", linked: 1 },
		]);
		const reading = vault.content(readingPath) ?? "";
		expect(reading).toMatch(/!\[\[Story#\^1\|\^[0-9a-f]{8}\]\]/u);
		// Paragraphs blank lines apart land as they were (#149).
		expect(reading).toContain(
			"Mein Hund heißt Bello.\n\n\n\nEr bellt [laut] ✋ 👀, wie [[See]].",
		);
		// Notes are read in path order: `Untitled.md` before `de/…`.
		expect(execution.freeform).toEqual([
			{
				_tag: "Unplaced",
				reason: 'no attestation of "Untitled" can be regenerated',
			},
			{ _tag: "Attached", path: readingPath, to: "Reading" },
		]);
		expect(
			(await Effect.runPromise(store.diagnostics)).quarantined,
		).toEqual([]);

		// The report names the layout it produced.
		expect(reportPath).toBe(`Dictionary reset ${STAMP}.md`);
		expect(vault.content(reportPath)).toBe(report);
		expect(report).toContain(`Source of the old notes: \`${SOURCE}/\`.`);
		expect(report).toContain(`Worter/ was moved to \`${NEW_BACKUP}/\`.`);
		expect(report).toContain(
			"## Worter/ now (1 Lemma note, 1 Reading note, 1 Crossroad note)",
		);
		expect(report).toContain("No Shadow notes.");
		expect(report).toContain(
			`[[${readingPath.slice(0, -3)}|🐕 Hund]]`,
		);
	});

	it("refuses to run again once Worter/ holds the new layout, changing nothing", async () => {
		const { execute, vault } = await setUp();
		const first = await execute();
		expect(first._tag).toBe("Success");
		const before = new Map(
			[...vault.files].map(([path, { content }]) => [path, content]),
		);
		const second = await execute();
		expect(second._tag).toBe("Failure");
		expect(String(second._tag === "Failure" ? second.cause : "")).toContain(
			"of the current layout",
		);
		expect(
			new Map([...vault.files].map(([path, { content }]) => [path, content])),
		).toEqual(before);
	});
});
