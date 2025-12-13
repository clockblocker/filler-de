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
// Copy the function bodies inline in test files, matching these implementations.

export const getHelpersApi = (app: { plugins: { plugins: Record<string, unknown> } }): HelpersTestingApi => {
	const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
		getHelpersTestingApi?: () => HelpersTestingApi;
	};
	const api = plugin.getHelpersTestingApi?.();
	if (!api) throw new Error("testing api unavailable");
	return api;
};

export const asResult = <T>(r: unknown): Result<T> => r as Result<T>;

// Helper to run test logic with API - reduces boilerplate
// Test function receives the API and can use it directly
// Note: browser must be passed from test files (can't import at module level)
export type TestWithApi = (
	api: HelpersTestingApi,
	app: { vault: { read: (file: unknown) => Promise<string> } },
) => Promise<unknown>;
