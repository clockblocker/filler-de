/**
 * Decorations: italics, bold, `_` and `__`, `~~` and `==`. A cut into
 * sentence blocks that goes through one closes it at the end of the block
 * before and opens it again at the start of the block after, so
 * `*Er kam. Sie ging.*` becomes `*Er kam.*` and `*Sie ging.*`.
 */

/** A stretch of the text, `[from, to)`. */
export type Range = { readonly from: number; readonly to: number };

/** One decoration: its marker, and where its opening and closing markers stand. */
export type DecorationPair = {
	readonly marker: string;
	/** The opening marker's range. */
	readonly open: Range;
	/** The closing marker's range. */
	readonly close: Range;
};

/**
 * A run of exactly `length` underscores that may open or close emphasis:
 * one with a letter or digit on both sides is inside a word, as in
 * `snake_case`, and emphasizes nothing.
 */
function underscoreRun(length: number): RegExp {
	const run = `_{${length}}`;
	return new RegExp(
		`(?<![_\\p{L}\\p{N}])${run}(?!_)|(?<!_)${run}(?![_\\p{L}\\p{N}])`,
		"gu",
	);
}

/** Each marker and the runs that are exactly it, longest marker of a kind first. */
const DECORATION_PATTERNS: readonly {
	readonly marker: string;
	readonly pattern: RegExp;
}[] = [
	{ marker: "***", pattern: /(?<!\*)\*\*\*(?!\*)/gu },
	{ marker: "**", pattern: /(?<!\*)\*\*(?!\*)/gu },
	{ marker: "*", pattern: /(?<!\*)\*(?!\*)/gu },
	{ marker: "~~", pattern: /(?<!~)~~(?!~)/gu },
	{ marker: "==", pattern: /(?<!=)==(?!=)/gu },
	{ marker: "___", pattern: underscoreRun(3) },
	{ marker: "__", pattern: underscoreRun(2) },
	{ marker: "_", pattern: underscoreRun(1) },
];

/** The markers a line may open with and leave unclosed, longest first. */
const HEALED_MARKERS = ["***", "**", "*", "~~", "=="] as const;

/** How often `marker` stands on its own in `line`: `*` never counts the stars of `**`. */
function markerCount(line: string, marker: string): number {
	const pattern = DECORATION_PATTERNS.find(
		(candidate) => candidate.marker === marker,
	)?.pattern;
	return pattern
		? (line.match(new RegExp(pattern.source, pattern.flags)) ?? []).length
		: 0;
}

/**
 * Heals unclosed decorations as Obsidian reads them: it treats `*text` as
 * `*text*`. A line that starts with a marker it never closes gets the
 * closing marker at its end. A line that opens and closes it, such as
 * `*Kursiv* und normal.`, and a list item's `* ` stay as they are.
 */
export function healUnclosedDecorations(text: string): string {
	return text
		.split("\n")
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed) return line;
			for (const marker of HEALED_MARKERS) {
				if (!trimmed.startsWith(marker)) continue;
				// A marker before a blank opens nothing: `* item` is a list item.
				if (/^\s/u.test(trimmed.slice(marker.length))) return line;
				if (trimmed.endsWith(marker)) return line;
				// An even count closes every marker the line opens.
				if (markerCount(trimmed, marker) % 2 === 0) return line;
				const trailing = line.match(/\s*$/u)?.[0] ?? "";
				return line.trimEnd() + marker + trailing;
			}
			return line;
		})
		.join("\n");
}

const overlaps = (a: Range, b: Range) => a.from < b.to && b.from < a.to;

/**
 * The decorations in `text[range]`: each marker's runs, outside `skip`,
 * paired in order, first with second, third with fourth. A longer marker
 * is paired first, and a pair that crosses one already found, neither
 * holding the other, is dropped. A list item's `* ` is no marker.
 */
export function decorationPairs(
	text: string,
	range: Range,
	skip: readonly Range[],
): DecorationPair[] {
	const stretch = text.slice(range.from, range.to);
	const pairs: DecorationPair[] = [];
	for (const { marker, pattern } of DECORATION_PATTERNS) {
		const runs: Range[] = [];
		for (const match of stretch.matchAll(
			new RegExp(pattern.source, pattern.flags),
		)) {
			const from = range.from + match.index;
			const run = { from, to: from + marker.length };
			const bullet =
				marker === "*" &&
				/^[ \t]*(?:>[ \t]*)*$/u.test(
					text.slice(text.lastIndexOf("\n", from - 1) + 1, from),
				) &&
				/[ \t]/u.test(text[run.to] ?? "");
			if (bullet || skip.some((skipped) => overlaps(skipped, run)))
				continue;
			runs.push(run);
		}
		for (let index = 0; index + 1 < runs.length; index += 2) {
			const open = runs[index];
			const close = runs[index + 1];
			if (!open || !close) continue;
			const whole = { from: open.from, to: close.to };
			const crosses = pairs.some(({ close: c, open: o }) => {
				const other = { from: o.from, to: c.to };
				const nested =
					(other.from <= whole.from && whole.to <= other.to) ||
					(whole.from <= other.from && other.to <= whole.to);
				return overlaps(other, whole) && !nested;
			});
			if (!crosses) pairs.push({ close, marker, open });
		}
	}
	return pairs.sort((a, b) => a.open.from - b.open.from);
}
