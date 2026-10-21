import { describe, expect, it } from "bun:test";
import { syncretize } from "dumling";
import {
	caseFold,
	crossroadNotePath,
	FOREIGN_READING_MARKER,
	findPathCollisions,
	lemmaNotePath,
	NAME_SEGMENT_FALLBACK,
	type ParsedNotePath,
	parseNotePath,
	pathCollisionKey,
	RESERVED_NAME_PREFIX,
	readingNotePath,
	shardFolders,
	toNameSegment,
} from "../src";
import {
	acceptsEmojiDescription,
	type DeLemma,
	lemma,
	pick,
	randomText,
	reading,
	seeded,
} from "./path-support";

const utf8 = (text: string) => new TextEncoder().encode(text).length;
const graphemes = (text: string) =>
	Array.from(
		new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
			text,
		),
		({ segment }) => segment,
	);

const noun = (canonicalForm: string, gender = "Masc") =>
	lemma("Lexeme", "NOUN", canonicalForm, { gender });
const foreign = (canonicalForm: string, sourceLang = "en") =>
	lemma("Foreign", "Foreign", canonicalForm, { sourceLang });
const pronoun = (canonicalForm: string, core: Record<string, unknown>) =>
	lemma("Lexeme", "PRON", canonicalForm, {
		case: null,
		gender: null,
		number: null,
		person: null,
		polite: null,
		poss: null,
		pronType: null,
		...core,
	});
const ihm = (gender: "Masc" | "Neut") =>
	pronoun("ihm", {
		case: "Dat",
		gender,
		number: "Sing",
		person: "3",
		pronType: "Prs",
	});

const fahrer = noun("Fahrer");

function parsed(path: string): ParsedNotePath {
	const result = parseNotePath(path);
	if (!result.ok) throw new Error(`${path}: ${result.error.reason}`);
	return result.value;
}

const setFeatures = (core: Readonly<Record<string, unknown>>) =>
	Object.fromEntries(
		Object.entries(core).filter(
			([, value]) => value !== null && value !== undefined,
		),
	);

describe("the map's example", () => {
	it("spells Fahrer's Lemma, Reading and Crossroad notes", () => {
		expect(lemmaNotePath(fahrer).path).toBe(
			"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer.md",
		);
		expect(readingNotePath(reading(fahrer, "🚗")).path).toBe(
			"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/🚗 Fahrer.md",
		);
		expect(crossroadNotePath("Fahrer", "de").path).toBe(
			"Worter/f/fah/fahre/fahrer.md",
		);
		expect(crossroadNotePath("Fahrern", "de").path).toBe(
			"Worter/f/fah/fahre/fahrern.md",
		);
	});
});

