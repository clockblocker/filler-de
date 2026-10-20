/**
 * The one write resolution makes to a Scroll: a compare-and-swap transform
 * through VAM. VAM runs it on the editor's content when the Scroll is open
 * and through `Vault.process` otherwise; either way the transform sees the
 * content as it is at that moment, so the user's typing is never replaced.
 */
import {
	splitPathCodec,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect, Predicate, Schema } from "effect";

export class ScrollWriteFailed extends Schema.TaggedError<ScrollWriteFailed>()(
	"ScrollWriteFailed",
	{
		cause: Schema.Defect(),
		/** Another write won the race; the transform may run again. */
		conflict: Schema.Boolean,
		message: Schema.String,
	},
) {}

export type ScrollFiles = {
	readonly process: (
		scrollPath: string,
		transform: (current: string) => string,
	) => Effect.Effect<void, ScrollWriteFailed>;
};

/** Whether a VAM failure says the file changed under the transform. */
function lostRace(error: unknown): boolean {
	const cause =
		Predicate.hasProperty(error, "failure") &&
		Predicate.hasProperty(error.failure, "cause")
			? error.failure.cause
			: error;
	if (!Predicate.hasProperty(cause, "_tag")) return false;
	return (
		cause._tag === "VamContentConflictError" ||
		(cause._tag === "VamActiveEditorError" &&
			Predicate.hasProperty(cause, "reason") &&
			(cause.reason === "IdentityMismatch" ||
				cause.reason === "StaleFile"))
	);
}

export function vamScrollFiles(
	vam: Pick<VaultActionManager, "dispatchStopOnFirstFailure">,
): ScrollFiles {
	return {
		process: (scrollPath, transform) =>
			Effect.suspend(() => {
				const splitPath = splitPathCodec.parse(scrollPath);
				if (splitPath.kind !== "MdFile")
					return Effect.fail(
						new ScrollWriteFailed({
							cause: scrollPath,
							conflict: false,
							message: `${scrollPath} is no Markdown file`,
						}),
					);
				return vam
					.dispatchStopOnFirstFailure([
						{
							kind: VaultActionKind.ProcessMdFile,
							payload: { splitPath, transform },
						},
					])
					.pipe(
						Effect.mapError(
							(error) =>
								new ScrollWriteFailed({
									cause: error,
									conflict: lostRace(error),
									message: `Could not write the links into ${scrollPath}`,
								}),
						),
					);
			}),
	};
}
