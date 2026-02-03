import * as fs from "node:fs";
import * as path from "node:path";
import {
	ALL_KNOWN_LANGUAGES,
	ALL_TARGET_LANGUAGES,
	type KnownLanguage,
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
	toKebabCase,
} from "./utils";

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
): Promise<void> {
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

	logger.info(`  ✓ Generated: ${toKebabCase(targetLanguage)}/${toKebabCase(knownLanguage)}/${fileName}`);
}

async function generateIndex(): Promise<void> {
	const imports: string[] = [];

	for (const targetLang of ALL_TARGET_LANGUAGES) {
		for (const knownLang of ALL_KNOWN_LANGUAGES) {
			for (const promptKind of ALL_PROMPT_KINDS) {
				const targetLower = toKebabCase(targetLang);
				const knownLower = toKebabCase(knownLang);
				const varName = `${targetLower}To${knownLang}${promptKind}Prompt`;
				const fileName = getGeneratedFileName(promptKind);

				imports.push(
					`import * as ${varName} from "./codegen/generated-promts/${targetLower}/${knownLower}/${fileName.replace(".ts", "")}";`,
				);
			}
		}
	}

	const content = `// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

${imports.join("\n")}
import type { AvaliablePromptDict } from "./types";

export const PromptFor = {
${ALL_TARGET_LANGUAGES.map(
	(targetLang) =>
		`\t${targetLang}: {\n${ALL_KNOWN_LANGUAGES.map(
			(knownLang) =>
				`\t\t${knownLang}: {\n${ALL_PROMPT_KINDS.map(
					(kind) =>
						`\t\t\t${kind}: ${toKebabCase(targetLang)}To${knownLang}${kind}Prompt,`,
				).join("\n")}\n\t\t},`,
		).join("\n")}\n\t},`,
).join("\n")}
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

	// 2. Parts presence
	const partsResult = ensureAllPartsArePresent();
	if (partsResult.isErr()) {
		process.exit(1);
	}

	// 3. Schema validation
	const examplesResult = await ensureAllExamplesMatchSchema();
	if (examplesResult.isErr()) {
		process.exit(1);
	}

	for (const targetLanguage of ALL_TARGET_LANGUAGES) {
		for (const knownLanguage of ALL_KNOWN_LANGUAGES) {
			for (const promptKind of ALL_PROMPT_KINDS) {
				await generateForLanguage(
					targetLanguage,
					knownLanguage,
					promptKind,
				);
			}
		}
	}

	await generateIndex();
}

main().catch((err) => {
	logger.error("Codegen failed:", err);
	process.exit(1);
});
