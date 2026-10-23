/**
 * The "Reset dictionary from old notes…" command (#65, #117): a modal shows
 * the source folder of old notes, `Worter/` or a `Worter backup …` folder,
 * and what `Worter/` holds now, and offers Dry run and Execute; the dry
 * run's report offers Execute too (#145). Execute asks once more, naming
 * both, checks the provider keys before it moves or writes anything (#146),
 * and reports progress in a notice until it opens its report note. "Cancel
 * dictionary reset" stops a run between or inside attestations.
 */
import type {
	DictionaryScanError,
	DumdictVaultStore,
} from "@textfresser/dictionary";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import { operations } from "dumgen";
import {
	Cause,
	DateTime,
	Deferred,
	Effect,
	Exit,
	Layer,
	Option,
	Predicate,
	Ref,
} from "effect";
import { type App, Modal, Setting } from "obsidian";
import type { DictionaryStoreClosed } from "../../lifecycle/dictionary-store-service";
import {
	conciseFailure,
	type DumgenProvide,
	type KeyCheckFailure,
} from "../../managers/dumgen";
import type {
	NoticeHandle,
	NoticeSink,
	Notices,
	Workspace,
} from "../../managers/obsidian/host";
import { catchWhole, causeMessages } from "../../utils/causes";
import { getErrorMessage } from "../../utils/get-error-message";
import { ClassifySegmenter } from "../classify/classify-selection";
import { dumgenUnitResolver } from "../classify/resolution/dumgen-unit-resolver";
import type { KnowledgeQueue } from "../classify/resolution/knowledge-queue";
import type { ScrollActivity } from "../classify/resolution/scroll-activity";
import { vamScrollFiles } from "../classify/resolution/scroll-files";
import { SegmentationCache } from "../classify/segmentation-cache";
import { UnitResolver, UnitResolverError } from "../classify/unit-resolver";
import { CANCEL_RESET_COMMAND_NAME } from "./command-names";
import {
	dryRunReset,
	executeReset,
	type ResetProgress,
	resetStamp,
} from "./execute";
import { WORTER } from "./plan";
import { type ResetDictionary, ResetFailed } from "./ports";
import { findSources, type SourceChoice } from "./source";
import { vamResetVault } from "./vam-reset-vault";

/** What a step the unloading plugin interrupted answers; it shows nothing. */
const UNLOADED = "the plugin unloaded";

export type DictionaryResetDeps = {
	readonly app: App;
	readonly vam: VaultActionManager;
	/** What the reset tells the user, and its progress. */
	readonly notices: Notices["Service"];
	/** Opens the report note once an Execute wrote it. */
	readonly workspace: Workspace["Service"];
	/** Runs an Execute on one dumgen build: `Dumgen.provide`. */
	readonly dumgen: DumgenProvide;
	readonly segmenterVersion: Effect.Effect<string>;
	readonly cache: SegmentationCache["Service"];
	readonly store: Effect.Effect<
		DumdictVaultStore,
		DictionaryScanError | DictionaryStoreClosed
	>;
	readonly knowledge: KnowledgeQueue;
	/** Classify's runs per Scroll, which the unlink observer waits out. */
	readonly activity?: ScrollActivity;
	readonly missingProviderKeys: Effect.Effect<readonly string[]>;
	/** Checks the provider keys with each provider; answers what failed. */
	readonly checkProviderKeys: Effect.Effect<readonly KeyCheckFailure[]>;
	/**
	 * Runs a modal button's step on the plugin runtime, under
	 * `user-event.<kind>`. It must start the step at once, so what the step
	 * shows is held before the click returns.
	 */
	readonly run: (kind: string, effect: Effect.Effect<void>) => void;
};

const STAGE_LABEL: Record<ResetProgress["stage"], string> = {
	Backup: "Backing up Worter/",
	Collect: "Reading the old notes",
	Reattach: "Re-attaching freeform text",
	Regenerate: "Regenerating",
	Report: "Writing the report",
};

/**
 * What the command's last opening showed: its modal, with the sources it
 * offered, or the notice it failed with.
 */
export type ResetOpening =
	| ({ readonly kind: "Opened" } & SourceChoice)
	| { readonly kind: "Failed"; readonly notice: string };

