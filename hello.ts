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

function testy() {
  let document = DocumentApp.getActiveDocument();
  let body = document.getBody();
  let firstLine = body.getText();

  body.appendTable([]);
}

function main() {
  let document = DocumentApp.getActiveDocument();
  setBackgroundColors(document);
}

function setBackgroundColors(document : docs.Document) {
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

  let updates : Array<GoogleAppsScript.Docs.Schema.Request> = []
  for (let paragraph of body.getParagraphs()) {
    let structuredParagraph = nextStructuredParagraph();
    let request = parseParagraph(paragraph, structuredParagraph);
    if (request) updates.push(request);
  }
  if (updates.length != 0) {
    Docs.Documents.batchUpdate({requests: updates}, document.getId());
  }
}

function parseParagraph(paragraph : Paragraph, structuredParagraph : StructuredElement) : GoogleAppsScript.Docs.Schema.Request | undefined {
  if (paragraph.getAttributes()[DocumentApp.Attribute.BACKGROUND_COLOR]) {
    return;
  }
  if (paragraph.getText().startsWith('```')) {
    let request : GoogleAppsScript.Docs.Schema.Request = {
      updateParagraphStyle: {
        range: {
          startIndex: structuredParagraph.startIndex,
          endIndex: structuredParagraph.endIndex,
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
    }
    return request;
  }
  return undefined;
}
