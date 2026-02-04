import * as fs from "node:fs";
import * as path from "node:path";
import { err, ok, type Result } from "neverthrow";
import { ALL_TARGET_LANGUAGES, KnownLanguage } from "../../../types";
import { ALL_PROMPT_KINDS } from "../consts";
import { getPartsPath } from "./utils";

const REQUIRED_FILES = [
	"agent-role.ts",
	"task-description.ts",
	"examples/to-use.ts",
];

/** Only xxx->English is required, other languages are optional */
const REQUIRED_KNOWN_LANGUAGE = KnownLanguage.English;

export interface MissingPart {
	promptKind: string;
	targetLanguage: string;
	knownLanguage: string;
	file: string;
}

export function ensureAllPartsArePresent(): Result<void, MissingPart[]> {
	const missing: MissingPart[] = [];

	for (const targetLanguage of ALL_TARGET_LANGUAGES) {
		// Only English is required as known language
		for (const promptKind of ALL_PROMPT_KINDS) {
			const partsPath = getPartsPath(
				targetLanguage,
				REQUIRED_KNOWN_LANGUAGE,
				promptKind,
			);

			for (const file of REQUIRED_FILES) {
				const filePath = path.join(partsPath, file);
				if (!fs.existsSync(filePath)) {
					missing.push({
						file,
						knownLanguage: REQUIRED_KNOWN_LANGUAGE,
						promptKind,
						targetLanguage,
					});
				}
			}
		}
	}

	if (missing.length > 0) {
		logger.error("Missing prompt parts:");
		for (const m of missing) {
			logger.error(
				`  - ${m.targetLanguage}/${m.knownLanguage}/${m.promptKind}/${m.file}`,
			);
		}
		return err(missing);
	}

	return ok(undefined);
}
