/**
 * TL;DR Reporter: prints only suite tree with ✓/✖.
 * No error blocks, no stacks. Diagnostics go to files via WDIO hooks.
 */
const WDIOReporter = require("@wdio/reporter").default;

// Helper: safe filename (same logic as wdio.conf.mts)
const safeName = (s) =>
	s.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 200);

class TldrReporter extends WDIOReporter {
  constructor(options = {}) {
    // stdout true ensures output goes to console
    super({ ...options, stdout: true });
    this.indent = 0;
  }

  onRunnerStart() {
    // no-op
  }

  onSuiteStart(suite) {
    if (!suite || !suite.title || suite.title === "Root Suite") return;

    this._line(`${" ".repeat(this.indent)}${suite.title}`);
    this.indent += 2;
  }

  onSuiteEnd(suite) {
    if (!suite || !suite.title || suite.title === "Root Suite") return;

    this.indent = Math.max(0, this.indent - 2);
  }

  onTestPass(test) {
    this._testLine(test, "✓");
  }

  onTestFail(test) {
    const title = test.title ?? "unknown-test";
    const filename = `fail_${safeName(title)}.log`;
    this._testLine(test, "✖", `file:///tests/tracing/logs/${filename}`);
  }

  onTestSkip(test) {
    this._testLine(test, "-");
  }

  onRunnerEnd() {
    // WDIO prints "Spec Files: ..." itself
  }

  _testLine(test, icon, fileRef = "") {
    const title = (test && test.title) || "Unknown Test";
    const suffix = fileRef ? ` ${fileRef}` : "";
    this._line(`${" ".repeat(this.indent)}${icon} ${title}${suffix}`);
  }

  _line(s) {
    // WDIO reporter output (don’t use console.log)
    this.write(s + "\n");
  }
}

// Support both import styles
module.exports = TldrReporter;
module.exports.default = TldrReporter;