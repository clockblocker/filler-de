import { describe, expect, test } from "bun:test";
import { dictNoteHelper } from "../../../../src/commanders/textfresser/domain/dict-note/index";
import type { DictEntry } from "../../../../src/commanders/textfresser/domain/dict-note/types";

// ─── Fixtures ───

/** Real format: header line is content + ^blockId, then blank line, then sections */
const KOHLEKRAFTWERK_ENTRY = [
	"🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german) ^l-nom-n-m1",
	" ",
	'<span class="entry_section_title entry_section_title_kontexte">Deine Kontexte</span>',
	"![[Atom#^13|^]]",
	"",
	"![[Atom#^14|^]]",
	'<span class="entry_section_title entry_section_title_kontexte">Note</span>',
	" *You can write here*",
	"",
	"",
	'<span class="entry_section_title entry_section_title_synonyme">Semantische Beziehungen</span>',
	"= [[Kraftwerk]], [[Stromerzeugungsanlage]], [[Stromerzeugungsanlage]]",
	"≈ [[Industrieanlage]], [[Fabrik]]",
	"≠ [[Windrad]], [[Solaranlage]]",
	'<span class="entry_section_title entry_section_title_morpheme">Morpheme</span>',
	" [[Kohle]]|[[kraft]]|[[werk]]",
	" [[Kohle]] + [[Kraftwerk]]",
	'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
	"coal-fired power plant",
	'<span class="entry_section_title entry_section_title_related">Verweise</span>',
	" [[Kohle]], [[Kraftwerk]]",
	'<span class="entry_section_title entry_section_title_flexion">Flexion</span>',
	"N: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]",
	"A: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]",
	"G: des [[Kohlekraftwerkes]], der [[Kohlekraftwerke]]",
	"D: dem [[Kohlekraftwerk]], den [[Kohlekraftwerken]]",
	'<span class="entry_section_title entry_section_title_tags">Tags</span>',
	"#Ablaut  #Ableitung  #Abtönung",
].join("\n");

const WINDRAD_ENTRY = [
	"🌬️ das [[Windrad]] ^l-nom-n-w2",
	" ",
	'<span class="entry_section_title entry_section_title_kontexte">Deine Kontexte</span>',
	"![[Energie#^5|^]]",
	'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
	"wind turbine",
].join("\n");

const MULTI_ENTRY_BODY = `${KOHLEKRAFTWERK_ENTRY}\n---\n---\n---\n${WINDRAD_ENTRY}`;

function makeNoteWithMeta(body: string, meta: Record<string, unknown>): string {
	const padding = "\n".repeat(20);
	const section = `<section id="textfresser_meta_keep_me_invisible">\n${JSON.stringify(meta)}\n</section>`;
	return `${body}${padding}${section}\n`;
}

// ─── Tests ───

