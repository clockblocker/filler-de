/** The Layers of the plugin's services; see `plugin-services.ts`. */
import {
	type DictionaryScanError,
	type DumdictVaultStore,
	makeDumdictVaultStore,
} from "@textfresser/dictionary";
import {
	createObsidianEventLayer,
	type PendingWork,
} from "@textfresser/obsidian-event-layer";
import {
	SplitPathKind,
	splitPathCodec,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { operations } from "dumgen";
import { Effect, Exit, Layer, Option, Ref } from "effect";
import { Notice, type Plugin } from "obsidian";
import {
	ClassifyCommander,
	createKnowledgeQueue,
	createReadingReopener,
	createScrollActivity,
	createUnlinkObserver,
	DUMGEN_SEGMENTER_VERSION,
	dumgenUnitResolver,
	filesSegmentationCache,
	type KnowledgeQueue,
	observeScrollModifications,
	produceKnowledge,
	UnitResolverError,
	vamScrollFiles,
	vamUnlinkScrolls,
} from "../commanders/classify";
import { DictionaryResetCommand } from "../commanders/dictionary-reset/reset-command";
import { Textfresser } from "../commanders/textfresser/textfresser";
import { getParsedUserSettings } from "../global-state/global-state";
import {
	DictionaryStore,
	makeDictionaryStoreService,
} from "../lifecycle/dictionary-store-service";
import type { LifecycleNotices } from "../lifecycle/lifecycle-notices";
import { Lifecycle, releaseGuarded } from "../lifecycle/lifecycle-supervisor";
import { Dumgen } from "../managers/dumgen";
import type { CommandExecutor } from "../managers/obsidian/command-executor";
import {
	protectedPathRefusal,
	watchProtectedPaths,
} from "../managers/obsidian/protected-paths/protected-paths-guard";
import { OverlayManager } from "../managers/overlay-manager";
import type { PluginServices } from "../runtime/plugin-live";
import type { PluginRuntime } from "../runtime/plugin-runtime";
import { dictionaryProjections } from "../stateless-helpers/dictionary-projections";
import type { TextEaterSettings } from "../types";
import { getErrorMessage } from "../utils/get-error-message";
import { IdleTracker } from "../utils/idle-tracker";
import {
	ClassifyServices,
	composePluginServices,
	DictionaryReset,
	type ObservationError,
	Overlay,
	type PluginServicesOut,
	TextfresserCommands,
	UserEvents,
} from "./plugin-services";

/** What the services' Layers take from the plugin. */
export type PluginServicesDeps = {
	readonly plugin: Plugin;
	readonly runtime: Pick<
		PluginRuntime<PluginServices, unknown>,
		"hops" | "readSync"
	>;
	readonly notices: LifecycleNotices;
	/** The plugin's settings as they are now. */
	readonly settings: () => TextEaterSettings;
};

/** The plugin's services. */
export const PluginServicesLive = (
	deps: PluginServicesDeps,
): Layer.Layer<PluginServicesOut, ObservationError, PluginServices> =>
	composePluginServices({
		classify: ClassifyLive(deps),
		observation: ObservationLive(deps),
		reset: DictionaryResetLive(deps),
		store: DictionaryStoreLive(deps),
		textfresser: TextfresserLive(deps),
		userEvents: UserEventsLive(deps),
	});

/** Counts plain-callback work on the runtime's idle tracker. */
const pendingWork = (deps: PluginServicesDeps): Effect.Effect<PendingWork> =>
	Effect.map(IdleTracker, (idle) => ({
		end: () => void deps.runtime.readSync(idle.end),
		start: () => void deps.runtime.readSync(idle.start),
	}));

const TextfresserLive = (deps: PluginServicesDeps) =>
	Layer.effect(
		TextfresserCommands,
		Effect.gen(function* () {
			const vam = yield* VaultActionManager;
			const dumgen = yield* Dumgen;
			const make = () =>
				new Textfresser(vam, deps.settings().languages, dumgen.provide);
			const current = yield* Ref.make(make());
			return {
				current: Ref.get(current),
				rebuild: Effect.suspend(() => Ref.set(current, make())),
			};
		}),
	);

/** The dictionary store over `Worter/`, built at once. */
const DictionaryStoreLive = (deps: PluginServicesDeps) =>
	Layer.effect(
		DictionaryStore,
		Effect.gen(function* () {
			const vault = yield* VaultActionManager;
			return yield* makeDictionaryStoreService<
				DumdictVaultStore,
				DictionaryScanError
			>({
				build: makeDumdictVaultStore({
					metadataFormat: () =>
						getParsedUserSettings().hideMetadata
							? "Hidden"
							: "Frontmatter",
					onDiagnostics: (diagnostics) =>
						diagnostics.quarantined.length > 0
							? Effect.logWarning(
									"[TextEaterPlugin] Dictionary notes the store cannot read:",
									diagnostics.quarantined
										.map(({ path }) => path)
										.join(", "),
								)
							: Effect.void,
					onTablesRerendered: ({ lemmas, notes, remaining }) =>
						Effect.logInfo(
							`[TextEaterPlugin] Re-rendered the inflection tables of ${lemmas} Lemma notes for the current language pack (${notes} notes written${remaining > 0 ? `, ${remaining} left for the next scan` : ""})`,
						),
					projections: dictionaryProjections,
					vault,
				}),
				close: (built) =>
					releaseGuarded(
						deps.notices,
						"close the dictionary store",
						built.close,
					),
				onBuildFailed: deps.notices.storeBuildFailed,
			});
		}),
	);

/** The store as Classify's resolver reads it. */
const resolverStore = (store: DictionaryStore["Service"]) =>
	store.get.pipe(
		Effect.mapError(
			(cause) =>
				new UnitResolverError({
					cause,
					message: `the dictionary could not be read: ${getErrorMessage(cause)}`,
				}),
		),
	);

const ClassifyLive = (deps: PluginServicesDeps) =>
	Layer.effect(
		ClassifyServices,
		Effect.gen(function* () {
			const vam = yield* VaultActionManager;
			const dumgen = yield* Dumgen;
			const lifecycle = yield* Lifecycle;
			const store = yield* DictionaryStore;
			const pending = yield* pendingWork(deps);
			const dictionary = resolverStore(store);
			const { notices, runtime } = deps;

			// Each Reading's Knowledge runs in the background, on the build
			// every background run shares.
			const runKnowledge = (
				job: Parameters<KnowledgeQueue["enqueue"]>[0],
			) =>
				dictionary.pipe(
					Effect.flatMap((built) =>
						produceKnowledge(
							{
								dumgen: operations,
								store: built,
								translationLanguages:
									deps.settings().languages.known ===
									"Russian"
										? ["en", "ru"]
										: ["en"],
							},
							job,
						),
					),
					dumgen.provideBackground,
					Effect.catchTag("DumgenUnavailable", (error) =>
						Effect.fail(
							new UnitResolverError({
								cause: error.cause,
								message: error.message,
							}),
						),
					),
				);
			const knowledgeQueue = yield* Effect.acquireRelease(
				Effect.sync(() =>
					createKnowledgeQueue({
						notify: (message) => new Notice(message),
						onEnd: pending.end,
						onStart: pending.start,
						run: runKnowledge,
						runtime: runtime.hops,
					}),
				),
				(queue) =>
					releaseGuarded(
						notices,
						"close the Knowledge queue",
						Effect.sync(() => queue.close()),
					),
			);
			const reopenReading = createReadingReopener({
				activePath: vam.mdPwd().pipe(
					Effect.map((path) =>
						path ? splitPathCodec.format(path) : null,
					),
					Effect.orElseSucceed(() => null),
				),
				open: (path) =>
					Effect.suspend(() => {
						const splitPath = splitPathCodec.parse(path);
						return splitPath.kind === SplitPathKind.MdFile
							? vam.cd(splitPath)
							: Effect.void;
					}),
				queue: knowledgeQueue,
			});

			const cache = filesSegmentationCache(deps.plugin.app.vault.adapter);
			const segmenterVersion = Effect.map(
				dumgen.scriptedJevTag,
				(scripted) =>
					scripted
						? `${DUMGEN_SEGMENTER_VERSION}+scripted-${scripted}`
						: DUMGEN_SEGMENTER_VERSION,
			);
			const scrollActivity = createScrollActivity();
			const classify = new ClassifyCommander({
				blockedBy: (scrollPath) =>
					lifecycle.classifyRefusal() ??
					protectedPathRefusal(vam, scrollPath),
				cache,
				dumgen: dumgen.provide,
				missingProviderKeys: dumgen.missingKeys,
				resolver: dumgenUnitResolver({
					activity: scrollActivity,
					dumgen: operations,
					knowledge: knowledgeQueue,
					notify: (message) => new Notice(message),
					scroll: vamScrollFiles(vam),
					store: dictionary,
				}),
				segmenterVersion,
			});
			const unlinkObserver = yield* Effect.acquireRelease(
				Effect.sync(() =>
					createUnlinkObserver({
						activity: scrollActivity,
						blockedBy: lifecycle.classifyRefusal,
						cache,
						notify: (message) => new Notice(message),
						onEnd: pending.end,
						onStart: pending.start,
						runtime: runtime.hops,
						scrolls: vamUnlinkScrolls(vam),
						segmenterVersion,
						store: dictionary,
					}),
				),
				(observer) =>
					releaseGuarded(
						notices,
						"close the unlink observer",
						Effect.sync(() => observer.close()),
					),
			);
			return {
				cache,
				classify,
				knowledgeQueue,
				reopenReading,
				scrollActivity,
				segmenterVersion,
				unlinkObserver,
			};
		}),
	);

const DictionaryResetLive = (deps: PluginServicesDeps) =>
	Layer.effect(
		DictionaryReset,
		Effect.gen(function* () {
			const vam = yield* VaultActionManager;
			const dumgen = yield* Dumgen;
			const store = yield* DictionaryStore;
			const classify = yield* ClassifyServices;
			const { runtime } = deps;
			return yield* Effect.acquireRelease(
				Effect.sync(
					() =>
						new DictionaryResetCommand({
							activity: classify.scrollActivity,
							app: deps.plugin.app,
							cache: classify.cache,
							checkProviderKeys: dumgen.checkKeys,
							dumgen: dumgen.provide,
							knowledge: classify.knowledgeQueue,
							// Read in the modal's click, to decide it.
							missingProviderKeys: () =>
								Option.getOrElse(
									Exit.getSuccess(
										runtime.readSync(dumgen.missingKeys),
									),
									() => [],
								),
							runtime: runtime.hops,
							segmenterVersion: classify.segmenterVersion,
							store: store.get,
							vam,
						}),
				),
				(reset) =>
					releaseGuarded(
						deps.notices,
						"cancel the dictionary reset",
						Effect.sync(() => void reset.cancel()),
					),
			);
		}),
	);

/**
 * VAM's listening: it turns file system events into VaultEvents, filters
 * its own, and notifies subscribers such as the Librarian. Then the
 * protected paths' warnings and the Scrolls' modifications.
 */
const ObservationLive = (deps: PluginServicesDeps) =>
	Layer.effectDiscard(
		Effect.gen(function* () {
			const vam = yield* VaultActionManager;
			const { unlinkObserver } = yield* ClassifyServices;
			yield* vam.startListening();
			// It logs each warning it shows, under its delivery's span.
			yield* Effect.acquireRelease(
				watchProtectedPaths(vam, (message) => {
					const notice = new Notice(message, 0);
					return {
						showing: () => notice.noticeEl.isConnected,
						update: (next) => notice.setMessage(next),
					};
				}),
				(subscription) =>
					releaseGuarded(
						deps.notices,
						"stop watching the protected paths",
						subscription.close,
					),
			);
			yield* Effect.asVoid(
				Effect.acquireRelease(
					observeScrollModifications(vam, unlinkObserver),
					(stop) =>
						releaseGuarded(
							deps.notices,
							"stop observing Scrolls",
							stop,
						),
				),
			);
		}),
	);

const UserEventsLive = (deps: PluginServicesDeps) =>
	Layer.effect(
		UserEvents,
		Effect.gen(function* () {
			const vam = yield* VaultActionManager;
			const pending = yield* pendingWork(deps);
			return yield* Effect.acquireRelease(
				Effect.sync(() => {
					const events = createObsidianEventLayer({
						app: deps.plugin.app,
						pendingWork: pending,
						plugin: deps.plugin,
						selectionTextSource: {
							getSelectionText: () => {
								const exit = deps.runtime.readSync(
									vam.getSelectionText(),
								);
								return Exit.isSuccess(exit) ? exit.value : null;
							},
						},
					});
					events.start();
					return events;
				}),
				(events) =>
					releaseGuarded(
						deps.notices,
						"stop the user event interceptor",
						Effect.sync(() => events.stop()),
					),
			);
		}),
	);

/** The overlay: toolbars, edge zones and the context menu, as plain DOM. */
export const OverlayLive = (
	deps: PluginServicesDeps & {
		readonly commandExecutor: CommandExecutor;
	},
): Layer.Layer<Overlay, never, PluginServices | UserEvents> =>
	Layer.effect(
		Overlay,
		Effect.gen(function* () {
			const vam = yield* VaultActionManager;
			const lifecycle = yield* Lifecycle;
			const userEvents = yield* UserEvents;
			return yield* Effect.acquireRelease(
				Effect.sync(() => {
					const overlay = new OverlayManager({
						app: deps.plugin.app,
						commandExecutor: deps.commandExecutor,
						getLibrarian: () => lifecycle.librarian(),
						plugin: deps.plugin,
						readSync: deps.runtime.readSync,
						userEventInterceptor: userEvents,
						vam,
					});
					overlay.init();
					return overlay;
				}),
				(overlay) =>
					releaseGuarded(
						deps.notices,
						"destroy the overlay",
						Effect.sync(() => overlay.destroy()),
					),
			);
		}),
	);
