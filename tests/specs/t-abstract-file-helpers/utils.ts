/// <reference types="@wdio/globals/types" />

export const VAULT_PATH = "tests/simple";

// Why inline? browser.executeObsidian serializes functions and runs them in the Obsidian context, so external functions aren't accessible. The helper must be defined inside the callback.
export type HelpersTestingApi = {
	tfileHelper: {
		getFile: (p: unknown) => Promise<unknown>;
		createMdFile: (p: unknown) => Promise<unknown>;
	};
	tfolderHelper: {
		getFolder: (p: unknown) => Promise<unknown>;
		createFolder: (p: unknown) => Promise<unknown>;
	};
	splitPath: (input: string) => unknown;
};

export type Result<T> = {
	isErr: () => boolean;
	isOk: () => boolean;
	error?: string;
	value?: T;
};