describe("lemmaNotePath", () => {
	const examples: readonly [string, DeLemma][] = [
		["Worter/de/Lexeme/NOUN/Masc/t/tag/tag/Tag.md", noun("Tag")],
		[
			"Worter/de/Lexeme/PRON/Prs/3/Masc/Sing/Dat/i/ihm/ihm/ihm.md",
			ihm("Masc"),
		],
		[
			"Worter/de/Lexeme/PRON/Prs/3/~/Sing/Dat/i/ihm/ihm/ihm.md",
			syncretize([ihm("Masc"), ihm("Neut")]),
		],
		[
			"Worter/de/Lexeme/PRON/Prs/3/_/Plur/Nom/_/Form/s/sie/sie/Sie.md",
			pronoun("Sie", {
				case: "Nom",
				number: "Plur",
				person: "3",
				polite: "Form",
				pronType: "Prs",
			}),
		],
		[
			"Worter/de/Lexeme/NOUN/Masc+Neut/b/bal/balg/Balg.md",
			lemma("Lexeme", "NOUN", "Balg", {
				gender: { mixed: ["Masc", "Neut"] },
			}),
		],
		[
			"Worter/de/Lexeme/VERB/über/ü/übe/übers/übersetzen.md",
			lemma("Lexeme", "VERB", "übersetzen", {
				hasSepPrefix: "über",
				lexicallyReflexive: null,
			}),
		],
		[
			"Worter/de/Lexeme/VERB/_/Acc/s/sch/schäm/schämen.md",
			lemma("Lexeme", "VERB", "schämen", {
				hasSepPrefix: null,
				lexicallyReflexive: "Acc",
			}),
		],
		[
			"Worter/de/Lexeme/ADJ/comparable/s/sch/schön/schön.md",
			lemma("Lexeme", "ADJ", "schön", { comparable: "Yes" }),
		],
		[
			"Worter/de/Lexeme/ADP/m/mit/mit/mit.md",
			lemma("Lexeme", "ADP", "mit"),
		],
		[
			"Worter/de/Lexeme/NOUN/Fem/b/bes/bestä/Bestätigung.md",
			noun("Bestätigung", "Fem"),
		],
		[
			"Worter/de/Locution/VERB/s/sic/sichi/sich in Acht nehmen.md",
			lemma("Locution", "VERB", "sich in Acht nehmen"),
		],
		[
			"Worter/de/Locution/ADV/a/auf/aufje/auf jeden Fall.md",
			lemma("Locution", "ADV", "auf jeden Fall", { comparable: null }),
		],
		[
			"Worter/de/Saying/Saying/w/wer/werra/Wer rastet, der rostet.md",
			lemma("Saying", "Saying", "Wer rastet, der rostet"),
		],
		[
			"Worter/de/Morpheme/Prefix/auf/a/auf/auf/auf.md",
			lemma("Morpheme", "Prefix", "auf", { hasSepPrefix: "auf" }),
		],
		[
			"Worter/de/Morpheme/Suffix/-/-ch/-chen/-chen.md",
			lemma("Morpheme", "Suffix", "-chen"),
		],
		[
			"Worter/de/Foreign/Foreign/en/w/wee/weeke/weekend.md",
			foreign("weekend"),
		],
		[
			"Worter/de/Foreign/Foreign/fr/c/c'e/c'est/c'est la vie.md",
			foreign("c'est la vie", "fr"),
		],
		[
			"Worter/de/Foreign/Foreign/nl/'/'s-/'s-he/'s-Hertogenbosch.md",
			foreign("'s-Hertogenbosch", "nl"),
		],
		[
			"Worter/de/Lexeme/ADJ/3/3d/3d/3D.md",
			lemma("Lexeme", "ADJ", "3D", { comparable: null }),
		],
		["Worter/de/Lexeme/PUNCT/…/…/…/….md", lemma("Lexeme", "PUNCT", "…")],
		["Worter/de/Lexeme/PRON/e/er/er/er.md", pronoun("er", {})],
		["Worter/de/Lexeme/NOUN/Neut/k/k/k/k.md", noun("k", "Neut")],
		["Worter/de/Lexeme/NOUN/Fem/m/maß/maße/Maße.md", noun("Maße", "Fem")],
		[
			"Worter/de/Lexeme/NOUN/Fem/m/mas/masse/Masse.md",
			noun("Masse", "Fem"),
		],
		["Worter/de/Lexeme/NOUN/Fem/m/maß/maße/MAẞE.md", noun("MAẞE", "Fem")],
		["Worter/de/Lexeme/NOUN/Neut/c/c/c/C.md", noun("C#", "Neut")],
		[
			"Worter/de/Foreign/Foreign/es/c/@con/@con/@con.md",
			foreign("con", "es"),
		],
		["Worter/de/Foreign/Foreign/en/n/net/net/NET.md", foreign(".NET")],
	];

	for (const [expected, source] of examples) {
		it(`spells ${expected}`, () => {
			expect(lemmaNotePath(source).path).toBe(expected);
		});

		it(`parses ${expected} back as a Lemma note`, () => {
			const value = parsed(expected);
			if (value.type !== "lemma") throw new Error(value.type);
			expect({
				core: setFeatures(value.coreFeatures),
				family: value.family,
				kind: value.kind,
				name: value.name,
				syncretic: value.syncretic,
			}).toEqual({
				core: setFeatures(source.coreFeatures),
				family: source.family,
				kind: source.kind,
				name: toNameSegment(source.canonicalForm),
				syncretic: "syncretic" in source ? source.syncretic : undefined,
			});
		});
	}

	it("keeps ß, ẞ and umlauts, and writes NFC", () => {
		const path = lemmaNotePath(noun("Größe", "Fem")).path;
		expect(path).toBe("Worter/de/Lexeme/NOUN/Fem/g/grö/größe/Größe.md");
		expect(path).toBe(path.normalize("NFC"));
	});

	it("spells a text slot that would read as a slot symbol with @", () => {
		// dumling rejects these values; the path stays unambiguous anyway.
		const odd = (sourceLang: string) =>
			lemmaNotePath({
				canonicalForm: "x",
				coreFeatures: { sourceLang },
				family: "Foreign",
				kind: "Foreign",
				language: "de",
			}).path;
		expect(odd("_")).toBe("Worter/de/Foreign/Foreign/@_/x/x/x/x.md");
		expect(odd("~")).toBe("Worter/de/Foreign/Foreign/@~/x/x/x/x.md");
		expect(odd("..")).toBe("Worter/de/Foreign/Foreign/@/x/x/x/x.md");
		expect(odd("a:b")).toBe("Worter/de/Foreign/Foreign/ab/x/x/x/x.md");
		const value = parsed(odd("_"));
		expect(value.type === "lemma" && value.coreFeatures).toEqual({
			sourceLang: "_",
		});
	});

	it("caps a long name at 252 bytes, so the file name fits 255", () => {
		const long = lemma(
			"Saying",
			"Saying",
			"Wer anderen eine Grube gräbt, fällt selbst hinein "
				.repeat(8)
				.trim(),
		);
		const { basename, path } = lemmaNotePath(long);
		expect(utf8(`${basename}.md`)).toBeLessThanOrEqual(255);
		expect(basename.startsWith("Wer anderen eine Grube")).toBe(true);
		expect(parsed(path).type).toBe("lemma");
	});
});

