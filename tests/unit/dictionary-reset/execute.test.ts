/**
 * Execute (#65) with a stubbed resolver and a fake vault: it backs up
 * before anything regenerates, regenerates through Classify's resolver
 * port, re-attaches freeform text, writes its report, and never deletes.
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createDumgen } from "dumgen";
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
import {
	executeReset,
	type ResetDictionary,
	ResetFailed,
	type ResetVault,
} from "../../../src/commanders/dictionary-reset/execute";
import { createScriptedJev } from "../../../src/managers/dumgen/scripted-jev";

const FIXTURE = join(import.meta.dir, "fixtures/vault");
const BACKUP = "Worter backup 2026-10-20 12-00-00";

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
					const readingPath = `Worter/de/Lexeme/NOUN/${text}.md`;
					vault.ops.push(`resolve ${text}`);
					if (!vault.files.has(readingPath))
						vault.files.set(readingPath, `%%tf-part:lemma%%\n${text}\n`);
					return {
						_tag: "Resolved",
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
		rescan: Effect.sync(() => {
			vault.ops.push("rescan");
		}),
		settleKnowledge: Effect.sync(() => {
			vault.ops.push("settle");
		}),
	};
}

function servicesWith(resolver: UnitResolver["Service"]) {
	const dumgen = createDumgen({
		jev: createScriptedJev().ask,
		luna: () => Promise.reject(new Error("no Luna in this test")),
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
	options: { readonly cancelAfterFirst?: boolean } = {},
) {
	const cancel = Deferred.makeUnsafe<void>();
	const { plans, resolver } = stubResolver(vault, () => {
		if (options.cancelAfterFirst) Deferred.doneUnsafe(cancel, Effect.void);
	});
	const exit = await Effect.runPromiseExit(
		executeReset({
			cancel,
			dictionary: stubDictionary(vault),
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
		expect(vault.ops[1]).toBe("rescan");
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
		const attachedTo = aufpassen?._tag === "Attached" ? aufpassen.readingPath : "";
		expect(vault.files.get(attachedTo)).toContain("I [walked] in the park");
		expect(
			result.execution.freeform.filter((entry) => entry._tag === "Unplaced"),
		).toHaveLength(3);

		expect(result.reportPath).toBe("Dictionary reset 2026-10-20 12-00-00.md");
		expect(vault.ops.at(-1)).toBe(`create ${result.reportPath}`);
		const report = vault.files.get(result.reportPath) ?? "";
		expect(report).toContain("## Regenerated Lemmas (");
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

	it("refuses a Worter/ that already holds new-format notes", async () => {
		const files = fixtureFiles();
		files.set("Worter/de/Lexeme/NOUN/See.md", "%%tf-part:lemma%%\n");
		const vault = new FakeResetVault(files);
		const { exit } = await runExecute(vault);
		expect(exit._tag).toBe("Failure");
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
