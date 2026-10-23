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
import { readFileSync } from "node:fs";
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
	"schema-imports",
	"module-let",
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

const GLOBAL_SETTINGS_CALLS = new Set([
	"getParsedUserSettings",
	"updateParsedSettings",
	"initializeState",
	"clearState",
]);
const RUN_METHOD = /^run(?:Promise|Sync|Fork|Callback)/;

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
	if (parts[1] === "packages" && parts.length >= 5) return parts[3];
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
	const runAllowed = isAllowlisted(file, allowlist);
	let importsNeverthrow = false;

	new Visitor({
		CallExpression(node) {
			const callee = node.callee;
			const fn =
				callee.type === "MemberExpression" && !callee.computed
					? name(callee.property)
					: name(callee);
			if (fn !== undefined && GLOBAL_SETTINGS_CALLS.has(fn)) {
				add("global-settings-calls");
			}
			if (callee.type !== "MemberExpression") return;
			const receiver = callee.object;
			const receiverName =
				receiver.type === "MemberExpression" && !receiver.computed
					? name(receiver.property)
					: name(receiver);
			if (receiverName === "logger") add("logger-calls");
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
			const importsSchema =
				source === "effect/Schema" ||
				(source === "effect" &&
					node.specifiers.some(
						(s) =>
							s.type === "ImportSpecifier" &&
							(s.imported.type === "Identifier"
								? s.imported.name
								: s.imported.value) === "Schema",
					));
			if (importsSchema) add("schema-imports");
		},
		MemberExpression(node) {
			if (node.computed) return;
			const object = name(node.object);
			const property = name(node.property);
			if (property === undefined) return;
			if (RUN_METHOD.test(property) && !runAllowed) add("run-sites");
			if (object === "ManagedRuntime" && property === "make") {
				add("managed-runtime-make");
			}
			if (object === "Cause" && property === "squash") add("cause-squash");
		},
		ThrowStatement() {
			add("throw");
		},
		TryStatement() {
			add("try");
		},
	}).visit(program);

	if (importsNeverthrow) add("neverthrow-files");
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

/** Each place an area, or `total`, exceeds its target. */
export function checkTargets(report: GaugeReport, targets: unknown): string[] {
	if (typeof targets !== "object" || targets === null) {
		throw new Error("targets must be an object of areas");
	}
	const violations: string[] = [];
	for (const [area, ceilings] of Object.entries(targets)) {
		const counts =
			area === "total" ? report.total : (report.areas[area] ?? emptyCounts());
		for (const [metric, ceiling] of Object.entries(ceilings ?? {})) {
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
	const areas = Object.keys(report.areas).sort(compareAreas);
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

async function gauge(root: string): Promise<GaugeReport> {
	const config = JSON.parse(readFileSync(`${root}/.oxlintrc.json`, "utf8"));
	const ignored = (config.ignorePatterns as string[]).map((p) => new Glob(p));
	const areas: Record<string, Counts> = {};
	for await (const file of new Glob("src/**/*.{ts,tsx,mts,cts}").scan(root)) {
		const area = areaOf(file);
		if (!area || ignored.some((g) => g.match(file))) continue;
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
	return { areas, total: totalOf(areas) };
}

async function main(args: string[]): Promise<number> {
	const json = args.includes("--json");
	const checkAt = args.indexOf("--check");
	const targetsPath = checkAt === -1 ? undefined : args[checkAt + 1];
	const known = new Set(["--json", "--check", targetsPath]);
	if ((checkAt !== -1 && !targetsPath) || args.some((a) => !known.has(a))) {
		console.error("usage: effect-gauge [--json] [--check <targets.json>]");
		return 2;
	}
	const report = await gauge(path.resolve(import.meta.dir, ".."));
	console.log(json ? JSON.stringify(report, null, "\t") : formatTables(report));
	if (!targetsPath) return 0;
	const targets = JSON.parse(readFileSync(targetsPath, "utf8"));
	const violations = checkTargets(report, targets);
	for (const v of violations) console.error(`over target: ${v}`);
	return violations.length > 0 ? 1 : 0;
}

if (import.meta.main) {
	process.exit(await main(process.argv.slice(2)));
}
