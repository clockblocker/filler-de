// Measures the Effect migration (#215) over non-test `src/`.
// It counts @effect/tsgo lint findings per area, from
// `oxlint --type-aware --format json` with the repo's `.oxlintrc.json`, and
// counts what tsgo can't see by parsing each file with oxc-parser, so
// comments and strings never count.
//
//   bun run gauge:effect                       Markdown tables, one row per area
//   bun run gauge:effect --json                the same data as JSON
//   bun run gauge:effect --check targets.json  fails when an area exceeds a target
//
// A targets file maps an area, or `total`, to metric ceilings:
//   { "total": { "run-sites": 12 }, "vault-action-manager": { "cause-squash": 0 } }
// An area with no files counts as zero. An unknown metric is an error.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Glob } from "bun";
import { type Node, parseSync, Visitor } from "oxc-parser";

export const EFFECT_NATIVE_RULES = [
	"async-function",
	"new-promise",
	"global-date",
	"global-date-in-effect",
	"global-timers",
	"global-timers-in-effect",
	"global-console",
	"global-console-in-effect",
	"extends-native-error",
] as const;

export const ERROR_AND_RUN_RULES = [
	"any-unknown-in-error-context",
	"unknown-in-effect-catch",
	"run-effect-inside-effect",
	"try-catch-in-effect-gen",
	"global-error-in-effect-failure",
	"floating-effect",
	"effect-fn-iife",
	"no-floating-promises",
] as const;

export const SOURCE_COUNTS = [
	"run-sites",
	"managed-runtime-make",
	"neverthrow-files",
	"logger-calls",
	"global-settings-calls",
	"cause-squash",
	"throw",
	"try",
	"schema-files",
	"module-let",
	"host-calls",
] as const;

const TABLES = [
	{ metrics: EFFECT_NATIVE_RULES, title: "effect-native rules" },
	{ metrics: ERROR_AND_RUN_RULES, title: "Error and run rules" },
	{ metrics: SOURCE_COUNTS, title: "Counts tsgo can't see" },
] as const;

export type Metric = (typeof TABLES)[number]["metrics"][number];
export const METRICS: readonly Metric[] = TABLES.flatMap((t) => t.metrics);
export type Counts = Record<Metric, number>;

/**
 * Files whose `Effect.run*` / `runtime.run*` sites are edges by design and do
 * not count as run sites. Patterns are globs relative to the repo root.
 */
export type AllowlistEntry = { readonly pattern: string; readonly reason: string };
export const RUN_BOUNDARY_ALLOWLIST: readonly AllowlistEntry[] = [];

/**
 * Where Obsidian's plugin host may be called directly: its services (#229).
 * Everywhere else, a `new Notice`, a command or an event registration, or
 * `openLinkText`, counts as a `host-calls` site.
 */
export const HOST_SERVICES: readonly AllowlistEntry[] = [
	{
		pattern: "src/managers/obsidian/host/**",
		reason: "the Obsidian host services",
	},
];
const HOST_METHODS = new Set([
	"addCommand",
	"removeCommand",
	"registerEvent",
	"registerDomEvent",
	"registerEditorExtension",
	"openLinkText",
]);

const GLOBAL_SETTINGS_CALLS = new Set([
	"getParsedUserSettings",
	"updateParsedSettings",
	"initializeState",
	"clearState",
]);
const RUN_METHOD = /^run(?:Promise|Sync|Fork|Callback)/;
const EFFECT_RUN_SOURCES = new Set(["effect", "effect/Effect", "effect/Runtime"]);

/**
 * The run site a member access `receiver.property` is: `Effect.run*`,
 * `runtime.run*` and `this.managed.run*`, and the plugin runtime's own
 * `runtime.run` and `runtime.fork`. A `this.run*` method is a helper on the
 * class itself, and `Effect.fork` forks inside an Effect, so neither counts.
 */
export function isRunSite(
	receiver: string | undefined,
	property: string,
	receiverIsThis = false,
): boolean {
	if (RUN_METHOD.test(property)) return !receiverIsThis;
	return (
		(property === "run" || property === "fork") &&
		/runtime$/i.test(receiver ?? "")
	);
}

