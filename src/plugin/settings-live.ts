/** The `Settings` service of the plugin runtime, wired to the lifecycle and VAM. */
import { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect, Layer } from "effect";
import { DelimiterChangeService } from "../commanders/librarian/runtime/delimiter-change-service";
import type { LifecycleNotices } from "../lifecycle/lifecycle-notices";
import { Lifecycle } from "../lifecycle/lifecycle-supervisor";
import { Confirm, Notices } from "../managers/obsidian/host";
import { PluginData } from "../settings/plugin-data";
import { makeSettings, Settings } from "../settings/settings-service";
import { changeDelimiter } from "./delimiter-migration";
import { migrateNoteMetadata } from "./note-metadata-migration";

export const SettingsLive = (host: {
	/** What the delimiter migration reports. */
	readonly notices: LifecycleNotices;
}) =>
	Layer.effect(
		Settings,
		Effect.gen(function* () {
			// Asks before the delimiter migration renames files.
			const confirm = yield* Confirm;
			const notices = yield* Notices;
			const data = yield* PluginData;
			const lifecycle = yield* Lifecycle;
			const vam = yield* VaultActionManager;
			const delimiterChangeService = new DelimiterChangeService(vam);
			return yield* makeSettings({
				data,
				reactions: {
					changeDelimiter: ({ apply, from, libraryRoot, to }) =>
						changeDelimiter(
							{
								applyDelimiter: apply,
								confirm: confirm.ask,
								libraryRoot,
								notices: host.notices,
								service: delimiterChangeService,
								supervisor: lifecycle,
							},
							from,
							to,
						),
					moveMetadata: (target, libraryRoot) =>
						migrateNoteMetadata(vam, notices, target, libraryRoot),
					reconfigure: lifecycle.reconfigure,
					whenLaunched: lifecycle.whenLaunched,
				},
			});
		}),
	);
