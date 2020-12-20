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
    //let color = structured.paragraph.paragraphStyle.shading.backgroundColor.color.rgbColor;
    // TODO(florian): obviously not everything is white.
    let color : RgbColor = {
      red: 255,
      green: 255,
      blue: 255,
    };
    result.push(new IndexedParagraph(paragraph, startIndex, endIndex, color));
  }
  return result;
}

function findCodeSegments(paragraphs : Array<IndexedParagraph>) : Array<CodeSegment> {
  let result : Array<CodeSegment> = []
  let inCodeSegment = false;
  let accumulated : Array<IndexedParagraph> = [];
  for (let paragraph of paragraphs) {
    // TODO(florian): is there a way to split a paragraph into smaller pieces
    // by replacing one "\r" with "\n" (for example)?
    let text = paragraph.p.getText()
    if (text.startsWith("```")) {
      if (inCodeSegment) {
        accumulated.push(paragraph);
        result.push(new CodeSegment(accumulated));
        accumulated = [];
        inCodeSegment = false;
      } else {
        inCodeSegment = true;
      }
    }
    if (inCodeSegment) {
      accumulated.push(paragraph)
      let lines = text.split("\r");
      if (lines.length > 1 && lines[lines.length - 1].startsWith("```")) {
        result.push(new CodeSegment(accumulated))
        accumulated = [];
        inCodeSegment = false;
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
                rgbColor: {
                  red: 1.0,
                  green: 0.0,
                  blue: 0.0
                }
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
