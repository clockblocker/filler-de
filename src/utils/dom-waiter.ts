/**
 * Wait for a DOM condition to become true using MutationObserver.
 * Resolves when check() returns true, or after timeout.
 *
 * @param check - Function that returns true when condition is met
 * @param options - Configuration options
 * @returns Promise that resolves when condition is met or timeout
 */
export function waitForDomCondition(
	check: () => boolean,
	options: { timeout?: number; target?: HTMLElement } = {},
): Promise<void> {
	const { timeout = 500, target = document.body } = options;

	return new Promise((resolve) => {
		if (check()) {
			resolve();
			return;
		}

		const observer = new MutationObserver(() => {
			if (check()) {
				observer.disconnect();
				resolve();
			}
		});

		observer.observe(target, {
			attributes: true,
			childList: true,
			subtree: true,
		});

		setTimeout(() => {
			observer.disconnect();
			resolve();
		}, timeout);
	});
}
