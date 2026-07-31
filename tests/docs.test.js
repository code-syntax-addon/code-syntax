const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {loadAppScript} = require("./app-script-loader");

const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, "fixtures", "demo.json"), "utf8"));

const ElementType = {
  PARAGRAPH: "PARAGRAPH",
  TABLE: "TABLE",
};

const Attribute = {
  FONT_FAMILY: "FONT_FAMILY",
  FOREGROUND_COLOR: "FOREGROUND_COLOR",
  BACKGROUND_COLOR: "BACKGROUND_COLOR",
  BOLD: "BOLD",
  ITALIC: "ITALIC",
};

function fakeParagraph(text) {
  const paragraph = {
    getType() {
      return ElementType.PARAGRAPH;
    },
    asParagraph() {
      return paragraph;
    },
    getText() {
      return text;
    },
  };
  return paragraph;
}

function fakeBody(paragraphs) {
  return {
    getNumChildren() {
      return paragraphs.length;
    },
    getChild(index) {
      return paragraphs[index];
    },
  };
}

async function loadDocs(globals = {}) {
  return loadAppScript("docs/syntax.ts", {
    codemirror: globals.codemirror || {license: "test", runMode() {}},
    DocumentApp: {
      Attribute,
      ElementType,
      ParagraphHeading: {
        TITLE: "TITLE",
        HEADING1: "HEADING1",
        HEADING2: "HEADING2",
        HEADING3: "HEADING3",
      },
      ...globals.DocumentApp,
    },
    Utilities: globals.Utilities || {sleep() {}},
  });
}

test("demo document discovers every well-formed fenced mode", async () => {
  const app = await loadDocs();
  const findCodeSegments = app.evaluate("findCodeSegments");
  const text = fixture.document.blocks.flatMap(
      block => [...block.paragraphs, "paragraph between blocks"]);
  const inputParagraphs = text.map(fakeParagraph);
  const visitedParagraphs = [];

  const segments = findCodeSegments(fakeBody(inputParagraphs), visitedParagraphs);

  assert.deepEqual(
      Array.from(segments, segment => segment.mode),
      fixture.document.blocks.map(block => block.mode));
  assert.equal(visitedParagraphs.length, inputParagraphs.length);
});

test("malformed or incomplete backtick blocks are left untouched", async () => {
  const app = await loadDocs();
  const removeBackticks = app.evaluate("removeBackticks");

  for (const block of fixture.document.malformedBlocks) {
    let edits = 0;
    const paragraphs = block.map(content => ({
      getText() {
        return content;
      },
      editAsText() {
        edits++;
        throw new Error("malformed block must not be edited");
      },
      removeFromParent() {
        edits++;
        throw new Error("malformed block must not be removed");
      },
    }));
    removeBackticks({paragraphs});
    assert.equal(edits, 0);
  }
});

test("an empty code span does not address index zero", async () => {
  const app = await loadDocs();
  const highlightCodeSpan = app.evaluate("highlightCodeSpan");
  const text = {
    getText() {
      return "";
    },
    setAttributes() {
      throw new Error("empty text must not be styled");
    },
    deleteText() {
      throw new Error("empty text must not be edited");
    },
  };

  assert.doesNotThrow(() => highlightCodeSpan({editAsText: () => text}, 0, 0));
});

test("selection lookup retries transient Document service failures", async () => {
  let attempts = 0;
  const sleeps = [];
  const expectedSelection = {id: "selection"};
  const app = await loadDocs({
    DocumentApp: {
      getActiveDocument() {
        return {
          getSelection() {
            attempts++;
            if (attempts < 3) throw new Error("transient Document service failure");
            return expectedSelection;
          },
        };
      },
    },
    Utilities: {
      sleep(delay) {
        sleeps.push(delay);
      },
    },
  });

  assert.equal(app.evaluate("getActiveSelection")(), expectedSelection);
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [100, 300]);
});

test("Docs styles are batched into one setAttributes call", async () => {
  const app = await loadDocs();
  const applyStyle = app.evaluate("applyStyle");
  const calls = [];
  const text = {
    setAttributes(...args) {
      calls.push(args);
    },
  };

  applyStyle(text, 2, 8, {
    fontFamily: "Roboto Mono",
    foreground: "#112233",
    background: "#ffffff",
    bold: false,
    italic: true,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 2);
  assert.equal(calls[0][1], 8);
  assert.deepEqual({...calls[0][2]}, {
    FONT_FAMILY: "Roboto Mono",
    FOREGROUND_COLOR: "#112233",
    BACKGROUND_COLOR: "#ffffff",
    BOLD: false,
    ITALIC: true,
  });
});

test("adjacent identical Docs token styles are coalesced", async () => {
  const app = await loadDocs();
  const appendTextStyleRun = app.evaluate("appendTextStyleRun");
  const applyTextStyleRuns = app.evaluate("applyTextStyleRuns");
  const calls = [];
  const text = {
    setAttributes(...args) {
      calls.push(args);
    },
  };
  const runs = [];

  appendTextStyleRun(runs, text, 0, 3, {foreground: "#ff0000"});
  appendTextStyleRun(runs, text, 3, 2, {foreground: "#ff0000"});
  appendTextStyleRun(runs, text, 5, 1, {});
  appendTextStyleRun(runs, text, 6, 2, {bold: true});

  assert.equal(runs.length, 2);
  assert.equal(runs[0].endInclusive, 4);
  applyTextStyleRuns(runs);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call.slice(0, 2)), [[0, 4], [6, 7]]);
});
