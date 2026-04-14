import { getRequiredPromptSpecs } from "./prompt-registry";

const promptLabels = [
	...new Set(getRequiredPromptSpecs().map((spec) => spec.requestLabel)),
];

// biome-ignore lint/suspicious/noConsole: Codegen Script
console.log(
	`Validated ${promptLabels.length} lexical-generation-next prompt routes.`,
);
