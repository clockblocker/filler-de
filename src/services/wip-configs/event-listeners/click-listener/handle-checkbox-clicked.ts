import type { App } from "obsidian";
import { MarkdownView } from "obsidian";
import { treePathToPageBasenameLegacy } from "../../../../commanders/librarian/indexing/codecs";
import type { LibrarianLegacy } from "../../../../commanders/librarian/librarian";
import type { TreePathLegacyLegacy } from "../../../../commanders/librarian/types";

/**
 * Handle checkbox click in Codex files.
 * Extracts the linked path and calls setStatus.
 */
export function handleCheckboxClicked({
	checkbox,
	librarian,
	app,
}: {
	checkbox: HTMLInputElement;
	librarian: LibrarianLegacy;
	app: App;
}): boolean {
	// Find the line container (works in both Live Preview and Reading view)
	const lineContainer =
		checkbox.closest(".cm-line") ?? // Live Preview (CodeMirror)
		checkbox.closest("li") ?? // Reading view
		checkbox.parentElement;

	if (!lineContainer) {
		return false;
	}

	// Extract link target - try DOM first, then fall back to Obsidian API
	let href = extractLinkTarget(lineContainer);
	if (!href) {
		href = extractLinkTargetViaEditor(lineContainer, app);
	}
	if (!href) {
		return false;
	}

	// Parse the link target to TreePathLegacyLegacy
	// Could be: "Library/Section/Text" or "__Text-Section" (Codex filename)
	const { rootName, treePath } = parseCodexLinkTarget(href);
	if (!rootName || treePath.length === 0) {
		console.log(
			"[handleCheckboxClicked] Failed to parse link target:",
			href,
		);
		return false;
	}

	// Determine new status from checkbox state
	// Note: checkbox.checked is the NEW state after click
	const newStatus = checkbox.checked ? "Done" : "NotStarted";

	console.log("[handleCheckboxClicked] Setting status:", {
		href,
		newStatus,
		rootName,
		treePath,
	});

	// Call librarian to update status (fire-and-forget async)
	// rootName is validated to be "Library" in parseCodexLinkTarget
	librarian
		.setStatus(rootName as "Library", treePath, newStatus)
		.catch((error) => {
			console.error(
				"[handleCheckboxClicked] Failed to set status:",
				error,
			);
		});

	return true;
}

/**
 * Check if an element is a task checkbox in reading view.
 */
export function isTaskCheckbox(
	element: HTMLElement,
): element is HTMLInputElement {
	return (
		element.tagName === "INPUT" &&
		(element as HTMLInputElement).type === "checkbox" &&
		element.classList.contains("task-list-item-checkbox")
	);
}

/**
 * Parse a Codex link target into rootName and treePath.
 *
 * Handles three formats:
 * 1. Path format: "Library/Section/Text" → root="Library", path=["Section", "Text"]
 * 2. Page filename: "001-Text-Section" → root="Library", path=["Section", "Text", "001"]
 *    (page number is extracted and included in path)
 * 3. Codex filename: "__Text-Section" or "Text-Section" → root="Library", path=["Section", "Text"]
 *    (parts are reversed and joined with `-`)
 */
function parseCodexLinkTarget(href: string): {
	rootName: string | null;
	treePath: TreePathLegacyLegacy;
} {
	// Remove leading underscores if present
	const cleanHref = href.replace(/^_+/, "");

	// Check if it's a path format (contains /)
	if (cleanHref.includes("/")) {
		const pathParts = cleanHref.split("/");
		const rootName = pathParts[0];

		// Must be in Library folder
		if (rootName !== "Library") {
			return {
				rootName: null,
				treePath: [] as unknown as TreePathLegacyLegacy,
			};
		}

		return {
			rootName,
			treePath: pathParts.slice(1) as TreePathLegacyLegacy,
		};
	}

	// Check if it's a page filename (format: "000-TextName-Parent")
	// After refactor: pages stored in parent/000-TextName-Parent.md (no Page subfolder)
	// Use the decoder to properly parse it
	try {
		const decodedPath = treePathToPageBasenameLegacy.decode(cleanHref);
		// decodedPath format: [...textPath, pageNumber]
		// e.g., "002-Mann_gegen_mann-Rammstein-Songs" → ["Songs", "Rammstein", "Mann_gegen_mann", "002"]
		return {
			rootName: "Library",
			treePath: decodedPath,
		};
	} catch {
		// Not a page filename in the expected format, continue to other formats
	}

	// Codex filename format: "Text-Section" or just "Text"
	// Split by dash and reverse to get path order
	// e.g., "Aschenputtel-Fairy_Tales" → ["Fairy_Tales", "Aschenputtel"]
	const parts = cleanHref.split("-");
	return {
		rootName: "Library", // Codex files are always in Library
		treePath: parts.toReversed() as TreePathLegacyLegacy,
	};
}

