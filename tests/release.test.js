const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("release change detection ignores non-deployable project files", async () => {
  const {projectForPath, projectsForPaths} = await import("../tools/apps-script.mjs");

  assert.equal(projectForPath("docs/syntax.ts"), "docs");
  assert.equal(projectForPath("docs/appsscript.json"), "docs");
  assert.equal(projectForPath("codemirror/third_party/codemirror/lib/codemirror.js"), "codemirror");
  assert.equal(projectForPath("theme/theme.ts"), "theme");
  assert.equal(projectForPath("slides/screens/screen1.png"), null);
  assert.equal(projectForPath("docs/README.md"), null);
  assert.equal(projectForPath("docs/test-support.d.ts"), null);
  assert.equal(projectForPath("tests/docs.test.js"), null);

  assert.deepEqual(
      projectsForPaths(["README.md", "theme/schema.json", "slides/syntax.ts"]),
      ["slides"]);
});

test("library releases include both dependent add-ons", async () => {
  const {releasePlan, versionFromOutput} =
      await import("../tools/apps-script.mjs");

  assert.deepEqual(releasePlan(["theme"]), ["theme", "docs", "slides"]);
  assert.deepEqual(
      releasePlan(["codemirror", "slides"]),
      ["codemirror", "docs", "slides"]);
  assert.deepEqual(releasePlan(["docs"]), ["docs"]);
  assert.deepEqual(releasePlan([]), []);
  assert.equal(versionFromOutput("Created version 12"), 12);
  assert.equal(versionFromOutput("Created version 13."), 13);
  assert.equal(versionFromOutput("Unexpected output"), null);
});

test("build stages transpiled JavaScript instead of TypeScript", async () => {
  const {buildProject, cleanProject} = await import("../tools/apps-script.mjs");
  const buildDirectory = await buildProject("docs");
  try {
    const files = fs.readdirSync(buildDirectory).sort();
    assert.deepEqual(files, [
      ".clasp.json",
      ".claspignore",
      "appsscript.json",
      "syntax.js",
    ]);
    const syntax = fs.readFileSync(path.join(buildDirectory, "syntax.js"), "utf8");
    assert.match(syntax, /function colorize\(\)/);
    assert.doesNotMatch(syntax, /^\s*import\s+\*\s+as\s+theme/m);
  } finally {
    cleanProject("docs");
  }
});
