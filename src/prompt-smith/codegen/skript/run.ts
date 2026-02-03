import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	ALL_KNOWN_LANGUAGES,
	ALL_TARGET_LANGUAGES,
	KnownLanguage,
	type TargetLanguage,
} from "../../../types";
import { logger } from "../../../utils/logger";
import { ALL_PROMPT_KINDS, type PromptKind } from "../consts";
import { combineParts } from "./combine-parts";
import { ensureAllExamplesMatchSchema } from "./enshure-all-examples-match-schema";
import { ensureAllPartsArePresent } from "./enshure-all-parts-are-present";
import { ensurePartsFormat } from "./enshure-parts-format";
import {
	GENERATED_DIR,
	getGeneratedFileName,
	getGeneratedPath,
	partsExist,
	toKebabCase,
} from "./utils";

/** Fallback known language when specific translation not available */
const FALLBACK_KNOWN_LANGUAGE = KnownLanguage.English;

function generatePromptFile(systemPrompt: string): string {
	return `// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

export const systemPrompt = \`${systemPrompt.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;
`;
}

async function generateForLanguage(
	targetLanguage: TargetLanguage,
	knownLanguage: KnownLanguage,
	promptKind: PromptKind,
): Promise<boolean> {
	// Skip if parts don't exist
	if (!partsExist(targetLanguage, knownLanguage, promptKind)) {
		return false;
	}

	const combined = await combineParts(
		targetLanguage,
		knownLanguage,
		promptKind,
	);
	const fileContent = generatePromptFile(combined.systemPrompt);

	const outputDir = getGeneratedPath(targetLanguage, knownLanguage);
	const fileName = getGeneratedFileName(promptKind);
	const outputPath = path.join(outputDir, fileName);

	fs.mkdirSync(outputDir, { recursive: true });
	fs.writeFileSync(outputPath, fileContent);

	logger.info(
		`  ✓ Generated: ${toKebabCase(targetLanguage)}/${toKebabCase(knownLanguage)}/${fileName}`,
	);
	return true;
}

interface GeneratedPrompt {
	targetLanguage: TargetLanguage;
	knownLanguage: KnownLanguage;
	promptKind: PromptKind;
	varName: string;
	importPath: string;
}

function generateIndex(generated: GeneratedPrompt[]): void {
	const imports = generated.map(
		(g) => `import * as ${g.varName} from "${g.importPath}";`,
	);

	// Build PROMPT_FOR with fallback logic
	const promptForLines: string[] = [];
	for (const targetLang of ALL_TARGET_LANGUAGES) {
		const targetLower = toKebabCase(targetLang);
		const knownLangLines: string[] = [];

		for (const knownLang of ALL_KNOWN_LANGUAGES) {
			const kindLines: string[] = [];

			for (const kind of ALL_PROMPT_KINDS) {
				const varName = `${targetLower}To${knownLang}${kind}Prompt`;
				const fallbackVarName = `${targetLower}To${FALLBACK_KNOWN_LANGUAGE}${kind}Prompt`;

				const hasPrompt = generated.some((g) => g.varName === varName);
				const hasFallback = generated.some(
					(g) => g.varName === fallbackVarName,
				);

				if (hasPrompt) {
					kindLines.push(`\t\t\t${kind}: ${varName},`);
				} else if (hasFallback) {
					// Use fallback to English
					kindLines.push(`\t\t\t${kind}: ${fallbackVarName},`);
				}
			}

			if (kindLines.length > 0) {
				knownLangLines.push(
					`\t\t${knownLang}: {\n${kindLines.join("\n")}\n\t\t},`,
				);
			}
		}

		if (knownLangLines.length > 0) {
			promptForLines.push(
				`\t${targetLang}: {\n${knownLangLines.join("\n")}\n\t},`,
			);
		}
	}

	const content = `// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

${imports.join("\n")}
import type { AvaliablePromptDict } from "./types";

export const PROMPT_FOR = {
${promptForLines.join("\n")}
} satisfies AvaliablePromptDict;

export { SchemasFor, type UserInput, type AgentOutput } from "./schemas";
`;

	const indexPath = path.join(GENERATED_DIR, "..", "..", "index.ts");
	fs.writeFileSync(indexPath, content);
}

async function main(): Promise<void> {
	// 1. Format validation (first!)
	const formatResult = ensurePartsFormat();
	if (formatResult.isErr()) {
		process.exit(1);
	}

	// 2. Parts presence (only xxx->English required)
	const partsResult = ensureAllPartsArePresent();
	if (partsResult.isErr()) {
		process.exit(1);
	}

	// 3. Schema validation
	const examplesResult = await ensureAllExamplesMatchSchema();
	if (examplesResult.isErr()) {
		process.exit(1);
	}

	const generated: GeneratedPrompt[] = [];

	for (const targetLanguage of ALL_TARGET_LANGUAGES) {
		for (const knownLanguage of ALL_KNOWN_LANGUAGES) {
			for (const promptKind of ALL_PROMPT_KINDS) {
				const wasGenerated = await generateForLanguage(
					targetLanguage,
					knownLanguage,
					promptKind,
				);

				if (wasGenerated) {
					const targetLower = toKebabCase(targetLanguage);
					const knownLower = toKebabCase(knownLanguage);
					const varName = `${targetLower}To${knownLanguage}${promptKind}Prompt`;
					const fileName = getGeneratedFileName(promptKind);

					generated.push({
						importPath: `./codegen/generated-promts/${targetLower}/${knownLower}/${fileName.replace(".ts", "")}`,
						knownLanguage,
						promptKind,
						targetLanguage,
						varName,
					});
				}
			}
		}
	}

	generateIndex(generated);

	// Run bun fix to format generated files
	logger.info("Running bun fix...");
	try {
		execSync("bun fix", { stdio: "inherit" });
	} catch {
		// bun fix may fail due to pre-existing lint errors, but formatting still works
		logger.warn(
			"bun fix exited with errors (likely pre-existing lint issues)",
		);
	}
}

main().catch((err) => {
	logger.error("Codegen failed:", err);
	process.exit(1);
});