export function isAllowlisted(
	file: string,
	allowlist: readonly AllowlistEntry[],
): boolean {
	return allowlist.some((entry) => new Glob(entry.pattern).match(file));
}

/**
 * The area a repo-relative file belongs to: the package directory name for
 * `src/packages/<group>/<name>/**`, else `src/<dir>`, else the root file.
 */
export function areaOf(file: string): string | undefined {
	const parts = file.split(/[\\/]/);
	if (parts[0] !== "src" || parts.length < 2) return undefined;
	if (parts[1] === "packages") {
		if (parts.length >= 5 && parts[3] !== "src") return parts[3];
		if (parts.length >= 4 && parts[3] === "src") return parts[2];
	}
	return `src/${parts[1]}`;
}

export function emptyCounts(): Counts {
	return Object.fromEntries(METRICS.map((m) => [m, 0])) as Counts;
}

/** The source counts of one file. */
export function countSource(
	file: string,
	text: string,
	allowlist: readonly AllowlistEntry[] = RUN_BOUNDARY_ALLOWLIST,
): Partial<Record<Metric, number>> {
	const { program, errors } = parseSync(file, text);
	if (errors.length > 0) {
		throw new Error(`${file}: ${errors.map((e) => e.message).join("; ")}`);
	}
	const counts: Partial<Record<Metric, number>> = {};
	const add = (metric: Metric) => {
		counts[metric] = (counts[metric] ?? 0) + 1;
	};
	const name = (node: Node | null | undefined) =>
		node?.type === "Identifier" ? node.name : undefined;
	// `logger` in `logger.info` and `this.logger.info`.
	const lastName = (node: Node) =>
		node.type === "MemberExpression" && !node.computed
			? name(node.property)
			: name(node);
	const runAllowed = isAllowlisted(file, allowlist);
	const hostAllowed = isAllowlisted(file, HOST_SERVICES);
	const importedRuns = new Set<string>();
	let importsNeverthrow = false;
	let importsSchema = false;

	new Visitor({
		CallExpression(node) {
			const callee = node.callee;
			if (callee.type === "Identifier") {
				if (GLOBAL_SETTINGS_CALLS.has(callee.name)) {
					add("global-settings-calls");
				}
				if (importedRuns.has(callee.name) && !runAllowed) add("run-sites");
				return;
			}
			if (callee.type !== "MemberExpression" || callee.computed) return;
			const method = name(callee.property);
			if (method && HOST_METHODS.has(method) && !hostAllowed) add("host-calls");
			if (callee.object.type === "ThisExpression" || method === undefined) {
				return;
			}
			if (GLOBAL_SETTINGS_CALLS.has(method)) add("global-settings-calls");
			if (lastName(callee.object) === "logger") add("logger-calls");
		},
		ExportAllDeclaration(node) {
			if (isNeverthrow(node.source.value)) importsNeverthrow = true;
		},
		ExportNamedDeclaration(node) {
			if (node.source && isNeverthrow(node.source.value)) {
				importsNeverthrow = true;
			}
		},
		ImportDeclaration(node) {
			const source = node.source.value;
			if (isNeverthrow(source)) importsNeverthrow = true;
			if (source === "effect/Schema") importsSchema = true;
			for (const s of node.specifiers) {
				if (s.type !== "ImportSpecifier") continue;
				const imported =
					s.imported.type === "Identifier" ? s.imported.name : s.imported.value;
				if (source === "effect" && imported === "Schema") importsSchema = true;
				if (EFFECT_RUN_SOURCES.has(source) && RUN_METHOD.test(imported)) {
					importedRuns.add(s.local.name);
				}
			}
		},
		MemberExpression(node) {
			if (node.computed) return;
			const object = name(node.object);
			const property = name(node.property);
			if (property === undefined) return;
			const isThis = node.object.type === "ThisExpression";
			if (!runAllowed && isRunSite(lastName(node.object), property, isThis)) {
				add("run-sites");
			}
			if (object === "ManagedRuntime" && property === "make") {
				add("managed-runtime-make");
			}
			if (object === "Cause" && property === "squash") add("cause-squash");
		},
		NewExpression(node) {
			if (name(node.callee) === "Notice" && !hostAllowed) add("host-calls");
		},
		ThrowStatement() {
			add("throw");
		},
		TryStatement() {
			add("try");
		},
	}).visit(program);

	if (importsNeverthrow) add("neverthrow-files");
	if (importsSchema) add("schema-files");
	for (const statement of program.body) {
		const declaration =
			statement.type === "ExportNamedDeclaration"
				? statement.declaration
				: statement;
		if (
			declaration?.type === "VariableDeclaration" &&
			(declaration.kind === "let" || declaration.kind === "var") &&
			!declaration.declare
		) {
			for (const _ of declaration.declarations) add("module-let");
		}
	}
	return counts;
}

