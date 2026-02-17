import { describe, expect, it } from "bun:test";
import { ok, okAsync, ResultAsync } from "neverthrow";
import {
	createBackgroundGenerateCoordinator,
} from "../../../../src/commanders/textfresser/orchestration/background/background-generate-coordinator";
import {
	createInitialTextfresserState,
	type TextfresserState,
} from "../../../../src/commanders/textfresser/state/textfresser-state";
import type { VaultActionManager } from "../../../../src/managers/obsidian/vault-action-manager";
import type {
	SplitPathToMdFile,
} from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import type { ApiService } from "../../../../src/stateless-helpers/api-service";

function buildTargetPath(basename: string): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		kind: "MdFile",
		pathParts: ["Worter", "de", "lexem", "lemma", basename[0] ?? "a"],
	};
}

function setLatestLemmaState(
	state: TextfresserState,
	lemma: string,
	targetPath: SplitPathToMdFile,
	targetOwnedByInvocation = false,
): void {
	state.latestLemmaResult = {
		attestation: {
			source: {
				path: {
					basename: "Source",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Books"],
				},
				ref: "![[Source#^1|^]]",
				textRaw: "Er geht schnell. ^1",
				textWithOnlyTargetMarked: "Er [geht] schnell. ^1",
			},
			target: {
				offsetInBlock: 3,
				surface: "geht",
			},
		},
		disambiguationResult: null,
		lemma,
		linguisticUnit: "Lexem",
		posLikeKind: "Verb",
		surfaceKind: "Lemma",
	};
	state.latestResolvedLemmaTargetPath = targetPath;
	state.latestLemmaTargetOwnedByInvocation = targetOwnedByInvocation;
}

