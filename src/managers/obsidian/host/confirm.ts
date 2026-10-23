/**
 * Asking the user to confirm, in an Obsidian modal with OK and Cancel
 * (`confirm-modal.ts`, plain DOM); `Confirm.ask` waits for its answer.
 */
import { Context, Effect, Layer } from "effect";

/** Opens a modal that asks; `answer` is told once, true for OK. */
export type OpenConfirm = (
	title: string,
	message: string,
	answer: (confirmed: boolean) => void,
) => { readonly close: () => void };

export class Confirm extends Context.Service<
	Confirm,
	{
		/**
		 * Asks `message` under `title`; answers whether OK was clicked.
		 * Closing the modal any other way answers Cancel. Interrupted, as
		 * when the plugin unloads, it closes the modal.
		 */
		readonly ask: (
			title: string,
			message: string,
		) => Effect.Effect<boolean>;
	}
>()("textfresser/managers/obsidian/host/Confirm") {
	/** Over `open`, such as a test's scripted one. */
	static readonly over = (open: OpenConfirm): Confirm["Service"] =>
		Confirm.of({
			ask: Effect.fn("Confirm.ask")((title: string, message: string) =>
				Effect.callback<boolean>((resume) => {
					const modal = open(title, message, (confirmed) =>
						resume(Effect.succeed(confirmed)),
					);
					// Its answer after this resumes nothing.
					return Effect.sync(() => modal.close());
				}),
			),
		});

	static readonly layer = (open: OpenConfirm) =>
		Layer.succeed(Confirm, Confirm.over(open));
}
