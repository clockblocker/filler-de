/**
 * Obsidian indexes `[[…]]` inside frontmatter property values. A nested
 * namespace with `escapeLinksInFrontmatter` writes `[` as `\[` there, so
 * its data holds no link in either format (#112).
 */
import { describe, expect, it } from "bun:test";
import { Predicate } from "effect";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
	defineNestedNamespace,
	type MetadataFormat,
	noteMetadataHelper as meta,
} from "../../../src/stateless-helpers/note-metadata";
import { setupGetParsedUserSettingsSpyWithHooks } from "../common-utils/setup-spy";

setupGetParsedUserSettingsSpyWithHooks({ hideMetadata: false });

const Schema = z.object({
	embeds: z.array(z.string()),
	map: z.record(z.string(), z.array(z.string())),
	text: z.string(),
});
const spec = {
	key: "dictionary",
	name: "dictionary",
	schema: Schema,
	version: 1,
} as const;
const Escaped = defineNestedNamespace({ ...spec, escapeLinksInFrontmatter: true });
const Plain = defineNestedNamespace(spec);

const VALUE = {
	embeds: ["![[Scroll#^3|^]]", "[[Worter/f/fah/fahre/fahrer|Fahrer]]"],
	map: { '["[\\"de\\"]","🚗"]': ["[x](y)"] },
	text: "a \\[ b \\\\ c [[d]] \\",
};

/** Every string in a YAML value, keys included. */
function stringsOf(value: unknown): string[] {
	if (Predicate.isString(value)) return [value];
	if (Array.isArray(value)) return value.flatMap(stringsOf);
	if (Predicate.isObject(value))
		return Object.entries(value).flatMap(([key, item]) => [
			key,
			...stringsOf(item),
		]);
	return [];
}

/** Whether a string holds a `[` its escape left bare. */
const bareBracket = (text: string) =>
	text.replace(/\\[\\[]/gu, "").includes("[");

const frontmatterOf = (content: string) =>
	content.match(/^---\n([\s\S]*?)\n---\n/u)?.[1] ?? "";

describe("the frontmatter link escape", () => {
	it("writes no [ into frontmatter, keys included, and reads the value back", () => {
		const content = meta.write(Escaped, VALUE, "Frontmatter")("Body\n");
		const yaml = frontmatterOf(content);
		expect(yaml).not.toContain("[[");
		expect(stringsOf(parseYaml(yaml)).filter(bareBracket)).toEqual([]);
		expect(meta.read(content, Escaped, "Frontmatter")).toEqual(VALUE);
	});

	it("leaves the hidden section's JSON as it was", () => {
		const hidden = meta.write(Escaped, VALUE, "Hidden")("Body\n");
		expect(hidden).toBe(meta.write(Plain, VALUE, "Hidden")("Body\n"));
		expect(meta.read(hidden, Escaped, "Hidden")).toEqual(VALUE);
	});

	it("leaves a namespace without the option as it was", () => {
		const content = meta.write(Plain, VALUE, "Frontmatter")("Body\n");
		expect(frontmatterOf(content)).toContain("[[");
	});

	for (const [from, to] of [
		["Hidden", "Frontmatter"],
		["Frontmatter", "Hidden"],
	] as const satisfies readonly (readonly [MetadataFormat, MetadataFormat])[])
		it(`moves the data ${from} → ${to} unescaped or escaped as the target needs`, () => {
			const content = meta.write(Escaped, VALUE, from)("Body\n");
			const converted = meta.convertNote(content, to, [Escaped]);
			expect(converted.moved).toEqual(["dictionary"]);
			expect(meta.read(converted.content, Escaped, to)).toEqual(VALUE);
			expect(converted.content).toBe(meta.write(Escaped, VALUE, to)("Body\n"));
		});
});
