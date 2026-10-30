/**
 * Where a clicked link stands in its note's text, read from the document
 * and never from the rendered lines: CodeMirror renders only the lines in
 * view, so a rendered line's index is not its line in the note. When the
 * place cannot be told for sure, none is: a wrong one would attest the
 * wrong occurrence.
 *
 * - **Live Preview and source mode.** The CodeMirror view the link's
 *   element belongs to (`EditorView.findFromDOM`), in any pane, and its
 *   `posAtDOM` of the element, kept only when a link spans it. A table
 *   cell is an editor of its own, whose document is the cell's text: its
 *   offset is moved into the note by where that text stands in the table,
 *   when it stands there once.
 * - **Reading view.** Obsidian renders a note section by section and tells
 *   a post-processor each section's lines (`getSectionInfo`). The layer
 *   keeps each rendered section's context; a click finds its link's
 *   section, and the link of the section's source that stands where the
 *   clicked one does among the section's links, once the source's links
 *   and the rendered ones agree, one for one.
 */
import { EditorView } from "@codemirror/view";
import { Effect, Option } from "effect";
import type { App, MarkdownPostProcessorContext } from "obsidian";
import type { UserEventsHost } from "../../../contracts";
import { DomSelectors } from "../../../internal/dom-selectors";

/** An embed's rendered content, whose links are another note's. */
const EMBED = ".internal-embed";

/** A CodeMirror editor's outer element. */
const CM_EDITOR = ".cm-editor";

/** The part of CodeMirror's view the offset is read from. */
export type LinkEditorView = Pick<EditorView, "posAtDOM" | "state">;

/** The view of an editor's outer element; tests give their own. */
export type EditorViewOf = (editor: HTMLElement) => LinkEditorView | null;

const findView: EditorViewOf = (editor) => EditorView.findFromDOM(editor);

/** `posAtDOM`, which throws for a node outside the view's document. */
const positionOf = Option.liftThrowable(
	(view: LinkEditorView, node: Node): number => view.posAtDOM(node),
);

/**
 * Where a clicked link stands: the note of the pane that shows it, the
 * offset inside its `[[…]]` in that note's text, and, from that text, the
 * link's target, which a virtualized editor's rendered lines cannot give.
 */
export type LinkPlace = {
	readonly sourcePath: string;
	readonly offset: number;
	readonly target?: { readonly basename: string; readonly alias?: string };
};

/**
 * The note of the workspace pane whose view holds `element`, if one does:
 * a link in a split pane is that pane's note's, wherever the cursor is.
 */
export function paneNoteOf(
	app: Pick<App, "workspace">,
	element: HTMLElement,
): string | undefined {
	let found: string | undefined;
	app.workspace.iterateAllLeaves((leaf) => {
		const view = leaf.view as {
			readonly containerEl?: { contains?: (node: Node) => boolean };
			readonly file?: { readonly path?: unknown } | null;
		};
		const path = view.file?.path;
		if (
			found === undefined &&
			typeof path === "string" &&
			view.containerEl?.contains?.(element) === true
		)
			found = path;
	});
	return found;
}

/**
 * Where the editor's `link`, an editor's link element, stands, when a link
 * of its pane's note spans its position.
 */
export function editorLinkPlace(
	app: Pick<App, "workspace">,
	link: HTMLElement,
	viewOf: EditorViewOf = findView,
): LinkPlace | undefined {
	const sourcePath = paneNoteOf(app, link);
	const editor = link.closest<HTMLElement>(CM_EDITOR);
	const view = editor ? viewOf(editor) : null;
	if (sourcePath === undefined || !editor || !view) return;
	const at = Option.getOrUndefined(positionOf(view, link));
	const text = view.state.doc.toString();
	if (at === undefined || !linkAt(text, at)) return;
	const outerEditor = editor.parentElement?.closest<HTMLElement>(CM_EDITOR);
	if (!outerEditor) return placeIn(sourcePath, text, at);
	// A table cell's editor, inside the note's.
	const outer = viewOf(outerEditor);
	const widget = outer
		? Option.getOrUndefined(positionOf(outer, editor))
		: undefined;
	if (!outer || widget === undefined) return;
	const note = outer.state.doc.toString();
	const table = paragraphAround(note, widget);
	const source = note.slice(table.from, table.to);
	const cell = source.indexOf(text);
	if (text === "" || cell < 0 || source.indexOf(text, cell + 1) >= 0) return;
	return placeIn(sourcePath, note, table.from + cell + at);
}

