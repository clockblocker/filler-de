/** The `Settings` service of the plugin runtime, wired to the lifecycle and VAM. */
import { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect, Layer } from "effect";
import { DelimiterChangeService } from "../commanders/librarian/runtime/delimiter-change-service";
import type { LifecycleNotices } from "../lifecycle/lifecycle-notices";
import { Lifecycle } from "../lifecycle/lifecycle-supervisor";
import { PluginData } from "../settings/plugin-data";
import { makeSettings, Settings } from "../settings/settings-service";
import { changeDelimiter } from "./delimiter-migration";
import { migrateNoteMetadata } from "./note-metadata-migration";

export const SettingsLive = (host: {
	/** Asks the user, such as before the delimiter migration renames files. */
	readonly confirm: (title: string, message: string) => Promise<boolean>;
	readonly notices: LifecycleNotices;
}) =>
	Layer.effect(
		Settings,
		Effect.gen(function* () {
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
								confirm: host.confirm,
								libraryRoot,
								notices: host.notices,
								service: delimiterChangeService,
								supervisor: lifecycle,
							},
							from,
							to,
						),
					moveMetadata: (target, libraryRoot) =>
						migrateNoteMetadata(vam, target, libraryRoot),
					reconfigure: lifecycle.reconfigure,
					whenLaunched: lifecycle.whenLaunched,
				},
			});
		}),
	);
