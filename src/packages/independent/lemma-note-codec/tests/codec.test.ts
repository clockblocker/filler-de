import { describe, expect, it } from "bun:test";
import { readingIdentityKey } from "dumling";
import {
	assignBlockIds,
	blockIdsOf,
	type Projections,
	parseDocument,
	readingBlockId,
	serialize,
	serializeDocument,
} from "../src";
import { sha256Hex } from "../src/hash";
import { familyFixtures, nounData, syncretismData, verbData } from "./fixtures";
import { normalized, parseDe, validData } from "./helpers";

/** A section's title line, as the codec renders it. */
const title = (kind: string, text: string) =>
	`<span class="note_block_title note_block_title_${kind}">${text}</span>`;

const MUTTER_HEADER =
	"👩 die [[Worter/de/Lexeme/NOUN/Fem/Mutter|Mutter]], [ˈmʊtɐ ♫](https://youglish.com/pronounce/Mutter/german)";

/** A stand-in table cell per Mutter Reading, for the projection hooks. */
const pluralOf = (reading: object) =>
	"emojiDescription" in reading && reading.emojiDescription === "👩"
		? "Mütter"
		: "emojiDescription" in reading && reading.emojiDescription === "🔩"
			? "Muttern"
			: "";

describe("round trips for every German Family", () => {
	for (const [family, fixture] of Object.entries(familyFixtures)) {
		it(`${family}: parse → serialize → parse keeps the records`, () => {
			// dumdict normalizes, e.g. Emoji Descriptions lose variation
			// selectors, so the records to keep are the normalized ones.
			const expected = normalized(fixture);
			const parsed = parseDe(serialize(undefined, fixture));
			if (!parsed.data.ok)
				throw new Error(
					parsed.data.issues.map((issue) => issue.message).join("; "),
				);
			expect(parsed.data.data).toEqual(expected);

			const second = serialize(parsed.document, parsed.data.data);
			expect(second).toBe(serialize(undefined, expected));
			const reparsed = parseDe(second);
			expect(reparsed.data.ok && reparsed.data.data).toEqual(expected);
			expect(serializeDocument(reparsed.document)).toBe(second);
		});
	}

	it("keeps nested Dumling and dumrel JSON exactly", () => {
		const [aufstehen] = validData(
			serialize(undefined, verbData),
		).readingEntries;
		const [source] = normalized(verbData).readingEntries;
		expect(aufstehen?.knowledge?.morphologicalTree).toEqual(
			source?.knowledge?.morphologicalTree,
		);
		expect(aufstehen?.knowledge?.valency).toEqual(
			source?.knowledge?.valency,
		);
		const [ihm] = validData(
			serialize(undefined, syncretismData),
		).readingEntries;
		expect(ihm?.knowledge?.semanticRelations).toEqual(
			syncretismData.readingEntries[0]?.knowledge?.semanticRelations,
		);
		expect(ihm?.reading.lemma).toEqual(syncretismData.lemmaRecord.lemma);
	});

	it("keeps both Readings, owned Surfaces and pending relations of Mutter", () => {
		const data = validData(serialize(undefined, nounData));
		expect(
			data.readingEntries.map((entry) => entry.knowledge?.translations),
		).toEqual([{ en: ["mother"], ru: ["мать", "мама"] }, { en: ["nut"] }]);
		expect(data.ownedSurfaceEntries).toHaveLength(1);
		expect(
			data.pendingRelations.map((record) => record.pending.relation),
		).toEqual(["hypernym", "antonym"]);
	});

	it("keeps a resolved Shadow relation's Lemma and shows it through the claim alone", () => {
		const [hypernym, antonym] = nounData.pendingRelations;
		if (!(hypernym && antonym)) throw new Error("Expected two records");
		const vater = {
			canonicalForm: "Vater",
			coreFeatures: { gender: "Masc" },
			family: "Lexeme",
			kind: "NOUN",
			language: "de",
			unitKind: "Lemma",
		} as const;
		const resolved = { ...antonym, resolvedLemma: vater };
		const markdown = serialize(undefined, {
			...nounData,
			pendingRelations: [hypernym, resolved],
		});
		expect(validData(markdown).pendingRelations).toEqual([
			hypernym,
			resolved,
		]);
		expect(markdown).toContain(
			"⊃ [[Worter/e/elt/elter/elternteil|Elternteil]]",
		);
		expect(markdown).not.toContain("≠ [[Worter/v/vat/vater/vater|Vater]]");
	});

	it("keeps notes, % and marker-like text inside payloads", () => {
		const markdown = serialize(undefined, nounData);
		const [mother] = validData(markdown).readingEntries;
		expect(mother?.notes).toBe(nounData.readingEntries[0]?.notes);
		expect(mother?.knowledge?.definition).toBe(
			"A female parent; 100% of the time %% loved.",
		);
		const percents = serialize(undefined, {
			...nounData,
			pendingRelations: [],
			readingEntries: nounData.readingEntries
				.slice(0, 1)
				.map((entry) => ({ ...entry, notes: "50%%% off\r\rnext" })),
		});
		expect(percents).not.toMatch(/^(?!%%tf).*%%/mu);
		expect(validData(percents).readingEntries[0]?.notes).toBe(
			"50%%% off\r\rnext",
		);
		for (const line of markdown.split("\n")) {
			if (line.startsWith("%%tf"))
				expect(line.slice(2, -2)).not.toContain("%");
		}
	});

	it("keeps links and embeds out of payloads, so each shows once", () => {
		const markdown = serialize(undefined, nounData);
		const payloadStrings = markdown
			.split("\n")
			.filter((line) => line.startsWith("%%tf"))
			.flatMap((line) => line.match(/"(?:[^"\\]|\\.)*"/gu) ?? []);
		expect(payloadStrings.length).toBeGreaterThan(0);
		for (const token of payloadStrings) expect(token).not.toContain("[");
		for (const embed of [
			"![[Scroll#^3|^]]",
			"![[Other Scroll#^7|^]]",
			"![[Scroll#^12|^]]",
		]) {
			expect(markdown.split(embed)).toHaveLength(2);
		}
		expect(markdown).toContain('"ref":"!\\u005b\\u005bScroll#^3|^]]"');
		expect(markdown).toContain(
			'"ref":"!\\u005b\\u005bOther Scroll#^7|^]]"',
		);
		const [mother] = validData(markdown).readingEntries;
		expect(mother?.attestationLinks.map(({ ref }) => ref)).toEqual([
			"![[Scroll#^3|^]]",
			"![[Other Scroll#^7|^]]",
		]);

		const notes = 'see [[Vater]], [a](b) and \\[[c]] in "[q]"';
		const linked = serialize(undefined, {
			...nounData,
			pendingRelations: [],
			readingEntries: nounData.readingEntries
				.slice(0, 1)
				.map((entry) => ({ ...entry, notes })),
		});
		expect(
			linked.split("\n").find((line) => line.startsWith("%%tf:notes")),
		).not.toContain("[");
		expect(validData(linked).readingEntries[0]?.notes).toBe(notes);
	});

	it("still reads payloads written with links in them", () => {
		const markdown = serialize(undefined, nounData);
		const unescaped = markdown.replaceAll("\\u005b", "[");
		expect(unescaped).not.toBe(markdown);
		const parsed = parseDe(unescaped);
		expect(parsed.data.ok && parsed.data.data).toEqual(
			normalized(nounData),
		);
		if (!parsed.data.ok) return;
		expect(serialize(parsed.document, parsed.data.data)).toBe(markdown);
	});
});

