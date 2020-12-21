import "google-apps-script";
import "google-apps-script.api";

import docs = GoogleAppsScript.Document;
type Document = docs.Document;
type Body = docs.Body;
type Paragraph = docs.Paragraph;
type Element = docs.Element;
type Text = docs.Text;
type Structured = GoogleAppsScript.Docs.Schema.Document;
type StructuredElement = GoogleAppsScript.Docs.Schema.StructuralElement;
type StructuredParagraph = GoogleAppsScript.Docs.Schema.Paragraph;
type RgbColor = GoogleAppsScript.Docs.Schema.RgbColor;

class IndexedParagraph {
  p: Paragraph;
  startIndex: number;
  endIndex: number;
  backgroundColor: RgbColor;

  constructor(paragraph: Paragraph, startIndex: number, endIndex: number, backgroundColor: RgbColor) {
    this.p = paragraph;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.backgroundColor = backgroundColor;
  }
}

class CodeSegment {
  paragraphs : Array<IndexedParagraph>;
  constructor(paragraphs : Array<IndexedParagraph>) {
    this.paragraphs = paragraphs;
  }
}

function main() {
  let document = DocumentApp.getActiveDocument();
  let indexedParagraphs = createIndexedParagraphs(document);
  let codeSegments = findCodeSegments(indexedParagraphs);
  setBackgroundColors(document, codeSegments);
}

function createIndexedParagraphs(document : Document) : Array<IndexedParagraph> {
  let result : Array<IndexedParagraph> = [];
  let structuredDoc = Docs.Documents.get(document.getId());
  let entries_index = 0;
  let entries = structuredDoc.body.content;
  function nextStructuredParagraph() : StructuredElement {
    while (entries_index < entries.length) {
      let entry = entries[entries_index++];
      if (entry.paragraph) {
        return entry;
      }
    }
    throw "not found";
  }

  let body = document.getBody();
  for (let paragraph of body.getParagraphs()) {
    let structured = nextStructuredParagraph();
    let startIndex = structured.startIndex;
    let endIndex = structured.endIndex;
    let color = structured.paragraph.paragraphStyle.shading.backgroundColor?.color?.rgbColor;
    result.push(new IndexedParagraph(paragraph, startIndex, endIndex, color));
  }
  return result;
}

function sameColor(a : RgbColor, b : RgbColor) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.red == b.red && a.green == b.green && a.blue == b.blue;
}

function findCodeSegments(paragraphs : Array<IndexedParagraph>) : Array<CodeSegment> {
  let result : Array<CodeSegment> = []
  let inCodeSegment = false;
  let lastColor = undefined;
  let accumulated : Array<IndexedParagraph> = [];

  function finishCodeSegment() {
    result.push(new CodeSegment(accumulated));
    accumulated = [];
    inCodeSegment = false;
    lastColor = undefined;
  }

  for (let paragraph of paragraphs) {
    let color = paragraph.backgroundColor
    // Color wins over text.
    if (!sameColor(lastColor, color)) {
      if (inCodeSegment) {
        // We were already accumulating.
        // Doesn't matter if it was because of color or text. We close the old one
        // and create a new segment.
        finishCodeSegment();
      }
      if (color) {
        // Start a new segment.
        inCodeSegment = true;
        lastColor = color;
      }
    }

    if (lastColor) {
      if (!inCodeSegment) throw "We should be in code segment."
      // Don't look at text if we are accumulating due to color.
      accumulated.push(paragraph);
      continue;
    }

    let text = paragraph.p.getText()
    // TODO(florian): is there a way to split a paragraph into smaller pieces
    // by replacing one "\r" with "\n" (for example)?
    if (text.startsWith("```")) {
      if (inCodeSegment) {
        accumulated.push(paragraph);
        finishCodeSegment();
      } else {
        inCodeSegment = true;
      }
    }
    if (inCodeSegment) {
      accumulated.push(paragraph)
      let lines = text.split("\r");
      if (lines.length > 1 && lines[lines.length - 1].startsWith("```")) {
        finishCodeSegment();
      }
    }
  }
  if (accumulated.length != 0) {
    result.push(new CodeSegment(accumulated));
  }
  return result;
}

function setBackgroundColors(document : Document, segments : Array<CodeSegment>) {
  let requests : Array<GoogleAppsScript.Docs.Schema.Request> = []
  for (let segment of segments) {
    let color = segment.paragraphs[0].backgroundColor || {
      red: 1.0,
      green: 0.0,
      blue: 0.0
    }
    let request : GoogleAppsScript.Docs.Schema.Request = {
      updateParagraphStyle: {
        range: {
          startIndex: segment.paragraphs[0].startIndex,
          endIndex: segment.paragraphs[segment.paragraphs.length - 1].endIndex,
        },
        fields: "shading",
        paragraphStyle: {
          shading: {
            backgroundColor: {
              color: {
                rgbColor: color
              }
            }
          }
        }
      }
    };
    requests.push(request)
  }
  if (requests.length != 0) {
    Docs.Documents.batchUpdate({requests: requests}, document.getId());
  }
}
