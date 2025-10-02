import { ACTION_CONFIGS } from './actions-config';
import { ALL_USER_ACTIONS, UserActionPlacement } from './types';

export const ALL_ACTIONS_ABOVE_SELECTION = ALL_USER_ACTIONS.filter(
	(action) =>
		ACTION_CONFIGS[action].placement === UserActionPlacement.AboveSelection
).map((action) => ({
	label: ACTION_CONFIGS[action].label,
	action,
}));

export const BOTTOM_ACTIONS = ALL_USER_ACTIONS.filter(
	(action) => ACTION_CONFIGS[action].placement === UserActionPlacement.Bottom
).map((action) => ({
	label: ACTION_CONFIGS[action].label,
	action,
}));