function isNeverthrow(source: string): boolean {
	return source === "neverthrow" || source.startsWith("neverthrow/");
}

/** A lint diagnostic's rule name, e.g. `effecttsgo(new-promise)` → `new-promise`. */
export function ruleOf(code: string): string | undefined {
	return /^[\w-]+\(([\w-]+)\)$/.exec(code)?.[1];
}

export type GaugeReport = {
	readonly areas: Record<string, Counts>;
	readonly total: Counts;
};

export function addTo(
	report: Record<string, Counts>,
	area: string,
	metric: Metric,
	by = 1,
): void {
	report[area] ??= emptyCounts();
	report[area][metric] += by;
}

export function totalOf(areas: Record<string, Counts>): Counts {
	const total = emptyCounts();
	for (const counts of Object.values(areas)) {
		for (const m of METRICS) total[m] += counts[m];
	}
	return total;
}

const isObject = (x: unknown): x is Record<string, unknown> =>
	typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Each place an area, or `total`, exceeds its target. Throws on an area with
 * no files, an unknown metric or a ceiling that is not a number, so a typo or
 * a renamed area can't pass unnoticed.
 */
export function checkTargets(report: GaugeReport, targets: unknown): string[] {
	if (!isObject(targets)) throw new Error("targets must map areas to ceilings");
	const violations: string[] = [];
	for (const [area, ceilings] of Object.entries(targets)) {
		const counts = area === "total" ? report.total : report.areas[area];
		if (!counts) throw new Error(`unknown area "${area}": it has no files`);
		if (!isObject(ceilings)) {
			throw new Error(`target "${area}" must map metrics to ceilings`);
		}
		for (const [metric, ceiling] of Object.entries(ceilings)) {
			if (!(METRICS as readonly string[]).includes(metric)) {
				throw new Error(`unknown metric "${metric}" in target "${area}"`);
			}
			if (typeof ceiling !== "number") {
				throw new Error(`target ${area}.${metric} must be a number`);
			}
			const actual = counts[metric as Metric];
			if (actual > ceiling) {
				violations.push(`${area} ${metric}: ${actual} > ${ceiling}`);
			}
		}
	}
	return violations;
}

export function formatTables(report: GaugeReport): string {
	const areas = Object.keys(report.areas);
	return TABLES.map(({ metrics, title }) => {
		const row = (label: string, counts: Counts) =>
			`| ${label} | ${metrics.map((m) => counts[m]).join(" | ")} |`;
		const rows = areas
			.filter((a) => metrics.some((m) => report.areas[a]?.[m]))
			.map((a) => row(a, report.areas[a] ?? emptyCounts()));
		return [
			`### ${title}`,
			"",
			`| area | ${metrics.join(" | ")} |`,
			`|---|${metrics.map(() => "---:").join("|")}|`,
			...rows,
			row("**total**", report.total),
		].join("\n");
	}).join("\n\n");
}

/** Packages first, then `src/` entries, each alphabetically. */
function compareAreas(a: string, b: string): number {
	const rank = (x: string) => (x.startsWith("src/") ? 1 : 0);
	return rank(a) - rank(b) || a.localeCompare(b);
}

