import { ACTION_CONFIGS } from '../../actions/actions-config';
import { type UserAction, UserActionSchema } from '../../actions/types';
import type { TexfresserObsidianServices } from '../../../services/obsidian-services/obsidian-services/interface';

export const executeButtonAction = ({
	buttonElement,
	services,
}: {
	buttonElement: HTMLButtonElement;
	services: TexfresserObsidianServices;
}) => {
	const actionId = buttonElement.getAttribute('data-action');
	console.log('[executeButtonAction] actionId', actionId);
	console.log('[executeButtonAction] buttonElement', buttonElement);

	const parsed = UserActionSchema.safeParse(actionId);
	console.log('[executeButtonAction] parsed', parsed);

	if (parsed.success) {
		const action = parsed.data as UserAction;
		const cfg = ACTION_CONFIGS[action];
		console.log('[executeButtonAction] executing action', action);
		try {
			cfg.execute(services);
		} catch (err) {
			console.error('Failed to execute action', action, err);
		}
	} else {
		console.log('[executeButtonAction] Invalid action ID', actionId);
	}
};
