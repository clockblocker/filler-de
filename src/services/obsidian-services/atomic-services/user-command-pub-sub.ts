// Simple pub-sub system for user commands like click, rename file, undo, etc.

type UserCommandType =
	| "click"
	| "renameFile"
	| "undo"
	| "redo"
	| "deleteFile"
	| "createFile"
	| "moveFile"
	| string; // Allow extensibility

type UserCommandPayload = any;

type UserCommandHandler = (payload: UserCommandPayload) => void;

class UserCommandBus {
	private listeners: Map<UserCommandType, Set<UserCommandHandler>> =
		new Map();

	subscribe(type: UserCommandType, handler: UserCommandHandler): () => void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)!.add(handler);

		// Return unsubscribe function
		return () => {
			this.listeners.get(type)!.delete(handler);
			if (this.listeners.get(type)!.size === 0) {
				this.listeners.delete(type);
			}
		};
	}

	emit(type: UserCommandType, payload?: UserCommandPayload) {
		const handlers = this.listeners.get(type);
		if (handlers) {
			for (const handler of handlers) {
				handler(payload);
			}
		}
	}

	clear() {
		this.listeners.clear();
	}
}

// Singleton instance for app-wide pub-sub
export const theWatcher = new UserCommandBus();

// Usage example (uncomment to use):
// theWatcher.subscribe("click", (payload) => {
//   console.log("User clicked:", payload);
// });

// theWatcher.emit("click", { x: 10, y: 20 });

/*
Supported command types you may want to use:
- click
- renameFile
- undo
- redo
- deleteFile
- createFile
- moveFile

Add more as needed!
*/
