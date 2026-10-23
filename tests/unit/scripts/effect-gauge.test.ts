import { describe, expect, it } from "bun:test";
import {
	areaOf,
	checkTargets,
	countSource,
	emptyCounts,
	ignoreGlobs,
	isAllowlisted,
	isRunSite,
	ruleOf,
	totalOf,
} from "../../../scripts/effect-gauge";

describe("areaOf", () => {
	it("names a package by its directory", () => {
		expect(
			areaOf("src/packages/independent/vault-action-manager/src/facade.ts"),
		).toBe("vault-action-manager");
		expect(areaOf("src/packages/composed/dictionary/src/store.ts")).toBe(
			"dictionary",
		);
		expect(areaOf("src/packages/composed/library-core/src/a/b/c.ts")).toBe(
			"library-core",
		);
		expect(
			areaOf("src/packages/composed/obsidian-event-layer/src/index.ts"),
		).toBe("obsidian-event-layer");
		expect(
			areaOf("src/packages/independent/lemma-note-codec/src/render/x.ts"),
		).toBe("lemma-note-codec");
	});

	it("names the rest of src by its top-level directory or file", () => {
		expect(areaOf("src/commanders/librarian/librarian.ts")).toBe(
			"src/commanders",
		);
		expect(areaOf("src/runtime/plugin-runtime.ts")).toBe("src/runtime");
		expect(areaOf("src/main.ts")).toBe("src/main.ts");
		expect(areaOf("src/packages/README.ts")).toBe("src/packages");
		expect(areaOf("src/packages/loose/src/index.ts")).toBe("loose");
	});

	it("leaves files outside src unclassified", () => {
		expect(areaOf("scripts/effect-gauge.ts")).toBeUndefined();
		expect(areaOf("tests/unit/setup.ts")).toBeUndefined();
		expect(areaOf("main.ts")).toBeUndefined();
	});
});

describe("isAllowlisted", () => {
	const allowlist = [
		{ pattern: "src/runtime/**", reason: "the runtime's edges" },
		{ pattern: "src/main.ts", reason: "the plugin class" },
	];

	it("matches a directory glob at any depth and an exact file", () => {
		expect(isAllowlisted("src/runtime/plugin-runtime.ts", allowlist)).toBe(
			true,
		);
		expect(isAllowlisted("src/runtime/edges/command.ts", allowlist)).toBe(
			true,
		);
		expect(isAllowlisted("src/main.ts", allowlist)).toBe(true);
	});

	it("does not match look-alikes", () => {
		expect(isAllowlisted("src/runtimes/x.ts", allowlist)).toBe(false);
		expect(isAllowlisted("src/main.test.ts", allowlist)).toBe(false);
		expect(isAllowlisted("src/plugin/main.ts", allowlist)).toBe(false);
	});

	it("matches nothing when empty", () => {
		expect(isAllowlisted("src/main.ts", [])).toBe(false);
	});
});

describe("countSource", () => {
	const source = [
		`import { Effect, Schema } from "effect";`,
		`import { ok } from "neverthrow";`,
		`let cache = 0;`,
		`export let shared = 1;`,
		`const fixed = 2;`,
		`// Cause.squash, Effect.runPromise and throw in a comment`,
		`const text = "Cause.squash throw logger.info()";`,
		`function f() {`,
		`	let local = 0;`,
		`	try { Effect.runPromise(Effect.void); } catch { throw new Error("x"); }`,
		`	runtime.runFork(Effect.void);`,
		`	this.logger.warn("w");`,
		`	logger.info(Cause.squash(c), getParsedUserSettings());`,
		`	ManagedRuntime.make(layer);`,
		`	this.runCallback(program);`,
		`	this.clearState();`,
		`	this.runtime.run(Effect.void);`,
		`	pluginRuntime.fork(Effect.void);`,
		`	Effect.fork(Effect.void);`,
		`	new Notice("done");`,
		`	this.addCommand({ id: "x" });`,
		`	app.workspace.openLinkText("Note", "", true);`,
		`}`,
	].join("\n");

	it("counts code, not comments or strings", () => {
		expect(countSource("src/a.ts", source, [])).toEqual({
			"cause-squash": 1,
			"global-settings-calls": 1,
			"host-calls": 3,
			"logger-calls": 2,
			"managed-runtime-make": 1,
			"module-let": 2,
			"neverthrow-files": 1,
			"run-sites": 4,
			"schema-files": 1,
			throw: 1,
			try: 1,
		});
	});

	it("counts no host calls in the host services", () => {
		expect(
			countSource("src/managers/obsidian/host/notices.ts", source, [])[
				"host-calls"
			],
		).toBe(undefined);
	});

	it("skips run sites in allowlisted files", () => {
		const allowlist = [{ pattern: "src/a.ts", reason: "edge" }];
		expect(countSource("src/a.ts", source, allowlist)["run-sites"]).toBe(
			undefined,
		);
	});
});

