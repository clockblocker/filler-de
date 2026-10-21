/**
 * YAML frontmatter: the format used while "Hide metadata" is off.
 *
 * Values are read with Obsidian's `parseYaml` and written with its
 * `stringifyYaml`, the same YAML library `processFrontMatter` uses, so
 * nested objects and arrays survive. `processFrontMatter` itself works on a
 * file, not on a string, so it cannot run inside a VAM transform or the
 * dictionary store's compare-and-swap; these helpers stay pure instead.
 */

import { Predicate } from "effect";
import { parseYaml, stringifyYaml } from "obsidian";
import type { MetadataDocument } from "./document";

/** `---`, the YAML lines, then `---` on a line of its own. */
const FRONTMATTER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/u;

export type LocatedFrontmatter = {
	/** Index just after the closing line. */
	readonly end: number;
	/** The block as written, delimiters included. */
	readonly raw: string;
	/** The YAML mapping, or null when the YAML is not a readable mapping. */
	readonly document: MetadataDocument | null;
};

/** The frontmatter that opens `content`, or null when there is none. */
export function locateFrontmatter(content: string): LocatedFrontmatter | null {
	const match = FRONTMATTER.exec(content);
	if (!match) return null;
	return {
		document: parseMapping(match[1] ?? ""),
		end: match[0].length,
		raw: match[0],
	};
}

function parseMapping(yaml: string): MetadataDocument | null {
	let parsed: unknown;
	try {
		parsed = parseYaml(yaml);
	} catch {
		return null;
	}
	if (parsed === null || parsed === undefined) return {};
	return Predicate.isObject(parsed) ? parsed : null;
}

/** The frontmatter block for `document`; empty for an empty document. */
export function formatFrontmatter(document: MetadataDocument): string {
	if (Object.keys(document).length === 0) return "";
	const yaml = stringifyYaml(document);
	return `---\n${yaml.endsWith("\n") ? yaml : `${yaml}\n`}---\n`;
}