/**
 * Globs for `.oxlintrc.json`'s `ignorePatterns`, read the way oxlint reads
 * them, gitignore-style: a pattern without an inner `/` matches at any depth,
 * and a pattern matches the files under a directory it names.
 */
export function ignoreGlobs(patterns: readonly string[]): Glob[] {
	return patterns.flatMap((raw) => {
		const trimmed = raw.replace(/^\//, "").replace(/\/$/, "");
		const p = trimmed.includes("/") ? trimmed : `**/${trimmed}`;
		return [new Glob(p), new Glob(`${p}/**`)];
	});
}

/** The files oxlint lints under `src/`: not gitignored and not ignored. */
function sourceFiles(root: string): string[] {
	const config = JSON.parse(readFileSync(`${root}/.oxlintrc.json`, "utf8"));
	const ignored = ignoreGlobs(config.ignorePatterns ?? []);
	const listed = Bun.spawnSync(
		["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
		{ cwd: root, stderr: "inherit", stdout: "pipe" },
	);
	if (listed.exitCode !== 0) throw new Error("git ls-files failed");
	return listed.stdout
		.toString()
		.split("\0")
		.filter(
			(f) =>
				/^src\/.*\.[cm]?tsx?$/.test(f) &&
				!ignored.some((g) => g.match(f)) &&
				existsSync(path.join(root, f)),
		);
}

async function gauge(root: string): Promise<GaugeReport> {
	const areas: Record<string, Counts> = {};
	for (const file of sourceFiles(root)) {
		const area = areaOf(file);
		if (!area) continue;
		areas[area] ??= emptyCounts();
		const text = readFileSync(path.join(root, file), "utf8");
		for (const [m, n] of Object.entries(countSource(file, text))) {
			addTo(areas, area, m as Metric, n);
		}
	}

	const lint = Bun.spawnSync(
		[`${root}/node_modules/.bin/oxlint`, "--type-aware", "--format", "json"],
		{ cwd: root, stderr: "pipe", stdout: "pipe" },
	);
	let diagnostics: { code?: string; filename: string }[];
	try {
		diagnostics = JSON.parse(lint.stdout.toString()).diagnostics;
	} catch {
		throw new Error(`oxlint gave no JSON report:\n${lint.stderr.toString()}`);
	}
	for (const d of diagnostics) {
		const rule = d.code ? ruleOf(d.code) : undefined;
		const area = areaOf(d.filename);
		if (area && rule && (METRICS as readonly string[]).includes(rule)) {
			addTo(areas, area, rule as Metric);
		}
	}
	const sorted = Object.fromEntries(
		Object.entries(areas).sort(([a], [b]) => compareAreas(a, b)),
	);
	return { areas: sorted, total: totalOf(sorted) };
}

/** Exits 0, 1 when over a target, or 2 on bad arguments or targets. */
async function main(args: string[]): Promise<number> {
	const json = args.includes("--json");
	const checkAt = args.indexOf("--check");
	const targetsPath = checkAt === -1 ? undefined : args[checkAt + 1];
	const known = new Set(["--json", "--check", targetsPath]);
	if (
		(checkAt !== -1 && (!targetsPath || targetsPath.startsWith("--"))) ||
		args.some((a) => !known.has(a))
	) {
		console.error("usage: effect-gauge [--json] [--check <targets.json>]");
		return 2;
	}
	let targets: unknown;
	try {
		if (targetsPath) targets = JSON.parse(readFileSync(targetsPath, "utf8"));
	} catch (e) {
		console.error(`cannot read targets ${targetsPath}: ${e}`);
		return 2;
	}
	const report = await gauge(path.resolve(import.meta.dir, ".."));
	console.log(json ? JSON.stringify(report, null, "\t") : formatTables(report));
	if (!targetsPath) return 0;
	try {
		const violations = checkTargets(report, targets);
		for (const v of violations) console.error(`over target: ${v}`);
		return violations.length > 0 ? 1 : 0;
	} catch (e) {
		console.error(`bad targets ${targetsPath}: ${e}`);
		return 2;
	}
}

if (import.meta.main) {
	process.exit(await main(process.argv.slice(2)));
}
