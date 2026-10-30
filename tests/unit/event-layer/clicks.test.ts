import { describe, expect, it } from "bun:test";
import {
	type PayloadFor,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import { Effect } from "effect";
import { sectionLinkOffset } from "../../../src/packages/composed/obsidian-event-layer/src/events/click/wikilink-click/link-offset";
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

describe("a subscriber that throws", () => {
	/** A task checkbox inside a toolbar button, so two subscribers see it. */
	function checkboxInButton() {
		const checkbox = taskCheckbox(false);
		const line = checkbox.parentElement as FakeElement;
		const button = new FakeElement("DIV").setAttribute(
			"data-action",
			"Translate",
		);
		button.append(line.parentElement as FakeElement);
		return checkbox;
	}

	it("is logged at its kind's edge, and the subscribers after it still run", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		const actions: string[] = [];
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => {
				throw new Error("doesApply broke");
			},
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		events.layer.setHandler(UserEventKind.ActionElementClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					actions.push(payload.actionId);
					return { outcome: "handled" } as const;
				}),
		});

		const [down] = click(events, checkboxInButton());

		expect(down?.defaultPrevented).toBe(false);
		expect(actions).toEqual(["Translate"]);
		expect(events.forks.map(({ kind }) => kind)).toEqual([
			UserEventKind.CheckboxClicked,
			UserEventKind.ActionElementClicked,
		]);
		expect(events.failures.map(String).join()).toContain("doesApply broke");
	});

	it("leaves a mousedown another subscriber handled blocked to its click", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		events.layer.setHandler(UserEventKind.ActionElementClicked, {
			doesApply: () => {
				throw new Error("doesApply broke");
			},
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});

		const [down, up, done] = click(events, checkboxInButton());

		expect(down?.defaultPrevented).toBe(true);
		expect(up?.defaultPrevented).toBe(true);
		expect(done?.defaultPrevented).toBe(true);
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

	it("runs the handler's afterwards even when the link fails to open, and fails at the edge", () => {
		const events = eventLayerOn(fakeApp("Library/Story.md"), {
			openLinkFails: true,
		});
		const reopened: string[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			afterwards: (payload) =>
				Effect.sync(() => {
					reopened.push(payload.target.basename);
				}),
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "passthrough" } as const),
		});

		click(events, readingLink());

		expect(reopened).toEqual(["Worter/f/fah/fahre/fahrer"]);
		expect(events.failures.map(String).join()).toContain(
			"no Worter/f/fah/fahre/fahrer",
		);
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

describe("wikilink click offsets", () => {
	const STORY = "Library/Story.md";

	/** A Live Preview link in the editor's only rendered line, which CodeMirror places at `at`. */
	function editorLink(at: number, inEditor = true) {
		const link = new FakeElement("SPAN", ["cm-hmd-internal-link"]);
		link.textContent = "Fahrer";
		const line = new FakeElement("DIV", ["cm-line"]).append(link);
		const content = new FakeElement("DIV", ["cm-content"]).append(line);
		const cm = {
			contentDOM: { contains: (node: unknown) => inEditor && content.contains(node as FakeElement) },
			posAtDOM: (node: unknown) => (node === link ? at : -1),
		};
		return { cm, link };
	}

	it("tells where an editor link stands from CodeMirror's position, not its rendered line", () => {
		// The rendered line is the editor's first, but CodeMirror only
		// renders the lines in view: the link is far below.
		const { cm, link } = editorLink(1234);
		const events = eventLayerOn(
			fakeApp(STORY, { cm, lines: ["Der [[Worter/f/fah/fahre/fahrer|Fahrer]] fährt. ^0"] }),
		);
		const seen: PayloadFor<"WikilinkClicked">[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					seen.push(payload);
					return { outcome: "handled" } as const;
				}),
		});
		click(events, link);
		expect(seen.map(({ offset, target }) => ({ offset, target }))).toEqual([
			{ offset: 1234, target: { alias: "Fahrer", basename: "Worter/f/fah/fahre/fahrer" } },
		]);

		// A link of another editor than the active note's has none.
		const elsewhere = editorLink(1234, false);
		const other = eventLayerOn(
			fakeApp(STORY, { cm: elsewhere.cm, lines: ["[[Worter/f/fah/fahre/fahrer|Fahrer]]"] }),
		);
		const told: (number | undefined)[] = [];
		other.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					told.push(payload.offset);
					return { outcome: "handled" } as const;
				}),
		});
		click(other, elsewhere.link);
		expect(told).toEqual([undefined]);
	});

	const TEXT = [
		"# Story",
		"",
		"Der `[[Code]]` [[Worter/m/man/mann/mann|Mann]] %%[[Kommentar]]%% ![[Bild.png]] [Web](https://x.de) und",
		"der [[Worter/f/fah/fahre/fahrer|Fahrer]]. ^0",
	].join("\n");

	/** Reading view's section of `TEXT`'s lines 2 to 3, with its two links. */
	function readingSection() {
		const mann = new FakeElement("A", ["internal-link"]).setAttribute(
			"data-href",
			"Worter/m/man/mann/mann",
		);
		const fahrer = new FakeElement("A", ["internal-link"]).setAttribute(
			"data-href",
			"Worter/f/fah/fahre/fahrer",
		);
		fahrer.textContent = "Fahrer";
		const embedded = new FakeElement("A", ["internal-link"]).setAttribute(
			"data-href",
			"Elsewhere",
		);
		const embed = new FakeElement("SPAN", ["internal-embed"]).append(embedded);
		const section = new FakeElement("DIV").append(
			new FakeElement("P").append(mann, embed, fahrer),
		);
		return { embedded, fahrer, section };
	}

	const clickedOffsets = (
		events: ReturnType<typeof eventLayerOn>,
		target: FakeElement,
	) => {
		const told: (number | undefined)[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					told.push(payload.offset);
					return { outcome: "handled" } as const;
				}),
		});
		click(events, target);
		return told;
	};

	it("tells where a Reading view link stands from its section's lines and its place among the section's links", () => {
		const events = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		const { fahrer, section } = readingSection();
		events.renderSection(section, { lineEnd: 3, lineStart: 2, sourcePath: STORY, text: TEXT });
		const [offset] = clickedOffsets(events, fahrer);
		expect(offset).toBe(TEXT.indexOf("[[Worter/f/fah") + 2);
	});

	it("tells nothing for a link in an embed, a section of another note, an unrendered section, or one whose source disagrees", () => {
		const embedded = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		const first = readingSection();
		embedded.renderSection(first.section, { lineEnd: 3, lineStart: 2, sourcePath: STORY, text: TEXT });
		expect(clickedOffsets(embedded, first.embedded)).toEqual([undefined]);

		const foreign = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		const second = readingSection();
		foreign.renderSection(second.section, {
			lineEnd: 3,
			lineStart: 2,
			sourcePath: "Library/Other.md",
			text: TEXT,
		});
		expect(clickedOffsets(foreign, second.fahrer)).toEqual([undefined]);

		const unrendered = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		expect(clickedOffsets(unrendered, readingSection().fahrer)).toEqual([undefined]);

		const stale = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		const third = readingSection();
		stale.renderSection(third.section, {
			lineEnd: 3,
			lineStart: 2,
			sourcePath: STORY,
			text: TEXT.replace("Worter/f/fah/fahre/fahrer", "Worter/f/fah/fahre/fahrerin"),
		});
		expect(clickedOffsets(stale, third.fahrer)).toEqual([undefined]);
	});
});

