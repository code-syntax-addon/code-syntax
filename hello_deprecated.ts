import "google-apps-script";

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
  if (paragraph.getAttributes()[GoogleAppsScript.Document.Attribute.BACKGROUND_COLOR]) {
    return;
  }
  if (paragraph.getText().startsWith('```')) {
    let bg = {}
    bg[docs.Attribute.BACKGROUND_COLOR] = "#ff0000";
    paragraph.setAttributes(bg);
  }
}