describe("readingNotePath", () => {
	it("names a Reading note <emoji> <name> in its Lemma note's folder", () => {
		const lemmaPath = lemmaNotePath(fahrer);
		const path = readingNotePath(reading(fahrer, "🚗"));
		expect(path.folders).toEqual(lemmaPath.folders);
		expect(path.basename).toBe("🚗 Fahrer");
	});

	it("takes a multi-emoji description whole", () => {
		const bank = noun("Bank", "Fem");
		expect(readingNotePath(reading(bank, "🏦💰")).path).toBe(
			"Worter/de/Lexeme/NOUN/Fem/b/ban/bank/🏦💰 Bank.md",
		);
	});

	it("strips variation selectors and skin tones, as readingIdentityKey does", () => {
		const maus = noun("Maus", "Fem");
		expect(readingNotePath(reading(maus, "🖱️")).basename).toBe("🖱 Maus");
		const geben = lemma("Lexeme", "VERB", "geben", {
			hasSepPrefix: null,
			lexicallyReflexive: null,
		});
		expect(readingNotePath(reading(geben, "🫳🏽")).basename).toBe(
			"🫳 geben",
		);
		expect(readingNotePath(reading(fahrer, "🚗️")).path).toBe(
			readingNotePath(reading(fahrer, "🚗")).path,
		);
	});

	it("gives one Reading note per Reading of a Lemma", () => {
		const mutter = noun("Mutter", "Fem");
		expect(readingNotePath(reading(mutter, "👩")).basename).toBe(
			"👩 Mutter",
		);
		expect(readingNotePath(reading(mutter, "🔩")).basename).toBe(
			"🔩 Mutter",
		);
	});

	it("names a Foreign Reading ∅ <name>", () => {
		expect(readingNotePath(reading(foreign("weekend"))).path).toBe(
			"Worter/de/Foreign/Foreign/en/w/wee/weeke/∅ weekend.md",
		);
	});

	it("caps a long Reading note's name too", () => {
		const long = lemma("Saying", "Saying", "abcdefghij ".repeat(30).trim());
		const { basename, path } = readingNotePath(reading(long, "🧱"));
		expect(utf8(`${basename}.md`)).toBeLessThanOrEqual(255);
		expect(parsed(path).type).toBe("reading");
	});
});

describe("crossroadNotePath", () => {
	it("gives Morgen and morgen one lowercase Crossroad", () => {
		expect(crossroadNotePath("Morgen", "de").path).toBe(
			"Worter/m/mor/morge/morgen.md",
		);
		expect(crossroadNotePath("morgen", "de").path).toBe(
			"Worter/m/mor/morge/morgen.md",
		);
	});

	it("gives Maße and Masse two, and MAẞE the one of Maße", () => {
		expect(crossroadNotePath("Maße", "de").path).toBe(
			"Worter/m/maß/maße/maße.md",
		);
		expect(crossroadNotePath("Masse", "de").path).toBe(
			"Worter/m/mas/masse/masse.md",
		);
		expect(crossroadNotePath("MAẞE", "de").path).toBe(
			crossroadNotePath("Maße", "de").path,
		);
	});

	it("shards short words and phrases like Lemma notes", () => {
		expect(crossroadNotePath("Tag", "de").path).toBe(
			"Worter/t/tag/tag/tag.md",
		);
		expect(crossroadNotePath("sich in Acht nehmen", "de").path).toBe(
			"Worter/s/sic/sichi/sich in acht nehmen.md",
		);
	});

	it("writes NFC for an NFD spelling", () => {
		expect(crossroadNotePath("Mütter", "de").path).toBe(
			"Worter/m/müt/mütte/mütter.md",
		);
	});

	it("names a spelling left with nothing @", () => {
		expect(crossroadNotePath("???", "de").path).toBe("Worter/@/@/@/@.md");
	});
});