describe("background generate coordinator", () => {
	it("queues latest pending target while one generate is in flight", async () => {
		const dispatches: Array<readonly unknown[]> = [];
		const vam = {
			dispatch: async (actions: readonly unknown[]) => {
				dispatches.push(actions);
				return ok(undefined);
			},
			exists: () => false,
			mdPwd: () => null,
			readContent: async () => ok("ready"),
		} as unknown as VaultActionManager;

		const state = createInitialTextfresserState({
			apiService: {} as ApiService,
			languages: { known: "English", target: "German" },
			vam,
		});

		const launches: string[] = [];
		let resolveFirst: () => void = () => {};
		const firstDone = new Promise<void>((resolve) => {
			resolveFirst = resolve;
		});

		let callCount = 0;
		const coordinator = createBackgroundGenerateCoordinator({
			runGenerateCommand: (input) =>
				new ResultAsync(
					(async () => {
						launches.push(input.commandContext.activeFile.splitPath.basename);
						if (callCount === 0) {
							callCount += 1;
							await firstDone;
						}
						return ok([]);
					})(),
				),
			scrollToTargetBlock: () => {},
			state,
			vam,
		});

		setLatestLemmaState(state, "alpha", buildTargetPath("alpha"));
		coordinator.requestBackgroundGenerate(() => {});

		setLatestLemmaState(state, "beta", buildTargetPath("beta"));
		coordinator.requestBackgroundGenerate(() => {});

		setLatestLemmaState(state, "gamma", buildTargetPath("gamma"));
		coordinator.requestBackgroundGenerate(() => {});

		expect(state.pendingGenerate?.targetPath.basename).toBe("gamma");

		resolveFirst();
		await new Promise((resolve) => setTimeout(resolve, 0));

		const remainingInFlight = state.inFlightGenerate;
		if (remainingInFlight) {
			await remainingInFlight.promise;
		}

		expect(launches).toEqual(["alpha", "gamma"]);
		expect(state.inFlightGenerate).toBeNull();
		expect(state.pendingGenerate).toBeNull();
		expect(dispatches.length).toBeGreaterThanOrEqual(2);
	});

	it("uses snapshotted lemmaResult, not live state", async () => {
		const vam = {
			dispatch: async () => ok(undefined),
			exists: () => false,
			mdPwd: () => null,
			readContent: async () => ok("ready"),
		} as unknown as VaultActionManager;

		const state = createInitialTextfresserState({
			apiService: {} as ApiService,
			languages: { known: "English", target: "German" },
			vam,
		});

		const receivedLemmas: string[] = [];
		let resolveGenerate: () => void = () => {};
		const generateBlocked = new Promise<void>((resolve) => {
			resolveGenerate = resolve;
		});

		const coordinator = createBackgroundGenerateCoordinator({
			runGenerateCommand: (input) =>
				new ResultAsync(
					(async () => {
						receivedLemmas.push(
							input.textfresserState.latestLemmaResult?.lemma ?? "null",
						);
						await generateBlocked;
						return ok([]);
					})(),
				),
			scrollToTargetBlock: () => {},
			state,
			vam,
		});

		// Set lemma=alpha and request generate
		setLatestLemmaState(state, "alpha", buildTargetPath("alpha"));
		coordinator.requestBackgroundGenerate(() => {});

		// Immediately overwrite state with lemma=beta (simulates next Lemma)
		setLatestLemmaState(state, "beta", buildTargetPath("beta"));

		// Unblock the in-flight generate
		resolveGenerate();
		const inFlight = state.inFlightGenerate;
		if (inFlight) {
			await inFlight.promise;
		}

		// The generate should have received alpha, not beta
		expect(receivedLemmas).toEqual(["alpha"]);
	});

	it("rolls back brand-new empty target note", async () => {
		const dispatches: Array<readonly unknown[]> = [];
		const notifications: string[] = [];
		const vam = {
			dispatch: async (actions: readonly unknown[]) => {
				dispatches.push(actions);
				return ok(undefined);
			},
			exists: () => false,
			mdPwd: () => null,
			readContent: async () => ok(""),
		} as unknown as VaultActionManager;

		const state = createInitialTextfresserState({
			apiService: {} as ApiService,
			languages: { known: "English", target: "German" },
			vam,
		});

		const coordinator = createBackgroundGenerateCoordinator({
			runGenerateCommand: () => okAsync([]),
			scrollToTargetBlock: () => {},
			state,
			vam,
		});

		setLatestLemmaState(state, "leer", buildTargetPath("leer"));
		coordinator.requestBackgroundGenerate((message) => {
			notifications.push(message);
		});

		const inFlight = state.inFlightGenerate;
		if (inFlight) {
			await inFlight.promise;
		}

		expect(dispatches).toHaveLength(2);
		const rollbackDispatch = dispatches[1] as
			| Array<{ kind?: string; payload?: { splitPath?: SplitPathToMdFile } }>
			| undefined;
		expect(rollbackDispatch).toBeDefined();
		const rollbackAction = rollbackDispatch?.find(
			(action) => action.kind === VaultActionKind.TrashMdFile,
		);
		expect(rollbackAction?.payload?.splitPath?.basename).toBe("leer");
		expect(
			notifications.some((message) =>
				message.includes("Background generate failed"),
			),
		).toBe(true);
	});

	it("rolls back empty target owned by current invocation even when it existed before", async () => {
		const dispatches: Array<readonly unknown[]> = [];
		const vam = {
			dispatch: async (actions: readonly unknown[]) => {
				dispatches.push(actions);
				return ok(undefined);
			},
			exists: () => true,
			mdPwd: () => null,
			readContent: async () => ok(""),
		} as unknown as VaultActionManager;

		const state = createInitialTextfresserState({
			apiService: {} as ApiService,
			languages: { known: "English", target: "German" },
			vam,
		});

		const coordinator = createBackgroundGenerateCoordinator({
			runGenerateCommand: () => okAsync([]),
			scrollToTargetBlock: () => {},
			state,
			vam,
		});

		setLatestLemmaState(state, "renamed", buildTargetPath("renamed"), true);
		coordinator.requestBackgroundGenerate(() => {});

		const inFlight = state.inFlightGenerate;
		if (inFlight) {
			await inFlight.promise;
		}

		expect(dispatches).toHaveLength(2);
		const rollbackDispatch = dispatches[1] as
			| Array<{ kind?: string; payload?: { splitPath?: SplitPathToMdFile } }>
			| undefined;
		expect(rollbackDispatch).toBeDefined();
		const rollbackAction = rollbackDispatch?.find(
			(action) => action.kind === VaultActionKind.TrashMdFile,
		);
		expect(rollbackAction?.payload?.splitPath?.basename).toBe("renamed");
	});
});
