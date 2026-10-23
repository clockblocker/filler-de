/**
 * The "Reset dictionary from old notes…" command (#65, #117): a modal shows
 * the source folder of old notes, `Worter/` or a `Worter backup …` folder,
 * and what `Worter/` holds now, and offers Dry run and Execute; the dry
 * run's report offers Execute too (#145). Execute asks once more, naming
 * both, checks the provider keys before it moves or writes anything (#146),
 * and reports progress in a notice until it opens its report note. "Cancel
 * dictionary reset" stops a run between or inside attestations.
 */
import type { DumdictVaultStore } from "@textfresser/dictionary";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import {
	describeError,
	formatCause,
} from "@textfresser/vault-action-manager/diagnostics";
import {
	Cause,
	DateTime,
	Deferred,
	Effect,
	Exit,
	Layer,
	Predicate,
} from "effect";
import { type App, Modal, Notice, Setting } from "obsidian";
import { conciseFailure, type KeyCheckFailure } from "../../managers/dumgen";
import type { Dumgen } from "../../managers/dumgen/dumgen-over";
import { getErrorMessage } from "../../utils/get-error-message";
import { logger } from "../../utils/logger";
import {
	ClassifyError,
	ClassifySegmenter,
} from "../classify/classify-selection";
import { dumgenUnitResolver } from "../classify/resolution/dumgen-unit-resolver";
import type { KnowledgeQueue } from "../classify/resolution/knowledge-queue";
import type { ScrollActivity } from "../classify/resolution/scroll-activity";
import { vamScrollFiles } from "../classify/resolution/scroll-files";
import { SegmentationCache } from "../classify/segmentation-cache";
import { UnitResolver, UnitResolverError } from "../classify/unit-resolver";
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

export const RESET_COMMAND_NAME = "Reset dictionary from old notes…";
export const CANCEL_RESET_COMMAND_NAME = "Cancel dictionary reset";

