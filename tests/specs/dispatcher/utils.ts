/// <reference types="@wdio/globals/types" />

export const VAULT_PATH = "tests/simple";

// Types use `unknown` because:
// 1. Actual types (VaultAction, DispatchResult, etc.) come from plugin code
// 2. Plugin types aren't accessible in test context due to serialization
// 3. We assert types at call sites: `as unknown as Result<T>`
// 4. Safer than `any` - forces explicit type assertions

export type VaultActionManagerTestingApi = {
	manager: {
		dispatch: (actions: readonly unknown[]) => Promise<void>;
		readContent: (splitPath: unknown) => Promise<string>;
		exists: (splitPath: unknown) => Promise<boolean>;
	};
	splitPath: (input: string) => unknown;
};

export type DispatchResult = {
	isErr: () => boolean;
	isOk: () => boolean;
	error?: Array<{ action: unknown; error: string }>;
};

// GOLDEN SOURCE PRINCIPLE: Obsidian's actual behavior is always the authoritative source.
// If code/docs/tests conflict with Obsidian's behavior, fix code/docs/tests to match Obsidian.
// Never assume - always verify Obsidian's actual behavior through tests.