describe("isRunSite", () => {
	it("counts Effect.run* and a runtime's run, fork and run*", () => {
		expect(isRunSite("Effect", "runPromise")).toBe(true);
		expect(isRunSite("managed", "runSyncExit")).toBe(true);
		expect(isRunSite("runtime", "run")).toBe(true);
		expect(isRunSite("PluginRuntime", "fork")).toBe(true);
	});

	it("skips this.run* helpers and Effect.fork", () => {
		expect(isRunSite(undefined, "runCallback", true)).toBe(false);
		expect(isRunSite("Effect", "fork")).toBe(false);
		expect(isRunSite("Stream", "run")).toBe(false);
	});

	it("counts a run function imported from effect", () => {
		const source = [
			`import { runPromise as run } from "effect/Effect";`,
			`run(program);`,
		].join("\n");
		expect(countSource("src/a.ts", source, [])["run-sites"]).toBe(1);
	});
});

describe("ignoreGlobs", () => {
	const ignored = (file: string) =>
		ignoreGlobs(["**/tests/**", "*.test.ts", "src/legacy", "/main.js"]).some(
			(g) => g.match(file),
		);

	it("reads ignorePatterns gitignore-style", () => {
		expect(ignored("src/a/tests/b.ts")).toBe(true);
		expect(ignored("src/a/b.test.ts")).toBe(true);
		expect(ignored("src/legacy/x/y.ts")).toBe(true);
		expect(ignored("main.js")).toBe(true);
		expect(ignored("src/a/b.ts")).toBe(false);
		expect(ignored("src/legacyish/b.ts")).toBe(false);
	});
});

describe("ruleOf", () => {
	it("reads the rule from a diagnostic code", () => {
		expect(ruleOf("effecttsgo(new-promise)")).toBe("new-promise");
		expect(ruleOf("typescript(no-floating-promises)")).toBe(
			"no-floating-promises",
		);
		expect(ruleOf("parse error")).toBeUndefined();
	});
});

describe("checkTargets", () => {
	const areas = {
		"src/main.ts": { ...emptyCounts(), "run-sites": 3 },
		"vault-action-manager": { ...emptyCounts(), "cause-squash": 2 },
	};
	const report = { areas, total: totalOf(areas) };

	it("reports each area and total over its target", () => {
		expect(
			checkTargets(report, {
				"src/main.ts": { "run-sites": 3 },
				total: { "run-sites": 2 },
				"vault-action-manager": { "cause-squash": 0 },
			}),
		).toEqual([
			"total run-sites: 3 > 2",
			"vault-action-manager cause-squash: 2 > 0",
		]);
	});

	it("rejects an area with no files, so a typo can't pass", () => {
		expect(() =>
			checkTargets(report, { "vault-actions-manager": { throw: 0 } }),
		).toThrow('unknown area "vault-actions-manager"');
	});

	it("rejects an unknown metric and a malformed ceiling", () => {
		expect(() =>
			checkTargets(report, { total: { "run-site": 0 } }),
		).toThrow('unknown metric "run-site"');
		expect(() => checkTargets(report, { total: 5 })).toThrow(
			'target "total" must map metrics',
		);
		expect(() => checkTargets(report, { total: { throw: "0" } })).toThrow(
			"must be a number",
		);
	});
});
