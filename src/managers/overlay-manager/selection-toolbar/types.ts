/**
 * Types for selection toolbar.
 */

/**
 * Action configuration for toolbar buttons.
 */
export type ActionConfig = {
	/** Action ID used in data-action attribute */
	id: string;
	/** Display label for the button */
	label: string;
};

/**
 * Selection toolbar interface.
 */
export interface SelectionToolbar {
	/** Show the toolbar at the given position */
	show(rect: DOMRect): void;
	/** Hide the toolbar */
	hide(): void;
	/** Clean up the toolbar */
	destroy(): void;
	/** Set the actions to display */
	setActions(actions: ActionConfig[]): void;
}

/**
 * Options for creating a selection toolbar.
 */
export type CreateSelectionToolbarOptions = {
	/** Container element to attach the toolbar to */
	container: HTMLElement;
};
