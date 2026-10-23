/**
 * The Obsidian plugin host as services: what the plugin registers
 * (`PluginHost`), the notices it shows (`Notices`), the confirmations it
 * asks for (`Confirm`), the links it opens (`Workspace`), and its HTTP
 * (`HttpTransport`). Each is a Layer of `PluginLive`; the vault, metadata
 * and active editor are VAM's.
 */
import { Layer } from "effect";
import { Confirm, type OpenConfirm } from "./confirm";
import { type NoticeSink, Notices } from "./notices";
import { type HostPlugin, PluginHost } from "./plugin-host";
import { Workspace, type WorkspaceNavigation } from "./workspace";

export { Confirm, type OpenConfirm } from "./confirm";
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
export {
	Workspace,
	WorkspaceError,
	type WorkspaceNavigation,
} from "./workspace";

/** The host services `PluginLive` holds. */
export type ObsidianHost = PluginHost | Notices | Confirm | Workspace;

/** The host over its parts, such as a test's fakes. */
export const ObsidianHostOver = (parts: {
	readonly plugin: HostPlugin;
	readonly notices: NoticeSink;
	readonly confirm: OpenConfirm;
	readonly workspace: WorkspaceNavigation;
}) =>
	Layer.mergeAll(
		PluginHost.layer(parts.plugin),
		Notices.layer(parts.notices),
		Confirm.layer(parts.confirm),
		Workspace.layer(parts.workspace),
	);
