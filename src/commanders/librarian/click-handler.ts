import type { App } from "obsidian";
import { MarkdownView } from "obsidian";
import { getParsedUserSettings } from "../../global-state/global-state";
import type { ObsidianVaultActionManager } from "../../obsidian-vault-action-manager";
import type { Librarian } from "./librarian";
import { CODEX_PREFIX } from "./types/literals";
import type { CoreNameChainFromRoot } from "./types/split-basename";

/**
 * Handle codex checkbox click.
 * Parses link target, converts to coreNameChain, calls setStatus.
 */
export async function handleCodexCheckboxClick({
	checkbox,
	vaultActionManager,
	librarian,
	app,
}: {
	checkbox: HTMLInputElement;
	vaultActionManager: ObsidianVaultActionManager;
	librarian: Librarian;
	app: App;
}): Promise<boolean> {
	const pwd = await vaultActionManager.pwd();
	if (!pwd.basename.startsWith(CODEX_PREFIX)) {
		return false;
	}

	const lineContainer =
		checkbox.closest(".cm-line") ?? // Live Preview
		checkbox.closest("li") ?? // Reading view
		checkbox.parentElement;

	if (!lineContainer) {
		return false;
	}

	// Extract link target from DOM or editor
	let href = extractLinkTarget(lineContainer);
	if (!href) {
		href = extractLinkTargetViaEditor(lineContainer, app);
	}
	if (!href) {
		return false;
	}

	// Parse to coreNameChain
	const coreNameChain = parseCodexLinkTarget(href);
	if (!coreNameChain || coreNameChain.length === 0) {
		console.log("[handleCodexCheckboxClick] Failed to parse:", href);
		return false;
	}

	// Determine new status (checkbox.checked is NEW state after click)
	const newStatus = checkbox.checked ? "Done" : "NotStarted";

	console.log("[handleCodexCheckboxClick]", {
		coreNameChain,
		href,
		newStatus,
	});

	// Fire-and-forget async
	librarian.setStatus(coreNameChain, newStatus).catch((error) => {
		console.error("[handleCodexCheckboxClick] setStatus failed:", error);
	});

	return true;
}

/**
 * Check if element is a task checkbox.
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
 * Parse codex link target to CoreNameChainFromRoot.
 * Reads suffixDelimiter from global settings.
 *
 * New format uses suffixDelimiter:
 * - Codex links: "Aschenputtel-Fairy_Tales" → ["Fairy_Tales", "Aschenputtel"]
 * - With prefix: "__Fairy_Tales" → ["Fairy_Tales"] (section codex)
 * - Scroll links: "NoteName-Parent-GrandParent" → ["GrandParent", "Parent", "NoteName"]
 */
export function parseCodexLinkTarget(
	href: string,
): CoreNameChainFromRoot | null {
	// Strip codex prefix if present
	const cleanHref = href.startsWith(CODEX_PREFIX)
		? href.slice(CODEX_PREFIX.length)
		: href;

	if (!cleanHref) {
		return null;
	}

	// Split by delimiter and reverse (suffix is parent chain reversed)
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	const parts = cleanHref.split(suffixDelimiter);
	return parts.toReversed();
}

// ─── DOM Extraction Helpers (battle-tested from old implementation) ────────

/**
 * Extract link target from line container.
 * Handles both Live Preview and Reading view.
 */
function extractLinkTarget(container: Element): string | null {
	// Reading view: <a class="internal-link" data-href="...">
	const aLink = container.querySelector("a.internal-link");
	if (aLink) {
		return (
			aLink.getAttribute("data-href") ??
			aLink.getAttribute("href") ??
			null
		);
	}

	// Live Preview: spans with link classes
	const allLinkSpans = Array.from(
		container.querySelectorAll(".cm-hmd-internal-link"),
	);

	// Check for actual target (not alias)
	const targetSpan = allLinkSpans.find(
		(s) =>
			s.classList.contains("cm-link-has-alias") &&
			!s.classList.contains("cm-link-alias") &&
			!s.classList.contains("cm-link-alias-pipe"),
	);

	if (targetSpan?.textContent) {
		return targetSpan.textContent;
	}

	// Widget mode: parse from CodeMirror state
	const lineText = getLineTextFromCodeMirror(container);
	if (lineText) {
		const linkMatch = lineText.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (linkMatch?.[1]) {
			return linkMatch[1];
		}
	}

	return null;
}

/**
 * Extract link via Obsidian's Editor API.
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
	const cmContent = lineElement.closest(".cm-content");
	if (!cmContent) {
		return null;
	}

	const lines = Array.from(cmContent.querySelectorAll(".cm-line"));
	const lineIndex = lines.indexOf(lineElement as Element);
	if (lineIndex === -1) {
		return null;
	}

	const lineText = editor.getLine(lineIndex);
	if (!lineText) {
		return null;
	}

	const linkMatch = lineText.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
	if (linkMatch?.[1]) {
		return linkMatch[1];
	}

	return null;
}

/**
 * Get line text from CodeMirror internals.
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

	// Access EditorView via internal properties
	const editorRecord = cmEditor as unknown as Record<string, unknown>;

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

	const lines = Array.from(cmContent.querySelectorAll(".cm-line"));
	const lineIndex = lines.indexOf(lineElement as Element);
	if (lineIndex === -1) {
		return null;
	}

	try {
		if (doc.line && typeof doc.line === "function") {
			const line = doc.line(lineIndex + 1);
			return line.text;
		}
	} catch {
		// Ignore
	}

	return null;
}
