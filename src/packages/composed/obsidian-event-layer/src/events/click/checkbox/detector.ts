/**
 * Task checkbox clicks (`- [ ]` / `- [x]`) in a note's content.
 *
 * A handler that takes the click prevents Obsidian's toggle: the mousedown
 * is stopped here, and the click stream blocks its mouseup and click.
 */
import { Effect } from "effect";
import type { App } from "obsidian";
import type { EventDispatch } from "../../../internal/dispatch";
import { DomSelectors } from "../../../internal/dom-selectors";
import { PayloadKind } from "../../../types/payload-base";
import { getCurrentFilePath } from "../../get-current-file-path";
import { editorLineOf } from "../editor-line";
import type { ClickSubscriber } from "../generic-click-detector";
import { CheckboxCodec } from "./codec";

export function checkboxClick(dispatch: EventDispatch): ClickSubscriber {
	const { app } = dispatch.host;
	return {
		kind: PayloadKind.CheckboxClicked,
		onMouseDown: (target, evt) => {
			if (!isTaskCheckbox(target)) return;

			const splitPath = getCurrentFilePath(app);
			if (!splitPath) return;

			const lineContent = extractLineContent(app, target);
			if (lineContent === null) return;

			// The click stream listens on mousedown, before the browser toggles
			// the checkbox: `checked` is the state the user sees and clicked.
			const payload = CheckboxCodec.encode({
				checked: target.checked,
				lineContent,
				splitPath,
			});

			const handler = dispatch.decide(
				PayloadKind.CheckboxClicked,
				payload,
			);
			// None: Obsidian toggles the checkbox.
			if (!handler) return;

			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();

			dispatch.run(
				PayloadKind.CheckboxClicked,
				handler,
				Effect.succeed(payload),
			);
		},
	};
}

function isTaskCheckbox(element: HTMLElement): element is HTMLInputElement {
	return (
		element.tagName === "INPUT" &&
		(element as HTMLInputElement).type === "checkbox" &&
		element.classList.contains(DomSelectors.TASK_CHECKBOX_CLASS)
	);
}

function extractLineContent(
	app: App,
	checkbox: HTMLInputElement,
): string | null {
	const lineContainer =
		checkbox.closest(DomSelectors.CM_LINE) ??
		checkbox.closest("li") ??
		checkbox.parentElement;

	if (!lineContainer) return null;

	const editorLine = editorLineOf(app, lineContainer);
	if (editorLine) return stripCheckboxPrefix(editorLine);

	const textContent = lineContainer.textContent;
	if (textContent) return stripCheckboxPrefix(textContent);

	return null;
}

function stripCheckboxPrefix(line: string): string {
	const match = line.match(/^[\s]*-\s*\[[xX\s]\]\s*/);
	if (match) return line.slice(match[0].length);
	return line.trim();
}
