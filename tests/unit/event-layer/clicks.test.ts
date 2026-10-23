import { describe, expect, it } from "bun:test";
import {
	type PayloadFor,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import { Effect } from "effect";
import {
	eventLayerOn,
	FakeElement,
	fakeApp,
	fakeEvent,
} from "../../support/event-layer";

const CODEX = "Library/Rezept/__-Rezept.md";

/** A task checkbox on the editor's second line, `- [ ] [[Kuchen]]`. */
function taskCheckbox(checked: boolean) {
	const checkbox = new FakeElement("INPUT", ["task-list-item-checkbox"]);
	checkbox.type = "checkbox";
	checkbox.checked = checked;
	const line = new FakeElement("DIV", ["cm-line"]).append(checkbox);
	new FakeElement("DIV", ["cm-content"]).append(
		new FakeElement("DIV", ["cm-line"]),
		line,
	);
	return checkbox;
}

const LINES = ["# Rezept", "- [ ] [[Kuchen-Rezept|Kuchen]]"];

/** A mousedown, mouseup and click on `target`, as one click. */
function click(
	events: ReturnType<typeof eventLayerOn>,
	target: FakeElement,
	init: Parameters<typeof fakeEvent>[1] = {},
) {
	return ["mousedown", "mouseup", "click"].map((type) =>
		events.fire(fakeEvent(type, { target, ...init })),
	);
}

describe("task checkbox clicks", () => {
	it("a handler that takes the click stops Obsidian's toggle, mousedown to click", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		const seen: PayloadFor<"CheckboxClicked">[] = [];
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					seen.push(payload);
					return { outcome: "handled" } as const;
				}),
		});

		const [down, up, done] = click(events, taskCheckbox(false));

		for (const event of [down, up, done]) {
			expect(event?.defaultPrevented).toBe(true);
			expect(event?.immediateStopped).toBe(true);
		}
		expect(seen).toEqual([
			{
				checked: false,
				kind: UserEventKind.CheckboxClicked,
				lineContent: "[[Kuchen-Rezept|Kuchen]]",
				sourcePath: CODEX,
			},
		]);
		expect(events.forks).toEqual([
			{ fork: { traced: true }, kind: UserEventKind.CheckboxClicked },
		]);
	});

	it("one the handler declines, or with no handler, is Obsidian's", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		for (const event of click(events, taskCheckbox(true)))
			expect(event.defaultPrevented).toBe(false);

		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => false,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		for (const event of click(events, taskCheckbox(true)))
			expect(event.defaultPrevented).toBe(false);
		expect(events.forks).toEqual([]);
	});

	it("ignores any button but the left one", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		for (const event of click(events, taskCheckbox(false), { button: 2 }))
			expect(event.defaultPrevented).toBe(false);
		expect(events.forks).toEqual([]);
	});

	it("blocks only the mouseup and click on the handled target", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		events.fire(fakeEvent("mousedown", { target: taskCheckbox(false) }));
		const elsewhere = new FakeElement("SPAN");
		expect(
			events.fire(fakeEvent("mouseup", { target: elsewhere }))
				.defaultPrevented,
		).toBe(false);
	});
});

describe("frontmatter checkbox clicks", () => {
	it("tell the handler, and leave the toggle to Obsidian", () => {
		const input = new FakeElement("INPUT");
		input.type = "checkbox";
		input.checked = true;
		const key = new FakeElement("DIV", ["metadata-property-key"]);
		key.textContent = " done ";
		new FakeElement("DIV", ["metadata-container"]).append(
			new FakeElement("DIV", ["metadata-property"]).append(key, input),
		);
		const events = eventLayerOn(fakeApp(CODEX));
		const seen: PayloadFor<"CheckboxFrontmatterClicked">[] = [];
		events.layer.setHandler(UserEventKind.CheckboxFrontmatterClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					seen.push(payload);
					return { outcome: "handled" } as const;
				}),
		});

		const [down] = click(events, input);

		expect(down?.defaultPrevented).toBe(false);
		expect(seen).toEqual([
			{
				checked: true,
				kind: UserEventKind.CheckboxFrontmatterClicked,
				propertyName: "done",
				sourcePath: CODEX,
			},
		]);
	});
});