/**
 * What the last dry run showed: its report modal, with its buttons and the
 * key check's warning, or the notice it failed with.
 */
export type ResetDryRunShown =
	| {
			readonly kind: "Report";
			readonly source: string;
			readonly actions: readonly string[];
			readonly keyWarning: string | null;
	  }
	| { readonly kind: "Failed"; readonly notice: string };

/** How the last Execute ended: refused before it changed anything, done, or stopped. */
export type ResetExecuteOutcome =
	| { readonly kind: "Refused"; readonly notice: string }
	| {
			readonly kind: "Done";
			readonly reportPath: string;
			readonly cancelled: boolean;
	  }
	| { readonly kind: "Stopped"; readonly notice: string };

/** What each step answers once the unloading plugin interrupted it. */
export const RESET_UNLOADED = {
	dryRun: { kind: "Failed", notice: UNLOADED },
	execute: { kind: "Stopped", notice: UNLOADED },
	opening: { kind: "Failed", notice: UNLOADED },
} as const satisfies {
	readonly opening: ResetOpening;
	readonly dryRun: ResetDryRunShown;
	readonly execute: ResetExecuteOutcome;
};

/** The key check's failures as one sentence's worth: `A; B`. */
const keyFailures = (failures: readonly KeyCheckFailure[]) =>
	failures.map(({ reason }) => reason).join("; ");

/** The modals the command has open, newest last, so E2E can click in them. */
class OpenModals {
	private readonly open: Modal[] = [];

	add(modal: Modal): void {
		this.open.push(modal);
	}

	remove(modal: Modal): void {
		const at = this.open.indexOf(modal);
		if (at !== -1) this.open.splice(at, 1);
	}

	/** Clicks the newest open modal's button labelled `label`. */
	click(label: string): boolean {
		const button = [
			...(this.open.at(-1)?.contentEl.querySelectorAll("button") ?? []),
		].find((candidate) => candidate.textContent === label);
		if (!button || button.disabled) return false;
		button.click();
		return true;
	}

	closeAll(): void {
		for (const modal of [...this.open].reverse()) modal.close();
	}
}

/** What the command holds between its steps. */
type ResetState = {
	/** The Execute running, completed to cancel it. */
	readonly running: Option.Option<Deferred.Deferred<void>>;
	/** What the last opening showed, once it is shown. */
	readonly opening: Deferred.Deferred<ResetOpening> | null;
	/** What the last dry run showed, once it is shown. */
	readonly dryRun: Deferred.Deferred<ResetDryRunShown> | null;
	/** How the last confirmed Execute ended, once it ends. */
	readonly executed: Deferred.Deferred<ResetExecuteOutcome> | null;
};

/**
 * Runs `effect` and completes `shown` with what it answers, however it
 * ends: a step the unloading plugin interrupted answers `unloaded` and
 * shows nothing, and one that died answers `died` (its edge logs it).
 */
const showInto = <A>(
	shown: Deferred.Deferred<A>,
	outcomes: {
		readonly unloaded: A;
		readonly died: (reasons: string) => A;
	},
	effect: Effect.Effect<A>,
): Effect.Effect<void> =>
	effect.pipe(
		Effect.onExit((exit) =>
			Deferred.succeed(
				shown,
				Exit.isSuccess(exit)
					? exit.value
					: Cause.hasInterruptsOnly(exit.cause)
						? outcomes.unloaded
						: outcomes.died(causeMessages(exit.cause)),
			),
		),
		Effect.asVoid,
	);