describe("shardFolders", () => {
	it("repeats a short word in full", () => {
		expect(shardFolders("Tag", "de")).toEqual(["t", "tag", "tag"]);
		expect(shardFolders("er", "de")).toEqual(["e", "er", "er"]);
		expect(shardFolders("k", "de")).toEqual(["k", "k", "k"]);
	});

	it("drops whitespace and what toNameSegment drops before counting", () => {
		expect(shardFolders("Vorsicht walten lassen", "de")).toEqual([
			"v",
			"vor",
			"vorsi",
		]);
		expect(shardFolders("#hashtag", "de")).toEqual(["h", "has", "hasht"]);
		expect(shardFolders("...abc", "de")).toEqual(["…", "…ab", "…abc"]);
		expect(shardFolders(". .abc", "de")).toEqual(["a", "abc", "abc"]);
		expect(shardFolders("z.B.", "de")).toEqual(["z", "z.b", "z.b"]);
	});

	it("counts graphemes, not code points", () => {
		expect(shardFolders("👨‍👩‍👧🚗x", "de")).toEqual([
			"👨‍👩‍👧",
			"👨‍👩‍👧🚗x",
			"👨‍👩‍👧🚗x",
		]);
		expect(shardFolders("Mütter", "de")).toEqual(["m", "müt", "mütte"]);
	});

	it("never spells a language folder at the first level", () => {
		const languages = ["de", "en", "he"].map(caseFold);
		for (let code = 0; code <= 0x10ffff; code++) {
			if (code >= 0xd800 && code <= 0xdfff) continue;
			if (languages.includes(caseFold(String.fromCodePoint(code))))
				throw new Error(`U+${code.toString(16)} folds to a language`);
		}
		const random = seeded(7);
		const alphabet = [
			"d",
			"e",
			"D",
			"E",
			"ﬁ",
			"ß",
			" ",
			".",
			"#",
			"🇩🇪",
			"é",
			"@",
		];
		for (let run = 0; run < 500; run++) {
			const [first] = shardFolders(randomText(random, alphabet, 8), "de");
			expect(graphemes(first).length).toBe(1);
			expect(languages).not.toContain(caseFold(first));
		}
	});
});

describe("collisions", () => {
	const claim = (path: string, owner: string) => ({ owner, path });

	it("keeps Maße and Masse apart through their shard folders", () => {
		const maße = noun("Maße", "Fem");
		const masse = noun("Masse", "Fem");
		expect(
			findPathCollisions([
				claim(lemmaNotePath(maße).path, "Maße"),
				claim(lemmaNotePath(masse).path, "Masse"),
				claim(crossroadNotePath("Maße", "de").path, "maße"),
				claim(crossroadNotePath("Masse", "de").path, "masse"),
			]),
		).toEqual([]);
	});

	it("reports C# and C, which toNameSegment spells alike", () => {
		const collisions = findPathCollisions([
			claim(lemmaNotePath(noun("C#", "Neut")).path, "C#"),
			claim(lemmaNotePath(noun("C", "Neut")).path, "C"),
		]);
		expect(collisions).toMatchObject([
			{ component: "file", key: "worter/de/lexeme/noun/neut/c/c/c/c.md" },
		]);
	});

	it("reports two Lemmas whose names differ only where the file system folds", () => {
		// dumling keeps ß and ss apart, APFS doesn't.
		const collisions = findPathCollisions([
			claim("Worter/de/Lexeme/NOUN/Fem/m/maß/maße/Maße.md", "Maße"),
			claim("Worter/de/Lexeme/NOUN/Fem/m/maß/maße/Masse.md", "Masse"),
		]);
		expect(collisions).toHaveLength(1);
	});

	it("reports two keycap Readings that lose their # and *", () => {
		const one = noun("Taste", "Fem");
		const collisions = findPathCollisions([
			claim(readingNotePath(reading(one, "#️⃣")).path, "#"),
			claim(readingNotePath(reading(one, "*️⃣")).path, "*"),
		]);
		expect(collisions).toHaveLength(1);
	});

	it("gives MAẞE and Maße one path key, since they are one Lemma", () => {
		expect(pathCollisionKey(lemmaNotePath(noun("MAẞE", "Fem")).path)).toBe(
			pathCollisionKey(lemmaNotePath(noun("Maße", "Fem")).path),
		);
	});
});

