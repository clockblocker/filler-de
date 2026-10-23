---
status: accepted
---

# Run the plugin on one Effect runtime

The plugin builds one `ManagedRuntime` from `PluginLive` in `onload` and disposes it in `onunload` (`src/runtime/`). `PluginLive` holds the plugin's observability (the recent-trace tracer, and the console and recent-trace loggers), the idle tracker, VAM's Layer with `observability: "host"`, dumgen, and the `Lifecycle` service, whose finalizer stops the lifecycle. VAM no longer brings a runtime of its own into the plugin; `createVaultActionManager` stays for VAM's own tests.

Obsidian enters the runtime only at an edge, and each edge opens the root span of what the user did: `obsidian.onload`, `command.<id>`, `user-event.<kind>`, `settings.save` or `e2e.<hook>`. An edge logs a failure under its span, so it reaches "Copy recent trace" whole. The lifecycle supervisor runs each command in a fiber of a scope it owns, with the context of the fiber that submitted it, so a Librarian restart, its start and VAM's scan and dispatch show as one tree under the command.

This supersedes ADR-0005.

## Considered Options

- A generic `run(span, effect)` and `fork(span, effect)` at every edge. Not taken: one method per kind of edge fixes the root span's name, so an edge cannot invent one, and the gauge's run-site count keeps meaning raw `Effect.run*` calls.
- Linking a lifecycle command's span to its submitter instead of parenting it. Not taken: the submitter waits for the command, so it is the command's parent, and a link would split one user action into two trees.

## Consequences

- Disposal interrupts the programs still running at an edge, then runs the Layer's finalizers newest first: the lifecycle stops, then VAM shuts down. The lifecycle's stop closes the scope its launch built the plugin's services in (`plugin/plugin-services.ts`: their Layers' finalizers, newest first), then the Librarian's own scope.
- VAM's shutdown never cuts the vault batch in flight: it waits for the batch to finish, however long, because a half-done batch can leave notes half renamed. `onunload` does not wait for the disposal, so Obsidian does not either. A shutdown that waits longer than 5 s is logged.
- A failed build is told once, as a launch failure (`notices.launchFailed`), with its whole cause; `VamSetupError` names the Layer that failed. Every edge then runs nothing.
- After disposal an edge runs nothing: an Obsidian callback that fires late is a no-op, and an E2E hook rejects.
- The background work that still starts from outside an Effect (Knowledge runs, unlink checks and the dictionary reset) runs on the plugin runtime through `PluginRuntime.hops`, as root spans of its own, until #227 moves it onto the runtime. The dictionary store's build runs in its Layer's scope (#226).