/** Runs `effect` with a sticky notice, hidden however it ends. */
const withNotice = <A, E, R>(
	notices: Notices["Service"],
	message: string,
	effect: (notice: NoticeHandle) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
	Effect.acquireUseRelease(
		notices.open(message, { sticky: true }),
		effect,
		(notice) => Effect.sync(() => notice.hide()),
	);

export class DictionaryResetCommand {
	private readonly modals = new OpenModals();

	private constructor(
		private readonly deps: DictionaryResetDeps,
		private readonly state: Ref.Ref<ResetState>,
	) {}

	static make(
		deps: DictionaryResetDeps,
	): Effect.Effect<DictionaryResetCommand> {
		return Effect.map(
			Ref.make<ResetState>({
				dryRun: null,
				executed: null,
				opening: null,
				running: Option.none(),
			}),
			(state) => new DictionaryResetCommand(deps, state),
		);
	}

	/**
	 * Looks for the old notes and opens the modal. What it shows is held at
	 * once, as the command's program starts, so E2E finds it right after
	 * running the command.
	 */
	readonly open: Effect.Effect<void> = Effect.suspend(() =>
		Effect.gen({ self: this }, function* () {
			const shown = yield* Deferred.make<ResetOpening>();
			yield* Ref.update(this.state, (state) => ({
				...state,
				opening: shown,
			}));
			yield* showInto<ResetOpening>(
				shown,
				{
					died: (reasons) => ({
						kind: "Failed",
						notice: `⚠ Dictionary reset: the modal failed: ${reasons}`,
					}),
					unloaded: RESET_UNLOADED.opening,
				},
				this.openModal,
			);
		}),
	);

	/** E2E: what the last `open` showed, once shown; null before any. */
	lastOpening(): Deferred.Deferred<ResetOpening> | null {
		return Ref.getUnsafe(this.state).opening;
	}

	/** E2E: what the last dry run showed, once shown; null before any. */
	lastDryRun(): Deferred.Deferred<ResetDryRunShown> | null {
		return Ref.getUnsafe(this.state).dryRun;
	}

	/** E2E: how the last confirmed Execute ended, once it ends; null before any. */
	lastExecute(): Deferred.Deferred<ResetExecuteOutcome> | null {
		return Ref.getUnsafe(this.state).executed;
	}

	/** E2E: clicks a button of the newest modal the command has open. */
	clickButton(label: string): boolean {
		return this.modals.click(label);
	}

	/** E2E: closes every modal the command has open, clicking nothing. */
	closeModal(): void {
		this.modals.closeAll();
	}

	/**
	 * Whether an Execute is running; Classify waits for it to end. Read
	 * synchronously, as Classify's refusal and the unlink observer's plans
	 * read it.
	 */
	isRunning(): boolean {
		return Option.isSome(Ref.getUnsafe(this.state).running);
	}

	/** Stops a running Execute; answers whether one was running. */
	readonly cancel: Effect.Effect<boolean> = Effect.suspend(() =>
		Effect.gen({ self: this }, function* () {
			const { running } = yield* Ref.get(this.state);
			if (Option.isNone(running)) return false;
			yield* Deferred.succeed(running.value, undefined);
			yield* this.deps.knowledge.cancelAll;
			return true;
		}),
	);

	/** Asks once more, then executes from `source`. */
	private confirmExecute(source: string, choice: SourceChoice): void {
		new ConfirmExecuteModal(
			this.deps.app,
			this.modals,
			source,
			choice,
			() =>
				this.deps.run("dictionary-reset.execute", this.execute(source)),
		).open();
	}

	private readonly openModal: Effect.Effect<ResetOpening> = Effect.suspend(
		() => {
			const { deps } = this;
			return findSources(vamResetVault(deps.vam)).pipe(
				Effect.flatMap((choice) =>
					Effect.sync((): ResetOpening => {
						let opened = false;
						const modal = new ResetModal(
							deps.app,
							this.modals,
							choice,
							{
								dryRun: (source) =>
									deps.run(
										"dictionary-reset.dry-run",
										this.dryRun(source, choice),
									),
								execute: (source) =>
									this.confirmExecute(source, choice),
								opened: () => {
									opened = true;
								},
							},
						);
						modal.open();
						return opened
							? { kind: "Opened", ...choice }
							: {
									kind: "Failed",
									notice: "The reset modal did not open",
								};
					}),
				),
				catchWhole((cause) => {
					const notice = `⚠ Dictionary reset: could not look for old notes: ${formatCause(cause, { stack: false })}`;
					return this.deps.notices
						.show(notice)
						.pipe(
							Effect.as<ResetOpening>({ kind: "Failed", notice }),
						);
				}),
			);
		},
	);

	/**
	 * Reads and plans, and checks the provider keys meanwhile, then shows the
	 * report with Execute beside it and a key that failed as a warning.
	 */
	private dryRun(source: string, choice: SourceChoice): Effect.Effect<void> {
		const { deps } = this;
		return Effect.gen({ self: this }, function* () {
			const shown = yield* Deferred.make<ResetDryRunShown>();
			yield* Ref.update(this.state, (state) => ({
				...state,
				dryRun: shown,
			}));
			const read = withNotice(
				deps.notices,
				`Dictionary reset dry run: reading the old notes in ${source}/…`,
				() =>
					Effect.all(
						[
							dryRunReset(vamResetVault(deps.vam), { source }),
							deps.checkProviderKeys,
						],
						{ concurrency: "unbounded" },
					),
			);
			yield* showInto<ResetDryRunShown>(
				shown,
				{
					died: (reasons) => ({
						kind: "Failed",
						notice: `⚠ Dictionary reset dry run failed: ${reasons}`,
					}),
					unloaded: RESET_UNLOADED.dryRun,
				},
				read.pipe(
					Effect.flatMap(([result, failures]) =>
						Effect.sync((): ResetDryRunShown => {
							const keyWarning =
								failures.length === 0
									? null
									: `⚠ Execute would stop before changing anything: ${keyFailures(failures)}. Fix the key in Textfresser's settings first.`;
							const modal = new ReportModal(
								deps.app,
								this.modals,
								{
									execute: () =>
										this.confirmExecute(source, choice),
									keyWarning,
									notices: deps.notices.sink,
									report: result.report,
								},
							);
							modal.open();
							return {
								actions: modal.actions(),
								keyWarning,
								kind: "Report",
								source,
							};
						}),
					),
					catchWhole((cause) => {
						const notice = `⚠ Dictionary reset dry run failed: ${conciseFailure(causeMessages(cause))}`;
						return this.deps.notices.show(notice).pipe(
							Effect.as<ResetDryRunShown>({
								kind: "Failed",
								notice,
							}),
						);
					}),
				),
			);
		});
	}

	/** Why an Execute may not start now, if it may not. */
	private readonly refusal: Effect.Effect<string | undefined> =
		Effect.suspend(() => {
			const { deps } = this;
			return Effect.gen(function* () {
				const missing = yield* deps.missingProviderKeys;
				if (missing.length > 0)
					return `The reset regenerates through dumgen and needs ${missing.join(" and ")} API keys in Textfresser's settings. Nothing changed.`;
				if ((yield* deps.knowledge.running) > 0)
					return "Knowledge generation is still running. Wait for it, or cancel it, then reset. Nothing changed.";
				return undefined;
			});
		});

	private execute(source: string): Effect.Effect<void> {
		return Effect.gen({ self: this }, function* () {
			const shown = yield* Deferred.make<ResetExecuteOutcome>();
			yield* Ref.update(this.state, (state) => ({
				...state,
				executed: shown,
			}));
			yield* showInto<ResetExecuteOutcome>(
				shown,
				{
					died: (reasons) => ({
						kind: "Stopped",
						notice: `⚠ Dictionary reset stopped: ${reasons}`,
					}),
					unloaded: RESET_UNLOADED.execute,
				},
				this.claimAndExecute(source),
			);
		});
	}

	/** Executes unless one runs already; it runs alone until it ends. */
	private claimAndExecute(
		source: string,
	): Effect.Effect<ResetExecuteOutcome> {
		const refuse = (refusal: string) => {
			const notice = `⚠ ${refusal}`;
			return this.deps.notices
				.show(notice, { sticky: true })
				.pipe(
					Effect.as<ResetExecuteOutcome>({ kind: "Refused", notice }),
				);
		};
		return Effect.gen({ self: this }, function* () {
			const cancel = yield* Deferred.make<void>();
			const claimed = yield* Ref.modify(this.state, (state) =>
				Option.isSome(state.running)
					? [false, state]
					: [true, { ...state, running: Option.some(cancel) }],
			);
			if (!claimed)
				return yield* refuse("A dictionary reset is already running.");
			const execute = Effect.gen({ self: this }, function* () {
				const refusal = yield* this.refusal;
				if (refusal) return yield* refuse(refusal);
				return yield* withNotice(
					this.deps.notices,
					"Dictionary reset: checking the provider keys…",
					(notice) =>
						Effect.gen({ self: this }, function* () {
							// Before the backup moves anything: a key the
							// provider rejects would fail every attestation
							// after Worter/ was moved (#146).
							const failures =
								yield* this.deps.checkProviderKeys.pipe(
									catchWhole((cause) =>
										Effect.succeed(causeMessages(cause)),
									),
								);
							if (Predicate.isString(failures))
								return yield* refuse(
									`Dictionary reset did not start: the provider keys could not be checked (${failures}). Nothing changed.`,
								);
							if (failures.length > 0)
								return yield* refuse(
									`Dictionary reset did not start: ${keyFailures(failures)}. Fix the key in Textfresser's settings and run it again. Nothing changed.`,
								);
							if (yield* Deferred.isDone(cancel))
								return yield* refuse(
									"Dictionary reset cancelled before it started. Nothing changed.",
								);
							yield* Effect.sync(() =>
								notice.setMessage(
									"Dictionary reset: starting…",
								),
							);
							return yield* this.run(source, cancel, notice);
						}),
				);
			});
			return yield* execute.pipe(
				Effect.ensuring(
					Ref.update(this.state, (state) =>
						Option.contains(state.running, cancel)
							? { ...state, running: Option.none() }
							: state,
					),
				),
			);
		});
	}

	/** Execute once the keys passed: back up, regenerate, report. */
	private run(
		source: string,
		cancel: Deferred.Deferred<void>,
		notice: NoticeHandle,
	): Effect.Effect<ResetExecuteOutcome> {
		const notices: string[] = [];
		const { deps } = this;
		const store = deps.store.pipe(
			Effect.mapError(
				(cause) =>
					new ResetFailed({
						cause,
						message: `The dictionary could not be read: ${getErrorMessage(cause)}`,
					}),
			),
		);
		const dictionary: ResetDictionary = {
			appendFreeform: (request) =>
				store.pipe(
					Effect.flatMap((opened) => opened.appendFreeform(request)),
					Effect.mapError((error) =>
						error instanceof ResetFailed
							? error
							: new ResetFailed({
									cause: error,
									message: error.message,
								}),
					),
				),
			caughtUp: store.pipe(Effect.flatMap((opened) => opened.caughtUp)),
			settleKnowledge: deps.knowledge.whenIdle,
		};
		const resolver = dumgenUnitResolver({
			...(deps.activity === undefined ? {} : { activity: deps.activity }),
			dumgen: operations,
			knowledge: deps.knowledge,
			notify: (message) => notices.push(message),
			scroll: vamScrollFiles(deps.vam),
			store: store.pipe(
				Effect.mapError(
					(error) =>
						new UnitResolverError({
							cause: error,
							message: error.message,
						}),
				),
			),
		});
		const layer = Layer.mergeAll(
			Layer.succeed(SegmentationCache, deps.cache),
			Layer.succeed(UnitResolver, resolver),
			Layer.effect(
				ClassifySegmenter,
				Effect.map(deps.segmenterVersion, (segmenterVersion) => ({
					segmenterVersion,
				})),
			),
		);
		return Effect.gen(function* () {
			const local = DateTime.toParts(
				DateTime.setZone(yield* DateTime.now, DateTime.zoneMakeLocal()),
			);
			return yield* executeReset({
				cancel,
				dictionary,
				notices: () => notices,
				onProgress: (progress) =>
					notice.setMessage(
						`Dictionary reset: ${STAGE_LABEL[progress.stage]}${progress.stage === "Regenerate" ? ` ${progress.done + 1}/${progress.total}${progress.label ? ` (${progress.label})` : ""}` : "…"}\nRun "${CANCEL_RESET_COMMAND_NAME}" to stop.`,
					),
				source,
				stamp: resetStamp(local),
				vault: vamResetVault(deps.vam),
			});
		}).pipe(
			Effect.provide(layer),
			// One Execute is one dumgen action, on one request budget.
			deps.dumgen,
			Effect.catchTag("DumgenUnavailable", (error) =>
				Effect.fail(
					new ResetFailed({
						cause: error,
						message: error.message,
					}),
				),
			),
			// The report holds one line per failure (#147); the provider's
			// own words go to the log.
			Effect.tap((result) =>
				Effect.forEach(
					result.execution.regenerations,
					(regeneration) =>
						regeneration?._tag === "Unresolved" &&
						conciseFailure(regeneration.reason) !==
							regeneration.reason
							? Effect.logWarning(
									"[DictionaryReset] Unresolved:",
									regeneration.reason,
								)
							: Effect.void,
					{ discard: true },
				),
			),
			Effect.tapError((failure) =>
				failure instanceof ResetFailed &&
				Predicate.isString(failure.cause)
					? Effect.logError(
							"[DictionaryReset] Report:",
							failure.cause,
						)
					: Effect.void,
			),
			// What failed after the reset ran, such as opening its report,
			// is logged here too: every reason of the cause, kept whole.
			Effect.flatMap((result) =>
				Effect.gen(function* () {
					yield* Effect.sync(() => notice.hide());
					yield* deps.notices.show(
						`Dictionary reset ${result.execution.cancelled ? "cancelled" : "done"}; see ${result.reportPath}`,
					);
					yield* deps.workspace
						.openLink(result.reportPath, "", true)
						.pipe(
							Effect.mapError(
								(error) =>
									new ResetFailed({
										cause: error.cause,
										message: `The report ${result.reportPath} could not be opened: ${getErrorMessage(error.cause)}`,
									}),
							),
						);
					return {
						cancelled: result.execution.cancelled,
						kind: "Done",
						reportPath: result.reportPath,
					} satisfies ResetExecuteOutcome;
				}),
			),
			Effect.tapCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.void
					: Effect.logError("[DictionaryReset] Failed:", cause),
			),
			catchWhole((cause) => {
				const message = `⚠ Dictionary reset stopped: ${conciseFailure(causeMessages(cause))}`;
				return this.deps.notices.show(message, { sticky: true }).pipe(
					Effect.as<ResetExecuteOutcome>({
						kind: "Stopped",
						notice: message,
					}),
				);
			}),
		);
	}
}

