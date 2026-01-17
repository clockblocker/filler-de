import type { TextEaterSettings } from "../types";
import { type ParsedUserSettings, parseSettings } from "./parsed-settings";

export type GlobalState = {
	parsedUserSettings?: ParsedUserSettings;
};

const EMPTY_GLOBAL_STATE: GlobalState = {} as const;
let globalState: GlobalState = {};

export function getState(): GlobalState {
	return globalState;
}

export function getParsedUserSettings(): ParsedUserSettings {
	const parsedUserSettings = globalState.parsedUserSettings;

	if (!parsedUserSettings) {
		throw new Error("Parsed user settings not found");
	}

	return parsedUserSettings;
}

export function setState(state: Partial<GlobalState>): void {
	const currentState = getState();
	globalState = {
		...currentState,
		...state,
	};
}

export function initializeState(settings: TextEaterSettings): void {
	setState({
		parsedUserSettings: parseSettings(settings),
	});
}

export function clearState(): void {
	globalState = EMPTY_GLOBAL_STATE;
}

export function updateParsedSettings(settings: TextEaterSettings): void {
	setState({ parsedUserSettings: parseSettings(settings) });
}