/** A link in reading mode, `[[Worter/f/fah/fahre/fahrer|Fahrer]]`. */
function readingLink() {
	const link = new FakeElement("A", ["internal-link"]).setAttribute(
		"data-href",
		"Worter/f/fah/fahre/fahrer",
	);
	link.textContent = "Fahrer";
	const paragraph = new FakeElement("P").append(link);
	paragraph.textContent = "Der Fahrer fährt.";
	return link;
}

describe("wikilink clicks", () => {
	it("a passthrough opens the link as Obsidian would, then runs the handler's afterwards", () => {
		const events = eventLayerOn(fakeApp("Library/Story.md"));
		const order: string[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			afterwards: (payload) =>
				Effect.sync(() => {
					order.push(
						`afterwards ${payload.target.basename}, opened ${events.opened.length}`,
					);
				}),
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					order.push(`handle ${payload.target.alias}`);
					return { outcome: "passthrough" } as const;
				}),
		});

		const [down, up, done] = click(events, readingLink());

		expect(down?.defaultPrevented).toBe(true);
		expect(up?.defaultPrevented).toBe(true);
		expect(done?.defaultPrevented).toBe(true);
		expect(events.opened).toEqual([
			{ sourcePath: "Library/Story.md", target: "Worter/f/fah/fahre/fahrer" },
		]);
		expect(order).toEqual([
			"handle Fahrer",
			"afterwards Worter/f/fah/fahre/fahrer, opened 1",
		]);
	});

	it("a handled click opens nothing", () => {
		const events = eventLayerOn(fakeApp("Library/Story.md"));
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		click(events, readingLink());
		expect(events.opened).toEqual([]);
	});

	it("leaves a click with a modifier to Obsidian, for a new tab", () => {
		const events = eventLayerOn(fakeApp("Library/Story.md"));
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "passthrough" } as const),
		});
		for (const event of click(events, readingLink(), { metaKey: true }))
			expect(event.defaultPrevented).toBe(false);
		expect(events.opened).toEqual([]);
		expect(events.forks).toEqual([]);
	});
});

describe("action element clicks and selection changes", () => {
	it("run untraced: a button's command opens its own root, and a selection change is frequent", () => {
		const events = eventLayerOn(
			fakeApp("Library/Story.md", { selection: "Fahrer" }),
		);
		const told: string[] = [];
		events.layer.setHandler(UserEventKind.ActionElementClicked, {
			doesApply: (payload) => payload.actionId === "Translate",
			handle: (payload) =>
				Effect.sync(() => {
					told.push(payload.actionId);
					return { outcome: "handled" } as const;
				}),
		});
		events.layer.setHandler(UserEventKind.SelectionChanged, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					told.push(`${payload.source}: ${payload.selectedText}`);
					return { outcome: "passthrough" } as const;
				}),
		});
		const button = new FakeElement("BUTTON").setAttribute(
			"data-action",
			"Translate",
		);
		const disabled = new FakeElement("BUTTON")
			.setAttribute("data-action", "Translate")
			.setAttribute("disabled", "");

		click(events, button);
		click(events, disabled);
		events.fire(fakeEvent("mouseup", { target: new FakeElement("SPAN") }));
		events.fire(fakeEvent("keyup", { key: "ArrowLeft", shiftKey: true }));
		events.fire(fakeEvent("keyup", { key: "x" }));
		events.fire(fakeEvent("dragend"));

		// A mouseup on a button is its click, not a selection.
		expect(told).toEqual([
			"Translate",
			"mouse: Fahrer",
			"keyboard: Fahrer",
			"drag: Fahrer",
		]);
		expect(new Set(events.forks.map(({ fork }) => fork.traced))).toEqual(
			new Set([false]),
		);
	});
});