/**
 * Extract link target from line container.
 * Handles both Live Preview (CodeMirror spans) and Reading view (a tags).
 */
function extractLinkTarget(container: Element): string | null {
	// Try Reading view first: <a class="internal-link" data-href="...">
	const aLink = container.querySelector("a.internal-link");
	if (aLink) {
		return (
			aLink.getAttribute("data-href") ??
			aLink.getAttribute("href") ??
			null
		);
	}

	// Live Preview: the link target might be hidden (widget mode)
	// Try to get from visible spans first
	const allLinkSpans = Array.from(
		container.querySelectorAll(".cm-hmd-internal-link"),
	);

	// Check if we have the actual target (not just alias)
	const targetSpan = allLinkSpans.find(
		(s) =>
			s.classList.contains("cm-link-has-alias") &&
			!s.classList.contains("cm-link-alias") &&
			!s.classList.contains("cm-link-alias-pipe"),
	);

	if (targetSpan?.textContent) {
		return targetSpan.textContent;
	}

	// Widget mode: link target is hidden, need to parse from CodeMirror state
	const lineText = getLineTextFromCodeMirror(container);
	if (lineText) {
		// Parse markdown link: [[target|alias]] or [[target]]
		const linkMatch = lineText.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (linkMatch?.[1]) {
			return linkMatch[1];
		}
	}

	return null;
}

/**
 * Try to get the underlying line text from CodeMirror editor.
 * Note: This is a fallback - extractLinkTargetViaEditor is preferred.
 */
function getLineTextFromCodeMirror(lineElement: Element): string | null {
	const cmContent = lineElement.closest(".cm-content");
	if (!cmContent) {
		return null;
	}

	const cmEditor = cmContent.closest(".cm-editor");
	if (!cmEditor) {
		return null;
	}

	// Try to access EditorView via internal properties
	const editorRecord = cmEditor as unknown as Record<string, unknown>;

	// Try different paths where EditorView might be stored
	// Path 1: cmView.view (CodeMirror standard)
	// Path 2: Direct on element
	// Path 3: Through Obsidian's cm property
	type DocType = { line?: (n: number) => { text: string } };
	type StateType = { doc?: DocType };
	type ViewType = { state?: StateType };

	let doc: DocType | undefined;

	// Try cmView.view.state.doc
	const cmView = editorRecord.cmView as { view?: ViewType } | undefined;
	if (cmView?.view?.state?.doc) {
		doc = cmView.view.state.doc;
	}

	// Try cm (Obsidian's wrapper)
	if (!doc) {
		const cm = editorRecord.cm as ViewType | undefined;
		if (cm?.state?.doc) {
			doc = cm.state.doc;
		}
	}

	// Try direct state
	if (!doc) {
		const state = editorRecord.state as StateType | undefined;
		if (state?.doc) {
			doc = state.doc;
		}
	}

	if (!doc) {
		return null;
	}

	// Get the line's position by finding it in the content
	const lines = Array.from(cmContent.querySelectorAll(".cm-line"));
	const lineIndex = lines.indexOf(lineElement as Element);
	if (lineIndex === -1) {
		return null;
	}

	// Get line text (lines are 1-indexed in CodeMirror)
	try {
		if (doc.line && typeof doc.line === "function") {
			const line = doc.line(lineIndex + 1);
			return line.text;
		}
	} catch {
		// Ignore errors - fall back to null
	}

	return null;
}

/**
 * Extract link target using Obsidian's Editor API.
 * This is more reliable than trying to access CodeMirror internals.
 */
function extractLinkTargetViaEditor(
	lineElement: Element,
	app: App,
): string | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view?.editor) {
		return null;
	}

	const editor = view.editor;

	// Find which line we're on by counting cm-line elements
	const cmContent = lineElement.closest(".cm-content");
	if (!cmContent) {
		return null;
	}

	const lines = Array.from(cmContent.querySelectorAll(".cm-line"));
	const lineIndex = lines.indexOf(lineElement as Element);
	if (lineIndex === -1) {
		return null;
	}

	// Get the line content using Obsidian's Editor API
	const lineText = editor.getLine(lineIndex);
	if (!lineText) {
		return null;
	}

	// Parse markdown link: [[target|alias]] or [[target]]
	const linkMatch = lineText.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
	if (linkMatch?.[1]) {
		return linkMatch[1];
	}

	return null;
}
