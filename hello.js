// Compiled using ts2gas 3.4.4 (TypeScript 3.7.4)
var exports = exports || {};
var module = module || { exports: exports };
//import "google-apps-script";
//import docs = GoogleAppsScript.Document;
function testy() {
    var document = DocumentApp.getActiveDocument();
    var body = document.getBody();
    var firstLine = body.getText();
    body.appendTable([]);
}

function main() {
    var document = DocumentApp.getActiveDocument();
    parseBody(document.getBody());
  
}
function parseBody(body) {
    for (var _i = 0, _a = body.getParagraphs(); _i < _a.length; _i++) {
        var paragraph = _a[_i];
      console.log("foo".startsWith("f"));
      console.log("text: " + typeof paragraph.getText());
        parseParagraph(paragraph);
    }
}
function parseParagraph(paragraph) {
    if (paragraph.getAttributes()[DocumentApp.Attribute.BACKGROUND_COLOR]) {
        return;
    }
    var document = DocumentApp.getActiveDocument();
    var document_id = document.getId();
  var range = document.newRange().addElement(paragraph).build();
    if (paragraph.getText().startsWith('```')) {
      var requests = [
        {
          updateParagraphStyle: {
            paragraphStyle: {
              shading: {
                backgroundColor: {
                  "color": {
                    "rgbColor":
                    {
                      "red": 1.0,
                      "green": 0.0,
                      "blue": 0.0,
                    }
                  }
                }
              }
            },
            range: { startIndex: range, endIndex: id + 1},
            fields: "shading"
          }
        }
       ]
      console.log(requests);
       Docs.Documents.batchUpdate({requests}, document_id);
    }
}
