import "google-apps-script";
import "google-apps-script.api";

import docs = GoogleAppsScript.Document;
type Document = docs.Document;
type Body = docs.Body;
type Paragraph = docs.Paragraph;
type Element = docs.Element;
type Text = docs.Text;

function testy() {
  let document = DocumentApp.getActiveDocument();
  let body = document.getBody();
  let firstLine = body.getText();

  body.appendTable([]);
}

function main() {
  let document = DocumentApp.getActiveDocument();
  parseBody(document.getBody());
}

function parseBody(body : Body) {
  for (let paragraph of body.getParagraphs()) parseParagraph(paragraph);
}

function parseParagraph(paragraph : Paragraph) {
  if (paragraph.getAttributes()[DocumentApp.Attribute.BACKGROUND_COLOR]) {
    return;
  }
  if (paragraph.getText().startsWith('```')) {
    let bg = {}
    bg[DocumentApp.Attribute.BACKGROUND_COLOR] = "#ff0000";
    paragraph.setAttributes(bg);
  }
  let document_id = DocumentApp.getActiveDocument().getId();
  let request : GoogleAppsScript.Docs.Schema.Request = {
    updateParagraphStyle: {
      range: {
        startIndex: 5,
        endIndex: 6,
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
  Docs.Documents.batchUpdate({requests: [request]}, document_id);
}
