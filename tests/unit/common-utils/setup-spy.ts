import { afterEach, beforeEach, spyOn } from "bun:test";
import * as globalState from "../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../src/global-state/parsed-settings";
import { defaultSettingsForUnitTests } from "./consts";

export function setupGetParsedUserSettingsSpy(
	overrides?: Partial<ParsedUserSettings>,
): ReturnType<typeof spyOn> {
	const spy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettingsForUnitTests,
		...overrides,
	});
	return spy;
}

export function setupGetParsedUserSettingsSpyWithHooks(
	overrides?: Partial<ParsedUserSettings>,
): ReturnType<typeof spyOn> {
	let spy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		spy = setupGetParsedUserSettingsSpy(overrides);
	});

	afterEach(() => {
		spy.mockRestore();
	});

	return spy as ReturnType<typeof spyOn>;
}
