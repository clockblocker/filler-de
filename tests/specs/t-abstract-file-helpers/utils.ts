/// <reference types="@wdio/globals/types" />

export const VAULT_PATH = "tests/simple";

// Types use `unknown` because:
// 1. Actual types (SplitPath, Result<TFile, string>, etc.) come from plugin code
// 2. Plugin types aren't accessible in test context due to serialization
// 3. We assert types at call sites: `as unknown as Result<T>`
// 4. Safer than `any` - forces explicit type assertions
//
// Actual types (for reference):
// - getFile(splitPath: SplitPathToMdFile | SplitPathToFile): Promise<Result<TFile, string>>
// - createMdFile(file: MdFileWithContentDto): Promise<Result<TFile, string>>
// - getFolder(splitPath: SplitPathToFolder): Promise<Result<TFolder, string>>
// - createFolder(splitPath: SplitPathToFolder): Promise<Result<TFolder, string>>
// - splitPath(input: string): SplitPath
export type HelpersTestingApi = {
	tfileHelper: {
		getFile: (p: unknown) => Promise<unknown>;
		createMdFile: (p: unknown) => Promise<unknown>;
		trashFile: (p: unknown) => Promise<unknown>;
	};
	tfolderHelper: {
		getFolder: (p: unknown) => Promise<unknown>;
		createFolder: (p: unknown) => Promise<unknown>;
		trashFolder: (p: unknown) => Promise<unknown>;
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

// Pattern: Store helper code as strings in beforeEach, reuse in tests
// This allows sharing helper functions across test files without duplication.
//
// In beforeEach:
// (globalThis as { __helperName?: string }).__helperName = `function code here`;
//
// In tests:
// const helperCode = (globalThis as { __helperName?: string }).__helperName;
// const helper = new Function("deps...", helperCode + " return helperName;")(...deps);
//
// Example: runTest helper for getFile tests is stored in __runTestCode

// GOLDEN SOURCE PRINCIPLE: Obsidian's actual behavior is always the authoritative source.
// If code/docs/tests conflict with Obsidian's behavior, fix code/docs/tests to match Obsidian.
// Never assume - always verify Obsidian's actual behavior through tests.
