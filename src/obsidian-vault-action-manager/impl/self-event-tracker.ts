export class SelfEventTracker {
	constructor(private readonly ttlMs = 1000) {}

	private readonly entries = new Map<string, number>();

	register(paths: readonly string[]): void {
		const expiry = Date.now() + this.ttlMs;
		for (const path of paths) {
			this.entries.set(path, expiry);
		}
	}

	consume(path: string): boolean {
		const expiry = this.entries.get(path);
		if (expiry === undefined) return false;
		if (expiry < Date.now()) {
			this.entries.delete(path);
			return false;
		}
		this.entries.delete(path);
		return true;
	}
}
