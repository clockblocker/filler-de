/** The Layers of the plugin's services; see `plugin-services.ts`. */
import {
	type DictionaryScanError,
	type DumdictVaultStore,
	makeDumdictVaultStore,
} from "@textfresser/dictionary";
import {
	SplitPathKind,
	splitPathCodec,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { operations } from "dumgen";
import { Effect, Layer, Stream } from "effect";
import type { Plugin } from "obsidian";
import {
	ClassifyCommander,
	createReadingReopener,
	createScrollActivity,
	DUMGEN_SEGMENTER_VERSION,
	dumgenUnitResolver,
	filesSegmentationCache,
	HIDDEN_FOLDER,
	makeKnowledgeQueue,
	makeUnlinkObserver,
	observeScrollModifications,
	produceKnowledge,
	UnitResolverError,
	vamScrollFiles,
	vamUnlinkScrolls,
} from "../commanders/classify";
import { DictionaryResetCommand } from "../commanders/dictionary-reset/reset-command";
import {
	DictionaryStore,
	makeDictionaryStoreService,
} from "../lifecycle/dictionary-store-service";
import type { LifecycleNotices } from "../lifecycle/lifecycle-notices";
import { Lifecycle, releaseGuarded } from "../lifecycle/lifecycle-supervisor";
import { Dumgen } from "../managers/dumgen";
import type { CommandExecutor } from "../managers/obsidian/command-executor";
import { Notices, Workspace } from "../managers/obsidian/host";
import {
	protectedPathRefusal,
	watchProtectedPaths,
} from "../managers/obsidian/protected-paths/protected-paths-guard";
import { OverlayManager } from "../managers/overlay-manager";
import { listenForOverlay } from "../managers/overlay-manager/overlay-listeners";
import type { PluginServices } from "../runtime/plugin-live";
import type { PluginRuntime } from "../runtime/plugin-runtime";
import type { ParsedUserSettings } from "../settings/parsed-settings";
import { Settings } from "../settings/settings-service";
import { dictionaryProjections } from "../stateless-helpers/dictionary-projections";
import { metadataFormatOf } from "../stateless-helpers/note-metadata";
import { getErrorMessage } from "../utils/get-error-message";
import {
	ClassifyServices,
	composePluginServices,
	DictionaryReset,
	type ObservationError,
	Overlay,
	type PluginServicesOut,
	UserEvents,
} from "./plugin-services";
import { TextfresserLive } from "./textfresser-live";

/** What the services' Layers take from the plugin. */
export type PluginServicesDeps = {
	readonly plugin: Plugin;
	readonly runtime: Pick<
		PluginRuntime<PluginServices, unknown>,
		"readSync" | "userEvent"
	>;
	readonly notices: LifecycleNotices;
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
		textfresser: TextfresserLive,
		userEvents: UserEvents.layer({
			app: deps.plugin.app,
			document,
			runtime: deps.runtime,
		}),
	});

/** The dictionary store over `Worter/`, built at once. */
const DictionaryStoreLive = (deps: PluginServicesDeps) =>
	Layer.effect(
		DictionaryStore,
		Effect.gen(function* () {
			const vault = yield* VaultActionManager;
			const settings = yield* Settings;
			return yield* makeDictionaryStoreService<
				DumdictVaultStore,
				DictionaryScanError
			>({
				build: makeDumdictVaultStore({
					metadataFormat: () => metadataFormatOf(settings.now()),
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

const ClassifyLive = (_deps: PluginServicesDeps) =>
	Layer.effect(
		ClassifyServices,
		Effect.gen(function* () {
			const vam = yield* VaultActionManager;
			const dumgen = yield* Dumgen;
			const lifecycle = yield* Lifecycle;
			const settings = yield* Settings;
			const store = yield* DictionaryStore;
			const dictionary = resolverStore(store);
			const notify = (yield* Notices).sink.show;

			// Each Reading's Knowledge runs in the background, on the build
			// every background run shares. The queue's runs are interrupted
			// as this Layer's scope closes.
			const knowledgeQueue = yield* makeKnowledgeQueue({
				notify,
				run: (job) =>
					Effect.all([dictionary, settings.get]).pipe(
						Effect.flatMap(([built, { languages }]) =>
							produceKnowledge(
								{
									dumgen: operations,
									store: built,
									translationLanguages:
										languages.known === "Russian"
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
					),
			});
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

			const cache = filesSegmentationCache(
				vam.hiddenFolder(HIDDEN_FOLDER),
			);
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
					notify,
					scroll: vamScrollFiles(vam),
					store: dictionary,
				}),
				segmenterVersion,
			});
			// Its checks are interrupted as this Layer's scope closes,
			// before the Knowledge queue's runs.
			const unlinkObserver = yield* makeUnlinkObserver({
				activity: scrollActivity,
				blockedBy: lifecycle.classifyRefusal,
				cache,
				notify,
				scrolls: vamUnlinkScrolls(vam),
				segmenterVersion,
				store: dictionary,
			});
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
			const notices = yield* Notices;
			const workspace = yield* Workspace;
			return yield* Effect.acquireRelease(
				DictionaryResetCommand.make({
					activity: classify.scrollActivity,
					app: deps.plugin.app,
					cache: classify.cache,
					checkProviderKeys: dumgen.checkKeys,
					dumgen: dumgen.provide,
					knowledge: classify.knowledgeQueue,
					missingProviderKeys: dumgen.missingKeys,
					notices,
					// A modal's button, as a user's gesture.
					run: (kind, effect) =>
						void deps.runtime.userEvent(kind, effect),
					segmenterVersion: classify.segmenterVersion,
					store: store.get,
					vam,
					workspace,
				}),
				(reset) =>
					releaseGuarded(
						deps.notices,
						"cancel the dictionary reset",
						Effect.asVoid(reset.cancel),
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
			const notices = yield* Notices;
			yield* vam.startListening();
			// It logs each warning it shows, under its delivery's span.
			yield* Effect.acquireRelease(
				watchProtectedPaths(vam, (message) => {
					const notice = notices.sink.open(message, { sticky: true });
					return {
						showing: notice.showing,
						update: notice.setMessage,
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
			const settings = yield* Settings;
			const userEvents = yield* UserEvents;
			const overlay = yield* Effect.acquireRelease(
				Effect.sync(() => {
					const overlay = new OverlayManager({
						app: deps.plugin.app,
						commandExecutor: deps.commandExecutor,
						getLibrarian: () => lifecycle.librarian(),
						readSync: deps.runtime.readSync,
						settings: settings.now,
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
			// Released before the overlay is destroyed: newest first.
			yield* listenForOverlay(overlay);
			// The toolbars follow the settings' button placements.
			yield* settings.changes.pipe(
				Stream.map(placements),
				Stream.changesWith((a, b) => a === b),
				Stream.drop(1),
				Stream.runForEach(() =>
					Effect.sync(() => overlay.refreshToolbars()),
				),
				Effect.forkScoped,
			);
			return overlay;
		}),
	);

/** The toolbars' button placements, as one comparable value. */
const placements = (settings: ParsedUserSettings): string =>
	[
		settings.translatePlacement,
		settings.splitInBlocksPlacement,
		settings.explainGrammarPlacement,
		settings.generatePlacement,
	].join("|");
