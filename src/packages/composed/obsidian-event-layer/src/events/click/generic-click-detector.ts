/**
 * The shared click stream of the click detectors.
 *
 * Uses mousedown in the capture phase, to catch a click before Obsidian
 * re-renders. Each subscriber is told of the buttons it asks for, the left
 * one by default, and filters for its own targets, in order.
 *
 * When a subscriber prevents a mousedown's default, the mouseup and click
 * that follow on the same target are blocked too, so Obsidian, which
 * toggles a checkbox on mouseup, never sees them.
 *
 * A subscriber that throws, such as a handler's `doesApply`, is logged at
 * its kind's edge; the subscribers after it still run.
 */
import { Effect, Exit, MutableRef, Ref } from "effect";
import type { UserEventKind } from "../../contracts";
import type { EventDispatch } from "../../internal/dispatch";

export type ClickSubscriber = {
	/** The kind it detects, whose edge logs what it throws. */
	readonly kind: UserEventKind;
	/** The mouse buttons it is told about, by `MouseEvent.button`; the left one only by default. */
	readonly buttons?: readonly number[];
	readonly onMouseDown: (target: HTMLElement, evt: MouseEvent) => void;
};

const LEFT_ONLY: readonly number[] = [0];

const CAPTURE = { capture: true } as const;

/** Listens for clicks while the scope is open, for `subscribers` in order. */
export const listenForClicks = Effect.fnUntraced(function* (
	{ host }: EventDispatch,
	subscribers: readonly ClickSubscriber[],
) {
	// The target of the last mousedown a subscriber handled, until its click.
	const handledTarget = yield* Ref.make<EventTarget | null>(null);

	/** Blocks `evt` when it follows a handled mousedown on its target. */
	const blockAfterHandled = (evt: MouseEvent, endsSequence: boolean) => {
		const target = Ref.getUnsafe(handledTarget);
		if (!target || evt.target !== target) return;
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();
		if (endsSequence) MutableRef.set(handledTarget.ref, null);
	};

	yield* host.listen(
		"mousedown",
		(evt) => {
			MutableRef.set(handledTarget.ref, null);
			const target = evt.target as HTMLElement;
			for (const { buttons, kind, onMouseDown } of subscribers) {
				if (!(buttons ?? LEFT_ONLY).includes(evt.button)) continue;
				const ran = host.readSync(
					Effect.sync(() => onMouseDown(target, evt)),
				);
				if (Exit.isFailure(ran))
					host.fork(
						kind,
						// A throw: a defect, logged whole at the edge.
						Effect.failCause(ran.cause),
						{ traced: true },
					);
			}
			if (evt.defaultPrevented)
				MutableRef.set(handledTarget.ref, evt.target);
		},
		CAPTURE,
	);
	yield* host.listen(
		"mouseup",
		(evt) => blockAfterHandled(evt, false),
		CAPTURE,
	);
	yield* host.listen("click", (evt) => blockAfterHandled(evt, true), CAPTURE);
});
