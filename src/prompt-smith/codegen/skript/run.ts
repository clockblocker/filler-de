import * as fs from "node:fs";
import * as path from "node:path";
import { ALL_TARGET_LANGUAGES, type TargetLanguage } from "../../../types";
import { logger } from "../../../utils/logger";
import { ALL_PROMPT_KINDS, type PromptKind } from "../consts";
import { combineParts } from "./combine-parts";
import { validateAllPartsPresent } from "./enshure-all-parts-are-present";
import {
	GENERATED_DIR,
	getGeneratedFileName,
	getGeneratedPath,
	toKebabCase,
} from "./utils";

function generatePromptFile(
	language: TargetLanguage,
	promptKind: PromptKind,
	systemPrompt: string,
): string {
	const langLower = toKebabCase(language);
	const kindLower = toKebabCase(promptKind);

	return `// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

import { userInputSchema } from "../../../parts/${langLower}/${kindLower}/schemas/user-input";
import { agentOutputSchema } from "../../../parts/${langLower}/${kindLower}/schemas/agent-output";

export { userInputSchema, agentOutputSchema };

export const systemPrompt = \`${systemPrompt.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;
`;
}

async function generateForLanguage(
	language: TargetLanguage,
	promptKind: PromptKind,
): Promise<void> {
	const combined = await combineParts(language, promptKind);
	const fileContent = generatePromptFile(
		language,
		promptKind,
		combined.systemPrompt,
	);

	const outputDir = getGeneratedPath(language);
	const fileName = getGeneratedFileName(promptKind);
	const outputPath = path.join(outputDir, fileName);

	fs.mkdirSync(outputDir, { recursive: true });
	fs.writeFileSync(outputPath, fileContent);

	logger.info(`  ✓ Generated: ${fileName}`);
}

async function generateIndex(): Promise<void> {
	const imports: string[] = [];
	const entries: string[] = [];

	for (const language of ALL_TARGET_LANGUAGES) {
		for (const promptKind of ALL_PROMPT_KINDS) {
			const kindLower = toKebabCase(promptKind);
			const langLower = toKebabCase(language);
			const varName = `${langLower}${promptKind}Prompt`;
			const fileName = getGeneratedFileName(promptKind);

			imports.push(
				`import * as ${varName} from "./codegen/generated-promts/${langLower}/${fileName.replace(".ts", "")}";`,
			);
			entries.push(`\t\t${language}: ${varName},`);
		}
	}

	const content = `// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

${imports.join("\n")}
import type { AvaliablePromptDict } from "./types";

export const PromptFor = {
${ALL_TARGET_LANGUAGES.map(
	(lang) =>
		`\t${lang}: {\n${ALL_PROMPT_KINDS.map((kind) => `\t\t${kind}: ${toKebabCase(lang)}${kind}Prompt,`).join("\n")}\n\t},`,
).join("\n")}
} satisfies AvaliablePromptDict;
`;

	const indexPath = path.join(GENERATED_DIR, "..", "..", "index.ts");
	fs.writeFileSync(indexPath, content);
}

async function main(): Promise<void> {
	validateAllPartsPresent();

	for (const language of ALL_TARGET_LANGUAGES) {
		for (const promptKind of ALL_PROMPT_KINDS) {
			await generateForLanguage(language, promptKind);
		}
	}

	await generateIndex();
}

main().catch((err) => {
	logger.error("Codegen failed:", err);
	process.exit(1);
});
