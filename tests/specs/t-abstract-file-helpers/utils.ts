/// <reference types="@wdio/globals/types" />

export const VAULT_PATH = "tests/simple";

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

// Helper functions for tests
// NOTE: These cannot be imported directly in browser.executeObsidian callbacks due to serialization.
// Use direct API access pattern in tests:
// const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