describe("sectionLinkOffset", () => {
	it("counts the links Reading view renders as internal links, and only those", () => {
		const text = [
			"```",
			"[[InCode]]",
			"```",
			"A `x [[Inline]] x` %%[[Hidden]]%% <!-- [[Html]] --> ![[Embed]] ![alt](pic.png) [web](https://x.de)",
			"[[First|1]] [md](Notes/Second.md) [[Third\\|3]]",
		].join("\n");
		const offsets = [0, 1, 2, 3].map((index) => sectionLinkOffset(text, 0, 4, index));
		expect(offsets).toEqual([
			text.indexOf("[[First") + 2,
			text.indexOf("[md]") + 1,
			text.indexOf("[[Third") + 2,
			undefined,
		]);
		expect(sectionLinkOffset(text, 0, 4, 0, "First")).toBe(offsets[0]);
		expect(sectionLinkOffset(text, 0, 4, 2, "Third")).toBe(offsets[2]);
		expect(sectionLinkOffset(text, 0, 4, 0, "Other")).toBeUndefined();
		// Lines the note does not have.
		expect(sectionLinkOffset(text, 3, 9, 0)).toBeUndefined();
	});

	it("reads only the section's own lines", () => {
		const text = "[[A]]\n\n[[B]] [[C]]\n\n[[D]]";
		expect(sectionLinkOffset(text, 2, 2, 1, "C")).toBe(text.indexOf("[[C]]") + 2);
		expect(sectionLinkOffset(text, 2, 2, 2)).toBeUndefined();
	});
});

describe("observed wikilink clicks", () => {
	function observing() {
		const events = eventLayerOn(fakeApp("Library/Story.md"));
		const clicked: string[] = [];
		const observed: PayloadFor<"WikilinkObserved">[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					clicked.push(payload.target.basename);
					return { outcome: "handled" } as const;
				}),
		});
		events.layer.setHandler(UserEventKind.WikilinkObserved, {
			doesApply: () => true,
			// Whatever it answers, Obsidian navigates.
			handle: (payload) =>
				Effect.sync(() => {
					observed.push(payload);
					return { outcome: "handled" } as const;
				}),
		});
		return { clicked, events, observed };
	}

	it("tells a Cmd/Ctrl-click or a middle click to its handler, and leaves the navigation to Obsidian", () => {
		for (const init of [{ metaKey: true }, { ctrlKey: true }, { button: 1 }, { button: 1, shiftKey: true }]) {
			const { clicked, events, observed } = observing();
			for (const event of click(events, readingLink(), init))
				expect(event.defaultPrevented).toBe(false);
			expect(clicked).toEqual([]);
			expect(events.opened).toEqual([]);
			expect(observed.map(({ kind, sourcePath, target }) => ({ kind, sourcePath, target }))).toEqual([
				{
					kind: UserEventKind.WikilinkObserved,
					sourcePath: "Library/Story.md",
					target: { alias: "Fahrer", basename: "Worter/f/fah/fahre/fahrer" },
				},
			]);
			expect(events.forks).toEqual([
				{ fork: { traced: true }, kind: UserEventKind.WikilinkObserved },
			]);
		}
	});

	it("observes no plain click, nor one with only Shift or Alt, nor a right click", () => {
		const plain = observing();
		click(plain.events, readingLink());
		expect(plain.clicked).toEqual(["Worter/f/fah/fahre/fahrer"]);
		expect(plain.observed).toEqual([]);

		for (const init of [{ shiftKey: true }, { altKey: true }, { button: 2 }]) {
			const { clicked, events, observed } = observing();
			for (const event of click(events, readingLink(), init))
				expect(event.defaultPrevented).toBe(false);
			expect([...clicked, ...observed]).toEqual([]);
		}
	});
});
