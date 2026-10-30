/**
 * Where a clicked link stands in its note's text, read from the document
 * and never from the rendered lines: CodeMirror renders only the lines in
 * view, so a rendered line's index is not its line in the note.
 *
 * - **Live Preview and source mode.** CodeMirror's `posAtDOM` of the link's
 *   element, which lies inside its `[[…]]`.
 * - **Reading view.** Obsidian renders a note section by section and tells
 *   a post-processor each section's lines (`getSectionInfo`). The layer
 *   keeps each rendered section's context; a click finds its link's
 *   section, and the link of the section's source that stands where the
 *   clicked one does among the section's links.
 */
import type { EditorView } from "@codemirror/view";
import { Effect } from "effect";
import {
	type App,
	type MarkdownPostProcessorContext,
	MarkdownView,
} from "obsidian";
import type { UserEventsHost } from "../../../contracts";
import { DomSelectors } from "../../../internal/dom-selectors";

/** An embed's rendered content, whose links are another note's. */
const EMBED = ".internal-embed";

/**
 * The editor's offset of `link`, when it is an element of the active
 * note's editor.
 */
export function editorLinkOffset(
	app: App,
	link: HTMLElement,
): number | undefined {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const cm = (view?.editor as { cm?: EditorView } | undefined)?.cm;
	if (!cm?.contentDOM.contains(link)) return;
	const offset = cm.posAtDOM(link);
	return Number.isInteger(offset) && offset >= 0 ? offset : undefined;
}

/** The sections Reading view rendered, each with its post-processor's context. */
export type RenderedSections = {
	/**
	 * The offset of Reading view's `link` in the note at `sourcePath`, when
	 * its section is one of that note's and its source holds the link.
	 */
	readonly linkOffset: (
		link: HTMLElement,
		sourcePath: string,
	) => number | undefined;
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
		linkOffset: (link, sourcePath) => {
			let section: HTMLElement | null = link.parentElement;
			while (section && !contexts.has(section))
				section = section.parentElement;
			const context = section ? contexts.get(section) : undefined;
			if (!section || !context || context.sourcePath !== sourcePath)
				return;
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
			return sectionLinkOffset(
				info.text,
				info.lineStart,
				info.lineEnd,
				index,
				link.getAttribute(DomSelectors.DATA_HREF) ?? undefined,
			);
		},
	};
	return sections;
});

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

/**
 * The links Reading view renders as internal links: wikilinks and
 * Markdown links to a note, not embeds. Group 1 is an embed's `!`, group 2
 * a wikilink's inside, group 3 a Markdown link's `!`, group 4 its target.
 */
const RENDERED_LINK = /(!?)\[\[([^\]\n]*)\]\]|(!?)\[[^\]\n]*\]\(([^)\n]*)\)/gu;

/** A Markdown link's target that is a URL, which renders as an external link. */
const URL_TARGET = /^\s*<?[a-z][a-z0-9+.-]*:/iu;

/**
 * The offset inside the `index`th rendered internal link of the note
 * `text`'s lines `lineStart` to `lineEnd`, inclusive. A wikilink must
 * target `href`, the clicked link's own target, when it is given;
 * otherwise the section's source and its rendering disagree, and nothing
 * is told.
 */
export function sectionLinkOffset(
	text: string,
	lineStart: number,
	lineEnd: number,
	index: number,
	href?: string,
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
	let seen = 0;
	RENDERED_LINK.lastIndex = 0;
	for (
		let match = RENDERED_LINK.exec(section);
		match;
		match = RENDERED_LINK.exec(section)
	) {
		const [, embed, inside, mdEmbed, mdTarget] = match;
		if (embed === "!" || mdEmbed === "!") continue;
		if (inside === undefined && URL_TARGET.test(mdTarget ?? "")) continue;
		if (seen++ < index) continue;
		if (inside !== undefined && href !== undefined) {
			const target = (inside.split("|")[0] ?? "")
				.replace(/\\$/u, "")
				.trim();
			if (target !== href) return;
		}
		return from + match.index + (inside === undefined ? 1 : 2);
	}
	return;
}
