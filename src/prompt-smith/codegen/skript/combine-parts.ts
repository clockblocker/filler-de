import * as path from "node:path";
import type { TargetLanguage } from "../../../types";
import type { PromptKind } from "../consts";
import { getPartsPath, wrapInXmlTag } from "./utils";

interface PromptParts {
	agentRole: string;
	taskDescription: string;
	examples: { input: string; output: string }[];
}

async function loadParts(
	language: TargetLanguage,
	promptKind: PromptKind,
): Promise<PromptParts> {
	const partsPath = getPartsPath(language, promptKind);

	const { agentRole } = await import(path.join(partsPath, "agent-role.ts"));
	const { taskDescription } = await import(
		path.join(partsPath, "task-description.ts")
	);
	const { examples } = await import(
		path.join(partsPath, "examples/to-use.ts")
	);

	return { agentRole, examples, taskDescription };
}

function formatExamples(examples: { input: string; output: string }[]): string {
	return examples
		.map(
			(ex, i) =>
				`<example-${i + 1}>\n<input>\n${ex.input}\n</input>\n<output>\n${ex.output}\n</output>\n</example-${i + 1}>`,
		)
		.join("\n\n");
}

export function buildSystemPrompt(parts: PromptParts): string {
	const sections = [
		wrapInXmlTag("agent-role", parts.agentRole),
		wrapInXmlTag("task-description", parts.taskDescription),
		wrapInXmlTag("examples", formatExamples(parts.examples)),
	];

	return sections.join("\n\n");
}

export interface CombinedPrompt {
	systemPrompt: string;
}

export async function combineParts(
	language: TargetLanguage,
	promptKind: PromptKind,
): Promise<CombinedPrompt> {
	const parts = await loadParts(language, promptKind);
	const systemPrompt = buildSystemPrompt(parts);

	return { systemPrompt };
}
