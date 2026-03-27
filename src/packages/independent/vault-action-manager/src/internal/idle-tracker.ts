let pendingCount = 0;

function isE2E(): boolean {
	if (typeof process !== "undefined" && process.env.E2E === "1") {
		return true;
	}
	if (typeof window !== "undefined") {
		const win = window as unknown as { __E2E_MODE?: boolean };
		return win.__E2E_MODE === true;
	}
	return false;
}

export function incrementPending(): void {
	if (!isE2E()) return;
	pendingCount++;
}

export function decrementPending(): void {
	if (!isE2E()) return;
	if (pendingCount > 0) {
		pendingCount--;
	}
}
