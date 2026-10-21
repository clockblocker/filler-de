/**
 * Every metadata transform, applied to its own output, gives the same
 * bytes; and the Library's startup backlink pass plus a metadata write,
 * run any number of times, gives the bytes of one run (#107).
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeBacklinkTransform,
	makeCodecRulesFromSettings,
	makeCodecs,
	makeStripScrollBacklinkTransform,
	NodeSegmentIdSeparator,
	type SectionNodeSegmentId,
} from "@textfresser/library-core";
import { z } from "zod";
import {
	defineNestedNamespace,
	LibraryMetadata,
	type MetadataFormat,
	type MetadataTransform,
	noteMetadataHelper as meta,
} from "../../../src/stateless-helpers/note-metadata";
import { defaultSettingsForUnitTests } from "../common-utils/consts";
import {
	setupGetParsedUserSettingsSpy,
	setupGetParsedUserSettingsSpyWithHooks,
} from "../common-utils/setup-spy";

const OPEN = '<section id="textfresser_meta_keep_me_invisible">';
const PADDING = "\n".repeat(20);
const FORMATS: readonly MetadataFormat[] = ["Hidden", "Frontmatter"];

const Dictionary = defineNestedNamespace({
	key: "dictionary",
	name: "dictionary",
	schema: z.object({
		lemma: z.string(),
		table: z.array(z.array(z.string())),
	}),
	version: 1,
});
const TRICKY = {
	lemma: "</section> [[Fahrer]] %% #tag",
	table: [["[[a]]", "b"], ["</section>"]],
};

const codecs = makeCodecs(makeCodecRulesFromSettings(defaultSettingsForUnitTests));
const section = (name: string) =>
	`${name}${NodeSegmentIdSeparator}Section${NodeSegmentIdSeparator}` as SectionNodeSegmentId;
const parentChain = [section("Library"), section("Märchen")];
const LINK = "[[__-Märchen|← Märchen]]";

const FIXTURES: Record<string, string> = {
	"bloated empty Scroll": `\n ${LINK} ${"\n".repeat(1696)}${OPEN}\n{"status":"NotStarted"}\n</section>\n`,
	"empty body": "",
	"frontmatter only": "---\ntags:\n  - a\nstatus: false\n---\n",
	"frontmatter, body and section": `---\ntitle: T\n---\n\n ${LINK} \n\nText\n${PADDING}${OPEN}\n{"noteKind":"Page","status":"Done","prevPageIdx":0}\n</section>\n`,
	"legacy one-line section": `\n ${LINK} \n${OPEN}{"status":"Done"}</section>`,
	"section only": `${PADDING}${OPEN}\n{"status":"NotStarted"}\n</section>\n`,
	"text only": "Some text\nmore\n",
	"tricky values": `Text${PADDING}${OPEN}\n${JSON.stringify({ dictionary: { schemaVersion: 1, ...TRICKY } })}\n</section>\n`,
	"user text after the section": `Text\n${OPEN}\n{"status":"Done"}\n</section>\nTyped after it\n`,
};

function transformsFor(format: MetadataFormat): Record<string, MetadataTransform> {
	return {
		backlink: makeBacklinkTransform(parentChain, codecs) as MetadataTransform,
		"body unchanged": meta.mapBody((body) => body),
		"convert to this format": meta.convertFormat(format, [
			LibraryMetadata,
			Dictionary,
		]),
		"remove Library": meta.remove(LibraryMetadata),
		"strip backlink": makeStripScrollBacklinkTransform() as MetadataTransform,
		toggleStatus: meta.toggleStatus(true),
		"update dictionary": meta.update(
			Dictionary,
			(current) => current ?? TRICKY,
			format,
		),
		"write dictionary": meta.write(Dictionary, TRICKY, format),
		"write Library": meta.write(
			LibraryMetadata,
			{ noteKind: "Page", status: "Done" },
			format,
		),
	};
}

for (const format of FORMATS) {
	describe(`idempotency (${format})`, () => {
		let spy: ReturnType<typeof spyOn>;
		beforeEach(() => {
			spy = setupGetParsedUserSettingsSpy({
				hideMetadata: format === "Hidden",
			});
		});
		afterEach(() => spy.mockRestore());

		for (const [fixtureName, fixture] of Object.entries(FIXTURES)) {
			it(`every transform is idempotent on: ${fixtureName}`, () => {
				for (const [name, transform] of Object.entries(transformsFor(format))) {
					const once = transform(fixture);
					expect({ name, twice: transform(once) }).toEqual({
						name,
						twice: once,
					});
				}
			});
		}

		for (const [name, fixture] of [
			["an empty Scroll", ""],
			["a Scroll with content", "Es war einmal.\n\nEnde.\n"],
		] as const) {
			it(`backlink healing plus a metadata write, run N times, equals one run: ${name}`, () => {
				const pass = (content: string) =>
					makeBacklinkTransform(parentChain, codecs)(
						meta.write(LibraryMetadata, { status: "NotStarted" }, format)(content),
					) as string;
				const once = pass(fixture);
				let many: string = fixture;
				for (let run = 0; run < 10; run++) many = pass(many);
				expect(many).toBe(once);
				expect(meta.read(once, LibraryMetadata)).toEqual({ status: "NotStarted" });
			});
		}
	});
}

describe("blank-line growth regression", () => {
	setupGetParsedUserSettingsSpyWithHooks({ hideMetadata: true });

	it("an empty Scroll with a hidden section keeps the canonical padding", () => {
		const backlink = makeBacklinkTransform(parentChain, codecs) as MetadataTransform;
		const start = meta.write(LibraryMetadata, { status: "NotStarted" }, "Hidden")("");
		let content = start;
		for (let run = 0; run < 3; run++) content = backlink(content);
		expect(content).toBe(
			`\n ${LINK}${PADDING}${OPEN}\n{"status":"NotStarted"}\n</section>\n`,
		);
	});

	it("collapses an already bloated Scroll on its next pass", () => {
		const bloated = FIXTURES["bloated empty Scroll"] ?? "";
		const healed = (makeBacklinkTransform(parentChain, codecs) as MetadataTransform)(
			bloated,
		);
		expect(healed).toBe(
			`\n ${LINK}${PADDING}${OPEN}\n{"status":"NotStarted"}\n</section>\n`,
		);
		const stripped = (makeStripScrollBacklinkTransform() as MetadataTransform)(
			bloated,
		);
		expect(stripped).toBe(`${PADDING}${OPEN}\n{"status":"NotStarted"}\n</section>\n`);
	});
});