/** The place of the wikilink of `text` that spans `offset`; none for another link. */
function placeIn(
	sourcePath: string,
	text: string,
	offset: number,
): LinkPlace | undefined {
	const link = linkAt(text, offset);
	if (!link) return;
	if (!link.wikilink) return { offset, sourcePath };
	return {
		offset,
		sourcePath,
		target: {
			...(link.alias === undefined ? {} : { alias: link.alias }),
			basename: link.target,
		},
	};
}

/** The lines around `offset` up to the blank lines on either side, as a table's. */
function paragraphAround(text: string, offset: number) {
	const before = text.lastIndexOf("\n\n", Math.max(0, offset - 1));
	const after = text.indexOf("\n\n", offset);
	return {
		from: before < 0 ? 0 : before + 2,
		to: after < 0 ? text.length : after,
	};
}

/** The link of `offset`'s line that spans it, inside its brackets. */
function linkAt(text: string, offset: number): SourceLink | undefined {
	const from = text.lastIndexOf("\n", offset - 1) + 1;
	const end = text.indexOf("\n", offset);
	const line = text.slice(from, end < 0 ? text.length : end);
	return linksIn(line).find(
		(link) => link.from + from < offset && offset < link.to + from,
	);
}

/** The sections Reading view rendered, each with its post-processor's context. */
export type RenderedSections = {
	/**
	 * Where Reading view's `link` stands in the note its section renders,
	 * when its source holds the link.
	 */
	readonly linkPlace: (link: HTMLElement) => LinkPlace | undefined;
};

/** Keeps the context of each section Reading view renders, while the scope is open. */
export const renderedSections = Effect.fnUntraced(function* (
	host: Pick<UserEventsHost, "markdownPostProcessor">,
) {
	const contexts = new WeakMap<HTMLElement, MarkdownPostProcessorContext>();
	yield* host.markdownPostProcessor((element, context) => {
		contexts.set(element, context);
	});
	const sections: RenderedSections = {
		linkPlace: (link) => {
			let section: HTMLElement | null = link.parentElement;
			while (section && !contexts.has(section))
				section = section.parentElement;
			const context = section ? contexts.get(section) : undefined;
			if (!section || !context) return;
			const embed = link.closest(EMBED);
			if (embed && section.contains(embed)) return;
			const info = context.getSectionInfo(section);
			if (!info) return;
			const links = Array.from(
				section.querySelectorAll<HTMLElement>(
					DomSelectors.INTERNAL_LINK,
				),
			).filter((each) => {
				const inEmbed = each.closest(EMBED);
				return !inEmbed || !section.contains(inEmbed);
			});
			const index = links.indexOf(link);
			if (index < 0) return;
			const offset = sectionLinkOffset(
				info.text,
				info.lineStart,
				info.lineEnd,
				index,
				links.map(
					(each) => each.getAttribute(DomSelectors.DATA_HREF) ?? "",
				),
			);
			return offset === undefined
				? undefined
				: { offset, sourcePath: context.sourcePath };
		},
	};
	return sections;
});

/** A link of a note's source: a wikilink or a Markdown link, or an embed of either. */
type SourceLink = {
	/** Its first character, the `[` after any embed's `!`. */
	readonly from: number;
	/** Just after its last character. */
	readonly to: number;
	/** Just inside its brackets: its target's start, or a Markdown link's text's. */
	readonly inside: number;
	/** Its target, as Reading view's `data-href` gives it. */
	readonly target: string;
	/** A wikilink's alias, after its `|`. */
	readonly alias?: string;
	readonly embed: boolean;
	readonly wikilink: boolean;
};

/** A wikilink's target as `data-href` gives it: before any alias, with a table's escape dropped. */
const wikiTargetOf = (inside: string) =>
	(inside.split("|")[0] ?? "").replace(/\\$/u, "").trim();

/** A wikilink's alias, after its first `|`, if it has one. */
const aliasOf = (inside: string) => {
	const pipe = inside.indexOf("|");
	return pipe < 0 ? {} : { alias: inside.slice(pipe + 1) };
};

const decoded = Option.liftThrowable((target: string) =>
	decodeURIComponent(target),
);

