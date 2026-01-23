Obsidian hasn’t finished (re)rendering the leaf + its metadata/link-resolution pass yet, and a random click triggers a bunch of “now update the view” work.

There isn’t a single blessed reloadTheCurrentLeafSoItRegisteresTheChanges() API, but there are a few practical “force refresh” hooks people use:

1) Force-refresh the active leaf/view

A) Rebuild the current view (works broadly, can flicker)

The community “reload page” trick is:
	•	app.workspace.activeLeaf.rebuildView()  ￼
    https://forum.obsidian.md/t/creating-command-to-reload-page/57906

So in plugin code:
refreshActiveLeaf() {
  const leaf = this.app.workspace.activeLeaf;
  leaf?.rebuildView?.();
}

B) If it’s a Markdown reading/preview render issue: rerender preview (often smoother)

For “postprocessor didn’t run until something else happened”, this works:
	•	this.app.workspace.getActiveViewOfType(MarkdownView)?.previewMode.rerender(true);
    https://forum.obsidian.md/t/how-to-apply-post-processors-immediately/67029

    import { MarkdownView } from "obsidian";

refreshMarkdownPreviewIfActive() {
  const view = this.app.workspace.getActiveViewOfType(MarkdownView);
  view?.previewMode?.rerender?.(true);
}


In practice, I do B first, fallback to A.

2) Don’t run DOM-attach work too early: hook the right lifecycle

If your UI elements “don’t attach until click”, you’re often running before the leaf is actually ready/rendered.

Obsidian exposes workspace layout events (layout-ready, layout-change), and there’s also the workspace.layoutReady flag mentioned in the forum.  ￼

Typical pattern:
onload() {
  const run = () => this.attachOrReattachUi();

  if (this.app.workspace.layoutReady) run();
  else this.registerEvent(this.app.workspace.on("layout-ready", run));

  this.registerEvent(this.app.workspace.on("layout-change", run));
  this.registerEvent(this.app.workspace.on("active-leaf-change", run));
}
And inside attachOrReattachUi(), do a next-tick delay so you attach after Obsidian finishes its own render:
async nextPaint() {
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
}



---
A practical “do the thing” helper
import { MarkdownView } from "obsidian";

async function refreshCurrentLeaf(app: any) {
  // let Obsidian finish its render/cache pass
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  const mdView = app.workspace.getActiveViewOfType?.(MarkdownView);
  if (mdView?.getMode?.() === "preview" && mdView?.previewMode?.rerender) {
    mdView.previewMode.rerender(true); //  [oai_citation:5‡Obsidian Forum](https://forum.obsidian.md/t/how-to-apply-post-processors-immediately/67029)
    return;
  }

  app.workspace.activeLeaf?.rebuildView?.(); //  [oai_citation:6‡Obsidian Forum](https://forum.obsidian.md/t/creating-command-to-reload-page/57906)
}

When to call it
	•	after you auto-create/move files
	•	after you programmatically insert [[links]] into the active editor
	•	after your plugin toggles something that affects postprocessors / decorations

If you paste your exact flow (create file → move file? → insert link? → switch leaf?), I can point to the best trigger point (because calling rebuild/rerender too early is the #1 reason it “only works after click”).