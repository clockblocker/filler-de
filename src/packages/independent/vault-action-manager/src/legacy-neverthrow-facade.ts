import { Cause, Effect, Exit, Option } from "effect";
import { err, ok, type Result } from "neverthrow";
import type { App } from "obsidian";
import {
	VamDispatchError,
	VamPlanningError,
	type VamSetupError,
	VamShutdownError,
	type VamSubscriptionError,
	type VamVaultIoError,
} from "./effect/errors";
import {
	createVaultActionManager as createEffectVaultActionManager,
	type EffectBulkVaultEventHandler,
	type VaultActionManager as EffectVaultActionManager,
} from "./facade";
import type { SelectionInfo } from "./file-services/active-view/selection-service";
import type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import { getErrorMessage } from "./internal/get-error-message";
import { logger } from "./internal/logger";
import type { VaultActionManagerTestingAdapter } from "./testing-adapter";
import type { DispatchError, DispatchResult } from "./types/dispatch";
import {
	classifyReadContentError,
	type ReadContentError,
} from "./types/read-content-error";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

type LegacyFacadeFailure =
	| VamDispatchError
	| VamPlanningError
	| VamSetupError
	| VamShutdownError
	| VamSubscriptionError
	| VamVaultIoError
	| readonly VamDispatchError[];

export type LegacyBulkVaultEventHandler = (
	event: BulkVaultEvent,
) => Promise<void>;

export type LegacyTeardown = () => void;

export interface LegacyVaultActionManager {
	startListening(): void;

	subscribeToBulk(handler: LegacyBulkVaultEventHandler): LegacyTeardown;

	dispatch(actions: readonly VaultAction[]): Promise<DispatchResult>;

	readContent(
		splitPath: SplitPathToMdFile,
	): Promise<Result<string, ReadContentError>>;
	exists(splitPath: AnySplitPath): boolean;
	findByBasename(
		basename: string,
		options?: { folder?: SplitPathToFolder },
	): SplitPathToMdFile[];
	resolveLinkpathDest(
		linkpath: string,
		from: SplitPathToMdFile,
	): SplitPathToMdFile | null;
	list(splitPath: SplitPathToFolder): Result<AnySplitPath[], string>;
	listAllFilesWithMdReaders(
		splitPath: SplitPathToFolder,
	): Result<SplitPathWithReader[], string>;
	mdPwd(): SplitPathToMdFile | null;

	getOpenedContent(): Result<string, string>;
	getSelectionInfo(): SelectionInfo | null;
	getSelectionText(): string | null;
	cd(splitPath: SplitPathToMdFile): Promise<Result<void, string>>;
	scrollOpenedFileToLine(line: number): void;
}

function firstFailure<E>(exit: Exit.Exit<unknown, E>): E | undefined {
	if (Exit.isSuccess(exit)) return undefined;
	return Option.getOrUndefined(Cause.findErrorOption(exit.cause));
}

function unwrapTaggedCause(value: unknown): unknown {
	let current = value;
	const seen = new Set<unknown>();
	while (
		current instanceof Error &&
		"cause" in current &&
		current.cause !== undefined &&
		current.cause !== current &&
		!seen.has(current.cause)
	) {
		seen.add(current);
		current = current.cause;
	}
	return current;
}

function causeMessage(value: unknown): string {
	return getErrorMessage(unwrapTaggedCause(value));
}

function failureMessage(exit: Exit.Exit<unknown, unknown>): string {
	if (Exit.isSuccess(exit)) return "";
	const failure = firstFailure(exit);
	if (failure instanceof VamShutdownError) {
		return "Vault Action Manager has been disposed";
	}
	if (failure instanceof Error && "operation" in failure) {
		return `Vault Action Manager ${String(failure.operation)} failed: ${causeMessage(failure)}`;
	}
	return failure === undefined
		? Cause.pretty(exit.cause)
		: causeMessage(failure);
}

/** Neverthrow/Promise adapter retained while existing consumers migrate. */
class LegacyVaultActionManagerImpl implements LegacyVaultActionManager {
	constructor(private readonly manager: EffectVaultActionManager) {}

	startListening(): void {
		const exit = Effect.runSyncExit(this.manager.startListening());
		if (Exit.isFailure(exit)) {
			logger.warn(
				"[LegacyVaultActionManager] startListening failed",
				failureMessage(exit),
			);
		}
	}