describe("the Foreign Reading marker", () => {
	it("is no Emoji Description dumling accepts, nor toNameSegment's @", () => {
		expect(acceptsEmojiDescription(fahrer, FOREIGN_READING_MARKER)).toBe(
			false,
		);
		expect(acceptsEmojiDescription(fahrer, "🚗")).toBe(true);
		expect(FOREIGN_READING_MARKER).not.toBe(RESERVED_NAME_PREFIX);
		expect(FOREIGN_READING_MARKER).not.toBe(NAME_SEGMENT_FALLBACK);
		expect(toNameSegment(FOREIGN_READING_MARKER)).toBe(
			FOREIGN_READING_MARKER,
		);
		expect(caseFold(FOREIGN_READING_MARKER)).toBe(FOREIGN_READING_MARKER);
	});

	/**
	 * The Lemma that could share a Reading note's path is the one named
	 * `<prefix> <name>`, in the same route. Its shard folders start with the
	 * prefix, so it lands in the Reading's folder only when the Reading's
	 * Lemma itself shards as five graphemes of the prefix repeated.
	 */
	const meetsLemma = (prefix: string, of: DeLemma): boolean => {
		const [, , five] = lemmaNotePath(of).folders.slice(-3);
		const repeated = graphemes(prefix.repeat(5)).slice(0, 5).join("");
		return caseFold(five ?? "") === caseFold(repeated);
	};

	const alphabet = [
		"a",
		"b",
		"z",
		"ß",
		"ü",
		"W",
		" ",
		"∅",
		"∅∅",
		"🚗",
		"🏦",
		"-",
		"'",
		".",
		"#",
		"@",
		"C",
		"…",
		",",
	];
	const emojis = ["🚗", "🏦", "🏦💰", "👩", "🔩", "🧱🚗"];

	it("never puts a Reading note on another note's path but where the Lemma shards as its prefix", () => {
		const random = seeded(1105);
		let checked = 0;
		for (let run = 0; run < 1500; run++) {
			const form = randomText(random, alphabet, 10).trim();
			if (form === "") continue;
			const isForeign = run % 2 === 0;
			const of = isForeign ? foreign(form) : noun(form);
			const prefix = isForeign
				? FOREIGN_READING_MARKER
				: pick(random, emojis);
			const read = readingNotePath(
				isForeign ? reading(of) : reading(of, prefix),
			);
			const rival = isForeign
				? foreign(`${prefix} ${form}`)
				: noun(`${prefix} ${form}`);
			const lemmaPath = lemmaNotePath(rival);
			const collide =
				pathCollisionKey(read.path) ===
				pathCollisionKey(lemmaPath.path);
			expect([form, collide]).toEqual([form, meetsLemma(prefix, of)]);
			expect(pathCollisionKey(read.path)).not.toBe(
				pathCollisionKey(lemmaNotePath(of).path),
			);
			checked++;
		}
		expect(checked).toBeGreaterThan(1000);
	});

	it("meets a Lemma that shards as ∅∅∅∅∅, and no shorter run", () => {
		const five = foreign("∅∅∅∅∅x");
		expect(readingNotePath(reading(five)).path).toBe(
			lemmaNotePath(foreign("∅ ∅∅∅∅∅x")).path,
		);
		const four = foreign("∅∅∅∅x");
		expect(readingNotePath(reading(four)).path).not.toBe(
			lemmaNotePath(foreign("∅ ∅∅∅∅x")).path,
		);
	});

	it("keeps Reading notes apart unless their Lemma notes collide", () => {
		const random = seeded(2024);
		const claims: { path: string; owner: string; lemmaKey: string }[] = [];
		for (let run = 0; run < 400; run++) {
			const form = randomText(random, alphabet, 6).trim();
			if (form === "") continue;
			const of = noun(form);
			const emoji = pick(random, emojis);
			claims.push({
				lemmaKey: pathCollisionKey(lemmaNotePath(of).path),
				owner: `${emoji}|${form}`,
				path: readingNotePath(reading(of, emoji)).path,
			});
		}
		const byOwner = new Map(claims.map((entry) => [entry.owner, entry]));
		for (const { first, second, component } of findPathCollisions(claims)) {
			if (component !== "file") continue;
			const left = byOwner.get(first.owner);
			const right = byOwner.get(second.owner);
			expect(left?.owner.split("|")[0]).toBe(right?.owner.split("|")[0]);
			expect(left?.lemmaKey).toBe(right?.lemmaKey);
		}
	});
});

