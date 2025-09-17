import { ActionName, ActionNames } from 'actions/actions';

export const ACTION_LABELS: Record<ActionName, string> = {
	Generate: 'Generate',
	UpdateActionsBlock: 'Update Actions',
	AddContext: 'Add Context',
	SplitContexts: 'Split Contexts',
	SplitInBlocks: 'Split In Blocks',
	TranslateSelection: 'Translate Selection',
	TranslateBlock: 'Translate Block',
	ExplainGrammar: 'Explain Grammar',
};

const ACTION_BUTTON_CLASS = 'action-button' as const;
const BUTTON_HTML_TAG = 'button';

export class ActionButtonsHtmlIo {
	public static toHtml(action: ActionName, label?: string): string {
		const text = label ?? ACTION_LABELS[action] ?? action;
		return `<${BUTTON_HTML_TAG} class="${ACTION_BUTTON_CLASS}" data-action="${action}">${text}</${BUTTON_HTML_TAG}>`;
	}

	public static toHtmlMap(): Record<ActionName, string> {
		const out = {} as Record<ActionName, string>;
		for (const a of ActionNames) {
			out[a] = ActionButtonsHtmlIo.toHtml(a);
		}
		return out;
	}

	public static extract(html: string): Set<ActionName> {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		const actions = new Set<ActionName>();
		doc.body
			.querySelectorAll(`${BUTTON_HTML_TAG}.${ACTION_BUTTON_CLASS}`)
			.forEach((btn) => {
				const raw = (btn as HTMLElement).dataset.action;
				if (raw && (ActionNames as readonly string[]).includes(raw)) {
					actions.add(raw as ActionName);
				}
			});
		return actions;
	}

	public static fromSet(actions: Iterable<ActionName>): string {
		const parts: string[] = [];
		for (const a of actions) {
			parts.push(ActionButtonsHtmlIo.toHtml(a));
		}
		return parts.join('\n');
	}
}