describe("dictNoteHelper.parse", () => {
	test("parses full Kohlekraftwerk entry", () => {
		const note = makeNoteWithMeta(KOHLEKRAFTWERK_ENTRY, {
			entries: { "l-nom-n-m1": { status: "Done" } },
		});

		const entries = dictNoteHelper.parse(note);

		expect(entries).toHaveLength(1);
		const e = entries[0]!;
		expect(e.id).toBe("l-nom-n-m1");
		expect(e.headerContent).toBe(
			"🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german)",
		);
		expect(e.sections).toHaveLength(8);
		expect(e.sections[0]?.kind).toBe("kontexte");
		expect(e.sections[0]?.title).toBe("Deine Kontexte");
		expect(e.sections[1]?.kind).toBe("kontexte");
		expect(e.sections[1]?.title).toBe("Note");
		expect(e.sections[2]?.kind).toBe("synonyme");
		expect(e.sections[3]?.kind).toBe("morpheme");
		expect(e.sections[4]?.kind).toBe("translations");
		expect(e.sections[5]?.kind).toBe("related");
		expect(e.sections[6]?.kind).toBe("flexion");
		expect(e.sections[7]?.kind).toBe("tags");
		expect(e.meta).toEqual({ status: "Done" });
	});

	test("parses multiple entries separated by ---\\n---\\n---", () => {
		const note = makeNoteWithMeta(MULTI_ENTRY_BODY, {
			entries: {
				"l-nom-n-m1": { status: "Done" },
				"l-nom-n-w2": { status: "NotStarted" },
			},
		});

		const entries = dictNoteHelper.parse(note);

		expect(entries).toHaveLength(2);
		expect(entries[0]?.id).toBe("l-nom-n-m1");
		expect(entries[0]?.meta).toEqual({ status: "Done" });
		expect(entries[1]?.id).toBe("l-nom-n-w2");
		expect(entries[1]?.sections).toHaveLength(2);
		expect(entries[1]?.meta).toEqual({ status: "NotStarted" });
	});

	test("single entry without separator", () => {
		const entries = dictNoteHelper.parse(WINDRAD_ENTRY);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.id).toBe("l-nom-n-w2");
		expect(entries[0]?.headerContent).toBe("🌬️ das [[Windrad]]");
	});

	test("entry with no sections (just header)", () => {
		const note = "bare header line ^bare-id";
		const entries = dictNoteHelper.parse(note);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.id).toBe("bare-id");
		expect(entries[0]?.headerContent).toBe("bare header line");
		expect(entries[0]?.sections).toHaveLength(0);
	});

	test("empty/missing meta defaults to {}", () => {
		const entries = dictNoteHelper.parse(KOHLEKRAFTWERK_ENTRY);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.meta).toEqual({});
	});

	test("two sections with same kind but different titles preserved", () => {
		const entries = dictNoteHelper.parse(KOHLEKRAFTWERK_ENTRY);
		const sections = entries[0]?.sections;

		// First two sections are both "kontexte"
		expect(sections?.[0]?.kind).toBe("kontexte");
		expect(sections?.[0]?.title).toBe("Deine Kontexte");
		expect(sections?.[1]?.kind).toBe("kontexte");
		expect(sections?.[1]?.title).toBe("Note");
	});
});

describe("dictNoteHelper.serialize", () => {
	test("returns body and meta separately", () => {
		const entry: DictEntry = {
			headerContent:
				"🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german)",
			id: "l-nom-n-m1",
			meta: { status: "Done" },
			sections: [
				{
					content: "![[Atom#^13|^]]",
					kind: "kontexte",
					title: "Deine Kontexte",
				},
				{
					content: "coal-fired power plant",
					kind: "translations",
					title: "Übersetzung",
				},
			],
		};

		const { body, meta } = dictNoteHelper.serialize([entry]);

		expect(body).toContain(
			"🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german) ^l-nom-n-m1",
		);
		expect(body).toContain(
			'<span class="entry_section_title entry_section_title_kontexte">Deine Kontexte</span>',
		);
		expect(body).toContain("![[Atom#^13|^]]");
		expect(body).toContain("coal-fired power plant");
		// No metadata section in body
		expect(body).not.toContain("textfresser_meta_keep_me_invisible");
		// Meta collected separately
		expect(meta).toEqual({ entries: { "l-nom-n-m1": { status: "Done" } } });
	});

	test("joins multiple entries with separator", () => {
		const entries: DictEntry[] = [
			{ headerContent: "das [[Wort]]", id: "a1", meta: {}, sections: [] },
			{
				headerContent: "das [[Ding]]",
				id: "b2",
				meta: {},
				sections: [
					{
						content: "B content",
						kind: "kontexte",
						title: "Deine Kontexte",
					},
				],
			},
		];

		const { body } = dictNoteHelper.serialize(entries);
		expect(body).toContain(
			"das [[Wort]] ^a1\n\n\n\n---\n---\n\n\n\ndas [[Ding]] ^b2",
		);
	});

	test("entries with empty meta return empty object", () => {
		const entries: DictEntry[] = [
			{ headerContent: "das [[Wort]]", id: "x1", meta: {}, sections: [] },
		];
		const { meta } = dictNoteHelper.serialize(entries);
		expect(meta).toEqual({});
	});
});

