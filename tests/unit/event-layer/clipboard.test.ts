import { describe, expect, it } from "bun:test";
import { UserEventKind } from "@textfresser/obsidian-event-layer";
import { Effect } from "effect";
import { createClipboardHandler } from "../../../src/managers/obsidian/behavior-manager/clipboard-behavior";
import {
	eventLayerOn,
	fakeApp,
	fakeClipboard,
	fakeEvent,
} from "../../support/event-layer";

const NOTE = "Library/Märchen/Aschenputtel-Märchen.md";
const GO_BACK = "[[__-Märchen|← Märchen]]";

/** The layer with the plugin's clipboard handler, VAM reading `selection`. */
function withClipboardHandler(selection: string | null) {
	const events = eventLayerOn(fakeApp(NOTE), { selection });
	events.layer.setHandler(
		UserEventKind.ClipboardCopy,
		createClipboardHandler(),
	);
	return events;
}

const copy = (
	events: ReturnType<typeof eventLayerOn>,
	type: "copy" | "cut",
	clipboardText?: string,
) => {
	const clipboard = fakeClipboard(clipboardText);
	const event = events.fire(fakeEvent(type, { clipboardData: clipboard }));
	return { clipboard, event };
};

describe("copy and cut", () => {
	it("copy puts the selection without its go-back link on the clipboard, inside the event", () => {
		const events = withClipboardHandler(`${GO_BACK}\nEs war einmal.`);
		const { clipboard, event } = copy(events, "copy");

		expect(event.defaultPrevented).toBe(true);
		expect(clipboard.text).toBe("Es war einmal.");
		expect(events.forks).toEqual([
			{ fork: { traced: true }, kind: UserEventKind.ClipboardCopy },
		]);
	});

	// Only as handed a selection: in a real editor, CodeMirror's own cut
	// deletes the selection before this listener reads it, so a cut is not
	// stripped there (on master too); see the follow-up issue.
	it("a cut handed its selection strips it the same way (not yet in a real editor)", () => {
		const events = eventLayerOn(fakeApp(NOTE), {
			selection: `${GO_BACK}\nEs war einmal.`,
		});
		const seen: boolean[] = [];
		const handler = createClipboardHandler();
		events.layer.setHandler(UserEventKind.ClipboardCopy, {
			...handler,
			handle: (payload) => {
				seen.push(payload.isCut);
				return handler.handle(payload);
			},
		});
		const { clipboard, event } = copy(events, "cut");

		expect(seen).toEqual([true]);
		expect(event.defaultPrevented).toBe(true);
		expect(clipboard.text).toBe("Es war einmal.");
	});

	it("a selection with nothing to strip is copied as it is", () => {
		const events = withClipboardHandler("Es war einmal.");
		const { clipboard, event } = copy(events, "copy");

		expect(event.defaultPrevented).toBe(true);
		expect(clipboard.text).toBe("Es war einmal.");
	});

	it("falls back to the document's selection when VAM reads none", () => {
		const events = withClipboardHandler(null);
		events.state.selection = `${GO_BACK}\nSieben Zwerge.`;
		const { clipboard } = copy(events, "copy");

		expect(clipboard.text).toBe("Sieben Zwerge.");
	});

	it("with no handler, the native copy proceeds untouched", () => {
		const events = eventLayerOn(fakeApp(NOTE), { selection: "text" });
		const { clipboard, event } = copy(events, "copy", "native");

		expect(event.defaultPrevented).toBe(false);
		expect(clipboard.text).toBe("native");
		expect(events.forks).toEqual([]);
	});

	it("a handler that does not take the copy leaves it native", () => {
		const events = eventLayerOn(fakeApp(NOTE), { selection: "text" });
		events.layer.setHandler(UserEventKind.ClipboardCopy, {
			doesApply: () => false,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		const { event } = copy(events, "copy", "native");

		expect(event.defaultPrevented).toBe(false);
		expect(events.forks).toEqual([]);
	});

	it("a handler that waits finds the copy over: the selection was copied as it is, and its answer is dropped", async () => {
		const events = eventLayerOn(fakeApp(NOTE), {
			selection: `${GO_BACK}\nEs war einmal.`,
		});
		let answered = false;
		events.layer.setHandler(UserEventKind.ClipboardCopy, {
			doesApply: () => true,
			handle: () =>
				Effect.sleep("1 millis").pipe(
					Effect.as({
						effect: { modifiedText: "too late" },
						outcome: "effect",
					} as const),
					Effect.ensuring(
						Effect.sync(() => {
							answered = true;
						}),
					),
				),
		});
		const { clipboard, event } = copy(events, "copy");

		expect(event.defaultPrevented).toBe(true);
		expect(clipboard.text).toBe(`${GO_BACK}\nEs war einmal.`);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(answered).toBe(true);
		expect(clipboard.text).toBe(`${GO_BACK}\nEs war einmal.`);
	});

	it("a handled copy puts nothing on the clipboard", () => {
		const events = eventLayerOn(fakeApp(NOTE), { selection: "text" });
		events.layer.setHandler(UserEventKind.ClipboardCopy, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		const { clipboard, event } = copy(events, "copy");

		expect(event.defaultPrevented).toBe(true);
		expect(clipboard.text).toBeUndefined();
	});
});

describe("copy with no selection", () => {
	it("copies the block's embed for a block reference", () => {
		const events = withClipboardHandler(null);
		const { clipboard, event } = copy(events, "copy", "Es war einmal. ^12");

		expect(event.defaultPrevented).toBe(true);
		expect(clipboard.text).toBe("![[Aschenputtel-Märchen#^12|^]]");
		expect(events.forks).toEqual([]);
	});

	it("leaves other text, and every cut, alone", () => {
		const events = withClipboardHandler(null);
		const plain = copy(events, "copy", "Es war einmal.");
		expect(plain.event.defaultPrevented).toBe(false);
		expect(plain.clipboard.text).toBe("Es war einmal.");

		const cut = copy(events, "cut", "Es war einmal. ^12");
		expect(cut.event.defaultPrevented).toBe(false);
		expect(cut.clipboard.text).toBe("Es war einmal. ^12");
	});
});
