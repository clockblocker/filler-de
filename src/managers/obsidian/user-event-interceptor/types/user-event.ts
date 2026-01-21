/**
 * User event types - discriminated union with callbacks for DOM/editor actions.
 *
 * Events include callbacks so business logic (Librarian) can:
 * - Modify clipboard content
 * - Change editor selection
 * - Insert text at specific positions
 */

import type { EditorView } from "@codemirror/view";
import { z } from "zod";

import type { SplitPathToMdFile } from "../../vault-action-manager/types/split-path";

const InterceptableUserEventKindSchema = z.enum([
	"CheckboxClicked",
	"PropertyCheckboxClicked",
	"WikilinkCompleted",
	"ClipboardCopy",
	"SelectAll",
]);
export type InterceptableUserEventKind = z.infer<
	typeof InterceptableUserEventKindSchema
>;
export const InterceptableUserEventKind = InterceptableUserEventKindSchema.enum;

// ─── Event Types ───

/**
 * Emitted when a task checkbox is clicked in any markdown file.
 */
export type CheckboxClickedEvent = {
	kind: typeof InterceptableUserEventKind.CheckboxClicked;
	/** New state after click (checkbox.checked) */
	checked: boolean;
	/** File where checkbox was clicked */
	splitPath: SplitPathToMdFile;
	/** Line content after "- [ ] " or "- [x] " */
	lineContent: string;
};

/**
 * Emitted when a property checkbox (frontmatter) is clicked.
 */
export type PropertyCheckboxClickedEvent = {
	kind: typeof InterceptableUserEventKind.PropertyCheckboxClicked;
	/** New state after click */
	checked: boolean;
	/** File where property checkbox was clicked */
	splitPath: SplitPathToMdFile;
	/** Property name (e.g., "status") */
	propertyName: string;
};

/**
 * Emitted when user completes a wikilink (cursor right after ]]).
 */
export type WikilinkCompletedEvent = {
	kind: typeof InterceptableUserEventKind.WikilinkCompleted;
	/** Raw content between [[ and ]] */
	linkContent: string;
	/** Position before ]] */
	closePos: number;
	/** Callback to insert alias at closePos */
	insertAlias: (alias: string) => void;
};

/**
 * Emitted on copy/cut when content contains strippable metadata.
 */
export type ClipboardCopyEvent = {
	kind: typeof InterceptableUserEventKind.ClipboardCopy;
	/** Original selected text */
	originalText: string;
	/** True if cut, false if copy */
	isCut: boolean;
	/** Prevent default clipboard behavior */
	preventDefault: () => void;
	/** Set custom clipboard data */
	setClipboardData: (text: string) => void;
};

/**
 * Emitted on Ctrl/Cmd+A in source mode.
 */
export type SelectAllEvent = {
	kind: typeof InterceptableUserEventKind.SelectAll;
	/** Full document content */
	content: string;
	/** CodeMirror view for dispatching selection changes */
	view: EditorView;
	/** Prevent default select-all behavior */
	preventDefault: () => void;
	/** Set custom selection range */
	setSelection: (from: number, to: number) => void;
};

// ─── Union Type ───

export type UserEvent =
	| CheckboxClickedEvent
	| PropertyCheckboxClickedEvent
	| WikilinkCompletedEvent
	| ClipboardCopyEvent
	| SelectAllEvent;

// ─── Handler ───

export type UserEventHandler = (event: UserEvent) => void;

export type Teardown = () => void;
