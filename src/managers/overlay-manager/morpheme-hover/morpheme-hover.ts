/**
 * Hovering a morpheme of a Reading note's morphemes line (`morphemes-line.ts`)
 * reveals that one morpheme with `tf-morpheme-hover`, and nothing on its
 * neighbours, as tf-demo's morphemes line does: in the editor as a
 * decoration, in Reading view as a class on the rendered piece. The reveal
 * goes as the pointer leaves the piece, the view scrolls or the text
 * changes. The section's links are no unit parts (`unit-parts.ts`), so the
 * unit hover leaves them to this one.
 */
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
import { elementOf } from "../unit-hover/unit-hover";
import { morphemeAt, plainPieces } from "./morphemes-line";

/**
 * Each morpheme Reading view renders has `tf-morpheme`, and the revealed
 * one `tf-morpheme-hover` too; the editor's decoration has only the latter,
 * so the Reading-view listeners never touch the editor's DOM. styles.css
 * draws the reveal under the letters.
 */
const MORPHEME_CLASS = "tf-morpheme";
const MORPHEME_HOVER_CLASS = "tf-morpheme-hover";
const morphemeHoverMark = Decoration.mark({ class: MORPHEME_HOVER_CLASS });

const within = (
	{ clientX: x, clientY: y }: MouseEvent,
	rect: { left: number; right: number; top: number; bottom: number },
) => rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom;

/**
 * Finds the morpheme under the pointer in the document, not in its DOM: an
 * unlinked piece, such as `ge`, is bare text, and Live Preview shows only a
 * link's alias. The pointer's position is a boundary between characters,
 * so the character under it is the one on either side whose box holds it.
 */
class EditorMorphemeHover {
	decorations: DecorationSet = Decoration.none;
	/** The decorated range, so moving over the same morpheme changes nothing. */
	private shown = "";

	constructor(private readonly view: EditorView) {}

	update(update: ViewUpdate): void {
		if (update.docChanged) this.forget();
	}

	move(event: MouseEvent): void {
		const range = this.morphemeUnder(event);
		if (!range) {
			this.clear();
			return;
		}
		this.show(
			`${range.from}-${range.to}`,
			Decoration.set([morphemeHoverMark.range(range.from, range.to)]),
		);
	}

	/** The pointer left the editor's content for `to`. */
	leave(to: EventTarget | null): void {
		const node = elementOf(to);
		if (!node || !this.view.contentDOM.contains(node)) this.clear();
	}

	clear(): void {
		this.show("", Decoration.none);
	}

	/** The shown text of the morpheme under the pointer, in the document. */
	private morphemeUnder(event: MouseEvent) {
		const lineElement = elementOf(event.target)?.closest(
			DomSelectors.CM_LINE,
		);
		if (!lineElement || !this.view.contentDOM.contains(lineElement))
			return null;
		const { doc } = this.view.state;
		const line = doc.lineAt(this.view.posAtDOM(lineElement));
		// Cheap before the layout reads below: most lines are no such line.
		if (!line.text.includes(MORPHEMES_LINE_CLASS)) return null;
		const position = this.view.posAtCoords({
			x: event.clientX,
			y: event.clientY,
		});
		if (position === null) return null;
		const under = [position, position - 1].find((at) => {
			if (at < line.from || at >= line.to) return false;
			const box = this.view.coordsForChar(at);
			return box !== null && within(event, box);
		});
		if (under === undefined) return null;
		const morpheme = morphemeAt(line.text, under - line.from);
		return morpheme
			? {
					from: line.from + morpheme.shown.from,
					to: line.from + morpheme.shown.to,
				}
			: null;
	}

	private show(shown: string, decorations: DecorationSet): void {
		if (shown === this.shown) return;
		this.shown = shown;
		this.decorations = decorations;
		// Plugins' decorations are read as the view updates.
		this.view.dispatch({});
	}

	private forget(): void {
		this.shown = "";
		this.decorations = Decoration.none;
	}
}

const editorMorphemeHover = ViewPlugin.fromClass(EditorMorphemeHover, {
	decorations: (plugin) => plugin.decorations,
	eventHandlers: {
		mousemove(event) {
			this.move(event);
		},
		mouseout(event) {
			this.leave(event.relatedTarget);
		},
		scroll() {
			this.clear();
		},
	},
});

/**
 * Gives each rendered morpheme of `section`'s morphemes lines the
 * `tf-morpheme` class, so it can be hovered: a link gets it as it is, and
 * the plain letters between links, bare text, are wrapped in a span. The
 * line ends at its `<br>`, or at a line break in a text node.
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
			} else if (node.nodeType === 3 && wrapPlain(node as Text)) break;
			node = next;
		}
	}
}

/** Wraps `text`'s morphemes; whether the line ended in it. */
function wrapPlain(text: Text): boolean {
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

/** Reading view's morpheme `node` belongs to, if any. */
const renderedMorphemeOf = (node: EventTarget | null): Element | null =>
	elementOf(node)?.closest(`.${MORPHEME_CLASS}`) ?? null;

/**
 * Reveals morphemes as the pointer hovers them, in every editor and in
 * Reading view of the main window, for as long as the caller's scope is
 * open.
 */
export const listenForMorphemeHover = Effect.fnUntraced(function* (
	document: Document,
) {
	const host = yield* PluginHost;
	yield* host.editorExtension(editorMorphemeHover);
	yield* host.markdownPostProcessor(markRenderedMorphemes);

	let lit: Element | null = null;
	const clear = () => {
		lit?.classList.remove(MORPHEME_HOVER_CLASS);
		lit = null;
	};
	yield* Effect.addFinalizer(() => Effect.sync(clear));
	yield* host.onDom(document, "mouseover", (event) => {
		const morpheme = renderedMorphemeOf(event.target);
		if (!morpheme || morpheme === lit) return;
		clear();
		lit = morpheme;
		morpheme.classList.add(MORPHEME_HOVER_CLASS);
	});
	yield* host.onDom(document, "mouseout", (event) => {
		if (renderedMorphemeOf(event.relatedTarget) !== lit) clear();
	});
	// Captured, so a scroll inside any pane reaches it.
	yield* host.onDom(window, "scroll", clear, true);
});
