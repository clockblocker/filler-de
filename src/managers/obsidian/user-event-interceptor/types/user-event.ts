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
	"ActionClicked",
	"SelectionChanged",
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

/**
 * Emitted when an action button ([data-action]) is clicked.
 * Includes toolbar buttons, edge zones, overflow menu items.
 */
export type ActionClickedEvent = {
	kind: typeof InterceptableUserEventKind.ActionClicked;
	/** The action ID from the data-action attribute */
	actionId: string;
	/** The button element that was clicked */
	button: HTMLElement;
};

/**
 * Emitted when text selection changes (mouseup, keyup with selection keys).
 * Used to trigger toolbar recompute.
 */
export type SelectionChangedEvent = {
	kind: typeof InterceptableUserEventKind.SelectionChanged;
	/** True if there's currently a text selection */
	hasSelection: boolean;
	/** The selected text (empty string if no selection) */
	selectedText: string;
	/** Source of the selection change */
	source: "mouse" | "keyboard" | "drag";
};

// ─── Union Type ───

export type UserEvent =
	| CheckboxClickedEvent
	| PropertyCheckboxClickedEvent
	| WikilinkCompletedEvent
	| ClipboardCopyEvent
	| SelectAllEvent
	| ActionClickedEvent
	| SelectionChangedEvent;

// ─── Handler ───

export type UserEventHandler = (event: UserEvent) => void;

export type Teardown = () => void;
