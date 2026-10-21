import { sha256Hex } from "./hash";

/**
 * The rendering boundary (spec: Rendering boundary). A note's body holds
 * the codec's renderings and the user's text, with no marker between them.
 * Each rendering the codec writes is sealed in the note's metadata as its
 * line count and a hash of its lines. On parse, a run of body lines that
 * matches a seal exactly is that rendering again; every other line is
 * freeform, kept byte for byte and never read as data. Visible content is
 * never data either way: a note's records come from its metadata alone, so
 * the seals only tell what serialize may regenerate and what it must keep.
 *
 * A rendering that is edited no longer matches its seal, so its lines
 * become freeform and survive beside the fresh rendering serialize writes.
 * A line typed directly under a rendering leaves it intact and is freeform.
 */

/** One Block's visible lines, as the codec writes them. */
export type RenderedBlock = {
	/** The Block kind, such as `header` or `translation`. Cosmetic, for callers. */
	readonly block: string;
	/** Never empty, never opens or ends with a blank line, no `\n` inside a line. */
	readonly lines: readonly string[];
};

/**
 * What the metadata keeps of one rendering: its Block kind, its line count
 * and the first 8 hex digits of the SHA-256 of its lines joined by `\n`.
 */
export type RenderingSeal = {
	readonly block: string;
	readonly lines: number;
	readonly hash: string;
};

/**
 * A run of body lines: one sealed rendering, or the user's text. `start`
 * and `end` index the body's lines, `end` exclusive.
 */
export type BodySegment = {
	readonly start: number;
	readonly end: number;
} & (
	| {
			readonly type: "rendering";
			readonly block: string;
			/** The index of the seal it matched. */
			readonly seal: number;
			readonly lines: readonly string[];
	  }
	| {
			/**
			 * Lines no seal matched, without the blank lines around them. Its
			 * bytes are the body's, line endings included.
			 */
			readonly type: "freeform";
			readonly text: string;
	  }
);

/** The length of a seal's hash. Part of the note format: never change it. */
export const SEAL_HASH_LENGTH = 8;

const hashLines = (lines: readonly string[]) =>
	sha256Hex(lines.join("\n")).slice(0, SEAL_HASH_LENGTH);

export function sealOf(rendering: RenderedBlock): RenderingSeal {
	return {
		block: rendering.block,
		hash: hashLines(rendering.lines),
		lines: rendering.lines.length,
	};
}

const isBlank = (line: string) => line.trim().length === 0;

/**
 * A body's lines, split at `\n`, as segments index them; a CRLF line keeps
 * its CR.
 */
export function linesOf(body: string): string[] {
	const lines = body.split("\n");
	if (lines.at(-1) === "") lines.pop();
	return lines;
}

/** A line as seals compare it: without the CR a CRLF file ends it with. */
const compared = (line: string) => line.replace(/\r$/u, "");

/**
 * Splits a body at the rendering boundary. Seals are matched in order: each
 * first at the next non-blank line after the previous match, as an
 * unedited note has it, else at the first unclaimed run of lines that
 * matches it anywhere, so a section the user moved still counts. A seal no
 * run matches is a rendering the user edited or deleted, and matches
 * nothing. It never fails.
 */
