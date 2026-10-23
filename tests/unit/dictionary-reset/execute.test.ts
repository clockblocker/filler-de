/**
 * Execute (#65, #117) with a stubbed resolver and a fake vault: it backs up
 * `Worter/` before anything regenerates, whether the old notes are in
 * `Worter/` or in an earlier reset's backup folder, regenerates through
 * Classify's resolver port, re-attaches freeform text, writes its report,
 * and never deletes.
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { JevTransport, LunaTransport } from "dumgen";
import { Deferred, Effect, Layer } from "effect";
import { ClassifySegmenter } from "../../../src/commanders/classify/classify-selection";
import {
	memorySegmentationCache,
	SegmentationCache,
} from "../../../src/commanders/classify/segmentation-cache";
import type { ClassifyPlan } from "../../../src/commanders/classify/types";
import {
	type UnitResolution,
	UnitResolver,
} from "../../../src/commanders/classify/unit-resolver";
import { executeReset } from "../../../src/commanders/dictionary-reset/execute";
import {
	type ResetDictionary,
	ResetFailed,
	type ResetVault,
} from "../../../src/commanders/dictionary-reset/ports";
import { dumgenOver } from "../../../src/managers/dumgen";
import { createScriptedJev } from "../../../src/managers/dumgen/scripted-jev";

const FIXTURE = join(import.meta.dir, "fixtures/vault");
const BACKUP = "Worter backup 2026-10-20 12-00-00";
/** The folder the first reset moved the old notes to. */
const OLD_BACKUP = "Worter backup 2026-10-19 05-43-21";

function fixtureFiles(): Map<string, string> {
	const files = new Map<string, string>();
	const walk = (folder: string) => {
		for (const name of readdirSync(folder)) {
			const path = join(folder, name);
			if (statSync(path).isDirectory()) walk(path);
			else files.set(relative(FIXTURE, path), readFileSync(path, "utf8"));
		}
	};
	walk(FIXTURE);
	return files;
}

/** Notes the first reset wrote in the obsolete marker format. */
const OBSOLETE = new Map([
	[
		"Worter/de/Lexeme/NOUN/Masc/Fahrer.md",
		"%%tf-part:lemma%%\n%%tf-part:reading r-288c11eb%%\n🚗 der [[Worter/de/Lexeme/NOUN/Masc/Fahrer|Fahrer]] ^r-288c11eb\n\nmy note\n![[Morphologie ;; test ;; Textfresser#^0|^]]\n",
	],
	["Worter/de/Shadow/Lexeme/NOUN/Lenker.md", "%%tf:shadow%%\n"],
]);

/**
 * The dev vault after the first reset: the old notes in its backup folder,
 * and `Worter/` holding only obsolete notes.
 */
function afterFirstReset(): Map<string, string> {
	const files = new Map<string, string>();
	for (const [path, content] of fixtureFiles())
		files.set(
			path.startsWith("Worter/")
				? `${OLD_BACKUP}${path.slice("Worter".length)}`
				: path,
			content,
		);
	for (const [path, content] of OBSOLETE) files.set(path, content);
	return files;
}

/** A Crossroad note of the current layout, as the store writes it. */
const CROSSROAD_NOTE = [
	'<span class="note_block_title note_block_title_eintraege">Einträge</span>',
	"*Not classified yet*",
	"",
	'<section id="textfresser_meta_keep_me_invisible">',
	'{"crossroadNote":{"schemaVersion":1,"key":"see","language":"de","rendering":[{"block":"crossroad_lemma","hash":"0ad8a860","lines":2}]}}',
	"</section>",
	"",
].join("\n");

type Op = string;

/** An in-memory vault with the reset's port, logging every call that changes it. */
class FakeResetVault implements ResetVault {
	readonly ops: Op[] = [];
	constructor(
		readonly files: Map<string, string>,
		private readonly dropOnMove: string | undefined = undefined,
	) {}

	private under = (folder: string) =>
		[...this.files.keys()].filter((path) => path.startsWith(`${folder}/`));

