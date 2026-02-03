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

export const PARTS_DIR = path.resolve(
	import.meta.dir,
	"../../parts",
);

export const GENERATED_DIR = path.resolve(
	import.meta.dir,
	"../generated-promts",
);

export function getPartsPath(
	promptKind: string,
	language: string,
): string {
	return path.join(PARTS_DIR, toKebabCase(promptKind), toKebabCase(language));
}

export function getGeneratedPath(promptKind: string): string {
	return path.join(GENERATED_DIR, toKebabCase(promptKind));
}

export function getGeneratedFileName(language: string, promptKind: string): string {
	return `${toKebabCase(language)}-${toKebabCase(promptKind)}-prompt.ts`;
}
