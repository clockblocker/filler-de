import type * as Dumrel from "dumrel/types";
import {
	canonicalFormBasename,
	type DecodedBasename,
	decodeBasename,
	decodeSegment,
	encodeSegment,
} from "./basename";
import {
	type InvalidNotePath,
	MARKDOWN_EXTENSION,
	type NotePath,
	notePath,
	type PathLemma,
	WORTER_FOLDER,
} from "./common";
import { germanSlotsOf } from "./slot-table-de";
import {
	NULL_SLOT,
	parseSlots,
	slotsOrThrow,
	spellSlots,
	type TextSlotCodec,
} from "./slots";

/**
 * The superseded ADR-0013 layout: one note per Lemma at its identity
 * folders with no shard folders, percent-encoded basenames, and Shadow notes
 * under `Worter/<lang>/Shadow/`. The dictionary store and the note codec
 * still write it until the Lemma, Reading and Crossroad layout (ADR-0015,
 * `note-path.ts`) replaces it (#109, #112, #113).
 */

/** The folder under `Worter/<language>/` that holds Shadow notes. */
export const SHADOW_FOLDER = "Shadow";

/** A text value of just `_` escapes it; `~` is always escaped. */
const ESCAPED_NULL_SLOT = "%5F";

const PERCENT_TEXT: TextSlotCodec = {
	decode(folder) {
		if (folder === ESCAPED_NULL_SLOT) return NULL_SLOT;
		const value = decodeSegment(folder);
		return value === "" ? undefined : value;
	},
	encode: (value) =>
		value === NULL_SLOT ? ESCAPED_NULL_SLOT : encodeSegment(value),
};

/**
 * The ADR-0013 path of a German Lemma's note:
 * `Worter/de/<Family>/<Kind>/<slots…>/<basename>.md`.
 *
 * The note's `identity` Block stays authoritative; this is its projection.
 * It throws only for a Lemma dumling would reject, such as a route or
 * feature value the slot table does not know.
 */
export function legacyLemmaNotePath(lemma: PathLemma): NotePath {
	const spelled = spellSlots(
		slotsOrThrow(lemma.family, lemma.kind),
		lemma.coreFeatures,
		PERCENT_TEXT,
		lemma.syncretic,
	);
	return notePath(
		[WORTER_FOLDER, lemma.language, lemma.family, lemma.kind, ...spelled],
		canonicalFormBasename(lemma.canonicalForm),
	);
}

/**
 * The path of a Shadow's note (ADR 0012, 0013):
 * `Worter/<language>/Shadow/<Family>/<Kind>/<basename>.md`. A Shadow has no
 * Core Features, so it has no slots. #109 removes Shadow notes.
 */
export function shadowNotePath(
	shadow: Extract<Dumrel.UnitShadow, { language: "de" }>,
): NotePath {
	slotsOrThrow(shadow.family, shadow.kind);
	return notePath(
		[
			WORTER_FOLDER,
			shadow.language,
			SHADOW_FOLDER,
			shadow.family,
			shadow.kind,
		],
		canonicalFormBasename(shadow.canonicalForm),
	);
}

/** What an ADR-0013 Lemma note's path spells: all but a shortened form's tail. */
export type ParsedLegacyLemmaNotePath = {
	readonly type: "lemma";
	readonly language: "de";
	readonly family: string;
	readonly kind: string;
	/** Every slot's feature, null where the path holds `_`, `~` or nothing. */
	readonly coreFeatures: Readonly<Record<string, unknown>>;
	/** The features spelled `~`, in alphabetical order, if any. */
	readonly syncretic?: readonly string[];
	readonly basename: DecodedBasename;
};

export type ParsedShadowNotePath = {
	readonly type: "shadow";
	readonly language: "de";
	readonly family: string;
	readonly kind: string;
	readonly basename: DecodedBasename;
};

export type ParsedLegacyNotePath =
	| ParsedLegacyLemmaNotePath
	| ParsedShadowNotePath;

export type LegacyNotePathParse =
	| { readonly ok: true; readonly value: ParsedLegacyNotePath }
	| { readonly ok: false; readonly error: InvalidNotePath };

/**
 * Reverses {@link legacyLemmaNotePath} and {@link shadowNotePath}. Only the
 * canonical spelling parses: a trailing `_`, an unknown route, or a slot
 * value its feature never takes is an `InvalidNotePath`. Feature values are
 * read as spelled; validating them as a Lemma is the caller's step, since
 * a shortened basename does not hold the whole Canonical Form.
 */
export function parseLegacyNotePath(path: string): LegacyNotePathParse {
	const invalid = (reason: string): LegacyNotePathParse => ({
		error: { _tag: "InvalidNotePath", path, reason },
		ok: false,
	});
	if (!path.endsWith(MARKDOWN_EXTENSION))
		return invalid("Not a Markdown note");
	const segments = path.slice(0, -MARKDOWN_EXTENSION.length).split("/");
	const [root, language, ...rest] = segments;
	if (root !== WORTER_FOLDER) return invalid(`Not under ${WORTER_FOLDER}/`);
	if (language !== "de") return invalid("Only German notes have paths");
	const basenameText = rest.pop();
	const basename =
		basenameText === undefined ? undefined : decodeBasename(basenameText);
	if (basename === undefined) return invalid("Invalid basename");

	if (rest[0] === SHADOW_FOLDER) {
		const [, family, kind, ...extra] = rest;
		if (family === undefined || kind === undefined || extra.length > 0)
			return invalid("A Shadow note sits at Shadow/<Family>/<Kind>/");
		if (germanSlotsOf(family, kind) === undefined)
			return invalid(`Unknown route ${family}/${kind}`);
		return {
			ok: true,
			value: { basename, family, kind, language, type: "shadow" },
		};
	}

	const [family, kind, ...spelled] = rest;
	if (family === undefined || kind === undefined)
		return invalid("A Lemma note sits at <Family>/<Kind>/");
	const slots = germanSlotsOf(family, kind);
	if (slots === undefined) return invalid(`Unknown route ${family}/${kind}`);
	const parsed = parseSlots(slots, spelled, PERCENT_TEXT);
	if (typeof parsed === "string") return invalid(parsed);
	return {
		ok: true,
		value: { basename, family, kind, language, type: "lemma", ...parsed },
	};
}
