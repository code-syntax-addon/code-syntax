// Requires Resources -> Advanced Google Services -> Docs.
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
            range: { startIndex: 5, endIndex: 6},
            fields: "shading"
          }
        }
       ]
      console.log(requests);
       Docs.Documents.batchUpdate({requests}, document_id);
    }
}
