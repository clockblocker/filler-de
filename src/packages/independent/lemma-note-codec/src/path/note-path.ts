import { canonicalFormKey, readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import {
	type InvalidNotePath,
	MARKDOWN_EXTENSION,
	type NotePath,
	notePath,
	type PathLemma,
	WORTER_FOLDER,
} from "./common";
import {
	FILE_NAME_MAX_BYTES,
	graphemesOf,
	isReservedName,
	RESERVED_NAME_PREFIX,
	toNameSegment,
} from "./name-segment";
import { type ShardFolders, shardFolders } from "./shards";
import { germanSlotsOf } from "./slot-table-de";
import {
	NULL_SLOT,
	type ParsedSlots,
	parseSlots,
	slotsOrThrow,
	spellSlots,
	type TextSlotCodec,
} from "./slots";

/**
 * The Lemma, Reading and Crossroad note layout (ADR-0015):
 *
 * ```
 * Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer.md      Lemma note
 * Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/🚗 Fahrer.md   Reading note
 * Worter/f/fah/fahre/fahrer.md                          Crossroad note
 * ```
 *
 * Every folder and file name goes through `toNameSegment`, so names are
 * lossy: the real spelling lives in each note's metadata, and a path tells
 * only the kind of note. Paths are NFC. Two paths a case-insensitive file
 * system treats as one share a `pathCollisionKey`.
 */

/**
 * The name prefix of a Foreign Reading, which has no Emoji Description. It
 * is no emoji dumling accepts, nor `toNameSegment`'s `@`. A Reading note
 * named `∅ <name>` meets a Lemma note named the same only where that
 * Lemma's shard spelling starts with five `∅`, since the Lemma note's own
 * shard folders start with the `∅`; the collision key reports that case.
 */
export const FOREIGN_READING_MARKER = "∅";

const SYNCRETIC_SLOT = "~";

/**
 * A text slot, such as `hasSepPrefix`, is its value through
 * `toNameSegment`. A value that would read as the null or Syncretism slot
 * takes the reserved-name prefix: `_` is written `@_`.
 */
const NAME_TEXT: TextSlotCodec = {
	decode(folder) {
		if (folder === `${RESERVED_NAME_PREFIX}${NULL_SLOT}`) return NULL_SLOT;
		if (folder === `${RESERVED_NAME_PREFIX}${SYNCRETIC_SLOT}`)
			return SYNCRETIC_SLOT;
		return folder;
	},
	encode(value) {
		const segment = toNameSegment(value);
		return segment === NULL_SLOT || segment === SYNCRETIC_SLOT
			? `${RESERVED_NAME_PREFIX}${segment}`
			: segment;
	},
};

/**
 * The path of a German Lemma's note, which is also its base-form Surface's
 * note: `Worter/de/<Family>/<Kind>/<slots…>/<l1>/<l3>/<l5>/<name>.md`. The
 * slots spell Core Features in the route's fixed order (ADR-0013's grammar),
 * the shard folders come from the Canonical Form's `canonicalFormKey`, and
 * the name is the Canonical Form in its display casing.
 *
 * The note's metadata stays authoritative; this is its projection. It
 * throws only for a Lemma dumling would reject, such as a route or feature
 * value the slot table does not know.
 */
export function lemmaNotePath(lemma: PathLemma): NotePath {
	const slots = spellSlots(
		slotsOrThrow(lemma.family, lemma.kind),
		lemma.coreFeatures,
		NAME_TEXT,
		lemma.syncretic,
	);
	return notePath(
		[
			WORTER_FOLDER,
			lemma.language,
			lemma.family,
			lemma.kind,
			...slots,
			...shardFolders(lemma.canonicalForm, lemma.language),
		],
		toNameSegment(lemma.canonicalForm, FILE_NAME_MAX_BYTES),
	);
}

/**
 * The path of a Reading's note: `<emoji> <name>.md` in its Lemma note's
 * folder, such as `🚗 Fahrer.md`. The Emoji Description is the one
 * `readingIdentityKey` compares, without variation selectors or skin-tone
 * modifiers, so Readings that are one Reading get one path. A Foreign
 * Reading takes {@link FOREIGN_READING_MARKER}: `∅ weekend.md`.
 */
export function readingNotePath(reading: Dumling.Reading<"de">): NotePath {
	const lemmaPath = lemmaNotePath(reading.lemma);
	return notePath(
		lemmaPath.folders,
		toNameSegment(
			`${readingNamePrefix(reading)} ${lemmaPath.basename}`,
			FILE_NAME_MAX_BYTES,
		),
	);
}

/** The Emoji Description as Reading identity compares it, or `∅`. */
function readingNamePrefix(reading: Dumling.Reading<"de">): string {
	// The key is `[lemmaKey, emojiDescription | null]`; reading it back keeps
	// the normalization dumling's own.
	const [, emojiDescription] = JSON.parse(readingIdentityKey(reading)) as [
		string,
		string | null,
	];
	return emojiDescription ?? FOREIGN_READING_MARKER;
}

/**
 * The path of a spelling's Crossroad note:
 * `Worter/<l1>/<l3>/<l5>/<key>.md`, where the key is dumling's
 * `canonicalFormKey`, so the name is lowercase and keeps `ß`. `Morgen` and
 * `morgen` share one Crossroad; `Maße` and `Masse` get two.
 */
export function crossroadNotePath(
	spelling: string,
	language: Dumling.Language,
): NotePath {
	const key = canonicalFormKey(spelling, language);
	return notePath(
		[WORTER_FOLDER, ...shardFolders(key, language)],
		toNameSegment(key, FILE_NAME_MAX_BYTES),
	);
}

/** The identity a Lemma or Reading note's folders spell. */
type ParsedIdentityFolders = ParsedSlots & {
	readonly language: "de";
	readonly family: string;
	readonly kind: string;
	readonly shards: ShardFolders;
};

export type ParsedLemmaNotePath = ParsedIdentityFolders & {
	readonly type: "lemma";
	/** The file name without `.md`: the Canonical Form, as names are lossy. */
	readonly name: string;
};

export type ParsedReadingNotePath = ParsedIdentityFolders & {
	readonly type: "reading";
	readonly name: string;
	/** The name's emoji prefix, or null for a Foreign Reading's `∅`. */
	readonly emojiDescription: string | null;
	/**
	 * The name after its prefix: the Lemma note's name in the same folder,
	 * unless the 255-byte cap cut the Reading note's name short.
	 */
	readonly lemmaName: string;
};

export type ParsedCrossroadNotePath = {
	readonly type: "crossroad";
	readonly shards: ShardFolders;
	readonly name: string;
};

/**
 * A note directly in `Worter/`, as Obsidian creates one for an unresolved
 * bare link (`newFileFolderPath: Worter`). The store heals it.
 */
export type ParsedStrayNotePath = {
	readonly type: "stray";
	readonly name: string;
};

export type ParsedNotePath =
	| ParsedLemmaNotePath
	| ParsedReadingNotePath
	| ParsedCrossroadNotePath
	| ParsedStrayNotePath;

export type NotePathParse =
	| { readonly ok: true; readonly value: ParsedNotePath }
	| { readonly ok: false; readonly error: InvalidNotePath };

const PRESENTATION_MARKS = /[︎️]|\p{Emoji_Modifier}/u;

/**
 * Tells the kind of note from the path's structure alone: a Lemma, Reading
 * or Crossroad note, or a stray directly in `Worter/`. Only the canonical
 * spelling parses: every folder and name must be a `toNameSegment` fixpoint,
 * the slots must spell Core Features, and the shard folders must be the
 * name's. Names are lossy, so the spelling always comes from metadata,
 * never from the path.
 *
 * A name that splits into `<prefix> <rest>` is a Reading note when the
 * shard folders are `rest`'s; otherwise it is a Lemma note when they are
 * its own. Only a colliding pair of paths fits both, and it reads as a
 * Lemma note.
 */
export function parseNotePath(path: string): NotePathParse {
	const invalid = (reason: string): NotePathParse => ({
		error: { _tag: "InvalidNotePath", path, reason },
		ok: false,
	});
	if (path !== path.normalize("NFC")) return invalid("Not NFC");
	if (!path.endsWith(MARKDOWN_EXTENSION))
		return invalid("Not a Markdown note");
	const [root, ...folders] = path
		.slice(0, -MARKDOWN_EXTENSION.length)
		.split("/");
	const name = folders.pop();
	if (root !== WORTER_FOLDER || name === undefined)
		return invalid(`Not under ${WORTER_FOLDER}/`);
	if (toNameSegment(name, FILE_NAME_MAX_BYTES) !== name)
		return invalid("The name is not a name segment");
	if (folders.some((folder) => toNameSegment(folder) !== folder))
		return invalid("A folder is not a name segment");
	const [first, ...rest] = folders;
	if (first === undefined)
		return { ok: true, value: { name, type: "stray" } };
	if (first === "de") return parseIdentityPath(name, rest, invalid);
	if (graphemesOf(first).length !== 1)
		return invalid(
			"The first folder is neither de nor a one-grapheme shard folder",
		);
	if (rest.length !== 2)
		return invalid("A Crossroad note sits at <l1>/<l3>/<l5>/");
	const shards = [first, rest[0] ?? "", rest[1] ?? ""] as const;
	if (
		toNameSegment(canonicalFormKey(name, "de"), FILE_NAME_MAX_BYTES) !==
		name
	)
		return invalid("A Crossroad note's name is its lowercase key");
	if (!shardsOf(name, shards))
		return invalid("The shard folders are not the name's");
	return { ok: true, value: { name, shards, type: "crossroad" } };
}

function parseIdentityPath(
	name: string,
	folders: readonly string[],
	invalid: (reason: string) => NotePathParse,
): NotePathParse {
	const [family, kind, ...below] = folders;
	if (family === undefined || kind === undefined || below.length < 3)
		return invalid(
			"A Lemma note sits at <Family>/<Kind>/<slots…>/<l1>/<l3>/<l5>/",
		);
	const slots = germanSlotsOf(family, kind);
	if (slots === undefined) return invalid(`Unknown route ${family}/${kind}`);
	const [one = "", three = "", five = ""] = below.slice(-3);
	const shards = [one, three, five] as const;
	const parsedSlots = parseSlots(slots, below.slice(0, -3), NAME_TEXT);
	if (typeof parsedSlots === "string") return invalid(parsedSlots);
	const identity: ParsedIdentityFolders = {
		...parsedSlots,
		family,
		kind,
		language: "de",
		shards,
	};
	if (shardsOf(name, shards))
		return { ok: true, value: { ...identity, name, type: "lemma" } };
	const space = name.indexOf(" ");
	const prefix = name.slice(0, space);
	const lemmaName = name.slice(space + 1);
	if (space > 0 && shardsOf(lemmaName, shards)) {
		const foreign = family === "Foreign";
		if (foreign !== (prefix === FOREIGN_READING_MARKER))
			return invalid(
				foreign
					? `A Foreign Reading note's name starts with ${FOREIGN_READING_MARKER}`
					: `Only a Foreign Reading note's name starts with ${FOREIGN_READING_MARKER}`,
			);
		if (PRESENTATION_MARKS.test(prefix))
			return invalid(
				"A Reading note's emoji has no variation selectors or skin tones",
			);
		return {
			ok: true,
			value: {
				...identity,
				emojiDescription: foreign ? null : prefix,
				lemmaName,
				name,
				type: "reading",
			},
		};
	}
	return invalid("The shard folders are not the name's");
}

/**
 * Whether a name's spelling gives these shard folders. The name of a
 * reserved spelling carries the `@` prefix its shards don't, so both are
 * tried.
 */
function shardsOf(name: string, shards: ShardFolders): boolean {
	const spellings = [name];
	if (
		name.startsWith(RESERVED_NAME_PREFIX) &&
		isReservedName(name.slice(RESERVED_NAME_PREFIX.length))
	)
		spellings.push(name.slice(RESERVED_NAME_PREFIX.length));
	return spellings.some((spelling) => {
		const derived = shardFolders(spelling, "de");
		return derived.every((folder, index) => folder === shards[index]);
	});
}
