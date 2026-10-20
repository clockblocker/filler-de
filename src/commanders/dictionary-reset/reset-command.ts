/**
 * The "Reset dictionary from old notes…" command (#65): a modal offers Dry
 * run and Execute, Execute asks once more, and the run reports progress in
 * a notice until it opens its report note. "Cancel dictionary reset" stops
 * a run between or inside attestations.
 */
import type { DumdictVaultStore } from "@textfresser/dictionary";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import type { Dumgen } from "dumgen";
import {
	Cause,
	DateTime,
	Deferred,
	Effect,
	Exit,
	Layer,
	Predicate,
} from "effect";
import { type App, Modal, Notice } from "obsidian";
import { getErrorMessage } from "../../utils/get-error-message";
import { logger } from "../../utils/logger";
import {
	ClassifyError,
	ClassifySegmenter,
} from "../classify/classify-selection";
import { dumgenUnitResolver } from "../classify/resolution/dumgen-unit-resolver";
import type { KnowledgeQueue } from "../classify/resolution/knowledge-queue";
import { vamScrollFiles } from "../classify/resolution/scroll-files";
import { SegmentationCache } from "../classify/segmentation-cache";
import { UnitResolver, UnitResolverError } from "../classify/unit-resolver";
import {
	dryRunReset,
	executeReset,
	type ResetDictionary,
	ResetFailed,
	type ResetProgress,
	resetStamp,
} from "./execute";
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
	readonly missingProviderKeys: () => readonly string[];
};

const STAGE_LABEL: Record<ResetProgress["stage"], string> = {
	Backup: "Backing up Worter/",
	Collect: "Reading the old notes",
	Reattach: "Re-attaching freeform text",
	Regenerate: "Regenerating",
	Report: "Writing the report",
};

export class DictionaryResetCommand {
	private running: Deferred.Deferred<void> | null = null;

	constructor(private readonly deps: DictionaryResetDeps) {}

	open(): void {
		new ResetModal(this.deps.app, {
			dryRun: () => void this.dryRun(),
			execute: () =>
				new ConfirmExecuteModal(
					this.deps.app,
					() => void this.execute(),
				).open(),
		}).open();
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

	private async dryRun(): Promise<void> {
		const notice = new Notice(
			"Dictionary reset dry run: reading the old notes…",
			0,
		);
		try {
			const result = await Effect.runPromise(
				dryRunReset(vamResetVault(this.deps.vam)),
			);
			notice.hide();
			new ReportModal(this.deps.app, result.report).open();
		} catch (error) {
			notice.hide();
			new Notice(
				`⚠ Dictionary reset dry run failed: ${getErrorMessage(error)}`,
			);
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

	private async execute(): Promise<void> {
		const refusal = this.refusal();
		if (refusal) {
			new Notice(`⚠ ${refusal}`);
			return;
		}
		const cancel = Deferred.makeUnsafe<void>();
		this.running = cancel;
		const notices: string[] = [];
		const notice = new Notice("Dictionary reset: starting…", 0);
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
			rescan: store.pipe(
				Effect.flatMap((opened) => opened.rescan),
				Effect.mapError((error) =>
					error instanceof ResetFailed
						? error
						: new ResetFailed({
								cause: error,
								message: error.message,
							}),
				),
			),
			settleKnowledge: Effect.promise(() => deps.knowledge.whenIdle()),
		};
		const resolver = dumgenUnitResolver({
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
			new Notice(
				`Dictionary reset ${result.execution.cancelled ? "cancelled" : "done"}; see ${result.reportPath}`,
			);
			await deps.app.workspace.openLinkText(result.reportPath, "", true);
		} catch (error) {
			notice.hide();
			logger.error("[DictionaryReset] Failed:", getErrorMessage(error));
			new Notice(
				`⚠ Dictionary reset stopped: ${getErrorMessage(error)}`,
				0,
			);
		} finally {
			if (this.running === cancel) this.running = null;
		}
	}
}

class ResetModal extends Modal {
	constructor(
		app: App,
		private readonly actions: {
			readonly dryRun: () => void;
			readonly execute: () => void;
		},
	) {
		super(app);
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Reset dictionary from old notes" });
		contentEl.createEl("p", {
			text: "Collects every attestation embed and freeform text from the old notes in Worter/, moves Worter/ to a dated backup folder, regenerates each attested Lemma through Classify, re-attaches the freeform text, and writes a report note. Nothing is deleted.",
		});
		contentEl.createEl("p", {
			text: "Dry run only reads, and shows what Execute would do. Execute asks dumgen's providers and writes to the vault.",
		});
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		buttons
			.createEl("button", { text: "Cancel" })
			.addEventListener("click", () => this.close());
		buttons
			.createEl("button", { text: "Dry run" })
			.addEventListener("click", () => {
				this.close();
				this.actions.dryRun();
			});
		buttons
			.createEl("button", { cls: "mod-warning", text: "Execute…" })
			.addEventListener("click", () => {
				this.close();
				this.actions.execute();
			});
	}

	override onClose() {
		this.contentEl.empty();
	}
}

class ConfirmExecuteModal extends Modal {
	constructor(
		app: App,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Execute the dictionary reset?" });
		contentEl.createEl("p", {
			text: "Worter/ moves to a backup folder, and every attestation is classified again through dumgen, writing new Lemma notes and links into the attested Scrolls. Run a dry run first.",
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

	override onClose() {
		this.contentEl.empty();
	}
}

class ReportModal extends Modal {
	constructor(
		app: App,
		private readonly report: string,
	) {
		super(app);
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Dictionary reset: dry run" });
		const pre = contentEl.createEl("pre", { text: this.report });
		pre.style.maxHeight = "60vh";
		pre.style.overflow = "auto";
		pre.style.whiteSpace = "pre-wrap";
		pre.style.userSelect = "text";
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		buttons
			.createEl("button", { text: "Copy" })
			.addEventListener("click", () => {
				void navigator.clipboard.writeText(this.report).then(
					() => new Notice("Copied the dry-run report"),
					() => new Notice("⚠ Could not copy the report"),
				);
			});
		buttons
			.createEl("button", { cls: "mod-cta", text: "Close" })
			.addEventListener("click", () => this.close());
	}

	override onClose() {
		this.contentEl.empty();
	}
}
