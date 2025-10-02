import { ACTION_CONFIGS } from './actions-config';
import { ALL_USER_ACTIONS, UserAction, UserActionPlacement } from './types';

export type LabeledAction = {
	label: string;
	action: UserAction;
};

export const ALL_ACTIONS_ABOVE_SELECTION: LabeledAction[] =
	ALL_USER_ACTIONS.filter(
		(action) =>
			ACTION_CONFIGS[action].placement === UserActionPlacement.AboveSelection
	).map((action) => ({
		label: ACTION_CONFIGS[action].label,
		action,
	}));

export const BOTTOM_ACTIONS: LabeledAction[] = ALL_USER_ACTIONS.filter(
	(action) => ACTION_CONFIGS[action].placement === UserActionPlacement.Bottom
).map((action) => ({
	label: ACTION_CONFIGS[action].label,
	action,
}));