	subscribeToBulk(handler: LegacyBulkVaultEventHandler): LegacyTeardown {
		const effectHandler: EffectBulkVaultEventHandler<unknown> = (event) =>
			Effect.tryPromise({
				catch: (cause) => cause,
				try: () => handler(event),
			});
		const exit = Effect.runSyncExit(
			this.manager.subscribeToBulk(effectHandler),
		);
		if (Exit.isFailure(exit)) {
			logger.warn(
				"[LegacyVaultActionManager] subscribeToBulk failed",
				failureMessage(exit),
			);
			return () => {};
		}

		let active = true;
		return () => {
			if (!active) return;
			active = false;
			void Effect.runPromiseExit(exit.value.close);
		};
	}

	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		const exit = await Effect.runPromiseExit(
			this.manager.dispatch(actions),
		);
		if (Exit.isSuccess(exit)) return ok(undefined);
		return err(this.toDispatchErrors(exit, actions));
	}

	async readContent(
		splitPath: SplitPathToMdFile,
	): Promise<Result<string, ReadContentError>> {
		const exit = await Effect.runPromiseExit(
			this.manager.readContent(splitPath),
		);
		return Exit.isSuccess(exit)
			? ok(exit.value)
			: err(classifyReadContentError(failureMessage(exit)));
	}

	exists(splitPath: AnySplitPath): boolean {
		const exit = Effect.runSyncExit(this.manager.exists(splitPath));
		return Exit.isSuccess(exit) ? exit.value : false;
	}

	findByBasename(
		basename: string,
		options?: { folder?: SplitPathToFolder },
	): SplitPathToMdFile[] {
		const exit = Effect.runSyncExit(
			this.manager.findByBasename(basename, options),
		);
		return Exit.isSuccess(exit) ? exit.value : [];
	}

	resolveLinkpathDest(
		linkpath: string,
		from: SplitPathToMdFile,
	): SplitPathToMdFile | null {
		const exit = Effect.runSyncExit(
			this.manager.resolveLinkpathDest(linkpath, from),
		);
		return Exit.isSuccess(exit) ? exit.value : null;
	}

	list(splitPath: SplitPathToFolder): Result<AnySplitPath[], string> {
		const exit = Effect.runSyncExit(this.manager.list(splitPath));
		return Exit.isSuccess(exit)
			? ok(exit.value)
			: err(failureMessage(exit));
	}

	listAllFilesWithMdReaders(
		splitPath: SplitPathToFolder,
	): Result<SplitPathWithReader[], string> {
		const exit = Effect.runSyncExit(
			this.manager.listAllFilesWithMdReaders(splitPath),
		);
		return Exit.isSuccess(exit)
			? ok(
					exit.value.map((path) =>
						"read" in path
							? {
									...path,
									read: async () => {
										const readExit =
											await Effect.runPromiseExit(
												path.read(),
											);
										return Exit.isSuccess(readExit)
											? ok(readExit.value)
											: err(
													classifyReadContentError(
														failureMessage(
															readExit,
														),
													),
												);
									},
								}
							: path,
					),
				)
			: err(failureMessage(exit));
	}

	mdPwd(): SplitPathToMdFile | null {
		const exit = Effect.runSyncExit(this.manager.mdPwd());
		return Exit.isSuccess(exit) ? exit.value : null;
	}

	getOpenedContent(): Result<string, string> {
		const exit = Effect.runSyncExit(this.manager.getOpenedContent());
		return Exit.isSuccess(exit)
			? ok(exit.value)
			: err(failureMessage(exit));
	}

	getSelectionInfo(): SelectionInfo | null {
		const exit = Effect.runSyncExit(this.manager.getSelectionInfo());
		return Exit.isSuccess(exit) ? exit.value : null;
	}

	getSelectionText(): string | null {
		const exit = Effect.runSyncExit(this.manager.getSelectionText());
		return Exit.isSuccess(exit) ? exit.value : null;
	}

	async cd(splitPath: SplitPathToMdFile): Promise<Result<void, string>> {
		const exit = await Effect.runPromiseExit(this.manager.cd(splitPath));
		return Exit.isSuccess(exit) ? ok(undefined) : err(failureMessage(exit));
	}

	scrollOpenedFileToLine(line: number): void {
		Effect.runSyncExit(this.manager.scrollOpenedFileToLine(line));
	}

	private toDispatchErrors(
		exit: Exit.Exit<unknown, LegacyFacadeFailure>,
		actions: readonly VaultAction[],
	): DispatchError[] {
		const representative = actions[0] ?? ({} as VaultAction);
		const failure = firstFailure(exit);
		if (Array.isArray(failure)) {
			return failure.map((item) =>
				item instanceof VamDispatchError
					? this.toDispatchError(item, representative)
					: {
							action: representative,
							error: causeMessage(item),
						},
			);
		}
		if (failure instanceof VamPlanningError) {
			return [
				{
					action:
						(failure.action as VaultAction | undefined) ??
						representative,
					error: `EXCEPTION: ${causeMessage(failure.cause)}`,
				},
			];
		}
		if (failure instanceof VamDispatchError) {
			return [this.toDispatchError(failure, representative)];
		}
		return [{ action: representative, error: failureMessage(exit) }];
	}

	private toDispatchError(
		failure: VamDispatchError,
		fallback: VaultAction,
	): DispatchError {
		const message = causeMessage(failure.cause);
		return {
			action: (failure.action as VaultAction | undefined) ?? fallback,
			error:
				failure.operation === "overflow"
					? message
					: message ||
						`Vault action failed during ${failure.operation}`,
		};
	}
}

export type LegacyVaultActionManagerFactoryResult = {
	readonly dispose: () => Promise<void>;
	readonly manager: LegacyVaultActionManager;
	readonly testing: VaultActionManagerTestingAdapter;
};

export function createLegacyVaultActionManager(
	app: App,
): LegacyVaultActionManagerFactoryResult {
	const effectFacade = createEffectVaultActionManager(app);
	return {
		dispose: () => Effect.runPromise(effectFacade.dispose),
		manager: new LegacyVaultActionManagerImpl(effectFacade.manager),
		testing: effectFacade.testing,
	};
}

// The dedicated legacy subpath preserves the old symbol names, so an existing
// consumer can migrate by changing only its import path first.
export const createVaultActionManager = createLegacyVaultActionManager;
export type VaultActionManager = LegacyVaultActionManager;
export type VaultActionManagerFactoryResult =
	LegacyVaultActionManagerFactoryResult;
