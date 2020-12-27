import "google-apps-script";

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

function main() {
  let document = DocumentApp.getActiveDocument();
  moveParagraphsIntoTables(document);
}

function moveParagraphsIntoTables(doc : Document) {
  let body = doc.getBody();
  let paras = body.getParagraphs()
  for (let para of paras) {
    if (para.getText().startsWith("XXX")) {
      let parent = para.getParent();
      if (parent.getType() != DocumentApp.ElementType.BODY_SECTION) {
        console.log("yes. table ones are included as well")
        continue;
      }
      let index = parent.getChildIndex(para);
      para.removeFromParent();
      let table = body.insertTable(index);
      let cell = table.appendTableRow().appendTableCell()
      cell.appendParagraph(para);
      // Remove the automatically inserted empty paragraph.
      cell.removeChild(para.getPreviousSibling());
      cell.setBackgroundColor("#ffecec");
      console.log(cell.getBackgroundColor());
    }
  }
}
