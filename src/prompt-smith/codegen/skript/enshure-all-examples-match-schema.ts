import * as path from "node:path";
import { err, ok, type Result } from "neverthrow";
import {
	ALL_KNOWN_LANGUAGES,
	ALL_TARGET_LANGUAGES,
	type KnownLanguage,
	type TargetLanguage,
} from "../../../types";
import { logger } from "../../../utils/logger";
import { SchemasFor } from "../../schemas";
import { ALL_PROMPT_KINDS, type PromptKind } from "../consts";
import { getPartsPath, partsExist } from "./utils";

export interface InvalidExample {
	targetLanguage: TargetLanguage;
	knownLanguage: KnownLanguage;
	promptKind: PromptKind;
	index: number;
	field: "input" | "output";
	error: string;
}

export async function ensureAllExamplesMatchSchema(): Promise<
	Result<void, InvalidExample[]>
> {
	const invalid: InvalidExample[] = [];

	for (const targetLanguage of ALL_TARGET_LANGUAGES) {
		for (const knownLanguage of ALL_KNOWN_LANGUAGES) {
			for (const promptKind of ALL_PROMPT_KINDS) {
				// Skip if parts don't exist (optional languages)
				if (!partsExist(targetLanguage, knownLanguage, promptKind)) {
					continue;
				}

				const partsPath = getPartsPath(
					targetLanguage,
					knownLanguage,
					promptKind,
				);
				const { examples } = await import(
					path.join(partsPath, "examples/to-use.ts")
				);
				const schemas = SchemasFor[promptKind];

				for (let i = 0; i < examples.length; i++) {
					const ex = examples[i];
					const inputResult = schemas.userInputSchema.safeParse(
						ex.input,
					);
					if (!inputResult.success) {
						invalid.push({
							error: inputResult.error.message,
							field: "input",
							index: i,
							knownLanguage,
							promptKind,
							targetLanguage,
						});
					}
					const outputResult = schemas.agentOutputSchema.safeParse(
						ex.output,
					);
					if (!outputResult.success) {
						invalid.push({
							error: outputResult.error.message,
							field: "output",
							index: i,
							knownLanguage,
							promptKind,
							targetLanguage,
						});
					}
				}
			}
		}
	}

	if (invalid.length > 0) {
		logger.error("Invalid examples:");
		for (const e of invalid) {
			logger.error(
				`  - ${e.targetLanguage}/${e.knownLanguage}/${e.promptKind}[${e.index}].${e.field}: ${e.error}`,
			);
		}
		return err(invalid);
	}

	logger.info("✓ All examples match schemas");
	return ok(undefined);
}
