/** The Layers of the plugin's services; see `plugin-services.ts`. */
import {
	type DictionaryScanError,
	type DumdictVaultStore,
	makeDumdictVaultStore,
} from "@textfresser/dictionary";
import {
	splitPathCodec,
	VaultActionManager,
	VaultPath,
} from "@textfresser/vault-action-manager";
import { operations } from "dumgen";
import { Effect, Layer, Predicate, Schedule, Stream } from "effect";
import { type App, MarkdownView, type Plugin } from "obsidian";
import {
	ClassifyCommander,
	createReadingReopener,
	createScrollActivity,
	DUMGEN_SEGMENTER_VERSION,
	dumgenUnitResolver,
	filesJudgementCache,
	filesSegmentationCache,
	HIDDEN_FOLDER,
	makeKnowledgeQueue,
	makeOccurrenceAttester,
	makeReadingLifetime,
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
import type { TaggedFailure } from "../lifecycle/lifecycle-errors";
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
import { markMorphemes } from "../managers/overlay-manager/morpheme-hover/morpheme-hover";
import { listenForOverlay } from "../managers/overlay-manager/overlay-listeners";
import { listenForUnitHover } from "../managers/overlay-manager/unit-hover/unit-hover";
import type { PluginServices } from "../runtime/plugin-live";
import type { PluginRuntime } from "../runtime/plugin-runtime";
import type { ParsedUserSettings } from "../settings/parsed-settings";
import { Settings } from "../settings/settings-service";
import { dictionaryProjections } from "../stateless-helpers/dictionary-projections";
import { metadataFormatOf } from "../stateless-helpers/note-metadata";
import { getErrorMessage } from "../utils/get-error-message";
import { obsidianNoteLinks } from "./obsidian-note-links";
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
		PluginRuntime<PluginServices, TaggedFailure>,
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
			notices: deps.notices,
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

/**
 * Re-renders the active note at `path` in Reading view, keeping its scroll
 * position: the editor of Live Preview and source mode reloads a note
 * changed on disk by itself, and Reading view may keep its old sections.
 */
function rerenderActivePreview(app: Pick<App, "workspace">, path: string) {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (view?.file?.path !== path || view.getMode() !== "preview") return;
	const preview: unknown = view.previewMode;
	if (
		Predicate.hasProperty(preview, "rerender") &&
		Predicate.isFunction(preview.rerender)
	)
		preview.rerender(true);
}

const ClassifyLive = (deps: PluginServicesDeps) =>
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
									cause: error,
									message: error.message,
								}),
							),
						),
					),
			});
			const activePath = vam.mdPwd().pipe(
				Effect.map((path) =>
					path ? splitPathCodec.format(path) : null,
				),
				Effect.orElseSucceed(() => null),
			);
			const reopenReading = createReadingReopener({
				activePath,
				// Checked twice a second while a clicked note's Knowledge runs.
				leaves: (path) =>
					activePath.pipe(
						Effect.repeat({
							schedule: Schedule.spaced("500 millis"),
							until: (active) =>
								active === null ||
								!VaultPath.caseSensitive.same(active, path),
						}),
						Effect.asVoid,
					),
				queue: knowledgeQueue,
				refresh: (path) =>
					Effect.sync(() =>
						rerenderActivePreview(deps.plugin.app, path),
					),
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
			// Each occurrence's judgement, for the click that attests it (#281).
			const judgements = filesJudgementCache(
				vam.hiddenFolder(HIDDEN_FOLDER),
			);
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
					judgements,
					knowledge: knowledgeQueue,
					notify,
					scroll: vamScrollFiles(vam),
					store: dictionary,
				}),
				segmenterVersion,
			});
			// A click on a unit's link attests its occurrence; its runs are
			// interrupted as this Layer's scope closes.
			const attester = yield* makeOccurrenceAttester({
				activity: scrollActivity,
				blockedBy: lifecycle.classifyRefusal,
				cache,
				classify: (input) => classify.classify(input),
				notify,
				scrolls: vamUnlinkScrolls(vam),
				segmenterVersion,
				store: dictionary,
			});
			// A Reading lives while it has an Attestation or a link names it
			// (#281). Its checks are interrupted as this Layer's scope
			// closes, after the unlink observer's.
			const readingLifetime = yield* makeReadingLifetime({
				activity: scrollActivity,
				blockedBy: lifecycle.classifyRefusal,
				knowledge: knowledgeQueue,
				links: obsidianNoteLinks(deps.plugin.app),
				store: dictionary,
			});
			// Its checks are interrupted as this Layer's scope closes,
			// before the Knowledge queue's runs.
			const unlinkObserver = yield* makeUnlinkObserver({
				activity: scrollActivity,
				blockedBy: lifecycle.classifyRefusal,
				cache,
				notify,
				readings: readingLifetime,
				scrolls: vamUnlinkScrolls(vam),
				segmenterVersion,
				store: dictionary,
			});
			return {
				attester,
				cache,
				classify,
				knowledgeQueue,
				readingLifetime,
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
 * protected paths' warnings, the Scrolls' modifications, and the changes
 * to which notes link which, as Obsidian resolves them.
 */
const ObservationLive = (deps: PluginServicesDeps) =>
	Layer.effectDiscard(
		Effect.gen(function* () {
			const vam = yield* VaultActionManager;
			const { readingLifetime, unlinkObserver } = yield* ClassifyServices;
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
					observeScrollModifications(vam, {
						modified: (paths) =>
							Effect.andThen(
								unlinkObserver.modified(paths),
								readingLifetime.modified(paths),
							),
					}),
					(stop) =>
						releaseGuarded(
							deps.notices,
							"stop observing Scrolls",
							stop,
						),
				),
			);
			// Interrupted, and Obsidian's listeners released, as this
			// Layer's scope closes.
			yield* obsidianNoteLinks(deps.plugin.app).changes.pipe(
				Stream.runForEach(readingLifetime.changed),
				Effect.forkScoped,
			);
		}),
	);

/**
 * The overlay: toolbars, edge zones and the context menu, as plain DOM, the
 * highlight of a hovered unit's parts, and the reveal of a hovered morpheme.
 */
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
			yield* listenForUnitHover(document);
			yield* markMorphemes;
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