describe("tags as section", () => {
	test("parses tags section from entry", () => {
		const note = [
			"☁️ der [[Himmel]] ^LX-LM-NOUN-1",
			'<span class="entry_section_title entry_section_title_tags">Tags</span>',
			"#noun/maskulin",
		].join("\n");

		const entries = dictNoteHelper.parse(note);

		expect(entries).toHaveLength(1);
		const tagsSection = entries[0]?.sections.find((s) => s.kind === "tags");
		expect(tagsSection).toBeDefined();
		expect(tagsSection?.content).toBe("#noun/maskulin");
	});

	test("serializes tags section like any other section", () => {
		const entry: DictEntry = {
			headerContent: "☁️ der [[Himmel]]",
			id: "LX-LM-NOUN-1",
			meta: {},
			sections: [
				{
					content: "#noun/maskulin",
					kind: "tags",
					title: "Tags",
				},
			],
		};

		const { body } = dictNoteHelper.serialize([entry]);

		expect(body).toContain("☁️ der [[Himmel]] ^LX-LM-NOUN-1");
		expect(body).toContain(
			'<span class="entry_section_title entry_section_title_tags">Tags</span>',
		);
		expect(body).toContain("#noun/maskulin");
	});

	test("round-trips entry with tags section", () => {
		const original: DictEntry[] = [
			{
				headerContent: "☁️ der [[Himmel]]",
				id: "LX-LM-NOUN-1",
				meta: {},
				sections: [
					{
						content: "#noun/maskulin",
						kind: "tags",
						title: "Tags",
					},
					{
						content: "sky, heaven",
						kind: "translations",
						title: "Übersetzung",
					},
				],
			},
		];

		const { body } = dictNoteHelper.serialize(original);
		const parsed = dictNoteHelper.parse(body);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]?.sections).toEqual(original[0]?.sections);
	});
});

describe("round-trip", () => {
	test("serialize → parse round-trips body (without meta)", () => {
		const original: DictEntry[] = [
			{
				headerContent:
					"🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german)",
				id: "l-nom-n-m1",
				meta: {},
				sections: [
					{
						content: "![[Atom#^13|^]]\n![[Atom#^14|^]]",
						kind: "kontexte",
						title: "Deine Kontexte",
					},
					{
						content: "= [[Kraftwerk]]",
						kind: "synonyme",
						title: "Semantische Beziehungen",
					},
				],
			},
			{
				headerContent: "🌬️ das [[Windrad]]",
				id: "l-nom-n-w2",
				meta: {},
				sections: [
					{
						content: "wind turbine",
						kind: "translations",
						title: "Übersetzung",
					},
				],
			},
		];

		const { body } = dictNoteHelper.serialize(original);
		const parsed = dictNoteHelper.parse(body);

		expect(parsed).toHaveLength(2);
		for (let i = 0; i < original.length; i++) {
			const orig = original[i]!;
			const got = parsed[i]!;
			expect(got.id).toBe(orig.id);
			expect(got.headerContent).toBe(orig.headerContent);
			expect(got.sections).toEqual(orig.sections);
		}
	});

	test("parse → serialize → parse is stable", () => {
		const note = makeNoteWithMeta(MULTI_ENTRY_BODY, {
			entries: {
				"l-nom-n-m1": { wortart: "Nomen" },
				"l-nom-n-w2": { wortart: "Nomen" },
			},
		});

		const first = dictNoteHelper.parse(note);
		const { body } = dictNoteHelper.serialize(first);
		// Re-attach meta for parse to pick up
		const noteWithMeta = makeNoteWithMeta(body, {
			entries: {
				"l-nom-n-m1": { wortart: "Nomen" },
				"l-nom-n-w2": { wortart: "Nomen" },
			},
		});
		const second = dictNoteHelper.parse(noteWithMeta);

		expect(second).toHaveLength(first.length);
		for (let i = 0; i < first.length; i++) {
			expect(second[i]?.id).toBe(first[i]?.id);
			expect(second[i]?.headerContent).toBe(first[i]?.headerContent);
			expect(second[i]?.sections).toEqual(first[i]?.sections);
			expect(second[i]?.meta).toEqual(first[i]?.meta);
		}
	});
});
