/**
 * The plugin's settings, as a service of the plugin runtime: what is in
 * effect, its changes, and `update`, which applies a change the way the
 * settings tab asks for it and stores it in `data.json`.
 */
import type { SplitPathToFolder } from "@textfresser/vault-action-manager";
import {
	Context,
	Data,
	Effect,
	Semaphore,
	Stream,
	SubscriptionRef,
} from "effect";
import {
	type MetadataFormat,
	metadataFormatOf,
} from "../stateless-helpers/note-metadata";
import {
	DEFAULT_SETTINGS,
	type SuffixDelimiterConfig,
	type TextEaterSettings,
} from "../types";
import { getErrorMessage } from "../utils/get-error-message";
import { type ParsedUserSettings, parseSettings } from "./parsed-settings";
import type { PluginData, PluginDataError } from "./plugin-data";
import {
	diffSettings,
	patchSettings,
	type SettingsPatch,
} from "./settings-changes";

/** Settings the plugin cannot run under, such as a Library root that is a file. */
export class SettingsInvalid extends Data.TaggedError("SettingsInvalid")<{
	readonly cause: unknown;
}> {
	override get message(): string {
		return `Textfresser's settings are invalid: ${getErrorMessage(this.cause)}`;
	}
}

/** What a settings change sets off beyond the settings themselves. */
export type SettingsReactions = {
	/** Ends once the plugin's launch ended; a change applies after it. */
	readonly whenLaunched: Effect.Effect<void>;
	/**
	 * Renames the Library's files from one delimiter to the other, with the
	 * Librarian paused, and tells the user how it went. `apply` puts a
	 * delimiter into the settings in effect just before the Librarian
	 * restarts: the new one when every file carries it, the old one
	 * otherwise.
	 */
	readonly changeDelimiter: (change: {
		readonly from: SuffixDelimiterConfig;
		readonly to: SuffixDelimiterConfig;
		readonly libraryRoot: string;
		readonly apply: (config: SuffixDelimiterConfig) => Effect.Effect<void>;
	}) => Effect.Effect<{
		/** Every file carries the new delimiter, so the setting keeps it. */
		readonly keepsNewDelimiter: boolean;
		/** The Librarian restarted under the settings in effect. */
		readonly librarianReinitialized: boolean;
	}>;
	/** Moves the Library's and the dictionary's note metadata into `target`. */
	readonly moveMetadata: (
		target: MetadataFormat,
		libraryRoot: SplitPathToFolder,
	) => Effect.Effect<void>;
	/** Restarts the Librarian under the settings in effect. */
	readonly reconfigure: Effect.Effect<unknown>;
};

export type SettingsUpdateOptions = {
	/**
	 * Whether a changed delimiter renames the Library's files and a changed
	 * "Hide metadata" moves the notes' metadata; true by default. The E2E
	 * driver's reset turns it off: its scenarios lay out their own notes.
	 */
	readonly migrate?: boolean;
	/** Restart the Librarian even when no setting it reads changed. */
	readonly restartLibrarian?: boolean;
};

export type SettingsService = {
	/** The settings in effect. */
	readonly get: Effect.Effect<ParsedUserSettings>;
	/** The settings in effect, as `data.json` stores them. */
	readonly raw: Effect.Effect<TextEaterSettings>;
	/** The settings in effect, then each change to them. */
	readonly changes: Stream.Stream<ParsedUserSettings>;
	/**
	 * `get` at once, for plain code that decides synchronously: a DOM
	 * callback, or a Codex transform as the Librarian builds it.
	 */
	readonly now: () => ParsedUserSettings;
	/** `raw` at once, for the settings tab and the E2E driver. */
	readonly rawNow: () => TextEaterSettings;
	/**
	 * Why the stored settings cannot be run under, such as a Library root
	 * that is a file; undefined when they can. The launch then fails, the
	 * tab still shows them, and an update that parses fixes them. Until
	 * then `get` holds them with the default Library root.
	 */
	readonly invalid: () => SettingsInvalid | undefined;
	/**
	 * Applies `patch` once the launch ended, one update after another:
	 * diffs it against the settings in effect, renames the Library's files
	 * for a new delimiter (which may keep the old one), moves the notes'
	 * metadata for a "Hide metadata" toggle, puts the settings into effect
	 * and stores them. Then it restarts the Librarian when a setting it
	 * reads changed, and ends once that restart did. Settings that cannot
	 * be parsed change nothing.
	 */
	readonly update: (
		patch: SettingsPatch,
		options?: SettingsUpdateOptions,
	) => Effect.Effect<void, SettingsInvalid | PluginDataError>;
};