/** `Worter backup 2026-10-21 05-43-21/ (79 old notes)` */
const sourceLabel = ({
	folder,
	oldNotes,
}: SourceChoice["candidates"][number]) =>
	`${folder}/ (${oldNotes} old note${oldNotes === 1 ? "" : "s"})`;

/** What `Worter/` holds that is not the source, and that Execute backs up first. */
function worterNote(choice: SourceChoice, source: string): string {
	const worter = choice.candidates.find(({ folder }) => folder === WORTER);
	if (source === WORTER)
		return `Execute moves ${WORTER}/ to a new "${WORTER} backup <date time>" folder, checks every file arrived unchanged, and regenerates from the old notes there.`;
	if (worter === undefined || worter.notes === 0)
		return `There is no ${WORTER}/ to back up; Execute regenerates into a new one.`;
	return `${WORTER}/ now holds ${worter.notes} note${worter.notes === 1 ? "" : "s"}${worter.oldNotes > 0 ? `, ${worter.oldNotes} of them old notes that this source does not regenerate` : ", none of them old notes"}. Execute first moves ${WORTER}/ to a new "${WORTER} backup <date time>" folder and checks every file arrived unchanged; it reads none of them.`;
}

/** A modal the command tracks while it is open, for E2E clicks. */
abstract class TrackedModal extends Modal {
	constructor(
		app: App,
		private readonly tracked: OpenModals,
	) {
		super(app);
	}

