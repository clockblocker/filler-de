import { describe, expect, it } from "bun:test";
import { readingIdentityKey } from "dumling";
import {
	assignBlockIds,
	blockIdsOf,
	parseDocument,
	readingBlockId,
	serialize,
	serializeDocument,
} from "../src";
import { sha256Hex } from "../src/hash";
import { familyFixtures, nounData, syncretismData, verbData } from "./fixtures";
import { normalized, parseDe, validData } from "./helpers";

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
		expect(aufstehen?.knowledge?.preterite).toEqual(["stand auf"]);
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
			data.readingEntries.map((entry) => entry.knowledge?.plural),
		).toEqual([["Mütter"], ["Muttern"]]);
		expect(data.ownedSurfaceEntries).toHaveLength(1);
		expect(
			data.pendingRelations.map((record) => record.pending.relation),
		).toEqual(["hypernym", "antonym"]);
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
		serialize(undefined, nounData).split("\n")[2] ?? "",
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
			`${note}${serialize(undefined, nounData).split("\n").slice(4).join("\n")}`,
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

	it("keeps a Reading part's freeform with its Reading, last in the part", () => {
		const canonical = serialize(undefined, nounData);
		const nut = nounData.readingEntries[1];
		if (nut === undefined) throw new Error("fixture");
		const nutId = blockIdsOf(nounData).readings.get(
			readingIdentityKey(nut.reading),
		);
		const edited = canonical.replace(
			`%%tf-part:reading ${nutId}%%\n\n`,
			`%%tf-part:reading ${nutId}%%\n\nA note about nuts\n\n`,
		);
		const parsed = parseDe(edited);
		if (!parsed.data.ok) throw new Error("invalid");
		const written = serialize(parsed.document, parsed.data.data);
		const nutPart =
			written
				.split(`%%tf-part:reading ${nutId}%%`)[1]
				?.split("%%tf-part:")[0] ?? "";
		expect(nutPart.trimEnd().endsWith("A note about nuts")).toBe(true);
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
		const [marker, ...blocks] = (part ?? "").split("\n\n");
		const shuffled = `${head}%%tf-part:reading${[marker, ...blocks.filter(Boolean).reverse()].join("\n\n")}\n`;
		expect(shuffled).not.toBe(canonical);
		const parsed = parseDe(shuffled);
		if (!parsed.data.ok) throw new Error("invalid");
		expect(parsed.data.data).toEqual(normalized(verbData));
		expect(serialize(parsed.document, parsed.data.data)).toBe(canonical);
	});

	it("never reads projection Blocks: editing or deleting them changes no data", () => {
		const canonical = serialize(undefined, nounData);
		const edited = canonical
			.replace("👩 **die Mutter** /ˈmʊtɐ/", "🦖 **der Vater**")
			.replace("%%tf:tags%%\n*Tags*: #de/noun\n\n", "");
		expect(validData(edited)).toEqual(validData(canonical));
	});

	it("ignores edits to a serialized Block's visible rendering", () => {
		const canonical = serialize(undefined, nounData);
		const edited = canonical.replace(
			"*Translation*: en: nut",
			"*Translation*: en: bolt",
		);
		expect(edited).not.toBe(canonical);
		expect(validData(edited)).toEqual(validData(canonical));
	});
});

describe("projections", () => {
	it("renders tags, inflection and inverse relations from caller hooks", () => {
		const markdown = serialize(undefined, nounData, {
			projections: {
				inflection: ({ entry }) =>
					`| Nom | ${entry.knowledge?.plural?.toString() ?? ""} |\n\n| Gen | x |`,
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
		expect(markdown).toContain("%%tf:tags%%\n*Tags*: #noun #fem");
		expect(markdown).toContain(
			"%%tf:inverse_relation%%\n*Projected*: hyponym: [[Worter/de/Lexeme/VERB/auf/aufstehen|aufstehen]]",
		);
		expect(markdown).toContain(
			"%%tf:inflection%%\n*Inflection*\n| Nom | Mütter |\n| Gen | x |",
		);
		expect(validData(markdown)).toEqual(normalized(nounData));
	});

	it("leaves a projection out when its hook is absent", () => {
		const markdown = serialize(undefined, nounData);
		expect(markdown).not.toContain("%%tf:inflection");
		expect(markdown).not.toContain("%%tf:inverse_relation");
		expect(markdown).not.toContain("%%tf:tags");
	});

	it("takes a custom link renderer and header", () => {
		const markdown = serialize(undefined, nounData, {
			projections: {
				header: () => "Custom header",
				links: { lemma: (lemma) => `[[${lemma.canonicalForm}]]` },
			},
		});
		expect(markdown).toContain("synonym: [[Mama]]");
		expect(markdown).toMatch(
			/%%tf:header%%\nCustom header \^r-[0-9a-f]{8}\n/u,
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
