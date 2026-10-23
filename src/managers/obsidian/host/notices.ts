/**
 * Obsidian's `Notice`, as a service. Nothing outside this folder constructs
 * a `Notice`: Effect code yields `Notices`, and plain DOM code, such as the
 * settings tab or a modal's buttons, is handed its `sink`.
 */
import { Context, Effect, Layer } from "effect";
import { Notice } from "obsidian";

/** A sticky notice stays until the user dismisses it, or its handle hides it. */
export type NoticeOptions = { readonly sticky?: boolean };

/** A notice on screen, such as a progress notice its owner updates. */
export type NoticeHandle = {
	readonly setMessage: (message: string) => void;
	readonly hide: () => void;
	/** False once the user dismissed it, or it timed out or was hidden. */
	readonly showing: () => boolean;
};

/** The notices as plain functions, for code that runs in a DOM callback. */
export type NoticeSink = {
	readonly show: (message: string, options?: NoticeOptions) => void;
	readonly open: (message: string, options?: NoticeOptions) => NoticeHandle;
};

/**
 * Obsidian's notices: a passing notice lasts Obsidian's default time, a
 * sticky one stays (`new Notice(message, 0)`).
 */
export const obsidianNotices: NoticeSink = {
	open: (message, options) => {
		const notice = new Notice(message, options?.sticky ? 0 : undefined);
		return {
			hide: () => notice.hide(),
			setMessage: (next) => {
				notice.setMessage(next);
			},
			showing: () => notice.noticeEl.isConnected,
		};
	},
	show: (message, options) => {
		new Notice(message, options?.sticky ? 0 : undefined);
	},
};

export class Notices extends Context.Service<
	Notices,
	{
		readonly show: (
			message: string,
			options?: NoticeOptions,
		) => Effect.Effect<void>;
		readonly open: (
			message: string,
			options?: NoticeOptions,
		) => Effect.Effect<NoticeHandle>;
		/** The same notices as plain functions, for plain DOM code. */
		readonly sink: NoticeSink;
	}
>()("textfresser/managers/obsidian/host/Notices") {
	/** The service over `sink`, such as a test's recording one. */
	static readonly over = (sink: NoticeSink): Notices["Service"] =>
		Notices.of({
			open: (message, options) =>
				Effect.sync(() => sink.open(message, options)),
			show: (message, options) =>
				Effect.sync(() => sink.show(message, options)),
			sink,
		});

	static readonly layer = (sink: NoticeSink = obsidianNotices) =>
		Layer.succeed(Notices, Notices.over(sink));
}