describe("the document layer", () => {
	const note = [
		"---",
		"aliases: [Mutti]",
		"---",
		"Preamble text",
		"",
		"%%tf-part:lemma%%",
		"",
		serialize(undefined, nounData)
			.split("\n")
			.find((line) => line.startsWith("%%tf:identity")) ?? "",
		"",
		"My own paragraph",
		"",
		"  with odd spacing  ",
		"",
		"",
		'%%tf:future_block {"x":1}%%',
		"kept rendering",
		"",
	].join("\n");

	it("writes back every byte it parsed", () => {
		const messy = `${note}\r\n%%tf:\n%%unclosed\n\n\n`;
		expect(serializeDocument(parseDocument(messy))).toBe(messy);
		const canonical = serialize(undefined, nounData);
		expect(serializeDocument(parseDocument(canonical))).toBe(canonical);
		expect(serializeDocument(parseDocument(""))).toBe("");
	});

	it("keeps freeform and unknown Blocks byte for byte through serialize", () => {
		const parsed = parseDe(
			`${note}${serialize(undefined, nounData).slice(
				serialize(undefined, nounData).indexOf("%%tf-part:reading"),
			)}`,
		);
		if (!parsed.data.ok)
			throw new Error(
				parsed.data.issues.map((issue) => issue.message).join("; "),
			);
		const written = serialize(parsed.document, parsed.data.data);
		expect(
			written.startsWith(
				"---\naliases: [Mutti]\n---\nPreamble text\n\n%%tf-part:lemma%%",
			),
		).toBe(true);
		expect(written).toContain(
			"My own paragraph\n\n  with odd spacing  \n\n",
		);
		expect(written).toContain(
			'%%tf:future_block {"x":1}%%\nkept rendering',
		);
		const again = parseDe(written);
		expect(again.data.ok && again.data.data).toEqual(parsed.data.data);
		expect(serialize(again.document, parsed.data.data)).toBe(written);
	});

	it("keeps a Reading part's freeform with its Reading, under its Note title", () => {
		const canonical = serialize(undefined, nounData);
		const nut = nounData.readingEntries[1];
		if (nut === undefined) throw new Error("fixture");
		const nutId = blockIdsOf(nounData).readings.get(
			readingIdentityKey(nut.reading),
		);
		const edited = canonical.replace(
			`%%tf-part:reading ${nutId}%%\n`,
			`%%tf-part:reading ${nutId}%%\nA note about nuts\n\n`,
		);
		const parsed = parseDe(edited);
		if (!parsed.data.ok) throw new Error("invalid");
		const written = serialize(parsed.document, parsed.data.data);
		const nutPart =
			written
				.split(`%%tf-part:reading ${nutId}%%`)[1]
				?.split("%%tf-part:")[0] ?? "";
		expect(nutPart).toContain(
			`${title("kontexte", "Note")}\nA note about nuts\n\n\n%%tf:translation`,
		);
		// Written text replaces the Note placeholder.
		expect(nutPart).not.toContain("*You can write here*");
		expect(serialize(parseDe(written).document, parsed.data.data)).toBe(
			written,
		);
	});

	it("moves freeform of a part the data dropped to the Lemma part", () => {
		const canonical = serialize(undefined, nounData);
		const withNote = canonical.replace(
			"%%tf-part:surface",
			"Remember this\n\n%%tf-part:surface",
		);
		const parsed = parseDe(withNote);
		if (!parsed.data.ok) throw new Error("invalid");
		const { data } = parsed.data;
		const kept = data.readingEntries.slice(0, 1);
		const keptKeys = kept.map((entry) => readingIdentityKey(entry.reading));
		const fewer = {
			...data,
			pendingRelations: data.pendingRelations.filter((record) =>
				keptKeys.includes(readingIdentityKey(record.sourceReading)),
			),
			readingEntries: kept,
		};
		const written = serialize(parsed.document, fewer);
		const lemmaPart = written.split("%%tf-part:reading")[0] ?? "";
		expect(lemmaPart).toContain("Remember this");
	});

	it("parses Blocks in any order and serializes them canonically", () => {
		const canonical = serialize(undefined, normalized(verbData));
		const [head, part] = canonical.split("%%tf-part:reading");
		// Each Block, from its marker to the next, with its blank lines cut.
		const [marker, ...blocks] = (part ?? "")
			.split(/^(?=%%tf:)/mu)
			.map((block) => block.trimEnd());
		const shuffled = `${head}%%tf-part:reading${[marker, ...blocks.reverse()].join("\n\n")}\n`;
		expect(shuffled).not.toBe(canonical);
		const parsed = parseDe(shuffled);
		if (!parsed.data.ok) throw new Error("invalid");
		expect(parsed.data.data).toEqual(normalized(verbData));
		expect(serialize(parsed.document, parsed.data.data)).toBe(canonical);
	});

	it("never reads projection Blocks: editing or deleting them changes no data", () => {
		const canonical = serialize(undefined, nounData, {
			projections: { tags: () => ["de/noun"] },
		});
		const edited = canonical
			.replace(MUTTER_HEADER, "🦖 der [[Vater]]")
			.replace(/%%tf:tags@[^\n]*\n<span[^\n]*\n#de\/noun\n\n/gu, "");
		expect(edited).not.toContain("%%tf:tags");
		expect(validData(edited)).toEqual(validData(canonical));
	});

	it("ignores edits to a serialized Block's visible rendering", () => {
		const canonical = serialize(undefined, nounData);
		const edited = canonical.replace(
			`${title("translations", "Übersetzung")}\nnut`,
			`${title("translations", "Übersetzung")}\nbolt`,
		);
		expect(edited).not.toBe(canonical);
		expect(validData(edited)).toEqual(validData(canonical));
	});
});

describe("user text around renderings", () => {
	const projections: Projections<"de"> = {
		inflection: ({ entry }) =>
			`| Nom | ${pluralOf(entry.reading)} |\n| Gen | x |`,
		inverseRelations: ({ entry }) => [
			{
				provenance: "inferred",
				relation: "hyponym",
				source: entry.reading as never,
				target: verbData.lemmaRecord.lemma as never,
			},
		],
		tags: () => ["noun", "fem"],
	};
	const canonical = serialize(undefined, nounData, { projections });

	/** Inserts `text` after the first line that starts with `prefix`. */
	function typeUnder(markdown: string, prefix: string, text: string) {
		const lines = markdown.split("\n");
		const at = lines.findIndex((line) => line.startsWith(prefix));
		if (at < 0) throw new Error(`No line starts with ${prefix}`);
		lines.splice(at + 1, 0, text);
		return lines.join("\n");
	}

	/** parse → serialize → parse, checking data and the user's text survive. */
	function roundTrip(markdown: string, kept: readonly string[]) {
		const parsed = parseDe(markdown);
		if (!parsed.data.ok) throw new Error("invalid");
		expect(parsed.data.data).toEqual(normalized(nounData));
		expect(serializeDocument(parsed.document)).toBe(markdown);
		const freeform = parsed.document.parts
			.flatMap((part) => part.blocks)
			.filter((block) => block.type === "freeform")
			.map((block) => block.raw)
			.join("");
		for (const text of kept) expect(freeform).toContain(text);

		const written = serialize(parsed.document, parsed.data.data, {
			projections,
		});
		for (const text of kept) expect(written).toContain(text);
		const again = parseDe(written);
		expect(again.data.ok && again.data.data).toEqual(normalized(nounData));
		expect(
			serialize(again.document, normalized(nounData), { projections }),
		).toBe(written);
		return written;
	}

	const lastLines = {
		// The last of two embeds a blank line separates in one rendering.
		attestation: "![[Other Scroll#^7|^]]",
		header: `${MUTTER_HEADER} ^r-`,
		inflection: "| Gen | x |",
		inverse_relation: "⊂ [[",
		notes_title: title("kontexte", "Note"),
		surface: "Mütter (Nom Plur) ^s-",
		tags: "#noun #fem",
		translation: "ru: мать, мама",
	};
	for (const [kind, last] of Object.entries(lastLines)) {
		it(`keeps a line typed directly under ${kind}`, () => {
			const typed = typeUnder(canonical, last, `My ${kind} note`);
			const written = roundTrip(typed, [`My ${kind} note`]);
			expect(written).toContain(last);
		});
	}

	it("keeps a line typed directly under a Block with no rendering", () => {
		const typed = typeUnder(canonical, "%%tf:identity", "About Mutter");
		roundTrip(typed, ["About Mutter"]);
	});

	it("keeps an edit inside a rendering as freeform and re-renders the Block", () => {
		const edited = canonical
			.replace("#noun #fem", "#noun #fem #mine")
			.replace("| Gen | x |", "| Gen | Mutter |");
		const parsed = parseDe(edited);
		const blocks = parsed.document.parts[1]?.blocks ?? [];
		const tags = blocks.find(
			(block) => block.type === "projection" && block.kind === "tags",
		);
		expect(tags?.raw).toMatch(/^%%tf:tags@2:[0-9a-f]{8}%%\n$/u);
		const written = roundTrip(edited, [
			`${title("tags", "Tags")}\n#noun #fem #mine`,
			`${title("flexion", "Flexion")}\n| Nom | Mütter |\n| Gen | Mutter |`,
		]);
		expect(written).toContain(`${title("tags", "Tags")}\n#noun #fem\n`);
		expect(written).toContain("| Gen | x |");
	});

	it("keeps an edited serialized rendering without reading it", () => {
		const edited = canonical.replace("en: mother", "en: mom");
		roundTrip(edited, ["en: mom"]);
	});

	/** How often `^<id>` occurs in `markdown`. */
	const idCount = (markdown: string, id: string) =>
		markdown.match(new RegExp(`\\^${id}(?![0-9a-f])`, "gu"))?.length ?? 0;

	/** Every Block ID of the note occurs once, on its canonical Block. */
	function expectUniqueIds(written: string) {
		const ids = blockIdsOf(normalized(nounData));
		const all = [...ids.readings.values(), ...ids.surfaces.values()];
		expect(all.length).toBeGreaterThan(0);
		const canonicalLines = canonical.split("\n");
		const writtenLines = written.split("\n");
		for (const id of all) {
			expect(idCount(written, id)).toBe(1);
			const line = canonicalLines.find((text) =>
				text.endsWith(` ^${id}`),
			);
			expect(line).toBeDefined();
			expect(writtenLines).toContain(line ?? "");
		}
	}

	/**
	 * Edits the first line starting with `prefix`; returns the note and the
	 * edited line without its Block ID and the whitespace before it.
	 */
	function editLine(
		markdown: string,
		prefix: string,
		edit: (line: string) => string,
	) {
		const lines = markdown.split("\n");
		const at = lines.findIndex((line) => line.startsWith(prefix));
		if (at < 0) throw new Error(`No line starts with ${prefix}`);
		const line = edit(lines[at] ?? "");
		lines[at] = line;
		const userText = line.replace(/[ \t]+\^[rs]-[0-9a-f]+(?=[ \t]*$)/u, "");
		expect(userText).not.toBe(line);
		return { markdown: lines.join("\n"), userText };
	}

	const idLines = {
		header: `${MUTTER_HEADER} ^r-`,
		surface: "Mütter (Nom Plur) ^s-",
	};
	for (const [kind, prefix] of Object.entries(idLines)) {
		it(`keeps an edited ${kind} without its Block ID beside the re-rendered one`, () => {
			const { markdown, userText } = editLine(canonical, prefix, (line) =>
				line
					.replace("Mutter", "liebe Mutter")
					.replace("Mütter", "Mütterlein"),
			);
			const written = roundTrip(markdown, [userText]);
			expect(written.split("\n")).toContain(userText);
			expectUniqueIds(written);
		});
	}

	it("keeps every edited header and surface byte for byte but their Block IDs", () => {
		let markdown = canonical;
		const userTexts: string[] = [];
		const lines = canonical
			.split("\n")
			.filter((line) => / \^[rs]-[0-9a-f]+$/u.test(line));
		expect(lines.length).toBeGreaterThan(2);
		for (const [index, line] of lines.entries()) {
			const edited = editLine(
				markdown,
				line,
				(text) => `>  ${text.replace(/ \^/u, ` edit ${index}\t ^`)}  `,
			);
			markdown = edited.markdown;
			userTexts.push(edited.userText);
		}
		const written = roundTrip(
			markdown,
			userTexts.map((text) => text.trimEnd()),
		);
		const writtenLines = written.split("\n");
		for (const text of userTexts) {
			expect(text).toEndWith("  ");
			expect(writtenLines).toContain(text);
		}
		expectUniqueIds(written);
	});

	it("drops the Block ID of a header unsealed by a line typed above it", () => {
		const typed = typeUnder(canonical, "%%tf:header@", "Before the header");
		const written = roundTrip(typed, [
			`Before the header\n${MUTTER_HEADER}`,
		]);
		expectUniqueIds(written);
	});

	it("keeps a Block ID a user types under an intact rendering", () => {
		const typed = typeUnder(canonical, idLines.header, "My line ^r-0000");
		const written = roundTrip(typed, ["My line ^r-0000"]);
		expectUniqueIds(written);
	});

	it("keeps text typed between a marker and its rendering", () => {
		const typed = typeUnder(canonical, "%%tf:tags@", "Before the tags");
		roundTrip(typed, [
			`Before the tags\n${title("tags", "Tags")}\n#noun #fem`,
		]);
	});

	it("still recognises its renderings with CRLF line endings", () => {
		const crlf = canonical.replaceAll("\n", "\r\n");
		const parsed = parseDe(crlf);
		expect(serializeDocument(parsed.document)).toBe(crlf);
		const blocks = parsed.document.parts.flatMap((part) => part.blocks);
		expect(blocks.filter((block) => block.type === "freeform")).toEqual([]);
	});
});

describe("projections", () => {
	it("renders tags, inflection and inverse relations from caller hooks", () => {
		const markdown = serialize(undefined, nounData, {
			projections: {
				inflection: ({ entry }) =>
					`| Nom | ${pluralOf(entry.reading)} |\n\n| Gen | x |`,
				inverseRelations: ({ entry }) => [
					{
						provenance: "inferred",
						relation: "hyponym",
						source: entry.reading as never,
						target: verbData.lemmaRecord.lemma as never,
					},
				],
				tags: () => ["noun", "fem"],
			},
		});
		const unsealed = markdown.replace(/@[0-9]+:[0-9a-f]{8}/gu, "");
		expect(markdown).toContain("%%tf:tags@2:");
		expect(unsealed).toContain(
			`%%tf:tags%%\n${title("tags", "Tags")}\n#noun #fem`,
		);
		// The inverse relation joins the direct ones under one title.
		expect(unsealed).toContain(
			"%%tf:inverse_relation%%\n⊂ [[Worter/de/Lexeme/VERB/auf/aufstehen|aufstehen]]",
		);
		expect(unsealed).toContain(
			`%%tf:inflection%%\n${title("flexion", "Flexion")}\n| Nom | Mütter |\n| Gen | x |`,
		);
		expect(validData(markdown)).toEqual(normalized(nounData));
	});

	it("leaves a projection out when its hook is absent", () => {
		const markdown = serialize(undefined, nounData);
		expect(markdown).not.toContain("%%tf:inflection");
		expect(markdown).not.toContain("%%tf:inverse_relation");
		expect(markdown).not.toContain("%%tf:tags");
	});

	it("links a pending relation's target and a morpheme Shadow at their Crossroad paths", () => {
		const pending = serialize(undefined, nounData).replace(
			/@[0-9]+:[0-9a-f]{8}/gu,
			"",
		);
		expect(pending).toContain(
			"[[Worter/e/elt/elter/elternteil|Elternteil]]",
		);
		expect(pending).toContain("≠ [[Worter/v/vat/vater/vater|Vater]]");
		expect(pending).not.toContain("Shadow/");
		const morphemes = serialize(undefined, verbData);
		expect(morphemes).toContain("[[Worter/s/ste/stehe/stehen|stehen]]");
	});

	it("takes a custom link renderer and header", () => {
		const markdown = serialize(undefined, nounData, {
			projections: {
				header: () => "Custom header",
				links: { lemma: (lemma) => `[[${lemma.canonicalForm}]]` },
			},
		});
		expect(markdown).toContain("= [[Mama]]");
		expect(markdown).toMatch(
			/%%tf:header@1:[0-9a-f]{8}%%\nCustom header \^r-[0-9a-f]{8}\n/u,
		);
	});
});

describe("Block IDs", () => {
	it("hash readingIdentityKey and SurfaceId with SHA-256, 8 hex digits", () => {
		expect(sha256Hex("")).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
		expect(sha256Hex("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
		expect(sha256Hex("ü".repeat(100))).toHaveLength(64);
		const ids = blockIdsOf(nounData);
		const [mother] = nounData.readingEntries;
		if (mother === undefined) throw new Error("fixture");
		const key = readingIdentityKey(mother.reading);
		expect(ids.readings.get(key)).toBe(`r-${sha256Hex(key).slice(0, 8)}`);
		expect(readingBlockId(mother.reading)).toBe(
			ids.readings.get(key) ?? "",
		);
		const [surface] = nounData.ownedSurfaceEntries;
		if (surface === undefined) throw new Error("fixture");
		expect(ids.surfaces.get(surface.id)).toBe(
			`s-${sha256Hex(surface.id).slice(0, 8)}`,
		);
		expect(ids.targets.get(ids.readings.get(key) ?? "")).toEqual({
			key,
			scope: "reading",
		});
	});

	it("lengthens colliding IDs deterministically", () => {
		const digest = (key: string) =>
			({
				a: "aaaaaaaa1111aaaa",
				b: "aaaaaaaa1111bbbb",
				c: "aaaaaaaa2222cccc",
				d: "dddddddd00000000",
			})[key] ?? "";
		const forward = assignBlockIds("r-", ["a", "b", "c", "d"], digest);
		const backward = assignBlockIds("r-", ["d", "c", "b", "a"], digest);
		expect(Object.fromEntries(forward)).toEqual({
			a: "r-aaaaaaaa1111aaaa",
			b: "r-aaaaaaaa1111bbbb",
			c: "r-aaaaaaaa2222",
			d: "r-dddddddd",
		});
		expect(Object.fromEntries(backward)).toEqual(
			Object.fromEntries(forward),
		);
	});
});
