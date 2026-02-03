import * as fs from "node:fs";
import * as path from "node:path";
import { err, ok, type Result } from "neverthrow";
import {
	ALL_KNOWN_LANGUAGES,
	ALL_TARGET_LANGUAGES,
	type KnownLanguage,
	type TargetLanguage,
} from "../../../types";
import { logger } from "../../../utils/logger";
import { ALL_PROMPT_KINDS, type PromptKind } from "../consts";
import { getPartsPath } from "./utils";

interface FormatError {
	targetLanguage: TargetLanguage;
	knownLanguage: KnownLanguage;
	promptKind: PromptKind;
	file: string;
	issue: string;
}

const FILE_EXPORT_NAMES: Record<string, string> = {
	"agent-role.ts": "agentRole",
	"examples/to-test.ts": "testExamples",
	"examples/to-use.ts": "examples",
	"task-description.ts": "taskDescription",
};

export function ensurePartsFormat(): Result<void, FormatError[]> {
	const errors: FormatError[] = [];

	for (const targetLanguage of ALL_TARGET_LANGUAGES) {
		for (const knownLanguage of ALL_KNOWN_LANGUAGES) {
			for (const promptKind of ALL_PROMPT_KINDS) {
				const partsPath = getPartsPath(
					targetLanguage,
					knownLanguage,
					promptKind,
				);

				for (const [file, expectedExport] of Object.entries(
					FILE_EXPORT_NAMES,
				)) {
					const filePath = path.join(partsPath, file);
					if (!fs.existsSync(filePath)) continue; // handled by ensureAllPartsArePresent

					const content = fs.readFileSync(filePath, "utf-8");

					// Check export const name
					const exportRegex = new RegExp(
						`^export const ${expectedExport}\\b`,
						"m",
					);
					if (!exportRegex.test(content)) {
						errors.push({
							file,
							issue: `should export "${expectedExport}"`,
							knownLanguage,
							promptKind,
							targetLanguage,
						});
					}

					// Check imports + satisfies for example files
					if (file.includes("examples/")) {
						// Check import
						const importRegex =
							/import\s+type\s*\{\s*AgentOutput,\s*UserInput\s*\}\s*from/;
						if (!importRegex.test(content)) {
							errors.push({
								file,
								issue: `should have: import type { AgentOutput, UserInput } from "../../../../../schemas";`,
								knownLanguage,
								promptKind,
								targetLanguage,
							});
						}

						// Check satisfies
						const satisfiesRegex = new RegExp(
							`\\]\\s*satisfies\\s*\\{\\s*input:\\s*UserInput<"${promptKind}">;\\s*output:\\s*AgentOutput<"${promptKind}">;?\\s*\\}\\[\\];?\\s*$`,
						);
						if (!satisfiesRegex.test(content.trim())) {
							errors.push({
								file,
								issue: `should end with: ] satisfies { input: UserInput<"${promptKind}">; output: AgentOutput<"${promptKind}"> }[];`,
								knownLanguage,
								promptKind,
								targetLanguage,
							});
						}
					}
				}
			}
		}
	}

	if (errors.length > 0) {
		logger.error("Format errors in prompt parts:");
		for (const e of errors) {
			logger.error(
				`  - ${e.targetLanguage}/${e.knownLanguage}/${e.promptKind}/${e.file}: ${e.issue}`,
			);
		}
		return err(errors);
	}

	logger.info("✓ All prompt parts correctly formatted");
	return ok(undefined);
}