export class Settings extends Context.Service<Settings, SettingsService>()(
	"textfresser/settings/Settings",
) {}

type SettingsState = {
	readonly raw: TextEaterSettings;
	readonly parsed: ParsedUserSettings;
	readonly invalid?: SettingsInvalid;
};

const parse = (raw: TextEaterSettings) =>
	Effect.try({
		catch: (cause) => new SettingsInvalid({ cause }),
		try: (): SettingsState => ({ parsed: parseSettings(raw), raw }),
	});

/** The settings `data` loads, applied with `reactions`. */
export const makeSettings = Effect.fnUntraced(function* (deps: {
	readonly data: PluginData["Service"];
	readonly reactions: SettingsReactions;
}) {
	const { data, reactions } = deps;
	const loaded = yield* data.load;
	const state = yield* SubscriptionRef.make(
		yield* parse(loaded).pipe(
			Effect.catch((invalid) =>
				// Only the Library root can fail to parse.
				parse({
					...loaded,
					libraryRoot: DEFAULT_SETTINGS.libraryRoot,
				}).pipe(
					Effect.map(({ parsed }) => ({
						invalid,
						parsed,
						raw: loaded,
					})),
					Effect.orDie,
				),
			),
		),
	);
	const lock = yield* Semaphore.make(1);

	const set = (raw: TextEaterSettings) =>
		parse(raw).pipe(
			Effect.flatMap((next) => SubscriptionRef.set(state, next)),
		);

	const apply = Effect.fnUntraced(function* (
		patch: SettingsPatch,
		options: SettingsUpdateOptions,
	) {
		const migrate = options.migrate ?? true;
		const before = (yield* SubscriptionRef.get(state)).raw;
		const proposed = patchSettings(before, patch);
		const { parsed } = yield* parse(proposed);
		let next = proposed;
		let changes = diffSettings(before, next);
		let librarianRestarted = false;

		if (changes.delimiter && migrate) {
			const report = yield* reactions.changeDelimiter({
				apply: (config) =>
					Effect.orDie(
						set({ ...proposed, suffixDelimiter: { ...config } }),
					),
				from: before.suffixDelimiter,
				libraryRoot: proposed.libraryRoot,
				to: proposed.suffixDelimiter,
			});
			// The setting follows the files: it keeps the new delimiter only
			// when every file carries it.
			if (!report.keepsNewDelimiter) {
				next = {
					...proposed,
					suffixDelimiter: { ...before.suffixDelimiter },
				};
				changes = diffSettings(before, next);
			}
			librarianRestarted = report.librarianReinitialized;
		}

		if (changes.hideMetadata && migrate) {
			// What the running Librarian writes meanwhile lands in the
			// format the notes move into.
			yield* set(next);
			yield* reactions.moveMetadata(
				metadataFormatOf(next),
				parsed.splitPathToLibraryRoot,
			);
		}

		yield* set(next);
		// A failed save is raised after the Librarian's restart, below.
		const saveFailed =
			JSON.stringify(next) === JSON.stringify(before)
				? undefined
				: yield* data.save(next).pipe(
						Effect.as(undefined),
						Effect.catch((error) => Effect.succeed(error)),
					);
		return {
			/** Whether the Librarian must restart under the settings now in effect. */
			restart:
				(changes.librarian && !librarianRestarted) ||
				options.restartLibrarian === true,
			saveFailed,
		};
	});

	return Settings.of({
		changes: SubscriptionRef.changes(state).pipe(
			Stream.map(({ parsed }) => parsed),
		),
		get: Effect.map(SubscriptionRef.get(state), ({ parsed }) => parsed),
		invalid: () => SubscriptionRef.getUnsafe(state).invalid,
		now: () => SubscriptionRef.getUnsafe(state).parsed,
		raw: Effect.map(SubscriptionRef.get(state), ({ raw }) => raw),
		rawNow: () => SubscriptionRef.getUnsafe(state).raw,
		update: Effect.fn("Settings.update")(function* (
			patch: SettingsPatch,
			options: SettingsUpdateOptions = {},
		) {
			const { restart, saveFailed } = yield* lock.withPermit(
				reactions.whenLaunched.pipe(
					Effect.andThen(apply(patch, options)),
				),
			);
			// Outside the lock: restarts that wait together in the
			// lifecycle's mailbox, such as one per keystroke in the Library
			// root's field, run as one. The settings are in effect even when
			// storing them failed, so the Librarian restarts under them first.
			if (restart) yield* reactions.reconfigure;
			if (saveFailed) return yield* saveFailed;
		}),
	});
});