export type DictionaryResetDeps = {
	readonly app: App;
	readonly vam: VaultActionManager;
	readonly dumgen: () => Dumgen;
	readonly segmenterVersion: () => string;
	readonly cache: SegmentationCache["Service"];
	readonly store: () => Promise<DumdictVaultStore>;
	readonly knowledge: KnowledgeQueue;
	/** Classify's runs per Scroll, which the unlink observer waits out. */
	readonly activity?: ScrollActivity;
	readonly missingProviderKeys: () => readonly string[];
	/** Checks the provider keys with each provider; answers what failed. */
	readonly checkProviderKeys: () => Effect.Effect<readonly KeyCheckFailure[]>;
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

export class DictionaryResetCommand {
	private running: Deferred.Deferred<void> | null = null;
	private opening: Promise<ResetOpening> | null = null;
	private shownDryRun: Promise<ResetDryRunShown> | null = null;
	private executed: Promise<ResetExecuteOutcome> | null = null;
	private readonly modals = new OpenModals();

	constructor(private readonly deps: DictionaryResetDeps) {}

	open(): void {
		this.opening = this.openModal();
	}

	/** E2E: what the last `open()` showed, once shown; null before any. */
	lastOpening(): Promise<ResetOpening> | null {
		return this.opening;
	}

	/** E2E: what the last dry run showed, once shown; null before any. */
	lastDryRun(): Promise<ResetDryRunShown> | null {
		return this.shownDryRun;
	}

	/** E2E: how the last confirmed Execute ended, once it ends; null before any. */
	lastExecute(): Promise<ResetExecuteOutcome> | null {
		return this.executed;
	}

	/** E2E: clicks a button of the newest modal the command has open. */
	clickButton(label: string): boolean {
		return this.modals.click(label);
	}

	/** E2E: closes every modal the command has open, clicking nothing. */
	closeModal(): void {
		this.modals.closeAll();
	}

	/** Asks once more, then executes from `source`. */
	private confirmExecute(source: string, choice: SourceChoice): void {
		new ConfirmExecuteModal(
			this.deps.app,
			this.modals,
			source,
			choice,
			() => {
				this.executed = this.execute(source);
			},
		).open();
	}

	private async openModal(): Promise<ResetOpening> {
		const found = await Effect.runPromiseExit(
			findSources(vamResetVault(this.deps.vam)),
		);
		if (Exit.isFailure(found)) {
			const notice = `⚠ Dictionary reset: could not look for old notes: ${formatCause(found.cause, { stack: false })}`;
			new Notice(notice);
			return { kind: "Failed", notice };
		}
		let opened = false;
		const choice = found.value;
		const modal = new ResetModal(this.deps.app, this.modals, choice, {
			dryRun: (source) => {
				this.shownDryRun = this.dryRun(source, choice);
			},
			execute: (source) => this.confirmExecute(source, choice),
			opened: () => {
				opened = true;
			},
		});
		modal.open();
		return opened
			? { kind: "Opened", ...found.value }
			: { kind: "Failed", notice: "The reset modal did not open" };
	}

	/** Whether an Execute is running; Classify waits for it to end. */
	isRunning(): boolean {
		return this.running !== null;
	}

	/** Stops a running Execute; answers whether one was running. */
	cancel(): boolean {
		const running = this.running;
		if (!running) return false;
		Deferred.doneUnsafe(running, Effect.void);
		this.deps.knowledge.cancelAll();
		return true;
	}

	/**
	 * Reads and plans, and checks the provider keys meanwhile, then shows the
	 * report with Execute beside it and a key that failed as a warning.
	 */
	private async dryRun(
		source: string,
		choice: SourceChoice,
	): Promise<ResetDryRunShown> {
		const notice = new Notice(
			`Dictionary reset dry run: reading the old notes in ${source}/…`,
			0,
		);
		try {
			const [result, failures] = await Effect.runPromise(
				Effect.all(
					[
						dryRunReset(vamResetVault(this.deps.vam), { source }),
						this.deps.checkProviderKeys(),
					],
					{ concurrency: "unbounded" },
				),
			);
			notice.hide();
			const keyWarning =
				failures.length === 0
					? null
					: `⚠ Execute would stop before changing anything: ${keyFailures(failures)}. Fix the key in Textfresser's settings first.`;
			const modal = new ReportModal(this.deps.app, this.modals, {
				execute: () => this.confirmExecute(source, choice),
				keyWarning,
				report: result.report,
			});
			modal.open();
			return {
				actions: modal.actions(),
				keyWarning,
				kind: "Report",
				source,
			};
		} catch (error) {
			notice.hide();
			const message = `⚠ Dictionary reset dry run failed: ${conciseFailure(getErrorMessage(error))}`;
			new Notice(message);
			return { kind: "Failed", notice: message };
		}
	}

	private refusal(): string | undefined {
		if (this.running) return "A dictionary reset is already running.";
		const missing = this.deps.missingProviderKeys();
		if (missing.length > 0)
			return `The reset regenerates through dumgen and needs ${missing.join(" and ")} API keys in Textfresser's settings. Nothing changed.`;
		if (this.deps.knowledge.running() > 0)
			return "Knowledge generation is still running. Wait for it, or cancel it, then reset. Nothing changed.";
		return undefined;
	}

	private async execute(source: string): Promise<ResetExecuteOutcome> {
		const refuse = (refusal: string): ResetExecuteOutcome => {
			const message = `⚠ ${refusal}`;
			new Notice(message, 0);
			return { kind: "Refused", notice: message };
		};
		const refusal = this.refusal();
		if (refusal) return refuse(refusal);
		const cancel = Deferred.makeUnsafe<void>();
		this.running = cancel;
		const notice = new Notice(
			"Dictionary reset: checking the provider keys…",
			0,
		);
		try {
			// Before the backup moves anything: a key the provider rejects
			// would fail every attestation after Worter/ was moved (#146).
			const failures = await Effect.runPromise(
				this.deps.checkProviderKeys(),
			);
			if (failures.length > 0) {
				notice.hide();
				if (this.running === cancel) this.running = null;
				return refuse(
					`Dictionary reset did not start: ${keyFailures(failures)}. Fix the key in Textfresser's settings and run it again. Nothing changed.`,
				);
			}
			if (Deferred.isDoneUnsafe(cancel)) {
				notice.hide();
				if (this.running === cancel) this.running = null;
				return refuse(
					"Dictionary reset cancelled before it started. Nothing changed.",
				);
			}
		} catch (error) {
			notice.hide();
			if (this.running === cancel) this.running = null;
			return refuse(
				`Dictionary reset did not start: the provider keys could not be checked (${getErrorMessage(error)}). Nothing changed.`,
			);
		}
		notice.setMessage("Dictionary reset: starting…");
		return this.run(source, cancel, notice);
	}

	/** Execute once the keys passed: back up, regenerate, report. */
	private async run(
		source: string,
		cancel: Deferred.Deferred<void>,
		notice: Notice,
	): Promise<ResetExecuteOutcome> {
		const notices: string[] = [];
		const { deps } = this;
		const store = Effect.tryPromise({
			catch: (cause) =>
				new ResetFailed({
					cause,
					message: `The dictionary could not be read: ${getErrorMessage(cause)}`,
				}),
			try: () => deps.store(),
		});
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
			settleKnowledge: Effect.promise(() => deps.knowledge.whenIdle()),
		};
		const resolver = dumgenUnitResolver({
			...(deps.activity === undefined ? {} : { activity: deps.activity }),
			dumgen: Effect.try({
				catch: (cause) =>
					new UnitResolverError({
						cause,
						message: `dumgen is unavailable: ${getErrorMessage(cause)}`,
					}),
				try: deps.dumgen,
			}),
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
			Layer.succeed(ClassifySegmenter, {
				dumgen: Effect.try({
					catch: (cause) =>
						new ClassifyError({
							message: `dumgen is unavailable: ${getErrorMessage(cause)}`,
							reason: "DumgenUnavailable",
						}),
					try: deps.dumgen,
				}),
				segmenterVersion: deps.segmenterVersion(),
			}),
		);
		const local = DateTime.toParts(
			DateTime.setZone(DateTime.nowUnsafe(), DateTime.zoneMakeLocal()),
		);
		try {
			const exit = await Effect.runPromiseExit(
				executeReset({
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
				}).pipe(Effect.provide(layer)),
			);
			if (Exit.isFailure(exit)) {
				const failure = Cause.squash(exit.cause);
				if (
					failure instanceof ResetFailed &&
					Predicate.isString(failure.cause)
				)
					logger.error("[DictionaryReset] Report:", failure.cause);
				throw failure;
			}
			const result = exit.value;
			notice.hide();
			// The report holds one line per failure (#147); the provider's
			// own words go to the console.
			for (const regeneration of result.execution.regenerations)
				if (
					regeneration?._tag === "Unresolved" &&
					conciseFailure(regeneration.reason) !== regeneration.reason
				)
					logger.warn(
						"[DictionaryReset] Unresolved:",
						regeneration.reason,
					);
			new Notice(
				`Dictionary reset ${result.execution.cancelled ? "cancelled" : "done"}; see ${result.reportPath}`,
			);
			await deps.app.workspace.openLinkText(result.reportPath, "", true);
			return {
				cancelled: result.execution.cancelled,
				kind: "Done",
				reportPath: result.reportPath,
			};
		} catch (error) {
			notice.hide();
			logger.error("[DictionaryReset] Failed:", describeError(error));
			const message = `⚠ Dictionary reset stopped: ${conciseFailure(getErrorMessage(error))}`;
			new Notice(message, 0);
			return { kind: "Stopped", notice: message };
		} finally {
			if (this.running === cancel) this.running = null;
		}
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
				void navigator.clipboard.writeText(report).then(
					() => new Notice("Copied the dry-run report"),
					() => new Notice("⚠ Could not copy the report"),
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
