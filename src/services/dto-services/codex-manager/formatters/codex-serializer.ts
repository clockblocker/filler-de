import type { CodexChapter, CodexNormalizeOptions } from "../types";

/**
 * Do NOT use for parsing the user's input
 * Can only be safely used when the indents are guaranteed to be preserved
 */
export function markdownToChapterItems(
	md: string,
	opts: CodexNormalizeOptions = {},
): CodexChapter[] {
	const {
		deriveTitleFromTarget = (t) =>
			t.replace(/-index$/i, "").replace(/_/g, " "),
		spacesPerIndent = 2,
	} = opts;

	const lines = md.split(/\r?\n/);

	// Track the latest group name at each depth
	const groupAtDepth: string[] = [];
	const items: CodexChapter[] = [];

	for (const raw of lines) {
		if (!raw.trim()) continue;

		const depth = computeDepth(raw, spacesPerIndent);
		let s = stripLeadingBullet(raw);
		s = s.replace(/^[\t ]+/, "");
		s = stripEmphasis(s);

		const { text: afterBox, done } = pullCheckbox(s);
		const w = pullWikiLink(afterBox);

		if (w) {
			// Leaf node
			const title = w.display ?? deriveTitleFromTarget(w.target);

			// Build path from known groups at shallower depths
			const pathParts: string[] = [];
			for (let d = 0; d < depth; d++) {
				if (groupAtDepth[d]) pathParts.push(groupAtDepth[d] ?? "");
			}

			items.push({
				pathParts,
				title: title.trim(),
				done: done === true ? true : false, // default false if no checkbox or [ ]
			});
		} else {
			// Group node
			const label = afterBox.trim();
			if (!label) continue;

			// Register this group at its depth and discard deeper ones
			groupAtDepth[depth] = label;
			groupAtDepth.length = depth + 1; // truncate deeper levels
		}
	}

	return items;
}

const WIKILINK_RE = /\[\[(?<target>[^\]|]+?)(?:\|(?<display>[^\]]+))?\]\]/;

function stripEmphasis(s: string): string {
	// remove **bold**, *italic*, __bold__, _italic_
	// keep content inside
	return s
		.replace(/\*\*(.*?)\*\*/g, "$1")
		.replace(/\*(.*?)\*/g, "$1")
		.replace(/__(.*?)__/g, "$1")
		.replace(/_(.*?)_/g, "$1")
		.replace(/`(.*?)`/g, "$1");
}

/**
 * Compute indentation level: tabs count 1, spacesPerIndent spaces count 1.
 */
function computeDepth(line: string, spacesPerIndent: number): number {
	const m = line.match(/^[\t ]*/);
	const lead = m ? m[0] : "";
	const tabs = (lead.match(/\t/g) || []).length;
	const spaces = lead.length - tabs;
	return tabs + Math.floor(spaces / spacesPerIndent);
}

/**
 * Remove leading whitespace + bullet symbols + extra spaces.
 * Keeps the remainder (which might start with a checkbox).
 */
function stripLeadingBullet(raw: string): string {
	let s = raw.replace(/^[\t ]+/, "");
	// bullets could be -, *, + followed by spaces (optionally already with checkbox)
	s = s.replace(/^[-*+]\s+/, "");
	return s;
}

/**
 * Extract checkbox state if present: returns { text, done }
 */
function pullCheckbox(text: string): { text: string; done: boolean | null } {
	const m = text.match(/^\[(?<mark>[ xX])\]\s*/);
	if (!m) return { text, done: null };
	const mark = (m.groups!.mark || " ").toLowerCase();
	return { text: text.slice(m[0].length), done: mark === "x" };
}

/**
 * Extract wikilink (target/display). If none, returns null.
 */
function pullWikiLink(
	text: string,
): { target: string; display?: string } | null {
	const m = text.match(WIKILINK_RE);
	if (!m || !m.groups) return null;
	const target = m.groups["target"];
	const display = m.groups["display"];
	return { target: target ?? "", display: display ?? "" };
}

/**
 * 1) NORMALIZE / FLATTEN
 *
 * Produces a *preview* text block like your example:
 * - Removes bullets and emphasis.
 * - Keeps either "GroupName" lines (no wikilink) or "[x] [[target|display]]" lines.
 * - Places each item on a single line.
 */
export function normalizeMarkdownToPreview(
	md: string,
	opts: CodexNormalizeOptions = {},
): string {
	const {
		deriveTitleFromTarget = (t) =>
			t.replace(/-index$/i, "").replace(/_/g, " "),
		spacesPerIndent = 2,
	} = opts;

	const lines = md.split(/\r?\n/);
	const out: string[] = [];

	for (const raw of lines) {
		if (!raw.trim()) continue;

		const depth = computeDepth(raw, spacesPerIndent); // depth not used for preview, but could be.
		// Remove leading bullets + whitespace, strip emphasis around group labels
		let s = stripLeadingBullet(raw);
		s = s.replace(/^[\t ]+/, "");
		s = stripEmphasis(s);

		// Pull checkbox if present
		const { text: afterBox, done } = pullCheckbox(s);

		// Is there a wikilink?
		const w = pullWikiLink(afterBox);

		if (w) {
			const title = w.display ?? deriveTitleFromTarget(w.target);
			const check = done === true ? "[x] " : done === false ? "[ ] " : ""; // if no checkbox, omit
			out.push(`${check}[[${w.target}|${title}]]`);
		} else {
			// It's a group-ish line; keep it as a plain header token
			const header = afterBox.trim();
			if (header) out.push(header);
		}
	}

	return out.join("\n");
}
