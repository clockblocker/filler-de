/**
 * Each morpheme a Reading note's morphemes line shows (`morphemes-line.ts`)
 * carries a fixed `tf-morpheme` mark: in the editor a decoration over its
 * visible text, in Reading view its link or a span around its letters.
 * styles.css reveals the one under the pointer with `:hover`, as tf-demo's
 * morphemes line does, so the reveal needs no listener and nothing stays
 * lit as the view changes. The section's links are no unit parts
 * (`unit-parts.ts`), so the unit hover leaves them to this one.
 */
import type { Text } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { MORPHEMES_LINE_CLASS } from "@textfresser/lemma-note-codec";
import { Effect } from "effect";
import { DomSelectors } from "../../../utils/dom-selectors";
import { PluginHost } from "../../obsidian/host/plugin-host";
import { morphemesOf, plainPieces } from "./morphemes-line";

/** Each shown morpheme's class; styles.css draws its reveal under it. */
const MORPHEME_CLASS = "tf-morpheme";
const morphemeMark = Decoration.mark({ class: MORPHEME_CLASS });

/**
 * The marks of the morphemes lines `doc` holds within `ranges`, the parts
 * an editor draws. Only a line with the hook's class is parsed.
 */
export function morphemeMarks(
	doc: Text,
	ranges: readonly { readonly from: number; readonly to: number }[],
): DecorationSet {
	const marks = [];
	let after = -1;
	for (const { from, to } of ranges) {
		for (let at = Math.max(from, after + 1); at <= to; ) {
			const line = doc.lineAt(at);
			if (line.text.includes(MORPHEMES_LINE_CLASS))
				for (const morpheme of morphemesOf(line.text))
					marks.push(
						morphemeMark.range(
							line.from + morpheme.from,
							line.from + morpheme.to,
						),
					);
			after = line.to;
			at = line.to + 1;
		}
	}
	return Decoration.set(marks);
}

/** Marks the morphemes an editor draws, again as its text or viewport moves. */
const editorMorphemes = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = morphemeMarks(
				view.state.doc,
				view.visibleRanges,
			);
		}

		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged)
				this.decorations = morphemeMarks(
					update.state.doc,
					update.view.visibleRanges,
				);
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);

/**
 * Gives each rendered morpheme of `section`'s morphemes lines the
 * `tf-morpheme` class: a link gets it as it is, and the plain letters
 * between links, bare text, are wrapped in a span. The line ends at its
 * `<br>`, or at a line break in a text node.
 */
export function markRenderedMorphemes(section: HTMLElement): void {
	for (const hook of section.querySelectorAll(`.${MORPHEMES_LINE_CLASS}`)) {
		let node = hook.nextSibling;
		while (node) {
			const next = node.nextSibling;
			if (node.nodeType === 1) {
				const element = node as Element;
				if (element.tagName === "BR") break;
				if (element.matches(DomSelectors.INTERNAL_LINK))
					element.classList.add(MORPHEME_CLASS);
			} else if (
				node.nodeType === 3 &&
				wrapPlain(node as globalThis.Text)
			)
				break;
			node = next;
		}
	}
}

/** Wraps `text`'s morphemes; whether the line ended in it. */
function wrapPlain(text: globalThis.Text): boolean {
	const { pieces, rest } = plainPieces(text.data);
	if (!pieces.some(({ morpheme }) => morpheme)) return rest !== null;
	const document = text.ownerDocument;
	const fragment = document.createDocumentFragment();
	for (const piece of pieces) {
		if (!piece.morpheme) {
			fragment.append(piece.text);
			continue;
		}
		const span = document.createElement("span");
		span.className = MORPHEME_CLASS;
		span.textContent = piece.text;
		fragment.append(span);
	}
	if (rest !== null) fragment.append(rest);
	text.replaceWith(fragment);
	return rest !== null;
}

/**
 * Marks the morphemes of every editor and of Reading view for as long as
 * the caller's scope is open.
 */
export const markMorphemes = Effect.gen(function* () {
	const host = yield* PluginHost;
	yield* host.editorExtension(editorMorphemes);
	yield* host.markdownPostProcessor(markRenderedMorphemes);
});
