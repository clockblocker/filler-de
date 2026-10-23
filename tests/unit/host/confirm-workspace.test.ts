import { describe, expect, it } from "bun:test";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Effect, Exit, Fiber, Layer } from "effect";
import {
	Confirm,
	Workspace,
	WorkspaceError,
} from "../../../src/managers/obsidian/host";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { fakeHost, scriptedConfirm } from "../../support/obsidian-host";

/** Lets every fiber and promise that can move, move. */
async function until(done: () => boolean): Promise<void> {
	for (let round = 0; round < 200 && !done(); round++)
		await new Promise((resolve) => setTimeout(resolve, 5));
	if (!done()) throw new Error("timed out");
}

describe("Confirm.ask", () => {
	it("answers what the user clicked", async () => {
		const script = scriptedConfirm([true, false]);
		const confirm = Confirm.over(script.confirm);
		const answers = await Effect.runPromise(
			Effect.all([
				confirm.ask("Rename files?", "Continue?"),
				confirm.ask("Rename files?", "Continue?"),
			]),
		);
		expect(answers).toEqual([true, false]);
		expect(script.asked).toEqual([
			{ message: "Continue?", title: "Rename files?" },
			{ message: "Continue?", title: "Rename files?" },
		]);
	});

	it("closes the modal when it is interrupted", async () => {
		const script = scriptedConfirm();
		const confirm = Confirm.over(script.confirm);
		const fiber = Effect.runFork(confirm.ask("Rename files?", "Continue?"));
		await until(() => script.open() === 1);
		const exit = await Effect.runPromise(
			Fiber.interrupt(fiber).pipe(Effect.andThen(Fiber.await(fiber))),
		);
		expect(Exit.hasInterrupts(exit)).toBe(true);
		expect(script.open()).toBe(0);
	});

	it("closes its modal and settles when the plugin unloads mid-dialog", async () => {
		const host = fakeHost();
		const runtime = makePluginRuntime(
			host.layer.pipe(Layer.provideMerge(ObservabilityLive(makeRecentTrace()))),
			{
				onBuildFailed: () => {
					throw new Error("the host did not build");
				},
			},
		);
		let answered: boolean | undefined;
		const asking = runtime.settings(
			Effect.flatMap(Confirm, (confirm) =>
				confirm.ask("Rename files?", "Continue?"),
			).pipe(
				Effect.tap((answer) =>
					Effect.sync(() => {
						answered = answer;
					}),
				),
			),
		);
		await until(() => host.confirm.open() === 1);
		await runtime.dispose();
		await asking;
		expect(host.confirm.open()).toBe(0);
		expect(answered).toBeUndefined();
	});
});

describe("Workspace.openLink", () => {
	it("opens the link as Obsidian's openLinkText does", async () => {
		const opened: unknown[][] = [];
		const workspace = Workspace.over({
			openLinkText: (...args) => {
				opened.push(args);
				return Promise.resolve();
			},
		});
		await Effect.runPromise(
			workspace.openLink("Worter/Reset report.md", "", true),
		);
		expect(opened).toEqual([["Worter/Reset report.md", "", true]]);
	});

	it("fails as a WorkspaceError when Obsidian cannot open it", async () => {
		const workspace = Workspace.over({
			openLinkText: () => Promise.reject(new Error("no such leaf")),
		});
		const error = await Effect.runPromise(
			Effect.flip(workspace.openLink("Missing.md", "", false)),
		);
		expect(error).toBeInstanceOf(WorkspaceError);
		expect(error.message).toBe("could not open Missing.md: no such leaf");
	});
});
