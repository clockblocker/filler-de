/**
 * Just enough of Obsidian's plugin host for the host services' tests: a
 * plugin that records its commands, workspace listeners, editor
 * extensions and unload callbacks, and notices that record what they show.
 */
import type { Command, EventRef } from "obsidian";
import {
	type HostPlugin,
	type NoticeHandle,
	type NoticeSink,
	ObsidianHostOver,
	type OpenConfirm,
} from "../../src/managers/obsidian/host";

type Callback = (...args: never[]) => void;

export function fakeHostPlugin() {
	const commands = new Map<string, Command>();
	const removedCommands: string[] = [];
	const listeners = new Map<string, Set<Callback>>();
	const offrefs: string[] = [];
	const onUnload: (() => void)[] = [];
	const registeredExtensions: unknown[] = [];
	const postProcessors: ((element: unknown, context: unknown) => void)[] =
		[];
	let optionUpdates = 0;
	let unloaded = false;

	const workspace = {
		offref: (ref: EventRef) => {
			const { callback, name } = ref as unknown as {
				callback: Callback;
				name: string;
			};
			offrefs.push(name);
			listeners.get(name)?.delete(callback);
		},
		on: (name: string, callback: Callback) => {
			const set = listeners.get(name) ?? new Set();
			set.add(callback);
			listeners.set(name, set);
			return { callback, name } as unknown as EventRef;
		},
		updateOptions: () => {
			optionUpdates++;
		},
	};

	const plugin = {
		addCommand: (command: Command) => {
			commands.set(command.id, command);
			// As Obsidian's Plugin does: the command goes as the plugin unloads.
			onUnload.push(() => commands.delete(command.id));
			return command;
		},
		app: { workspace },
		register: (callback: () => unknown) => {
			onUnload.push(callback);
		},
		registerEditorExtension: (extension: unknown) => {
			registeredExtensions.push(extension);
		},
		registerMarkdownPostProcessor: (
			processor: (element: unknown, context: unknown) => void,
		) => {
			postProcessors.push(processor);
			// As Obsidian's Plugin does: the post-processor goes on unload.
			onUnload.push(() => {
				const at = postProcessors.indexOf(processor);
				if (at !== -1) postProcessors.splice(at, 1);
			});
			return processor;
		},
		removeCommand: (id: string) => {
			removedCommands.push(id);
			commands.delete(id);
		},
	} as unknown as HostPlugin;

	return {
		commands,
		/** The callbacks listening to `name` now. */
		listening: (name: string) => [...(listeners.get(name) ?? [])],
		offrefs,
		optionUpdates: () => optionUpdates,
		plugin,
		/** Renders `element` as Reading view would: every post-processor runs. */
		postProcess: (element: unknown) => {
			for (const processor of postProcessors) processor(element, {});
		},
		/** The post-processors registered with Obsidian now. */
		postProcessors,
		registeredExtensions,
		removedCommands,
		/** Fires `name` as Obsidian's workspace would. */
		trigger: (name: string, ...args: unknown[]) => {
			for (const callback of listeners.get(name) ?? [])
				(callback as (...a: unknown[]) => void)(...args);
		},
		/**
		 * Unloads the plugin, as Obsidian's `Component.unload` does: every
		 * callback it registered, once, newest first.
		 */
		unload: () => {
			if (unloaded) return;
			unloaded = true;
			for (const callback of onUnload.splice(0).reverse()) callback();
		},
	};
}

/** Notices that record what they show, sticky or not. */
export function recordingNotices() {
	const shown: { message: string; sticky: boolean }[] = [];
	const sink: NoticeSink = {
		open: (message, options) => {
			const entry = { message, sticky: options?.sticky === true };
			shown.push(entry);
			let showing = true;
			const handle: NoticeHandle = {
				hide: () => {
					showing = false;
				},
				setMessage: (next) => {
					entry.message = next;
				},
				showing: () => showing,
			};
			return handle;
		},
		show: (message, options) => {
			shown.push({ message, sticky: options?.sticky === true });
		},
	};
	return { messages: () => shown.map(({ message }) => message), shown, sink };
}

/**
 * A confirmation that answers each question with the next of `answers`,
 * at once, or holds it open while `answers` is empty.
 */
export function scriptedConfirm(answers: boolean[] = []) {
	const asked: { title: string; message: string }[] = [];
	let open = 0;
	const confirm: OpenConfirm = (title, message, answer) => {
		asked.push({ message, title });
		const next = answers.shift();
		if (next !== undefined) {
			answer(next);
			return { close: () => {} };
		}
		open++;
		let closed = false;
		return {
			close: () => {
				if (closed) return;
				closed = true;
				open--;
				answer(false);
			},
		};
	};
	return { asked, confirm, open: () => open };
}

/**
 * The host over a fake plugin, recording notices, a scripted confirmation
 * and a workspace that records the links it opens. With no `answers`, a
 * confirmation stays open until it is closed, as a modal the user has not
 * answered: a test that asks must answer, or close it by disposing.
 */
export function fakeHost(options: { readonly answers?: boolean[] } = {}) {
	const obsidian = fakeHostPlugin();
	const notices = recordingNotices();
	const confirm = scriptedConfirm(options.answers);
	const opened: { target: string; sourcePath: string; newLeaf: unknown }[] =
		[];
	const layer = ObsidianHostOver({
		confirm: confirm.confirm,
		notices: notices.sink,
		plugin: obsidian.plugin,
		workspace: {
			openLinkText: (target, sourcePath, newLeaf) => {
				opened.push({ newLeaf, sourcePath, target });
				return Promise.resolve();
			},
		},
	});
	return { confirm, layer, notices, obsidian, opened };
}
