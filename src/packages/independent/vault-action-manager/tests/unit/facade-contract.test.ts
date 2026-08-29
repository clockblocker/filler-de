import { describe, expect, it } from "bun:test";
import { createVaultActionManager, ReadContentErrorKind } from "../../src";
import {
	folderPath,
	makeFacadeHarness,
	mdPath,
} from "./helpers/facade-harness";

describe("VaultActionManager compatibility facade", () => {
	it("preserves every public method's return shape", async () => {
		const harness = makeFacadeHarness();
		const { dispose, manager } = createVaultActionManager(harness.app);

		expect(manager.startListening()).toBeUndefined();
		const teardown = manager.subscribeToBulk(async () => {});
		expect(typeof teardown).toBe("function");
		expect([...harness.callbacks.keys()].sort()).toEqual([
			"create",
			"delete",
			"rename",
		]);
		expect((await manager.dispatch([])).isOk()).toBe(true);
		expect((await manager.readContent(mdPath))._unsafeUnwrap()).toBe(
			"content",
		);
		expect(manager.exists(mdPath)).toBe(true);
		expect(manager.findByBasename("note")).toEqual([mdPath]);
		expect(manager.resolveLinkpathDest("note", mdPath)).toEqual(mdPath);
		expect(manager.list(folderPath).isOk()).toBe(true);
		const readers = manager.listAllFilesWithMdReaders(folderPath);
		expect(readers.isOk()).toBe(true);
		if (readers.isOk()) {
			const readable = readers.value.find(
				(
					path,
				): path is typeof path & { read: () => Promise<unknown> } =>
					"read" in path,
			);
			expect(readable).toBeDefined();
			expect(await readable?.read()).toBeDefined();
		}
		expect(manager.mdPwd()).toEqual(mdPath);
		expect(manager.getOpenedContent()._unsafeUnwrap()).toBe("content");
		expect(manager.getSelectionInfo()?.text).toBe("content");
		expect(manager.getSelectionText()).toBe("content");
		expect((await manager.cd(mdPath)).isOk()).toBe(true);
		expect(manager.scrollOpenedFileToLine(3)).toBeUndefined();
		expect(harness.getScrollCount()).toBe(1);

		teardown();
		expect(harness.removed).toHaveLength(3);
		await dispose();
	});

	it("maps post-disposal calls to conservative compatibility failures", async () => {
		const { app } = makeFacadeHarness();
		const { dispose, manager } = createVaultActionManager(app);
		manager.startListening();
		await Promise.all([dispose(), dispose()]);

		expect((await manager.dispatch([])).isErr()).toBe(true);
		const read = await manager.readContent(mdPath);
		expect(read.isErr()).toBe(true);
		if (read.isErr()) {
			expect(read.error.kind).toBe(ReadContentErrorKind.Unknown);
			expect(read.error.reason).toContain("disposed");
		}
		expect(manager.exists(mdPath)).toBe(false);
		expect(manager.findByBasename("note")).toEqual([]);
		expect(manager.resolveLinkpathDest("note", mdPath)).toBeNull();
		expect(manager.list(folderPath).isErr()).toBe(true);
		expect(manager.listAllFilesWithMdReaders(folderPath).isErr()).toBe(
			true,
		);
		expect(manager.mdPwd()).toBeNull();
		expect(manager.getOpenedContent().isErr()).toBe(true);
		expect(manager.getSelectionInfo()).toBeNull();
		expect(manager.getSelectionText()).toBeNull();
		expect((await manager.cd(mdPath)).isErr()).toBe(true);
		expect(manager.startListening()).toBeUndefined();
		expect(typeof manager.subscribeToBulk(async () => {})).toBe("function");
		expect(manager.scrollOpenedFileToLine(3)).toBeUndefined();
	});

	it("disposal releases active subscriptions once", async () => {
		const harness = makeFacadeHarness();
		const { dispose, manager } = createVaultActionManager(harness.app);
		manager.startListening();
		const teardown = manager.subscribeToBulk(async () => {});

		await Promise.all([dispose(), dispose()]);
		expect(harness.removed).toHaveLength(3);

		teardown();
		await dispose();
		expect(harness.removed).toHaveLength(3);
	});
});
