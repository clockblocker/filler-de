import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Exit, Layer, Scope } from "effect";
import { listenForUnitHover } from "../../../src/managers/overlay-manager/unit-hover/unit-hover";
import {
	type LineSource,
	paragraphAt,
	unitPartsAt,
} from "../../../src/managers/overlay-manager/unit-hover/unit-parts";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { fakeHost } from "../../support/obsidian-host";

const ANFANGEN = "Worter/de/Lexeme/VERB/a/anf/anfan/🚀 anfangen";
const SEE = "Worter/de/Lexeme/NOUN/Masc/s/see/see/🌊 See";

/** The texts of `ranges` in `text`. */
const textsOf = (
	text: string,
	ranges: readonly { readonly from: number; readonly to: number }[],
) => ranges.map(({ from, to }) => text.slice(from, to));

describe("unitPartsAt", () => {
	const text = `Er [[${ANFANGEN}|fängt]] am [[${SEE}|See]] zu singen [[${ANFANGEN}|an]]. ^3`;

	it("finds every part of the hovered link's unit, the hovered one too", () => {
		for (const hovered of ["fängt", "an]]", `[[${ANFANGEN}|an`])
			expect(
				textsOf(text, unitPartsAt(text, text.indexOf(hovered))),
			).toEqual(["fängt", "an"]);
		expect(textsOf(text, unitPartsAt(text, text.indexOf("See]")))).toEqual([
			"See",
		]);
	});

	it("finds none outside a link to a Reading note", () => {
		const mixed = `Ein [[Garten|Gärtchen]], ![[${SEE}]] und [[${SEE}|See]].`;
		expect(unitPartsAt(text, text.indexOf("am"))).toEqual([]);
		expect(unitPartsAt(mixed, mixed.indexOf("Gärtchen"))).toEqual([]);
		// An embed is no part, of its own unit or of another.
		expect(unitPartsAt(mixed, mixed.indexOf(`${SEE}]]`))).toEqual([]);
		expect(
			textsOf(mixed, unitPartsAt(mixed, mixed.indexOf("|See"))),
		).toEqual(["See"]);
	});

	it("shows a link without an alias by its target", () => {
		const bare = `Der [[${SEE}]] und [[${SEE}|See]]`;
		expect(textsOf(bare, unitPartsAt(bare, bare.indexOf("See|")))).toEqual(
			[SEE, "See"],
		);
	});
});

/** `content` by its lines, as CodeMirror's `Text` reads it. */
function linesOf(content: string): LineSource {
	const lines = content.split("\n");
	const starts = lines.map((_, index) =>
		lines.slice(0, index).reduce((sum, line) => sum + line.length + 1, 0),
	);
	return {
		line: (number) => ({
			from: starts[number - 1] ?? 0,
			text: lines[number - 1] ?? "",
		}),
		lineAt: (offset) => ({
			number: starts.findLastIndex((start) => start <= offset) + 1,
		}),
		lines: lines.length,
	};
}

describe("paragraphAt", () => {
	it("reads the lines around an offset up to a blank one", () => {
		const content = "Eins. ^0\n\nZwei\ndrei. ^1\n  \nVier. ^2";
		const doc = linesOf(content);
		expect(paragraphAt(doc, content.indexOf("drei"))).toEqual({
			from: content.indexOf("Zwei"),
			text: "Zwei\ndrei. ^1",
		});
		expect(paragraphAt(doc, 0)).toEqual({ from: 0, text: "Eins. ^0" });
		expect(paragraphAt(doc, content.length)).toEqual({
			from: content.indexOf("Vier"),
			text: "Vier. ^2",
		});
	});
});

/** An event target that counts its listeners. */
function countingTarget() {
	const target = new EventTarget();
	let listeners = 0;
	const add = target.addEventListener.bind(target);
	const remove = target.removeEventListener.bind(target);
	target.addEventListener = (...args) => {
		listeners++;
		add(...args);
	};
	target.removeEventListener = (...args) => {
		listeners--;
		remove(...args);
	};
	return { listeners: () => listeners, target };
}

describe("listenForUnitHover", () => {
	const global = globalThis as { window?: unknown };
	let previous: unknown;
	let window: ReturnType<typeof countingTarget>;
	beforeEach(() => {
		previous = global.window;
		window = countingTarget();
		global.window = window.target;
	});
	afterEach(() => {
		global.window = previous;
	});

	it("holds its editor extension and listeners only while its scope is open", async () => {
		const { layer, obsidian } = fakeHost();
		const runtime = makePluginRuntime(
			layer.pipe(
				Layer.provideMerge(ObservabilityLive(makeRecentTrace())),
			),
			{
				onBuildFailed: () => {
					throw new Error("the host did not build");
				},
			},
		);
		const document = countingTarget();
		const scope = Scope.makeUnsafe();
		await runtime.e2e(
			"listen",
			Scope.provide(scope)(
				listenForUnitHover(document.target as Document),
			),
		);
		expect(obsidian.registeredExtensions).toEqual([[expect.anything()]]);
		expect(document.listeners()).toBe(2);
		expect(window.listeners()).toBe(1);
		// Events over no link change nothing.
		document.target.dispatchEvent(new Event("mouseover"));
		document.target.dispatchEvent(new Event("mouseout"));

		await runtime.e2e("close", Scope.close(scope, Exit.void));
		expect(obsidian.registeredExtensions).toEqual([[]]);
		expect(document.listeners()).toBe(0);
		expect(window.listeners()).toBe(0);
		await runtime.dispose();
	});
});