describe("parseNotePath", () => {
	it("recognizes a Reading note and the Lemma note it belongs to", () => {
		const value = parsed(
			"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/🚗 Fahrer.md",
		);
		expect(value).toEqual({
			coreFeatures: { gender: "Masc" },
			emojiDescription: "🚗",
			family: "Lexeme",
			kind: "NOUN",
			language: "de",
			lemmaName: "Fahrer",
			name: "🚗 Fahrer",
			shards: ["f", "fah", "fahre"],
			type: "reading",
		});
	});

	it("recognizes a Foreign Reading note by its marker", () => {
		const value = parsed(
			"Worter/de/Foreign/Foreign/en/w/wee/weeke/∅ weekend.md",
		);
		expect(value).toMatchObject({
			emojiDescription: null,
			lemmaName: "weekend",
			type: "reading",
		});
		expect(
			parsed(readingNotePath(reading(foreign("con", "es"))).path),
		).toMatchObject({
			lemmaName: "@con",
			type: "reading",
		});
	});

	it("recognizes a Crossroad note and a stray", () => {
		expect(parsed("Worter/f/fah/fahre/fahrer.md")).toEqual({
			name: "fahrer",
			shards: ["f", "fah", "fahre"],
			type: "crossroad",
		});
		expect(parsed("Worter/@/@/@/@.md")).toMatchObject({
			type: "crossroad",
		});
		expect(parsed(crossroadNotePath("con", "de").path)).toMatchObject({
			name: "@con",
			type: "crossroad",
		});
		expect(parsed("Worter/Untitled 3.md")).toEqual({
			name: "Untitled 3",
			type: "stray",
		});
	});

	it("recognizes every note the module spells", () => {
		const random = seeded(4242);
		const alphabet = [
			"a",
			"e",
			"ß",
			"Ü",
			"x",
			" ",
			"-",
			"'",
			"…",
			"#",
			".",
			"C",
			"on",
			"@",
			"🚗",
			"∅",
		];
		for (let run = 0; run < 600; run++) {
			const form = randomText(random, alphabet, 9).trim();
			if (form === "") continue;
			const isForeign = run % 3 === 0;
			const of = isForeign ? foreign(form) : noun(form, "Fem");
			const lemmaPath = lemmaNotePath(of).path;
			const lemmaParse = parsed(lemmaPath);
			expect([form, lemmaParse.type]).toEqual([form, "lemma"]);
			const read = readingNotePath(
				isForeign ? reading(of) : reading(of, "🔩"),
			).path;
			const readParse = parsed(read);
			expect([form, readParse.type]).toEqual([form, "reading"]);
			expect([
				form,
				parsed(crossroadNotePath(form, "de").path).type,
			]).toEqual([form, "crossroad"]);
		}
	});

	const invalid = [
		"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer.txt",
		"Other/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer.md",
		"Worter/en/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer.md",
		"Worter/de/Lexeme/WORD/f/fah/fahre/Fahrer.md",
		"Worter/de/Lexeme/NOUN/Masc/_/f/fah/fahre/Fahrer.md",
		"Worter/de/Lexeme/NOUN/Masc/Fahrer.md",
		"Worter/de/Lexeme/NOUN/Masc/f/fah/fahrt/Fahrer.md",
		"Worter/de/Lexeme/NOUN/Masc/F/fah/fahre/Fahrer.md",
		"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fah?rer.md",
		"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/ Fahrer.md",
		"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/∅ Fahrer.md",
		"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/🚗️ Fahrer.md",
		"Worter/de/Foreign/Foreign/en/w/wee/weeke/🚗 weekend.md",
		"Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Mütter.md",
		"Worter/f/fah/fahre/Fahrer.md",
		"Worter/f/fah/fahrer.md",
		"Worter/f/fah/fahrt/fahrer.md",
		"Worter/fa/fah/fahre/fahrer.md",
		"Worter/de/Lexeme.md",
	];
	for (const path of invalid)
		it(`rejects ${path}`, () => {
			const result = parseNotePath(path);
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error._tag).toBe("InvalidNotePath");
		});
});
