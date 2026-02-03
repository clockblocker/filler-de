import * as fs from "node:fs";
import * as path from "node:path";
import { ALL_TARGET_LANGUAGES } from "../../../types";
import { logger } from "../../../utils/logger";
import { ALL_PROMPT_KINDS } from "../consts";
import { getPartsPath } from "./utils";

const REQUIRED_FILES = [
	"agent-role.ts",
	"task-description.ts",
	"schemas/user-input.ts",
	"schemas/agent-output.ts",
	"examples/to-use.ts",
];

interface MissingPart {
	promptKind: string;
	language: string;
	file: string;
}

export function ensureAllPartsArePresent(): MissingPart[] {
	const missing: MissingPart[] = [];

	for (const language of ALL_TARGET_LANGUAGES) {
		for (const promptKind of ALL_PROMPT_KINDS) {
			const partsPath = getPartsPath(language, promptKind);

			for (const file of REQUIRED_FILES) {
				const filePath = path.join(partsPath, file);
				if (!fs.existsSync(filePath)) {
					missing.push({ file, language, promptKind });
				}
			}
		}
	}

	return missing;
}

export function validateAllPartsPresent(): void {
	const missing = ensureAllPartsArePresent();

	if (missing.length > 0) {
		logger.error("Missing prompt parts:");
		for (const m of missing) {
			logger.error(`  - ${m.language}/${m.promptKind}/${m.file}`);
		}
		throw new Error(`Missing ${missing.length} prompt part(s)`);
	}

	logger.info("✓ All prompt parts present");
}