export function readBody(
	body: string,
	seals: readonly RenderingSeal[],
): BodySegment[] {
	const raw = linesOf(body);
	const lines = raw.map(compared);
	const claimed: (number | undefined)[] = lines.map(() => undefined);

	const fits = (start: number, seal: RenderingSeal) => {
		if (start + seal.lines > lines.length) return false;
		for (let at = start; at < start + seal.lines; at++)
			if (claimed[at] !== undefined) return false;
		return hashLines(lines.slice(start, start + seal.lines)) === seal.hash;
	};

	let cursor = 0;
	seals.forEach((seal, index) => {
		if (seal.lines < 1) return;
		let expected = cursor;
		while (expected < lines.length && isBlank(lines[expected] ?? ""))
			expected++;
		let start = fits(expected, seal) ? expected : -1;
		for (let at = 0; start < 0 && at < lines.length; at++)
			if (at !== expected && fits(at, seal)) start = at;
		if (start < 0) return;
		for (let at = start; at < start + seal.lines; at++) claimed[at] = index;
		cursor = start + seal.lines;
	});

	const segments: BodySegment[] = [];
	let at = 0;
	while (at < lines.length) {
		const owner = claimed[at];
		if (owner !== undefined) {
			const seal = seals[owner];
			const length = seal?.lines ?? 1;
			segments.push({
				block: seal?.block ?? "",
				end: at + length,
				lines: lines.slice(at, at + length),
				seal: owner,
				start: at,
				type: "rendering",
			});
			at += length;
			continue;
		}
		let start = at;
		while (at < lines.length && claimed[at] === undefined) at++;
		let end = at;
		while (start < end && isBlank(lines[start] ?? "")) start++;
		while (end > start && isBlank(lines[end - 1] ?? "")) end--;
		if (end > start)
			segments.push({
				end,
				start,
				text: raw.slice(start, end).join("\n").replace(/\r$/u, ""),
				type: "freeform",
			});
	}
	return segments;
}

/** Text without its blank lines at either end. */
export function trimBlankLines(text: string): string {
	const lines = text.split("\n");
	while (lines.length > 0 && isBlank(lines[0] ?? "")) lines.shift();
	while (lines.length > 0 && isBlank(lines.at(-1) ?? "")) lines.pop();
	return lines.join("\n");
}

/** The user's texts of a body, in order. */
export const freeformOf = (segments: readonly BodySegment[]): string[] =>
	segments.flatMap((segment) =>
		segment.type === "freeform" ? [segment.text] : [],
	);

/**
 * Writes a body line by line, sealing each rendered Block as it goes. The
 * caller places blank lines and freeform text; the writer never adds any.
 */
export class BodyWriter {
	private readonly lines: string[] = [];
	private readonly seals: RenderingSeal[] = [];

	/** Appends a rendering and its seal. An empty rendering is left out. */
	block(rendering: RenderedBlock | undefined): this {
		if (rendering === undefined || rendering.lines.length === 0)
			return this;
		this.lines.push(...rendering.lines);
		this.seals.push(sealOf(rendering));
		return this;
	}

	/** Appends user text as it is. */
	text(text: string): this {
		this.lines.push(...text.split("\n"));
		return this;
	}

	/** Ends the body with exactly `count` blank lines, unless it is empty. */
	gap(count: number): this {
		if (this.lines.length === 0) return this;
		while (this.lines.length > 0 && isBlank(this.lines.at(-1) ?? ""))
			this.lines.pop();
		for (let index = 0; index < count; index++) this.lines.push("");
		return this;
	}

	get empty(): boolean {
		return this.lines.length === 0;
	}

	finish(): { readonly body: string; readonly rendering: RenderingSeal[] } {
		const lines = [...this.lines];
		while (lines.length > 0 && isBlank(lines.at(-1) ?? "")) lines.pop();
		return {
			body: lines.length === 0 ? "" : `${lines.join("\n")}\n`,
			rendering: [...this.seals],
		};
	}
}

/**
 * A rendering's lines from text: split at line breaks, without blank lines
 * at either end, and with blank lines inside collapsed to one only where
 * `paragraphs` keeps them. `%%` would open an Obsidian comment in visible
 * text, so a zero-width space splits it.
 */
export function renderingLines(text: string, paragraphs = false): string[] {
	const lines: string[] = [];
	let gap = false;
	for (const line of text.split(/\r\n?|\n/u)) {
		if (isBlank(line)) {
			gap = paragraphs && lines.length > 0;
			continue;
		}
		if (gap) lines.push("");
		gap = false;
		lines.push(line.replace(/%(?=%)/gu, "%​"));
	}
	return lines;
}
