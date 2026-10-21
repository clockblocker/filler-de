/**
 * Where a freeform Block of an old note goes (#117): the Reading note of
 * its sense. Each Reading note is named `<emoji> <Lemma spelling>.md`, and
 * each old entry's header carries its sense emojis (`🚗 🧑‍✈️ der
 * [[Fahrer]]`), so a Block goes to the one regenerated Reading whose emoji
 * its entry names. When the Lemma regenerated a single Reading, that one
 * takes it. When the sense stays ambiguous, the Block goes to the Lemma
 * note; when even the Lemma is, it is not placed.
 */

/** A regenerated Reading: its note, and its Lemma's note. */
export type RegeneratedNote = {
	readonly readingPath: string;
	readonly lemmaPath: string;
};

export type FreeformTarget =
	| { readonly _tag: "Reading"; readonly path: string }
	| { readonly _tag: "Lemma"; readonly path: string }
	| { readonly _tag: "None"; readonly reason: string };

const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });

/** An emoji as Reading identity compares it: no variation selector or skin tone. */
const emojiKey = (emoji: string): string =>
	emoji
		.normalize("NFC")
		.replace(/\p{Variation_Selector}|\p{Emoji_Modifier}/gu, "");

const emojiKeys = (text: string): string[] =>
	[...graphemes.segment(text)]
		.map(({ segment }) => emojiKey(segment))
		.filter((key) =>
			/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(key),
		);

/** The Emoji Description a Reading note's name opens with. */
function readingEmojis(readingPath: string): string[] {
	const name = readingPath.split("/").at(-1) ?? readingPath;
	return emojiKeys(name.split(" ")[0] ?? "");
}

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`;

export function freeformTarget(
	/** The sense emojis of the old entry the Block sits under. */
	emojis: readonly string[],
	/** The notes regenerated for the Block's headword. */
	regenerated: readonly RegeneratedNote[],
): FreeformTarget {
	const readings = [
		...new Map(
			regenerated.map((note) => [note.readingPath, note]),
		).values(),
	];
	const [only] = readings;
	if (only === undefined)
		return { _tag: "None", reason: "no Reading was regenerated" };
	if (readings.length === 1)
		return { _tag: "Reading", path: only.readingPath };
	const wanted = new Set(emojis.flatMap(emojiKeys));
	const matching = readings.filter(({ readingPath }) =>
		readingEmojis(readingPath).some((key) => wanted.has(key)),
	);
	const [match] = matching;
	if (match !== undefined && matching.length === 1)
		return { _tag: "Reading", path: match.readingPath };
	const lemmas = [
		...new Set(
			(matching.length > 0 ? matching : readings).map(
				({ lemmaPath }) => lemmaPath,
			),
		),
	];
	const [lemma] = lemmas;
	if (lemma !== undefined && lemmas.length === 1)
		return { _tag: "Lemma", path: lemma };
	return {
		_tag: "None",
		reason: `its sense fits ${plural(lemmas.length, "regenerated Lemma")}`,
	};
}