	listRootFolders: ResetVault["listRootFolders"] = Effect.sync(() => [
		...new Set(
			[...this.files.keys()].flatMap((path) =>
				path.includes("/") ? [path.split("/")[0] ?? ""] : [],
			),
		),
	]);
	exists: ResetVault["exists"] = (path) =>
		Effect.sync(() => this.files.has(path) || this.under(path).length > 0);
	listFolder: ResetVault["listFolder"] = (folder) =>
		Effect.sync(() => {
			const paths = this.under(folder);
			if (paths.length === 0) return undefined;
			return {
				markdown: paths
					.filter((path) => path.endsWith(".md"))
					.map((path) => ({ content: this.files.get(path) ?? "", path })),
				other: paths.filter((path) => !path.endsWith(".md")),
			};
		});
	moveFolder: ResetVault["moveFolder"] = (from, to) =>
		Effect.sync(() => {
			this.ops.push(`move ${from} -> ${to}`);
			for (const path of this.under(from)) {
				const content = this.files.get(path) ?? "";
				this.files.delete(path);
				if (path.endsWith(this.dropOnMove ?? "\u0000")) continue;
				this.files.set(`${to}${path.slice(from.length)}`, content);
			}
		});
	createNote: ResetVault["createNote"] = (path, content) =>
		Effect.suspend(() => {
			if (this.files.has(path))
				return Effect.fail(new ResetFailed({ cause: path, message: "exists" }));
			this.ops.push(`create ${path}`);
			this.files.set(path, content);
			return Effect.void;
		});
	read: ResetVault["read"] = (path) => Effect.sync(() => this.files.get(path));
	resolveLink: ResetVault["resolveLink"] = (linkpath) =>
		Effect.sync(() =>
			[...this.files.keys()].find(
				(path) =>
					!path.startsWith("Worter") &&
					path.split("/").at(-1) === `${linkpath}.md`,
			),
		);
}

/** Resolves every planned unit to a note named after its first occurrence. */
function stubResolver(vault: FakeResetVault, onResolve?: () => void) {
	const plans: ClassifyPlan[] = [];
	const resolver = UnitResolver.of({
		resolve: (plan) =>
			Effect.sync(() => {
				plans.push(plan);
				onResolve?.();
				return plan.units.map((planned): UnitResolution => {
					const first = planned.occurrences[0];
					const text = first ? plan.content.slice(first.from, first.to) : "";
					const lemmaPath = `Worter/de/Lexeme/NOUN/${text}.md`;
					const readingPath = `Worter/de/Lexeme/NOUN/🔹 ${text}.md`;
					vault.ops.push(`resolve ${text}`);
					for (const path of [lemmaPath, readingPath])
						if (!vault.files.has(path)) vault.files.set(path, `${text}\n`);
					return {
						_tag: "Resolved",
						lemmaPath,
						linked: 0,
						readingPath,
						ref: planned.ref,
					};
				});
			}),
	});
	return { plans, resolver };
}

function stubDictionary(vault: FakeResetVault): ResetDictionary {
	return {
		appendFreeform: ({ path, text }) =>
			Effect.sync(() => {
				vault.ops.push(`append ${path}`);
				vault.files.set(path, `${vault.files.get(path) ?? ""}\n${text}\n`);
				return "Appended" as const;
			}),
		caughtUp: Effect.sync(() => {
			vault.ops.push("caught up");
		}),
		settleKnowledge: Effect.sync(() => {
			vault.ops.push("settle");
		}),
	};
}

function servicesWith(resolver: UnitResolver["Service"]) {
	const dumgen = dumgenOver({
		jev: JevTransport.fromAsk(createScriptedJev().ask),
		luna: LunaTransport.fromAsk(() =>
			Promise.reject(new Error("no Luna in this test")),
		),
	});
	return Layer.mergeAll(
		Layer.succeed(SegmentationCache, memorySegmentationCache()),
		Layer.succeed(UnitResolver, resolver),
		Layer.succeed(ClassifySegmenter, {
			dumgen: Effect.succeed(dumgen),
			segmenterVersion: "test",
		}),
	);
}

async function runExecute(
	vault: FakeResetVault,
	options: {
		readonly cancelAfterFirst?: boolean;
		readonly source?: string;
	} = {},
) {
	const cancel = Deferred.makeUnsafe<void>();
	const { plans, resolver } = stubResolver(vault, () => {
		if (options.cancelAfterFirst) Deferred.doneUnsafe(cancel, Effect.void);
	});
	const exit = await Effect.runPromiseExit(
		executeReset({
			cancel,
			dictionary: stubDictionary(vault),
			source: options.source ?? "Worter",
			stamp: "2026-10-20 12-00-00",
			vault,
		}).pipe(Effect.provide(servicesWith(resolver))),
	);
	return { exit, plans };
}

