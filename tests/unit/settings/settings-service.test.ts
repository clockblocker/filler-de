import { describe, expect, it } from "bun:test";
import {
	SplitPathKind,
	type SplitPathToFolder,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Cause, Deferred, Effect, Fiber, Layer, Stream } from "effect";
import type { DelimiterChangeService } from "../../../src/commanders/librarian/runtime/delimiter-change-service";
import { planDelimiterMigration } from "../../../src/commanders/librarian/runtime/delimiter-migration-plan";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	createLifecycleSupervisor,
	type SupervisedLibrarian,
} from "../../../src/lifecycle/lifecycle-supervisor";
import { Dumgen, ProviderKeys } from "../../../src/managers/dumgen";
import { changeDelimiter } from "../../../src/plugin/delimiter-migration";
import { TextfresserCommands } from "../../../src/plugin/plugin-services";
import { TextfresserLive } from "../../../src/plugin/textfresser-live";
import { makePluginData } from "../../../src/settings/plugin-data";
import {
	makeSettings,
	Settings,
	type SettingsReactions,
	type SettingsService,
} from "../../../src/settings/settings-service";
import { DEFAULT_SETTINGS, type SuffixDelimiterConfig } from "../../../src/types";
import { inItsScope } from "../../support/supervised-librarian";
import { memoryPluginData } from "../common-utils/test-settings";

const dash: SuffixDelimiterConfig = { padded: false, symbol: "-" };
const tilde: SuffixDelimiterConfig = { padded: false, symbol: "~" };
const root: SplitPathToFolder = {
	basename: "Library",
	kind: SplitPathKind.Folder,
	pathParts: [],
};

/** Settings over `data`, whose reactions record what they do in `events`. */
async function makeHarness(
	options: {
		readonly stored?: unknown;
		readonly failSaves?: boolean;
		readonly reactions?: (
			settings: () => SettingsService,
			events: string[],
			saved: readonly unknown[],
		) => Partial<SettingsReactions>;
	} = {},
) {
	const events: string[] = [];
	const data = memoryPluginData(options.stored ?? {});
	data.failSaves = options.failSaves ?? false;
	let service: SettingsService | null = null;
	const settings = () => service as SettingsService;
	const reactions: SettingsReactions = {
		changeDelimiter: () =>
			Effect.succeed({
				keepsNewDelimiter: true,
				librarianReinitialized: true,
			}),
		moveMetadata: (target) =>
			Effect.sync(() => {
				events.push(
					`move into ${target}, hideMetadata ${settings().now().hideMetadata}`,
				);
			}),
		reconfigure: Effect.sync(() => {
			events.push(
				`reconfigure under ${settings().now().splitPathToLibraryRoot.basename}`,
			);
		}),
		whenLaunched: Effect.void,
		...options.reactions?.(settings, events, data.saved),
	};
	service = await Effect.runPromise(
		makeSettings({ data: makePluginData(data), reactions }),
	);
	return { data, events, settings: service };
}

