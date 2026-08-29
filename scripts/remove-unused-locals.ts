import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ts = require("../node_modules/.bun/typescript@5.9.3/node_modules/typescript");

const changedFiles = execFileSync(
	"git",
	[
		"diff",
		"--name-only",
		"--diff-filter=AM",
		"--",
		"*.ts",
		"*.tsx",
	],
	{ encoding: "utf8" },
)
	.trim()
	.split("\n")
	.filter(Boolean)
	.map((filePath) => resolve(filePath));

const configFile = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ".", {
	noUnusedLocals: true,
});
const unusedDiagnosticCodes = new Set([6133, 6192, 6196]);

function createLanguageService() {
	const host = {
		fileExists: ts.sys.fileExists,
		getCompilationSettings: () => parsed.options,
		getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
		getDefaultLibFileName: (options: unknown) =>
			ts.getDefaultLibFilePath(options),
		getScriptFileNames: () => parsed.fileNames,
		getScriptSnapshot: (filePath: string) => {
			const source = ts.sys.readFile(filePath);
			return source === undefined
				? undefined
				: ts.ScriptSnapshot.fromString(source);
		},
		getScriptVersion: () => "0",
		readDirectory: ts.sys.readDirectory,
		readFile: ts.sys.readFile,
	};

	return ts.createLanguageService(host);
}

for (let pass = 1; pass <= 10; pass += 1) {
	const languageService = createLanguageService();
	const changesByFile = new Map<
		string,
		Array<{ newText: string; span: { length: number; start: number } }>
	>();
	let diagnosticCount = 0;

	for (const filePath of changedFiles) {
		if (!ts.sys.fileExists(filePath)) continue;

		const diagnostics = languageService
			.getSemanticDiagnostics(filePath)
			.filter((diagnostic: { code: number }) =>
				unusedDiagnosticCodes.has(diagnostic.code),
			);

		for (const diagnostic of diagnostics) {
			diagnosticCount += 1;
			const start = diagnostic.start ?? 0;
			const fixes = languageService.getCodeFixesAtPosition(
				filePath,
				start,
				start + (diagnostic.length ?? 0),
				[diagnostic.code],
				{},
				{},
			);
			const removal = fixes.find(
				(fix: { description: string; fixName: string }) =>
					fix.fixName === "unusedIdentifier" &&
					fix.description.startsWith("Remove unused"),
			);

			for (const change of removal?.changes ?? []) {
				const existing = changesByFile.get(change.fileName) ?? [];
				existing.push(...change.textChanges);
				changesByFile.set(change.fileName, existing);
			}
		}
	}

	languageService.dispose();
	let appliedCount = 0;

	for (const [filePath, changes] of changesByFile) {
		let source = ts.sys.readFile(filePath);
		if (source === undefined) continue;

		const uniqueChanges = [
			...new Map(
				changes.map((change) => [
					`${change.span.start}:${change.span.length}:${change.newText}`,
					change,
				]),
			).values(),
		].sort(
			(left, right) =>
				right.span.start - left.span.start ||
				right.span.length - left.span.length,
		);
		let nextAcceptedStart = Number.POSITIVE_INFINITY;

		for (const change of uniqueChanges) {
			const end = change.span.start + change.span.length;
			if (end > nextAcceptedStart) continue;
			source =
				source.slice(0, change.span.start) +
				change.newText +
				source.slice(end);
			nextAcceptedStart = change.span.start;
			appliedCount += 1;
		}

		ts.sys.writeFile(filePath, source);
	}

	console.log(
		`pass ${pass}: ${diagnosticCount} unused diagnostics, ${appliedCount} removals`,
	);
	if (diagnosticCount === 0 || appliedCount === 0) break;
}
