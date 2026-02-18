import { describe, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
	createSourceFile,
	forEachChild,
	isCallExpression,
	isExportDeclaration,
	isExternalModuleReference,
	isIdentifier,
	isImportDeclaration,
	isImportEqualsDeclaration,
	isStringLiteral,
	type Node,
	ScriptKind,
	ScriptTarget,
	SyntaxKind,
} from "typescript";

type ImportViolation = {
	filePath: string;
	importSpecifier: string;
	reason: string;
};

const BANNED_IMPORT_RULES: ReadonlyArray<{
	reason: string;
	test: (importSpecifier: string) => boolean;
}> = [
	{
		reason: "Obsidian API import is forbidden in pure propagator modules",
		test: (importSpecifier) => importSpecifier === "obsidian",
	},
	{
		reason: "Manager-layer import is forbidden in pure propagator modules",
		test: (importSpecifier) => /(^|\/)managers?\//.test(importSpecifier),
	},
	{
		reason: "VaultActionManager import is forbidden in pure propagator modules",
		test: (importSpecifier) => importSpecifier.includes("vault-action-manager"),
	},
];

function collectTsFilesRecursively(rootDir: string): string[] {
	const entries = readdirSync(rootDir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const absolutePath = join(rootDir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectTsFilesRecursively(absolutePath));
			continue;
		}
		if (!entry.isFile()) {
			continue;
		}
		if (!absolutePath.endsWith(".ts") || absolutePath.endsWith(".d.ts")) {
			continue;
		}
		files.push(absolutePath);
	}

	return files;
}

function extractImportSpecifiers(
	absoluteFilePath: string,
	fileContent: string,
): string[] {
	const moduleSpecifiers = new Set<string>();
	const sourceFile = createSourceFile(
		absoluteFilePath,
		fileContent,
		ScriptTarget.Latest,
		true,
		ScriptKind.TS,
	);

	const visit = (node: Node): void => {
		if (isImportDeclaration(node)) {
			if (
				node.moduleSpecifier &&
				isStringLiteral(node.moduleSpecifier)
			) {
				moduleSpecifiers.add(node.moduleSpecifier.text);
			}
		}

		if (
			isExportDeclaration(node) &&
			node.moduleSpecifier &&
			isStringLiteral(node.moduleSpecifier)
		) {
			moduleSpecifiers.add(node.moduleSpecifier.text);
		}

		if (
			isImportEqualsDeclaration(node) &&
			isExternalModuleReference(node.moduleReference) &&
			node.moduleReference.expression &&
			isStringLiteral(node.moduleReference.expression)
		) {
			moduleSpecifiers.add(node.moduleReference.expression.text);
		}

		if (
			isCallExpression(node) &&
			node.arguments.length === 1
		) {
			const argument = node.arguments[0];
			if (!argument || !isStringLiteral(argument)) {
				forEachChild(node, visit);
				return;
			}
			const firstArgument = argument.text;
			if (node.expression.kind === SyntaxKind.ImportKeyword) {
				moduleSpecifiers.add(firstArgument);
			}
			if (isIdentifier(node.expression) && node.expression.text === "require") {
				moduleSpecifiers.add(firstArgument);
			}
		}

		forEachChild(node, visit);
	};

	forEachChild(sourceFile, visit);
	return [...moduleSpecifiers];
}

function findForbiddenImportsInFile(absoluteFilePath: string): ImportViolation[] {
	const source = readFileSync(absoluteFilePath, "utf8");
	const moduleSpecifiers = extractImportSpecifiers(absoluteFilePath, source);
	const violations: ImportViolation[] = [];

	for (const importSpecifier of moduleSpecifiers) {
		for (const rule of BANNED_IMPORT_RULES) {
			if (rule.test(importSpecifier)) {
				violations.push({
					filePath: absoluteFilePath,
					importSpecifier,
					reason: rule.reason,
				});
			}
		}
	}

	return violations;
}

describe("linguistics propagator IO boundary", () => {
	it("blocks manager/VAM/Obsidian imports from src/linguistics modules", () => {
		const workspaceRoot = process.cwd();
		const linguisticsRoot = join(workspaceRoot, "src/linguistics");
		const linguisticsFiles = collectTsFilesRecursively(linguisticsRoot);
		if (linguisticsFiles.length === 0) {
			throw new Error(
				"Boundary guard misconfigured: no TypeScript files found in src/linguistics",
			);
		}

		const violations = linguisticsFiles.flatMap((filePath) =>
			findForbiddenImportsInFile(filePath),
		);
		if (violations.length === 0) {
			return;
		}

		const details = violations
			.map(
				(violation) =>
					`${relative(
						workspaceRoot,
						violation.filePath,
					)} imports "${violation.importSpecifier}" (${violation.reason})`,
			)
			.join("\n");
		throw new Error(
			`Propagator IO boundary violation(s) detected:\n${details}`,
		);
	});
});