/** The Markdown link whose text opens at `open`, a `[`, if one does there. */
function markdownLinkAt(text: string, open: number): SourceLink | undefined {
	let depth = 0;
	let close = open;
	for (; close < text.length; close++) {
		const char = text[close];
		if (char === "\n") return;
		if (char === "\\") close++;
		else if (char === "[") depth++;
		else if (char === "]" && --depth === 0) break;
	}
	if (close >= text.length || text[close + 1] !== "(") return;
	let at = close + 2;
	let target: string;
	if (text[at] === "<") {
		const end = text.indexOf(">", at);
		if (end < 0 || text.slice(at, end).includes("\n")) return;
		target = text.slice(at + 1, end);
		at = end + 1;
	} else {
		const start = at;
		let parens = 0;
		for (; at < text.length; at++) {
			const char = text[at];
			if (char === "\n" || char === " " || char === "\t") break;
			if (char === "(") parens++;
			else if (char === ")" && parens-- === 0) break;
		}
		target = text.slice(start, at);
	}
	const end = text.indexOf(")", at);
	if (end < 0) return;
	// Only a title may follow the target.
	const title = text.slice(at, end);
	if (title.trim() !== "" && !/^\s+(?:"[^"\n]*"|'[^'\n]*')\s*$/u.test(title))
		return;
	return {
		embed: text[open - 1] === "!",
		from: open,
		inside: open + 1,
		target: Option.getOrElse(decoded(target), () => target),
		to: end + 1,
		wikilink: false,
	};
}

/** The wikilinks and Markdown links of `text`, embeds included, in order. */
function linksIn(text: string): SourceLink[] {
	const links: SourceLink[] = [];
	for (let at = 0; at < text.length; ) {
		if (text.startsWith("[[", at)) {
			const close = text.indexOf("]]", at + 2);
			const newline = text.indexOf("\n", at);
			if (close >= 0 && (newline < 0 || close < newline)) {
				links.push({
					embed: text[at - 1] === "!",
					from: at,
					inside: at + 2,
					target: wikiTargetOf(text.slice(at + 2, close)),
					...aliasOf(text.slice(at + 2, close)),
					to: close + 2,
					wikilink: true,
				});
				at = close + 2;
				continue;
			}
		}
		const markdown =
			text[at] === "[" ? markdownLinkAt(text, at) : undefined;
		if (markdown) {
			links.push(markdown);
			at = markdown.to;
			continue;
		}
		at++;
	}
	return links;
}

/**
 * What Reading view renders no link from, masked to spaces so offsets
 * stay: fenced code, inline code, and comments.
 */
const UNRENDERED = new RegExp(
	[
		String.raw`^[ \t]*(\x60{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[^\n]*$|(?![\s\S]))`,
		String.raw`(\x60+)[^\n]*?\2`,
		String.raw`%%[\s\S]*?%%`,
		String.raw`<!--[\s\S]*?-->`,
	].join("|"),
	"gmu",
);

/** A Markdown link's target that is a URL, which renders as an external link. */
const URL_TARGET = /^\s*[a-z][a-z0-9+.-]*:/iu;

/**
 * The offset inside the `index`th rendered internal link of the note
 * `text`'s lines `lineStart` to `lineEnd`, inclusive: its wikilinks and
 * Markdown links to notes, not embeds, outside code and comments. `hrefs`
 * are the section's rendered internal links' targets, in order; unless the
 * source's links target them one for one, the source and its rendering
 * disagree, and nothing is told.
 */
export function sectionLinkOffset(
	text: string,
	lineStart: number,
	lineEnd: number,
	index: number,
	hrefs: readonly string[],
): number | undefined {
	const lines = text.split("\n");
	if (lineStart < 0 || lineEnd < lineStart || lineEnd >= lines.length) return;
	let from = 0;
	for (const line of lines.slice(0, lineStart)) from += line.length + 1;
	let to = from;
	for (const line of lines.slice(lineStart, lineEnd + 1))
		to += line.length + 1;
	const section = text
		.slice(from, to - 1)
		.replace(UNRENDERED, (masked) => masked.replace(/[^\n]/gu, " "));
	const rendered = linksIn(section).filter(
		(link) =>
			!link.embed && (link.wikilink || !URL_TARGET.test(link.target)),
	);
	if (
		rendered.length !== hrefs.length ||
		rendered.some((link, at) => link.target !== hrefs[at])
	)
		return;
	const link = rendered[index];
	return link ? from + link.inside : undefined;
}