	override open() {
		this.tracked.add(this);
		super.open();
	}

	override onClose() {
		this.tracked.remove(this);
		this.contentEl.empty();
	}
}

class ResetModal extends TrackedModal {
	private source: string | undefined;

	constructor(
		app: App,
		modals: OpenModals,
		private readonly choice: SourceChoice,
		private readonly actions: {
			readonly dryRun: (source: string) => void;
			readonly execute: (source: string) => void;
			readonly opened: () => void;
		},
	) {
		super(app, modals);
		this.source = choice.suggested;
	}

	override onOpen() {
		const { contentEl } = this;
		this.actions.opened();
		contentEl.createEl("h2", { text: "Reset dictionary from old notes" });
		contentEl.createEl("p", {
			text: "Collects every attestation embed and freeform text from the old notes in the source folder, regenerates each attested Lemma through Classify into Lemma, Reading and Crossroad notes in a fresh Worter/, re-attaches the freeform text to the Reading note of its sense, and writes a report note. Nothing is deleted.",
		});
		const usable = this.choice.candidates.filter(
			({ oldNotes }) => oldNotes > 0,
		);
		const note = contentEl.createEl("p");
		const render = () => {
			note.setText(
				this.source === undefined
					? `No folder holds old notes: neither ${WORTER}/ nor any "${WORTER} backup <date time>" folder.`
					: worterNote(this.choice, this.source),
			);
		};
		new Setting(contentEl)
			.setName("Source of the old notes")
			.setDesc(
				`${WORTER}/, or a "${WORTER} backup <date time>" folder an earlier reset moved them to.`,
			)
			.addDropdown((dropdown) => {
				for (const candidate of usable)
					dropdown.addOption(
						candidate.folder,
						sourceLabel(candidate),
					);
				if (this.source !== undefined) dropdown.setValue(this.source);
				dropdown.onChange((value) => {
					this.source = value;
					render();
				});
			});
		render();
		contentEl.createEl("p", {
			text: "Dry run only reads and checks the provider keys, and shows what Execute would do. Execute checks the keys again before it changes anything, then asks dumgen's providers and writes to the vault.",
		});
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		buttons
			.createEl("button", { text: "Cancel" })
			.addEventListener("click", () => this.close());
		const run = (action: (source: string) => void) => () => {
			const { source } = this;
			if (source === undefined) return;
			this.close();
			action(source);
		};
		const dryRun = buttons.createEl("button", { text: "Dry run" });
		dryRun.addEventListener("click", run(this.actions.dryRun));
		const execute = buttons.createEl("button", {
			cls: "mod-warning",
			text: "Execute…",
		});
		execute.addEventListener("click", run(this.actions.execute));
		dryRun.disabled = execute.disabled = this.source === undefined;
	}
}

