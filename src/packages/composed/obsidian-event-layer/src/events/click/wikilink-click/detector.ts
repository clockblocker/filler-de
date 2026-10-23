/**
 * Internal link (wikilink) clicks, in reading mode (`a.internal-link`) and
 * in the editor (`.cm-hmd-internal-link`). A click with a modifier is
 * Obsidian's, for a new tab and the like.
 *
 * A handler that takes the click prevents Obsidian's navigation; when it
 * answers passthrough, the link is opened as Obsidian would have, through
 * the host's workspace, in the same fiber.
 */
import { Effect } from "effect";
import type { App } from "obsidian";
import type { EventDispatch } from "../../../internal/dispatch";
import { DomSelectors } from "../../../internal/dom-selectors";
import { wikilinkHelper } from "../../../internal/wikilink-helper";
import { PayloadKind } from "../../../types/payload-base";
import { getCurrentFilePath } from "../../get-current-file-path";
import { editorLineOf } from "../editor-line";
import type { ClickSubscriber } from "../generic-click-detector";
import { WikilinkClickCodec } from "./codec";
import type { WikiTarget } from "./payload";

export function wikilinkClick(dispatch: EventDispatch): ClickSubscriber {
	const { app, openLink } = dispatch.host;
	return (target, evt) => {
		const linkElement = findLinkElement(target);
		if (!linkElement) return;

		if (evt.ctrlKey || evt.metaKey || evt.shiftKey || evt.altKey) return;

		const splitPath = getCurrentFilePath(app);
		if (!splitPath) return;

		const wikiTarget = extractLinkData(app, linkElement, target);
		if (!wikiTarget) return;

		const blockContent = extractBlockContent(app, linkElement);
		if (blockContent === null) return;

		const payload = WikilinkClickCodec.encode({
			blockContent,
			splitPath,
			wikiTarget,
		});

		const handler = dispatch.decide(PayloadKind.WikilinkClicked, payload);
		// None: Obsidian navigates.
		if (!handler) return;

		evt.preventDefault();
		dispatch.run(
			PayloadKind.WikilinkClicked,
			handler,
			Effect.succeed(payload),
			// Passthrough: the navigation prevented above, as Obsidian does it.
			(result) =>
				result.outcome === "passthrough"
					? openLink(wikiTarget.basename, payload.sourcePath)
					: Effect.void,
		);
	};
}

function findLinkElement(target: HTMLElement): HTMLElement | null {
	// Check for reading mode: a.internal-link
	const readingModeLink = target.closest(
		DomSelectors.INTERNAL_LINK,
	) as HTMLElement | null;
	if (readingModeLink) {
		return readingModeLink;
	}

	// Check for edit mode: .cm-hmd-internal-link
	const editModeLink = target.closest(
		DomSelectors.CM_INTERNAL_LINK,
	) as HTMLElement | null;
	if (editModeLink) {
		return editModeLink;
	}

	return null;
}

function extractLinkData(
	app: App,
	linkElement: HTMLElement,
	clickedElement: HTMLElement,
): WikiTarget | null {
	// Reading mode: get from data-href attribute
	if (linkElement.classList.contains(DomSelectors.INTERNAL_LINK_CLASS)) {
		const href = linkElement.getAttribute(DomSelectors.DATA_HREF);
		if (!href) return null;

		const displayText = linkElement.textContent ?? href;
		// If displayText differs from href, it's an alias
		const alias = displayText !== href ? displayText : undefined;
		return { alias, basename: href };
	}

	// Edit mode: parse from line content
	return extractLinkDataFromEditMode(app, linkElement, clickedElement);
}

function extractLinkDataFromEditMode(
	app: App,
	linkElement: HTMLElement,
	clickedElement: HTMLElement,
): WikiTarget | null {
	// In edit mode, the link spans might be split. Get the line and find the link.
	const lineElement = linkElement.closest(DomSelectors.CM_LINE);
	if (!lineElement) return null;

	const lineText = editorLineOf(app, lineElement);
	if (!lineText) return null;

	// Get clicked text to match against links
	const clickedText = clickedElement.textContent ?? "";

	// Find all wikilinks in the line using matcher
	const nextMatch = wikilinkHelper.createMatcher(lineText);
	let match = nextMatch();

	while (match !== null) {
		const basename = match.target;
		const alias = match.alias;
		const displayText = alias ?? basename;

		// Match by display text (may be partial due to CM spans)
		if (
			displayText.includes(clickedText) ||
			clickedText.includes(displayText)
		) {
			return { alias, basename };
		}
		match = nextMatch();
	}

	// Fallback: try to get any link from the line
	const simpleMatch = lineText.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
	if (simpleMatch?.[1]) {
		const basename = simpleMatch[1];
		const alias = simpleMatch[2]; // undefined if no alias
		return { alias, basename };
	}

	return null;
}

function extractBlockContent(
	app: App,
	linkElement: HTMLElement,
): string | null {
	const lineContainer =
		linkElement.closest(DomSelectors.CM_LINE) ??
		linkElement.closest("p") ??
		linkElement.closest("li") ??
		linkElement.parentElement;

	if (!lineContainer) return null;

	const editorLine = editorLineOf(app, lineContainer);
	if (editorLine) {
		return editorLine;
	}

	return lineContainer.textContent ?? null;
}
