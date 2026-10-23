/**
 * The Obsidian plugin host as services: what the plugin registers
 * (`PluginHost`), the notices it shows (`Notices`), and its HTTP
 * (`HttpTransport`). Each is a Layer of `PluginLive`; the vault, metadata
 * and active editor are VAM's.
 */
import { Layer } from "effect";
import type { Plugin } from "obsidian";
import { type NoticeSink, Notices, obsidianNotices } from "./notices";
import { type HostPlugin, PluginHost } from "./plugin-host";

export {
	HttpTransport,
	HttpTransportError,
} from "./http-transport";
export {
	type NoticeHandle,
	type NoticeOptions,
	type NoticeSink,
	Notices,
	obsidianNotices,
} from "./notices";
export {
	type EditorExtension,
	type HostCommand,
	type HostPlugin,
	makePluginHost,
	PluginHost,
	type WorkspaceEvents,
} from "./plugin-host";
export { createRequestUrlFetch, type RequestUrl } from "./request-url-fetch";

/** The host services `PluginLive` holds. */
export type ObsidianHost = PluginHost | Notices;

/** The host over its parts, such as a test's fakes. */
export const ObsidianHostOver = (parts: {
	readonly plugin: HostPlugin;
	readonly notices: NoticeSink;
}) =>
	Layer.mergeAll(
		PluginHost.layer(parts.plugin),
		Notices.layer(parts.notices),
	);

/** The host over Obsidian's plugin. */
export const ObsidianHostLive = (plugin: Plugin) =>
	ObsidianHostOver({ notices: obsidianNotices, plugin });
