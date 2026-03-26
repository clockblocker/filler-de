import * as fs from "node:fs";
import * as path from "node:path";

export function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

export function wrapInXmlTag(tagName: string, content: string): string {
	return `<${tagName}>\n${content}\n</${tagName}>`;
}

export const PARTS_DIR = path.resolve(import.meta.dir, "../../prompt-parts");

export const GENERATED_DIR = path.resolve(
	import.meta.dir,
	"../generated-promts",
);

export function getPartsPath(
	targetLanguage: string,
	knownLanguage: string,
	promptKind: string,
): string {
	return path.join(
		PARTS_DIR,
		toKebabCase(targetLanguage),
		toKebabCase(knownLanguage),
		toKebabCase(promptKind),
	);
}

export function getGeneratedPath(
	targetLanguage: string,
	knownLanguage: string,
): string {
	return path.join(
		GENERATED_DIR,
		toKebabCase(targetLanguage),
		toKebabCase(knownLanguage),
	);
}

export function getGeneratedFileName(promptKind: string): string {
	return `${toKebabCase(promptKind)}-prompt.ts`;
}

export function partsExist(
	targetLanguage: string,
	knownLanguage: string,
	promptKind: string,
): boolean {
	const partsPath = getPartsPath(targetLanguage, knownLanguage, promptKind);
	return fs.existsSync(partsPath);
}
