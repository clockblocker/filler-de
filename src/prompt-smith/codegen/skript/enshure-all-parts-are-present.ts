import * as fs from "node:fs";
import * as path from "node:path";
import { err, ok, type Result } from "neverthrow";
import { ALL_TARGET_LANGUAGES } from "../../../types";
import { logger } from "../../../utils/logger";
import { ALL_PROMPT_KINDS } from "../consts";
import { getPartsPath } from "./utils";

const REQUIRED_FILES = [
	"agent-role.ts",
	"task-description.ts",
	"examples/to-use.ts",
];

export interface MissingPart {
	promptKind: string;
	language: string;
	file: string;
}

export function ensureAllPartsArePresent(): Result<void, MissingPart[]> {
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

	if (missing.length > 0) {
		logger.error("Missing prompt parts:");
		for (const m of missing) {
			logger.error(`  - ${m.language}/${m.promptKind}/${m.file}`);
		}
		return err(missing);
	}

	logger.info("✓ All prompt parts present");
	return ok(undefined);
}
