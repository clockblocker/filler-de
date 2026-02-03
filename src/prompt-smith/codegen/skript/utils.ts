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

export function getPartsPath(language: string, promptKind: string): string {
	return path.join(PARTS_DIR, toKebabCase(language), toKebabCase(promptKind));
}

export function getGeneratedPath(language: string): string {
	return path.join(GENERATED_DIR, toKebabCase(language));
}

export function getGeneratedFileName(promptKind: string): string {
	return `${toKebabCase(promptKind)}-prompt.ts`;
}