class ConfirmExecuteModal extends TrackedModal {
	constructor(
		app: App,
		modals: OpenModals,
		private readonly source: string,
		private readonly choice: SourceChoice,
		private readonly onConfirm: () => void,
	) {
		super(app, modals);
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Execute the dictionary reset?" });
		contentEl.createEl("p", {
			text: `Source of the old notes: ${this.source}/. ${worterNote(this.choice, this.source)}`,
		});
		contentEl.createEl("p", {
			text: "Every attestation is then classified again through dumgen, writing Lemma, Reading and Crossroad notes and links into the attested Scrolls. Run a dry run first.",
		});
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		buttons
			.createEl("button", { text: "Cancel" })
			.addEventListener("click", () => this.close());
		buttons
			.createEl("button", { cls: "mod-warning", text: "Execute" })
			.addEventListener("click", () => {
				this.close();
				this.onConfirm();
			});
	}
}

/**
 * The dry run's report, with Copy, Close and Execute… for the same source,
 * so the user need not open the command again to execute (#145).
 */
class ReportModal extends TrackedModal {
	constructor(
		app: App,
		modals: OpenModals,
		private readonly shown: {
			readonly report: string;
			readonly keyWarning: string | null;
			readonly execute: () => void;
			/** What the Copy button tells, within its click. */
			readonly notices: NoticeSink;
		},
	) {
		super(app, modals);
	}

