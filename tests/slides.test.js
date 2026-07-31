const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {loadAppScript} = require("./app-script-loader");

const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, "fixtures", "demo.json"), "utf8"));

function slidesGlobals(overrides = {}) {
  return {
    SlidesApp: {
      ShapeType: {TEXT_BOX: "TEXT_BOX"},
      PageElementType: {SHAPE: "SHAPE", GROUP: "GROUP"},
      ...overrides.SlidesApp,
    },
    codemirror: overrides.codemirror || {runMode() {}},
  };
}

test("demo slides recognize newline and vertical-tab code shapes", async () => {
  const app = await loadAppScript("slides/syntax.ts", slidesGlobals());
  const isTextCodeShape = app.evaluate("isTextCodeShape");
  const CodeShape = app.evaluate("CodeShape");
  const modes = [];

  for (const slide of fixture.slides) {
    for (const shapeText of slide.shapes) {
      const text = {asString: () => shapeText};
      if (isTextCodeShape(text)) {
        modes.push(CodeShape.fromText({}, text).mode);
      }
    }
  }

  assert.deepEqual(modes, [
    "toit", "none", "none", "dart",
    "dart",
    "yaml", "sql",
    "dart", "ts", "go", "toit",
    "ts", "go", "toit", "python",
  ]);
});

test("changing color with no selected page elements is a no-op", async () => {
  const app = await loadAppScript("slides/syntax.ts", slidesGlobals({
    SlidesApp: {
      getActivePresentation() {
        return {
          getSelection() {
            return {getPageElementRange: () => null};
          },
        };
      },
    },
  }));

  assert.doesNotThrow(() => app.evaluate("changeColorTo")("dart"));
});

test("shapes that reject getText are skipped", async () => {
  const app = await loadAppScript("slides/syntax.ts", slidesGlobals());
  const getShapeText = app.evaluate("getShapeText");
  const doShape = app.evaluate("doShape");
  const inaccessibleShape = {
    getShapeType() {
      return "NOT_A_TEXT_BOX";
    },
    getText() {
      throw new Error("Slides service rejected getText");
    },
  };

  assert.equal(getShapeText(inaccessibleShape), null);
  assert.doesNotThrow(() => doShape(inaccessibleShape));
});

test("Slides applies defaults once and coalesces identical token deltas", async () => {
  const fullStyleCalls = [];
  const rangeStyleCalls = [];
  const ranges = [];
  const textStyle = calls => ({
    setFontFamily(value) { calls.push(["fontFamily", value]); },
    setForegroundColor(value) { calls.push(["foreground", value]); },
    setBackgroundColor(value) { calls.push(["background", value]); },
    setBold(value) { calls.push(["bold", value]); },
    setItalic(value) { calls.push(["italic", value]); },
  });
  const text = {
    asString() {
      return "abcd ";
    },
    getTextStyle() {
      return textStyle(fullStyleCalls);
    },
    getRange(start, end) {
      ranges.push([start, end]);
      return {getTextStyle: () => textStyle(rangeStyleCalls)};
    },
  };
  const segmentStyle = {
    codeMirrorMode: "demo",
    defaultStyle: {
      fontFamily: "Roboto Mono",
      foreground: "#000000",
      bold: false,
      italic: false,
    },
    codeMirrorStyleToStyleDelta(style) {
      return style === "keyword" ? {foreground: "#ff0000"} : {};
    },
  };
  const app = await loadAppScript("slides/syntax.ts", slidesGlobals({
    codemirror: {
      runMode(_source, _mode, callback) {
        callback("ab", "keyword");
        callback("cd", "keyword");
        callback(" ", null);
      },
    },
  }));
  app.context.testSegmentStyle = segmentStyle;
  app.evaluate("getModeToStyle = function() { return new Map([['demo', testSegmentStyle]]); }");

  app.evaluate("colorizeText")(text, "demo");

  assert.equal(fullStyleCalls.length, 4);
  assert.deepEqual(ranges, [[0, 4]]);
  assert.deepEqual(rangeStyleCalls, [["foreground", "#ff0000"]]);
});
