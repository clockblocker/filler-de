/**
 * Hovering one part of a unit highlights all of its parts (`unit-parts.ts`),
 * the hovered one too, with `tf-unit-hover`: in the editor as decorations,
 * in Reading view as a class on the rendered links. The highlight goes as
 * the pointer leaves the link, the view scrolls or the text changes.
 */
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { Effect, Predicate } from "effect";
import { DomSelectors } from "../../../utils/dom-selectors";
import { PluginHost } from "../../obsidian/host/plugin-host";
import { isUnitLinkTarget, paragraphAt, unitPartsAt } from "./unit-parts";

const UNIT_HOVER_CLASS = "tf-unit-hover";
const unitHoverMark = Decoration.mark({ class: UNIT_HOVER_CLASS });

/**
 * `node`, if it is an element. Not by `instanceof`: an editor in a popout
 * window has that window's `Element`.
 */
const elementOf = (node: EventTarget | null): Element | null =>
	Predicate.hasProperty(node, "closest") && Predicate.isFunction(node.closest)
		? (node as Element)
		: null;

/** The editor's link `node` belongs to, if any. */
const editorLinkOf = (node: EventTarget | null): Element | null =>
	elementOf(node)?.closest(DomSelectors.CM_INTERNAL_LINK) ?? null;

/**
 * Finds the hovered link in the document, not in its DOM: Live Preview
 * shows only a link's alias, so the target is read from the text at the
 * link's position.
 */
class EditorUnitHover {
	decorations: DecorationSet = Decoration.none;
	/** The decorated ranges, so hovering the same unit again changes nothing. */
	private shown = "";

	constructor(private readonly view: EditorView) {}

	update(update: ViewUpdate): void {
		if (update.docChanged) this.forget();
	}

	over(link: Element): void {
		const { doc } = this.view.state;
		const offset = this.view.posAtDOM(link);
		const paragraph = paragraphAt(doc, offset);
		const parts = unitPartsAt(paragraph.text, offset - paragraph.from).map(
			({ from, to }) => ({
				from: paragraph.from + from,
				to: paragraph.from + to,
			}),
		);
		this.show(
			parts.map(({ from, to }) => `${from}-${to}`).join(","),
			Decoration.set(
				parts.map(({ from, to }) => unitHoverMark.range(from, to)),
			),
		);
	}

	/**
	 * The pointer left a link for `to`: the highlight stays only if `to` is
	 * a link of this editor, whose own `mouseover` decides. A pointer
	 * moving fast can jump straight to a link of another editor, and that
	 * one's `mouseover` reaches only its own plugin.
	 */
	leave(to: EventTarget | null): void {
		const link = editorLinkOf(to);
		if (!link || !this.view.contentDOM.contains(link)) this.clear();
	}

	clear(): void {
		this.show("", Decoration.none);
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

const editorUnitHover = ViewPlugin.fromClass(EditorUnitHover, {
	decorations: (plugin) => plugin.decorations,
	eventHandlers: {
		mouseout(event) {
			this.leave(event.relatedTarget);
		},
		mouseover(event) {
			const link = editorLinkOf(event.target);
			if (link) this.over(link);
		},
		scroll() {
			this.clear();
		},
	},
});

/** Reading view's unit link `node` belongs to, if any. */
function renderedLinkOf(node: EventTarget | null): Element | null {
	const link = elementOf(node)?.closest(DomSelectors.INTERNAL_LINK);
	const target = link?.getAttribute(DomSelectors.DATA_HREF);
	return link && target && isUnitLinkTarget(target) ? link : null;
}

/** The rendered block a link stands in, as a paragraph holds its lines. */
const RENDERED_BLOCK = "p, li, td, th, h1, h2, h3, h4, h5, h6";

/** The rendered links of `link`'s unit: those of its block with its target. */
function renderedPartsOf(link: Element): Element[] {
	const target = link.getAttribute(DomSelectors.DATA_HREF);
	const block = link.closest(RENDERED_BLOCK) ?? link.parentElement;
	if (!block) return [link];
	return [...block.querySelectorAll(DomSelectors.INTERNAL_LINK)].filter(
		(other) => other.getAttribute(DomSelectors.DATA_HREF) === target,
	);
}

/**
 * Highlights units as the pointer hovers their parts, in every editor and
 * in Reading view of the main window, for as long as the caller's scope is
 * open.
 */
export const listenForUnitHover = Effect.fnUntraced(function* (
	document: Document,
) {
	const host = yield* PluginHost;
	yield* host.editorExtension(editorUnitHover);

	let lit: readonly Element[] = [];
	const clear = () => {
		for (const part of lit) part.classList.remove(UNIT_HOVER_CLASS);
		lit = [];
	};
	yield* Effect.addFinalizer(() => Effect.sync(clear));
	yield* host.onDom(document, "mouseover", (event) => {
		const link = renderedLinkOf(event.target);
		if (!link || lit.includes(link)) return;
		clear();
		lit = renderedPartsOf(link);
		for (const part of lit) part.classList.add(UNIT_HOVER_CLASS);
	});
	yield* host.onDom(document, "mouseout", (event) => {
		if (!renderedLinkOf(event.relatedTarget)) clear();
	});
	// Captured, so a scroll inside any pane reaches it.
	yield* host.onDom(window, "scroll", clear, true);
});