	/** The labels of its buttons, in order. */
	actions(): string[] {
		return [...this.contentEl.querySelectorAll("button")].map(
			(button) => button.textContent ?? "",
		);
	}

	override onOpen() {
		const { contentEl } = this;
		const { keyWarning, report } = this.shown;
		contentEl.createEl("h2", { text: "Dictionary reset: dry run" });
		if (keyWarning !== null)
			contentEl
				.createEl("p", { text: keyWarning })
				.style.setProperty("color", "var(--text-error)");
		const pre = contentEl.createEl("pre", { text: report });
		pre.style.maxHeight = "60vh";
		pre.style.overflow = "auto";
		pre.style.whiteSpace = "pre-wrap";
		pre.style.userSelect = "text";
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		buttons
			.createEl("button", { text: "Copy" })
			.addEventListener("click", () => {
				const { notices } = this.shown;
				void navigator.clipboard.writeText(report).then(
					() => notices.show("Copied the dry-run report"),
					() => notices.show("⚠ Could not copy the report"),
				);
			});
		buttons
			.createEl("button", { text: "Close" })
			.addEventListener("click", () => this.close());
		buttons
			.createEl("button", { cls: "mod-warning", text: "Execute…" })
			.addEventListener("click", () => {
				this.close();
				this.shown.execute();
			});
	}
}
