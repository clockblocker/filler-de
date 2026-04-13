import { getRequiredPromptSpecs } from "./prompt-registry";

const promptLabels = [...new Set(getRequiredPromptSpecs().map((spec) => spec.requestLabel))];

console.log(`Validated ${promptLabels.length} lexical-generation-next prompt routes.`);
