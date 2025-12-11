import type { App } from "obsidian";
import { MarkdownView } from "obsidian";
import { treePathToPageBasename } from "../../../../commanders/librarian/indexing/codecs";
import type { TreePath } from "../../../../commanders/librarian/types";

export function parseCodexLinkTarget(href: string): {
	rootName: string | null;
	treePath: TreePath;
} {
	const cleanHref = href.replace(/^_+/, "");

	if (cleanHref.includes("/")) {
		const pathParts = cleanHref.split("/");
		const rootName = pathParts[0];

		if (rootName !== "Library") {
			return { rootName: null, treePath: [] as unknown as TreePath };
		}

		return {
			rootName,
			treePath: pathParts.slice(1) as TreePath,
		};
	}

	try {
		const decodedPath = treePathToPageBasename.decode(cleanHref);
		return {
			rootName: "Library",
			treePath: decodedPath,
		};
	} catch {
		// fall through
	}

	const parts = cleanHref.split("-");
	return {
		rootName: "Library",
		treePath: parts.toReversed() as TreePath,
	};
}

export function extractCodexLinkTarget(
	container: Element,
	app: App,
): string | null {
	const aLink = container.querySelector("a.internal-link");
	if (aLink) {
		return (
			aLink.getAttribute("data-href") ??
			aLink.getAttribute("href") ??
			null
		);
	}

	const allLinkSpans = Array.from(
		container.querySelectorAll(".cm-hmd-internal-link"),
	);

	const targetSpan = allLinkSpans.find(
		(s) =>
			s.classList.contains("cm-link-has-alias") &&
			!s.classList.contains("cm-link-alias") &&
			!s.classList.contains("cm-link-alias-pipe"),
	);

	if (targetSpan?.textContent) {
		return targetSpan.textContent;
	}

	const lineText = getLineTextFromCodeMirror(container);
	if (lineText) {
		const linkMatch = lineText.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (linkMatch?.[1]) {
			return linkMatch[1];
		}
	}

	return extractLinkTargetViaEditor(container, app);
}

function getLineTextFromCodeMirror(lineElement: Element): string | null {
	const cmContent = lineElement.closest(".cm-content");
	if (!cmContent) {
		return null;
	}

	const cmEditor = cmContent.closest(".cm-editor");
	if (!cmEditor) {
		return null;
	}

	const editorRecord = cmEditor as unknown as Record<string, unknown>;

	type DocType = { line?: (n: number) => { text: string } };
	type StateType = { doc?: DocType };
	type ViewType = { state?: StateType };

	let doc: DocType | undefined;

	const cmView = editorRecord.cmView as { view?: ViewType } | undefined;
	if (cmView?.view?.state?.doc) {
		doc = cmView.view.state.doc;
	}

	if (!doc) {
		const cm = editorRecord.cm as ViewType | undefined;
		if (cm?.state?.doc) {
			doc = cm.state.doc;
		}
	}

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
		return null;
	}

	return null;
}

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
