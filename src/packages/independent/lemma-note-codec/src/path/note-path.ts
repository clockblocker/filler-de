import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import {
	canonicalFormBasename,
	type DecodedBasename,
	decodeBasename,
	decodeSegment,
	encodeSegment,
} from "./basename";
import { germanSlotsOf, type Slot } from "./slot-table-de";

/** The vault folder every Lemma and Shadow note lives under. */
export const WORTER_FOLDER = "Worter";
/** The folder under `Worter/<language>/` that holds Shadow notes. */
export const SHADOW_FOLDER = "Shadow";

const NULL_SLOT = "_";
const SYNCRETIC_SLOT = "~";
const SET_SEPARATOR = "+";
const FLAG_VALUE = "Yes";
const EXTENSION = ".md";

/** A note's vault location: its folder chain, its basename and both joined. */
export type NotePath = {
	readonly folders: readonly string[];
	readonly basename: string;
	/** `folders/basename.md`, relative to the vault root. */
	readonly path: string;
};

/** The fields of a Lemma its path spells. */
export type PathLemma = Pick<
	Dumling.Lemma<"de">,
	"language" | "family" | "kind" | "canonicalForm" | "coreFeatures"
> & { readonly syncretic?: readonly string[] };

function notePath(folders: readonly string[], basename: string): NotePath {
	return {
		basename,
		folders,
		path: `${[...folders, basename].join("/")}${EXTENSION}`,
	};
}

function slotsOrThrow(family: string, kind: string): readonly Slot[] {
	const slots = germanSlotsOf(family, kind);
	if (slots === undefined)
		throw new Error(`No path slots for the German route ${family}/${kind}`);
	return slots;
}

/**
 * The path of a German Lemma's note (ADR 0013):
 * `Worter/de/<Family>/<Kind>/<slots…>/<basename>.md`. Each slot spells one
 * Core Feature in the route's fixed order. A null in the middle is `_`,
 * trailing nulls are dropped, and a feature a Syncretism leaves open is `~`.
 *
 * The note's `identity` Block stays authoritative; this is its projection.
 * It throws only for a Lemma dumling would reject, such as a route or
 * feature value the slot table does not know.
 */
export function lemmaNotePath(lemma: PathLemma): NotePath {
	const slots = slotsOrThrow(lemma.family, lemma.kind);
	const core: Readonly<Record<string, unknown>> = lemma.coreFeatures;
	const syncretic = new Set(lemma.syncretic ?? []);
	const spelled = slots.map((slot) =>
		syncretic.has(slot.feature)
			? SYNCRETIC_SLOT
			: encodeSlot(slot, core[slot.feature]),
	);
	while (spelled.at(-1) === NULL_SLOT) spelled.pop();
	return notePath(
		[WORTER_FOLDER, lemma.language, lemma.family, lemma.kind, ...spelled],
		canonicalFormBasename(lemma.canonicalForm),
	);
}

/**
 * The path of a Shadow's note (ADR 0012, 0013):
 * `Worter/<language>/Shadow/<Family>/<Kind>/<basename>.md`. A Shadow has no
 * Core Features, so it has no slots.
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

function encodeSlot(slot: Slot, value: unknown): string {
	if (value === null || value === undefined) return NULL_SLOT;
	switch (slot.encoding) {
		case "flag":
			if (value === FLAG_VALUE) return slot.feature;
			break;
		case "value":
			if (typeof value === "string" && isClosedValue(value)) return value;
			break;
		case "text":
			if (typeof value === "string" && value.length > 0)
				return encodeText(value);
			break;
		case "valueSet":
			if (typeof value === "string" && isClosedValue(value)) return value;
			if (
				typeof value === "object" &&
				"mixed" in value &&
				Array.isArray(value.mixed) &&
				value.mixed.every(
					(member) =>
						typeof member === "string" && isClosedValue(member),
				)
			)
				return value.mixed.join(SET_SEPARATOR);
			break;
	}
	throw new Error(
		`Core Feature ${slot.feature} has a value its path slot cannot spell: ${JSON.stringify(value)}`,
	);
}

/** A text value that would read as `_` or `~` escapes that character. */
const RESERVED_TEXT: Readonly<Record<string, string>> = {
	[NULL_SLOT]: "%5F",
	[SYNCRETIC_SLOT]: "%7E",
};

function encodeText(value: string): string {
	return RESERVED_TEXT[value] ?? encodeSegment(value);
}

function decodeText(slot: string): string | undefined {
	for (const [value, sequence] of Object.entries(RESERVED_TEXT)) {
		if (slot === sequence) return value;
	}
	return decodeSegment(slot);
}

/** What a Lemma note's path spells: everything but a shortened form's tail. */
export type ParsedLemmaNotePath = {
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

export type ParsedNotePath = ParsedLemmaNotePath | ParsedShadowNotePath;

/** A path no Lemma or Shadow note has, with the reason. */
export type InvalidNotePath = {
	readonly _tag: "InvalidNotePath";
	readonly path: string;
	readonly reason: string;
};

export type NotePathParse =
	| { readonly ok: true; readonly value: ParsedNotePath }
	| { readonly ok: false; readonly error: InvalidNotePath };

/**
 * Reverses {@link lemmaNotePath} and {@link shadowNotePath}. Only the
 * canonical spelling parses: a trailing `_`, an unknown route, or a slot
 * value its feature never takes is an `InvalidNotePath`. Feature values are
 * read as spelled; validating them as a Lemma is the caller's step, since
 * a shortened basename does not hold the whole Canonical Form.
 */
export function parseNotePath(path: string): NotePathParse {
	const invalid = (reason: string): NotePathParse => ({
		error: { _tag: "InvalidNotePath", path, reason },
		ok: false,
	});
	if (!path.endsWith(EXTENSION)) return invalid("Not a Markdown note");
	const segments = path.slice(0, -EXTENSION.length).split("/");
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
	if (spelled.length > slots.length)
		return invalid(`${family}/${kind} has ${slots.length} slots`);
	if (spelled.at(-1) === NULL_SLOT)
		return invalid("A trailing null slot is dropped, not written");

	const coreFeatures: Record<string, unknown> = {};
	const syncretic: string[] = [];
	for (const [index, slot] of slots.entries()) {
		const text = spelled[index];
		if (text === undefined || text === NULL_SLOT) {
			coreFeatures[slot.feature] = null;
			continue;
		}
		if (text === SYNCRETIC_SLOT) {
			coreFeatures[slot.feature] = null;
			syncretic.push(slot.feature);
			continue;
		}
		const value = decodeSlot(slot, text);
		if (value === undefined)
			return invalid(`Slot ${index + 1} cannot spell ${slot.feature}`);
		coreFeatures[slot.feature] = value;
	}
	return {
		ok: true,
		value: {
			basename,
			coreFeatures,
			family,
			kind,
			language,
			type: "lemma",
			...(syncretic.length > 0
				? { syncretic: syncretic.toSorted() }
				: {}),
		},
	};
}

function decodeSlot(slot: Slot, text: string): unknown {
	switch (slot.encoding) {
		case "flag":
			return text === slot.feature ? FLAG_VALUE : undefined;
		case "value":
			return isClosedValue(text) ? text : undefined;
		case "text":
			return decodeText(text);
		case "valueSet": {
			const members = text.split(SET_SEPARATOR);
			if (!members.every(isClosedValue)) return undefined;
			return members.length === 1 ? text : { mixed: members };
		}
	}
}

/** A closed value never collides with the slot syntax or needs escaping. */
function isClosedValue(text: string): boolean {
	return /^[A-Za-z0-9]+$/u.test(text);
}
