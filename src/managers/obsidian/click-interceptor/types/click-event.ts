/**
 * Click events emitted by ClickInterceptor.
 */

import type { SplitPathToMdFile } from "../../vault-action-manager/types/split-path";

// ─── Event Types ───

export type ClickEventType = "CheckboxClicked" | "PropertyCheckboxClicked";

// ─── Events ───

/**
 * Emitted when a task checkbox is clicked in any markdown file.
 */
export type CheckboxClickedEvent = {
	kind: "CheckboxClicked";
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
	kind: "PropertyCheckboxClicked";
	/** New state after click */
	checked: boolean;
	/** File where property checkbox was clicked */
	splitPath: SplitPathToMdFile;
	/** Property name (e.g., "status") */
	propertyName: string;
};

export type ClickEvent = CheckboxClickedEvent | PropertyCheckboxClickedEvent;

// ─── Handler ───

export type ClickEventHandler = (event: ClickEvent) => void;

export type Teardown = () => void;