describe("executeReset", () => {
	it("backs up first, regenerates, re-attaches and reports, deleting nothing", async () => {
		const original = fixtureFiles();
		const vault = new FakeResetVault(new Map(original));
		const { exit, plans } = await runExecute(vault);
		if (exit._tag !== "Success") throw new Error(String(exit.cause));
		const result = exit.value;

		const move = vault.ops.indexOf(`move Worter -> ${BACKUP}`);
		const firstResolve = vault.ops.findIndex((op) => op.startsWith("resolve"));
		expect(move).toBe(0);
		// Regeneration waits until the store has followed the move.
		expect(vault.ops[1]).toBe("caught up");
		expect(firstResolve).toBeGreaterThan(move);
		expect(plans.map(({ scrollPath }) => scrollPath)).toEqual([
			"Library/Textfresser/test/Morphologie ;; test ;; Textfresser.md",
			"Library/Textfresser/test/Morphologie ;; test ;; Textfresser.md",
			"Texte/Extra/1.2 Sams Ankunft.md",
		]);

		// Nothing deleted: every old note is in the backup as it was, and
		// every other file is where it was.
		for (const [path, content] of original)
			if (path.startsWith("Worter/"))
				expect(vault.files.get(`${BACKUP}${path.slice("Worter".length)}`)).toBe(content);
			else expect(vault.files.get(path)).toBe(content);

		const regenerated = result.execution.regenerations.flatMap((entry) =>
			entry?._tag === "Regenerated" ? [entry.readingPath] : [],
		);
		expect(regenerated).toHaveLength(3);
		const aufpassen = result.execution.freeform.find(
			(entry) => entry._tag === "Attached",
		);
		expect(aufpassen).toMatchObject({ _tag: "Attached" });
		expect(aufpassen).toMatchObject({ to: "Reading" });
		const attachedTo = aufpassen?._tag === "Attached" ? aufpassen.path : "";
		expect(vault.files.get(attachedTo)).toContain("I [walked] in the park");
		expect(
			result.execution.freeform.filter((entry) => entry._tag === "Unplaced"),
		).toHaveLength(3);

		expect(result.reportPath).toBe("Dictionary reset 2026-10-20 12-00-00.md");
		expect(vault.ops.at(-1)).toBe(`create ${result.reportPath}`);
		const report = vault.files.get(result.reportPath) ?? "";
		expect(report).toContain("## Regenerated Readings (");
		expect(report).toContain("## Attestations it could not resolve (3)");
		expect(report).toContain("## Freeform text it could not place (3)");
		expect(report).toContain(`[[${BACKUP}/de/lexem/lemma/g/ges/gespe/Gespenst|Gespenst]]`);
	});

	it("stops before regenerating when the backup does not hold every old file", async () => {
		const vault = new FakeResetVault(fixtureFiles(), "Team.md");
		const { exit, plans } = await runExecute(vault);
		expect(exit._tag).toBe("Failure");
		expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
			"is not in the backup",
		);
		expect(plans).toHaveLength(0);
		// The store has followed whatever the stopped backup moved.
		expect(vault.ops).toContain("caught up");
		expect(vault.ops.some((op) => op.startsWith("create"))).toBe(false);
		expect(vault.ops.some((op) => op.startsWith("append"))).toBe(false);
	});

	it("moves nothing when Worter/ changed after Collect read it", async () => {
		const vault = new FakeResetVault(fixtureFiles());
		const list = vault.listFolder;
		let calls = 0;
		vault.listFolder = (folder) =>
			list(folder).pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						calls++;
						// Typed into a note while the plan read the Scrolls.
						if (calls === 1)
							vault.files.set("Worter/Atom.md", "edited meanwhile\n");
					}),
				),
			);
		const { exit, plans } = await runExecute(vault);
		expect(exit._tag).toBe("Failure");
		expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
			"Nothing was moved",
		);
		expect(vault.ops).toEqual([]);
		expect(plans).toHaveLength(0);
	});

	it("refuses a Worter/ that already holds notes of the current layout", async () => {
		const files = fixtureFiles();
		files.set("Worter/s/see/see/see.md", CROSSROAD_NOTE);
		const vault = new FakeResetVault(files);
		const { exit } = await runExecute(vault);
		expect(exit._tag).toBe("Failure");
		expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
			"of the current layout",
		);
		expect(vault.ops).toEqual([]);
	});

	it("backs up obsolete marker-format notes in Worter/ with the old ones, reading none", async () => {
		const files = fixtureFiles();
		for (const [path, content] of OBSOLETE) files.set(path, content);
		const vault = new FakeResetVault(files);
		const { exit, plans } = await runExecute(vault);
		if (exit._tag !== "Success") throw new Error(String(exit.cause));
		for (const [path, content] of OBSOLETE)
			expect(vault.files.get(`${BACKUP}${path.slice("Worter".length)}`)).toBe(
				content,
			);
		// The obsolete Fahrer's embed is not regenerated a second time.
		expect(plans).toHaveLength(3);
		expect(exit.value.report).toContain(
			"- Notes in the obsolete marker format, backed up and never read: 2",
		);
	});
});

