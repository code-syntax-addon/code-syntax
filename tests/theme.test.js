const assert = require("node:assert/strict");
const test = require("node:test");
const {loadAppScript} = require("./app-script-loader");

test("syntax deltas exclude attributes already present in the default style", async () => {
  const app = await loadAppScript("theme/theme.ts");
  const result = app.evaluate(`(() => {
    const style = new SegmentStyle(
        "demo", "demo", "#ffffff",
        {fontFamily: "Roboto Mono", foreground: "#000000", bold: false},
        {keyword: {foreground: "#ff0000", bold: true}});
    return {
      plain: style.codeMirrorStyleToStyleDelta(null),
      keyword: style.codeMirrorStyleToStyleDelta("keyword"),
      fullKeyword: style.codeMirrorStyleToStyle("keyword"),
    };
  })()`);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    plain: {},
    keyword: {foreground: "#ff0000", bold: true},
    fullKeyword: {
      fontFamily: "Roboto Mono",
      foreground: "#ff0000",
      bold: true,
    },
  });
});

test("invalid custom colors are rejected before reaching Apps Script setters", async () => {
  const errors = [];
  const app = await loadAppScript("theme/theme.ts", {
    console: {
      log() {},
      error(message) {
        errors.push(String(message));
      },
    },
  });
  app.context.invalidTheme = JSON.stringify({
    default: {foreground: "not-a-color"},
  });

  assert.equal(app.evaluate("parseTheme(invalidTheme, 'test')"), null);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Invalid color default\.foreground/);
});