describe("Settings", () => {
	it("loads the defaults under what data.json holds, and saves data with retired keys again without them", async () => {
		const { data, settings } = await makeHarness({
			stored: { googleApiKey: "old", libraryRoot: "Books" },
		});

		expect(settings.rawNow()).toEqual({
			...DEFAULT_SETTINGS,
			libraryRoot: "Books",
		});
		expect(settings.now().splitPathToLibraryRoot.basename).toBe("Books");
		expect(data.saved).toEqual([{ ...DEFAULT_SETTINGS, libraryRoot: "Books" }]);
	});

	it("still loads data with retired keys that it cannot save again", async () => {
		const { data, settings } = await makeHarness({
			failSaves: true,
			stored: { googleApiKey: "old", libraryRoot: "Books" },
		});
		expect(settings.rawNow().libraryRoot).toBe("Books");
		expect(settings.invalid()).toBeUndefined();
		expect(data.saved).toEqual([]);
	});

	it("loads settings it cannot run under, marked invalid, and an update that parses fixes them", async () => {
		const { data, events, settings } = await makeHarness({
			stored: { libraryRoot: "Notes.md" },
		});
		expect(settings.invalid()?._tag).toBe("SettingsInvalid");
		expect(settings.rawNow().libraryRoot).toBe("Notes.md");
		expect(settings.now().splitPathToLibraryRoot.basename).toBe("Library");

		await Effect.runPromise(settings.update({ libraryRoot: "Books" }));

		expect(settings.invalid()).toBeUndefined();
		expect(settings.now().splitPathToLibraryRoot.basename).toBe("Books");
		expect(events).toEqual(["reconfigure under Books"]);
		expect(data.saved).toEqual([{ ...DEFAULT_SETTINGS, libraryRoot: "Books" }]);
	});

	it("keeps a change it could not store in effect, restarts the Librarian under it, then fails", async () => {
		const { events, settings } = await makeHarness({ failSaves: true });

		const error = await Effect.runPromise(
			Effect.flip(settings.update({ libraryRoot: "Books" })),
		);

		expect(error._tag).toBe("PluginDataError");
		expect(settings.now().splitPathToLibraryRoot.basename).toBe("Books");
		expect(events).toEqual(["reconfigure under Books"]);
	});

	it("keeps a value that a patch holds as undefined", async () => {
		const { settings } = await makeHarness();
		await Effect.runPromise(
			settings.update({ libraryRoot: undefined, openaiApiKey: "sk" }),
		);
		expect(settings.rawNow().libraryRoot).toBe("Library");
		expect(settings.rawNow().openaiApiKey).toBe("sk");
	});

	it("does not save data that holds no retired key at load", async () => {
		const { data } = await makeHarness({ stored: { libraryRoot: "Books" } });
		expect(data.saved).toEqual([]);
	});

	it("stores a change, merges the languages into those in effect, and streams it", async () => {
		const { data, settings } = await makeHarness();
		const seen = Effect.runFork(
			settings.changes.pipe(
				Stream.map(({ languages }) => languages.target),
				Stream.take(2),
				Stream.runCollect,
			),
		);

		await Effect.runPromise(settings.update({ languages: { target: "English" } }));

		expect(settings.now().languages).toEqual({
			known: DEFAULT_SETTINGS.languages.known,
			target: "English",
		});
		expect(data.saved).toEqual([
			{
				...DEFAULT_SETTINGS,
				languages: { ...DEFAULT_SETTINGS.languages, target: "English" },
			},
		]);
		expect(Array.from(await Effect.runPromise(Fiber.join(seen)))).toEqual([
			"German",
			"English",
		]);
	});

	it("changes nothing for settings it cannot parse", async () => {
		const { data, events, settings } = await makeHarness();

		const error = await Effect.runPromise(
			Effect.flip(settings.update({ libraryRoot: "Notes.md" })),
		);

		expect(error._tag).toBe("SettingsInvalid");
		expect(settings.rawNow().libraryRoot).toBe("Library");
		expect(events).toEqual([]);
		expect(data.saved).toEqual([]);
	});

	it("stores a new Library root, then restarts the Librarian under it, and ends once it restarted", async () => {
		const restarted = Deferred.makeUnsafe<void>();
		const { data, events, settings } = await makeHarness({
			reactions: (settings, events, saved) => ({
				reconfigure: Effect.gen(function* () {
					events.push(
						`reconfigure under ${settings().now().splitPathToLibraryRoot.basename}, ${saved.length} saved`,
					);
					yield* Deferred.await(restarted);
				}),
			}),
		});

		let ended = false;
		const update = Effect.runPromise(
			settings.update({ libraryRoot: "Books" }),
		).then(() => {
			ended = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(events).toEqual(["reconfigure under Books, 1 saved"]);
		expect(ended).toBe(false);

		Deferred.doneUnsafe(restarted, Effect.void);
		await update;
		expect(data.saved).toEqual([{ ...DEFAULT_SETTINGS, libraryRoot: "Books" }]);
	});

	it("puts a Hide metadata toggle into effect before it moves the notes, then restarts the Librarian", async () => {
		const { data, events, settings } = await makeHarness();

		await Effect.runPromise(settings.update({ hideMetadata: false }));

		expect(events).toEqual([
			"move into Frontmatter, hideMetadata false",
			"reconfigure under Library",
		]);
		expect(data.saved).toEqual([{ ...DEFAULT_SETTINGS, hideMetadata: false }]);
	});

	it("runs two quick updates one after the other", async () => {
		const held = Deferred.makeUnsafe<void>();
		const { data, events, settings } = await makeHarness({
			reactions: (settings, events) => ({
				moveMetadata: (target) =>
					Effect.sync(() => events.push(`move into ${target}`)).pipe(
						Effect.andThen(Deferred.await(held)),
					),
			}),
		});

		const first = Effect.runPromise(settings.update({ hideMetadata: false }));
		const second = Effect.runPromise(settings.update({ libraryRoot: "Books" }));
		await new Promise((resolve) => setTimeout(resolve, 10));
		// The first still moves the notes: the second has not begun.
		expect(events).toEqual(["move into Frontmatter"]);
		expect(settings.rawNow().libraryRoot).toBe("Library");
		expect(data.saved).toEqual([]);

		Deferred.doneUnsafe(held, Effect.void);
		await Promise.all([first, second]);
		expect(data.saved).toEqual([
			{ ...DEFAULT_SETTINGS, hideMetadata: false },
			{ ...DEFAULT_SETTINGS, hideMetadata: false, libraryRoot: "Books" },
		]);
		expect(events.filter((event) => event.startsWith("reconfigure"))).toHaveLength(2);
	});

	it("applies a change only once the launch ended", async () => {
		const launched = Deferred.makeUnsafe<void>();
		const { events, settings } = await makeHarness({
			reactions: () => ({ whenLaunched: Deferred.await(launched) }),
		});

		const update = Effect.runPromise(settings.update({ libraryRoot: "Books" }));
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(settings.rawNow().libraryRoot).toBe("Library");
		expect(events).toEqual([]);

		Deferred.doneUnsafe(launched, Effect.void);
		await update;
		expect(events).toEqual(["reconfigure under Books"]);
	});

	it("applies the E2E reset without migrations, and restarts the Librarian even when nothing it reads changed", async () => {
		const { data, events, settings } = await makeHarness({
			reactions: (_, events) => ({
				changeDelimiter: () =>
					Effect.sync(() => {
						events.push("change delimiter");
						return { keepsNewDelimiter: true, librarianReinitialized: true };
					}),
			}),
		});

		await Effect.runPromise(
			settings.update(
				{ hideMetadata: false, suffixDelimiter: tilde },
				{ migrate: false, restartLibrarian: true },
			),
		);
		await Effect.runPromise(
			settings.update({}, { migrate: false, restartLibrarian: true }),
		);

		expect(events).toEqual(["reconfigure under Library", "reconfigure under Library"]);
		expect(settings.now().suffixDelimiter).toBe("~");
		expect(settings.now().hideMetadata).toBe(false);
		expect(data.saved).toHaveLength(1);
	});
});

describe("Settings and the delimiter migration", () => {
	/**
	 * Settings whose delimiter change runs the real migration: a supervisor
	 * whose Librarians start under the settings in effect, and files whose
	 * renames `execute` decides.
	 */
	async function withMigration(execute: "Completed" | "RolledBack") {
		const events: string[] = [];
		const notices = createLifecycleNotices(() => {}, { writeStop: () => {} });
		const supervisor = createLifecycleSupervisor<SupervisedLibrarian>({ notices });
		const plan = planDelimiterMigration({
			candidates: [
				{
					basename: "alpha-beta",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
			],
			libraryRoot: root,
			newConfig: tilde,
			oldConfig: dash,
		});
		const service = {
			execute: () =>
				Effect.sync(() =>
					execute === "Completed"
						? {
								kind: "Completed" as const,
								renamedCount: plan.actions.length,
								succeeded: plan.actions,
							}
						: {
								failure: {
									cause: new Error("EBUSY"),
									dispatch: Cause.fail(new Error("EBUSY")),
									operation: "renameFile",
								},
								kind: "RolledBack" as const,
								rolledBack: [],
							},
				),
			plan: () => Effect.succeed(plan),
		} as unknown as DelimiterChangeService;

		const harness = await makeHarness({
			reactions: (settings) => ({
				changeDelimiter: ({ apply, from, libraryRoot, to }) =>
					changeDelimiter(
						{
							applyDelimiter: apply,
							confirm: () => Promise.resolve(true),
							libraryRoot,
							notices,
							service,
							supervisor,
						},
						from,
						to,
					),
				reconfigure: Effect.sync(() => events.push("reconfigure")).pipe(
					Effect.andThen(supervisor.reconfigure),
				),
				whenLaunched: supervisor.whenLaunched,
			}),
		});
		let started = 0;
		await Effect.runPromise(
			supervisor.launch(
				Effect.succeed({
					attachLibrarian: () => () => undefined,
					loadStore: Effect.void,
					makeLibrarian: () => {
						const id = started++;
						return inItsScope({
							init: () =>
								Effect.sync(() => {
									events.push(
										`init ${id} under ${harness.settings.now().suffixDelimiter}`,
									);
								}),
							unsubscribe: () => Effect.void,
						});
					},
					onLaunched: () => Effect.void,
					resetRunning: () => false,
					sweep: Effect.void,
				}),
			),
		);
		return { ...harness, events };
	}

	it("keeps the old delimiter when the files refuse the new one, and stores nothing", async () => {
		const { data, events, settings } = await withMigration("RolledBack");

		await Effect.runPromise(settings.update({ suffixDelimiter: { symbol: "~" } }));

		expect(settings.now().suffixDelimiterConfig).toEqual(dash);
		expect(settings.rawNow().suffixDelimiter).toEqual(dash);
		expect(events).toEqual(["init 0 under -", "init 1 under -"]);
		expect(data.saved).toEqual([]);
	});

	it("takes the new delimiter when every file carries it: the Librarian restarts under it once, and it is stored", async () => {
		const { data, events, settings } = await withMigration("Completed");

		await Effect.runPromise(settings.update({ suffixDelimiter: { symbol: "~" } }));

		expect(settings.now().suffixDelimiter).toBe("~");
		expect(events).toEqual(["init 0 under -", "init 1 under ~"]);
		expect(data.saved).toEqual([{ ...DEFAULT_SETTINGS, suffixDelimiter: tilde }]);
	});
});

describe("what follows the settings", () => {
	const settingsLayer = (stored: unknown = {}) =>
		Layer.effect(
			Settings,
			makeSettings({
				data: makePluginData(memoryPluginData(stored)),
				reactions: {
					changeDelimiter: () =>
						Effect.succeed({
							keepsNewDelimiter: true,
							librarianReinitialized: true,
						}),
					moveMetadata: () => Effect.void,
					reconfigure: Effect.void,
					whenLaunched: Effect.void,
				},
			}),
		);

	it("rebuilds Textfresser once for a languages change, and not for other changes", async () => {
		const program = Effect.gen(function* () {
			const settings = yield* Settings;
			const { current } = yield* TextfresserCommands;
			const before = yield* current;
			expect(yield* current).toBe(before);

			yield* settings.update({ languages: { known: "English" } });
			const after = yield* current;
			expect(after).not.toBe(before);
			expect(yield* current).toBe(after);

			yield* settings.update({ openaiApiKey: "sk-new" });
			expect(yield* current).toBe(after);
		});
		await Effect.runPromise(
			program.pipe(
				Effect.provide(
					TextfresserLive.pipe(
						Layer.provideMerge(
							Layer.mergeAll(
								settingsLayer(),
								Layer.succeed(VaultActionManager, {} as never),
								Layer.succeed(Dumgen, {
									provide: (effect: unknown) => effect,
								} as never),
							),
						),
					),
				),
			),
		);
	});

	it("gives dumgen the provider keys in effect at each use", async () => {
		const program = Effect.gen(function* () {
			const settings = yield* Settings;
			const keys = yield* ProviderKeys;
			expect(yield* keys.current).toEqual({
				openaiApiKey: "sk-old",
				typesafeApiKey: "",
			});
			yield* settings.update({ openaiApiKey: "sk-new", typesafeApiKey: "ts" });
			expect(yield* keys.current).toEqual({
				openaiApiKey: "sk-new",
				typesafeApiKey: "ts",
			});
		});
		await Effect.runPromise(
			program.pipe(
				Effect.provide(
					ProviderKeys.fromSettings.pipe(
						Layer.provideMerge(settingsLayer({ openaiApiKey: "sk-old" })),
					),
				),
			),
		);
	});
});