describe("executeReset from an earlier reset's backup folder", () => {
	it("backs up Worter/'s obsolete notes first, then regenerates from the backup", async () => {
		const original = afterFirstReset();
		const vault = new FakeResetVault(new Map(original));
		const { exit, plans } = await runExecute(vault, { source: OLD_BACKUP });
		if (exit._tag !== "Success") throw new Error(String(exit.cause));
		const { execution, report } = exit.value;

		expect(vault.ops.slice(0, 2)).toEqual([
			`move Worter -> ${BACKUP}`,
			"caught up",
		]);
		expect(execution.backupFolder).toBe(BACKUP);
		// Every file is where it was, or, if it was in Worter/, in the new
		// backup as it was: nothing deleted, the old notes untouched.
		for (const [path, content] of original)
			expect(
				vault.files.get(
					path.startsWith("Worter/")
						? `${BACKUP}${path.slice("Worter".length)}`
						: path,
				),
			).toBe(content);
		expect(plans.map(({ scrollPath }) => scrollPath)).toEqual([
			"Library/Textfresser/test/Morphologie ;; test ;; Textfresser.md",
			"Library/Textfresser/test/Morphologie ;; test ;; Textfresser.md",
			"Texte/Extra/1.2 Sams Ankunft.md",
		]);
		const attached = execution.freeform.find(
			(entry) => entry._tag === "Attached",
		);
		expect(attached).toMatchObject({
			path: "Worter/de/Lexeme/NOUN/🔹 Pass.md",
			to: "Reading",
		});

		expect(report).toContain(`Source of the old notes: \`${OLD_BACKUP}/\`.`);
		expect(report).toContain("## Worter/ before the reset");
		expect(report).toContain("- Notes: 2 (2 Obsolete)");
		// Old notes are linked where they stay, in the source.
		expect(report).toContain(
			`[[${OLD_BACKUP}/de/lexem/lemma/g/ges/gespe/Gespenst|Gespenst]]`,
		);
		// The stub writes notes without metadata, so the layout counts them
		// as other notes; the integration test reads a real one.
		expect(execution.layout?.otherNotes).toHaveLength(6);
		expect(report).toContain("## Worter/ now (0 Lemma notes,");
	});

	it("stops before regenerating when the obsolete notes' backup is not complete", async () => {
		const vault = new FakeResetVault(afterFirstReset(), "Lenker.md");
		const { exit, plans } = await runExecute(vault, { source: OLD_BACKUP });
		expect(exit._tag).toBe("Failure");
		expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
			"is not in the backup",
		);
		expect(plans).toHaveLength(0);
		expect(vault.ops.some((op) => op.startsWith("create"))).toBe(false);
	});

	it("moves nothing when Worter/ changed after Collect read it", async () => {
		const vault = new FakeResetVault(afterFirstReset());
		const list = vault.listFolder;
		vault.listFolder = (folder) =>
			list(folder).pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						if (folder === "Worter" && !vault.files.has("Worter/new.md"))
							vault.files.set("Worter/new.md", "typed meanwhile\n");
					}),
				),
			);
		const { exit, plans } = await runExecute(vault, { source: OLD_BACKUP });
		expect(exit._tag).toBe("Failure");
		expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
			"Worter/ changed while the reset read it",
		);
		expect(vault.ops).toEqual([]);
		expect(plans).toHaveLength(0);
	});

	it("regenerates without a move when there is no Worter/", async () => {
		const files = afterFirstReset();
		for (const path of OBSOLETE.keys()) files.delete(path);
		const vault = new FakeResetVault(files);
		const { exit } = await runExecute(vault, { source: OLD_BACKUP });
		if (exit._tag !== "Success") throw new Error(String(exit.cause));
		expect(vault.ops.some((op) => op.startsWith("move"))).toBe(false);
		expect(exit.value.execution.backupFolder).toBeUndefined();
		expect(exit.value.report).toContain("There was no Worter/ to back up.");
	});

	it("refuses Worter/ as the source when it holds only obsolete notes", async () => {
		const vault = new FakeResetVault(afterFirstReset());
		const { exit } = await runExecute(vault, { source: "Worter" });
		expect(exit._tag).toBe("Failure");
		expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain(
			"holds no old notes",
		);
		expect(vault.ops).toEqual([]);
	});

	it("refuses an empty or missing Worter/ without moving anything", async () => {
		const vault = new FakeResetVault(new Map([["Texte/a.md", "Hallo. ^1\n"]]));
		const { exit } = await runExecute(vault);
		expect(exit._tag).toBe("Failure");
		expect(vault.ops).toEqual([]);
	});

	it("on cancel, stops regenerating, still re-attaches what it can and reports", async () => {
		const vault = new FakeResetVault(fixtureFiles());
		const { exit, plans } = await runExecute(vault, { cancelAfterFirst: true });
		if (exit._tag !== "Success") throw new Error(String(exit.cause));
		expect(plans).toHaveLength(1);
		expect(exit.value.execution.cancelled).toBe(true);
		expect(
			exit.value.execution.regenerations.filter(
				(entry) => entry?._tag === "Cancelled",
			),
		).toHaveLength(2);
		expect(exit.value.report).toContain("# Dictionary reset (cancelled)");
		expect(vault.files.has(exit.value.reportPath)).toBe(true);
	});
});
