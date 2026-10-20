import {
	isProjectionBlockKind,
	isSerializedBlockKind,
	type PartScope,
	type ProjectionBlockKind,
	type SerializedBlockKind,
} from "./blocks";

/**
 * One Block of a Lemma note. `raw` holds the Block's exact bytes, from its
 * marker line through the blank lines after it, so concatenating a
 * document's `raw`s gives back the note it was parsed from.
 */
export type NoteBlock =
	| {
			readonly type: "serialized";
			readonly kind: SerializedBlockKind;
			/** The payload text after the marker name, still unparsed. */
			readonly payload: string;
			readonly raw: string;
	  }
	| {
			readonly type: "projection";
			readonly kind: ProjectionBlockKind;
			readonly raw: string;
	  }
	| {
			/** User content: any lines after a blank line, up to the next marker. */
			readonly type: "freeform";
			readonly raw: string;
	  }
	| {
			/** A marker this codec does not know, kept with its lines. */
			readonly type: "unknown";
			readonly marker: string;
			readonly raw: string;
	  };

/** The Lemma part, one Reading's part, or one Surface's part. */
export type NotePart = {
	readonly scope: PartScope;
	/** The `r-…` or `s-…` Block ID its marker names; none for the Lemma part. */
	readonly blockId: string | undefined;
	/** The part marker line and the blank lines after it. */
	readonly raw: string;
	readonly blocks: readonly NoteBlock[];
};

/**
 * A Lemma note's document layer (ADR 0007): part order, Block order, and the
 * bytes of every Block, so freeform and unknown Blocks survive untouched.
 */
export type LemmaNoteDocument = {
	/** Blocks before the first part marker, such as frontmatter. */
	readonly preamble: readonly NoteBlock[];
	readonly parts: readonly NotePart[];
};

export const EMPTY_DOCUMENT: LemmaNoteDocument = { parts: [], preamble: [] };

/**
 * Marker syntax. Every Block and part starts with one marker line, an
 * Obsidian comment, so reading view hides it:
 *
 * - `%%tf-part:lemma%%`, `%%tf-part:reading r-…%%`, `%%tf-part:surface s-…%%`
 *   open a part;
 * - `%%tf:<kind>%%` opens a projection Block and `%%tf:<kind> <json>%%` a
 *   serialized one, whose payload is one line of JSON with `%` written as
 *   `%`.
 *
 * A typed Block's visible rendering follows its marker up to the first blank
 * line. Lines after that blank line, up to the next marker, are freeform.
 */
const MARKER_PATTERN =
	/^%%tf(-part)?:([A-Za-z0-9_-]+)(?: ([^\r\n]*?))?%%[ \t]*\r?\n?$/u;
const BLOCK_ID_PATTERN = /^[rs]-[0-9a-f]+$/u;
const BLANK_PATTERN = /^[ \t]*\r?\n?$/u;

/** A Block before its lines are known. */
type BlockHead = NoteBlock extends infer Block
	? Block extends NoteBlock
		? Omit<Block, "raw">
		: never
	: never;

type Marker =
	| { readonly type: "part"; readonly scope: PartScope; readonly id?: string }
	| { readonly type: "block"; readonly block: BlockHead };

function readMarker(line: string): Marker | undefined {
	const match = MARKER_PATTERN.exec(line);
	if (match === null) return undefined;
	const [, partPrefix, name = "", argument] = match;
	if (partPrefix !== undefined) {
		if (name === "lemma" && argument === undefined)
			return { scope: "lemma", type: "part" };
		if (
			(name === "reading" || name === "surface") &&
			(argument === undefined || BLOCK_ID_PATTERN.test(argument))
		)
			return {
				scope: name,
				type: "part",
				...(argument === undefined ? {} : { id: argument }),
			};
		return {
			block: { marker: `tf-part:${name}`, type: "unknown" },
			type: "block",
		};
	}
	if (isSerializedBlockKind(name))
		return {
			block: { kind: name, payload: argument ?? "", type: "serialized" },
			type: "block",
		};
	if (isProjectionBlockKind(name))
		return { block: { kind: name, type: "projection" }, type: "block" };
	return { block: { marker: `tf:${name}`, type: "unknown" }, type: "block" };
}

function splitLines(markdown: string): string[] {
	return markdown.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}

const isBlank = (line: string) => BLANK_PATTERN.test(line);

type Phase = "rendering" | "trailing" | "freeform";

/**
 * Parses a Lemma note into its document layer. It never fails: lines that
 * are not markers are rendering or freeform, unknown markers become unknown
 * Blocks, and every byte lands in some Block's `raw`.
 */
export function parseDocument(markdown: string): LemmaNoteDocument {
	const preamble: NoteBlock[] = [];
	const parts: { part: NotePart; blocks: NoteBlock[] }[] = [];
	let open: { block: BlockHead; lines: string[] } | undefined;
	let openPart:
		| { marker: Marker & { type: "part" }; lines: string[] }
		| undefined;
	let phase: Phase = "freeform";

	const target = () => parts.at(-1)?.blocks ?? preamble;
	const flush = () => {
		if (open !== undefined) {
			target().push({ ...open.block, raw: open.lines.join("") });
			open = undefined;
		}
		if (openPart !== undefined) {
			const { marker, lines } = openPart;
			const blocks: NoteBlock[] = [];
			parts.push({
				blocks,
				part: {
					blockId: marker.id,
					blocks,
					raw: lines.join(""),
					scope: marker.scope,
				},
			});
			openPart = undefined;
		}
	};

	for (const line of splitLines(markdown)) {
		const marker = readMarker(line);
		if (marker !== undefined) {
			flush();
			if (marker.type === "part") {
				openPart = { lines: [line], marker };
				phase = "trailing";
			} else {
				open = { block: marker.block, lines: [line] };
				phase = "rendering";
			}
			continue;
		}
		const current = openPart ?? open;
		if (current === undefined) {
			open = { block: { type: "freeform" }, lines: [line] };
			phase = "freeform";
			continue;
		}
		if (phase === "rendering" && isBlank(line)) phase = "trailing";
		if (phase === "trailing" && !isBlank(line)) {
			flush();
			open = { block: { type: "freeform" }, lines: [line] };
			phase = "freeform";
			continue;
		}
		current.lines.push(line);
	}
	flush();
	return { parts: parts.map(({ part }) => part), preamble };
}

/** Writes a document back exactly as parsed: the concatenation of its bytes. */
export function serializeDocument(document: LemmaNoteDocument): string {
	return [
		...document.preamble.map((block) => block.raw),
		...document.parts.flatMap((part) => [
			part.raw,
			...part.blocks.map((block) => block.raw),
		]),
	].join("");
}

/** A Block's lines without the blank lines that separate it from the next. */
export function trimmedRaw(block: NoteBlock): string {
	const lines = splitLines(block.raw);
	while (lines.length > 0 && isBlank(lines[0] ?? "")) lines.shift();
	while (lines.length > 0 && isBlank(lines.at(-1) ?? "")) lines.pop();
	return lines.join("").replace(/\r?\n$/u, "");
}
