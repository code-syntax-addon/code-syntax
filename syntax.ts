// Copyright (C) 2020 Florian Loitsch. All rights reserved.

import "google-apps-script";

import docs = GoogleAppsScript.Document;

declare var codemirror;

type Document = docs.Document;
type Body = docs.Body;
type Container = docs.ContainerElement;
type Paragraph = docs.Paragraph;
type Element = docs.Element;
type Table = docs.Table;
type TableCell = docs.TableCell;
type Text = docs.Text;

const CODE_COLOR = "#ffecec"

class CodeSegment {
  // Once this code segment is boxed, this field points to the surrounding
  // table cell.
  cell : TableCell | undefined = undefined

  paragraphs : Array<Paragraph>;
  constructor(paragraphs : Array<Paragraph>) {
    this.paragraphs = paragraphs;
  }
}

function main() {
  let document = DocumentApp.getActiveDocument();
  let codeSegments = findCodeSegments(document.getBody());
  boxSegments(codeSegments);
  highlightSegments(codeSegments);
}

let defaultWidth = null;

// Returns the default width of a paragraph.
// Only works for elements that aren't nested.
function computeDefaultWidth() : number {
  if (defaultWidth === null) {
    let document = DocumentApp.getActiveDocument();
    let body = document.getBody();
    defaultWidth = body.getPageWidth() - body.getMarginLeft() - body.getMarginRight();
  }
  return defaultWidth;
}

function isCodeTable(table : Table) : boolean {
  if (table.getNumRows() != 1 || table.getRow(0).getNumCells() != 1) return false;
  let cell = table.getCell(0, 0);
  if (cell.getBackgroundColor() != CODE_COLOR) return false;
  for (let i = 0; i < cell.getNumChildren(); i++) {
    if (cell.getChild(i).getType() != DocumentApp.ElementType.PARAGRAPH) return false;
  }
  return true;
}

function codeSegmentFromCodeTable(table : Table) : CodeSegment {
  let paras : Array<Paragraph> = [];
  let cell = table.getCell(0, 0);
  for (let i = 0; i < cell.getNumChildren(); i++) {
    let para = cell.getChild(i).asParagraph();
    if (para === undefined) throw "Must be paragraph";
    paras.push(para);
  }
  let codeSegment = new CodeSegment(paras);
  codeSegment.cell = cell;
  return codeSegment;
}

function findCodeSegmentsInTable(table : Table) : Array<CodeSegment> {
  let result : Array<CodeSegment> = [];
  for (let i = 0; i < table.getNumRows(); i++) {
    let row = table.getRow(i);
    for (let j = 0; j < row.getNumCells(); j++) {
      let cell = row.getCell(j);
      let segments = findCodeSegments(cell);
      result.push(...segments);
    }
  }
  return result;
}

function findCodeSegments(container : Body | TableCell) : Array<CodeSegment> {
  let result : Array<CodeSegment> = []
  let inCodeSegment = false;
  let accumulated : Array<Paragraph> = [];

  function finishCodeSegment() {
    result.push(new CodeSegment(accumulated));
    accumulated = [];
    inCodeSegment = false;
  }

  for (let i = 0; i < container.getNumChildren(); i++) {
    let element = container.getChild(i);
    if (inCodeSegment && element.getType() != DocumentApp.ElementType.PARAGRAPH) {
      finishCodeSegment();
    }
    if (element.getType() == DocumentApp.ElementType.TABLE) {
      let table = element.asTable();
      if (isCodeTable(table)) {
        result.push(codeSegmentFromCodeTable(table));
      } else {
        let nested = findCodeSegmentsInTable(element.asTable());
        result.push(...nested);
      }
    }
    if (element.getType() != DocumentApp.ElementType.PARAGRAPH) continue;

    let paragraph = element.asParagraph();
    // Color wins over text.

    let text = paragraph.getText()
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

function insertTableAt(parent : Element, index : number) : Table {
  if (parent.getType() == DocumentApp.ElementType.BODY_SECTION) {
    return parent.asBody().insertTable(index);
  }
  if (parent.getType() == DocumentApp.ElementType.TABLE_CELL) {
    return parent.asTableCell().insertTable(index);
  }
  // This should not happen.
  // Let's just assume there is an insert-table.
  return (parent as any).insertTable(index);
}

function moveParagraphsIntoTables(segment : CodeSegment) {
  let paras = segment.paragraphs;
  let firstParagraph = paras[0];
  let parent = firstParagraph.getParent();
  let index = parent.getChildIndex(firstParagraph);
  let table = insertTableAt(parent, index);
  let cell = table.appendTableRow().appendTableCell()
  segment.cell = cell;

  let minStart = 999999;

  for (let para of paras) {
    let start = para.getIndentStart();
    if (start === null) minStart = null;
    if (minStart !== null && start < minStart) minStart = start;
  }

  for (let para of paras) {
    para.removeFromParent();
    cell.appendParagraph(para);
    if (minStart !== null) {
      // Remove the indentation. We will indent the table instead.
      para.setIndentStart(para.getIndentStart() - minStart);
      para.setIndentFirstLine(para.getIndentFirstLine() - minStart);
    }
    // No need to change the right indentation, since it's absolute and
    // thus works in the table.
  }

  // Remove the automatically inserted empty paragraph.
  cell.removeChild(cell.getChild(0));

  if (minStart !== null && minStart !== 0) {
    // We can't change the indentation of tables in Google Apps Script.
    // As a work-around we create another invisible table. It's an ugly hack, but
    //   unfortunately seems to be the only way.
    let indentTable = insertTableAt(parent, index);
    let attributes = indentTable.getAttributes();
    attributes["BORDER_WIDTH"] = 0;
    indentTable.setAttributes(attributes);

    let row = indentTable.appendTableRow();
    row.appendTableCell().setWidth(minStart);
    let secondCell = row.appendTableCell();
    secondCell
        .setPaddingTop(0)
        .setPaddingBottom(0)
        .setPaddingLeft(0)
        .setPaddingRight(0);
    secondCell.setWidth(computeDefaultWidth() - minStart - 2);
    table.removeFromParent();
    secondCell.appendTable(table);
    // Tables seem to require a lines around a table. Add a second one and change
    // their size to 0.
    secondCell.appendParagraph("");
    secondCell.getChild(0).asParagraph().editAsText().setFontSize(0);
    secondCell.getChild(2).asParagraph().editAsText().setFontSize(0);
  }
}

function removeBackticks(segment : CodeSegment) {
  let paragraphs = segment.paragraphs;
  let first = paragraphs[0];
  if (!first.getText().startsWith("```")) throw "Unexpected code segment";
  let last = paragraphs[paragraphs.length - 1]
  let lineBreak = first.getText().indexOf("\r");
  if (lineBreak != -1) {
    first.editAsText().deleteText(0, lineBreak);  // deleteText is inclusive.
  } else {
    first.removeFromParent();
    paragraphs.shift();
  }
  let lastText = last.getText();
  lineBreak = lastText.lastIndexOf("\r");
  if (lineBreak != -1) {
    if (lastText.substring(lineBreak + 1, lineBreak + 4) != "```") throw "Unexpected code segment";
    last.editAsText().deleteText(lineBreak, lastText.length - 1);  // deleteText is inclusive.
  } else {
    if (!last.getText().startsWith("```")) throw "Unexpected code segment";
    last.removeFromParent();
    paragraphs.length--;
  }
  // If we removed all paragraphs, add a fresh one, as Google Docs will otherwise
  // add one anyway, and we won't change the styling of that one.
  if (paragraphs.length == 0) {
    let para = segment.cell.appendParagraph("");
    segment.paragraphs = [para];
  }
}

function boxSegments(segments : Array<CodeSegment>) {
  for (let segment of segments) {
    if (!segment.cell) {
      moveParagraphsIntoTables(segment);
      // By removing the backticks, we might remove all paragraphs of it.
      removeBackticks(segment);
    }

    segment.cell.setBackgroundColor("#ffecec");
    for (let para of segment.paragraphs) {
      para.editAsText().setFontFamily("Roboto Mono");
    }
  }
}

function applyStyle(text : Text, start : number, token : string, style : string) {
  let endInclusive = start + token.length - 1;
  let bold = undefined;
  let italic = undefined;
  let foreground = undefined;
  if (style !== undefined) {
    switch (style) {
      case "comment":
        italic = true;
        bold = true;
        foreground = "#498bf1";
        break;
      case "def":
        foreground = "#16aa65";
        break;
      case "variable":
        foreground = "#1ab1cd";
        break;
      case "operator":
        foreground = "#ee11ff";
        bold = true;
        break;
      case "type":
        foreground = "#74cce1";
        break;
      case "string":
        foreground = "#1ab1ad";
        break;
      case "number":
        foreground = "#a73d14";
        break;
      case "keyword":
        foreground = "#663344";
        bold = true;
        break;
      case "error":
        foreground = "#ff0c0c";
        break;
    }
  }
  text.setItalic(start, endInclusive, italic);
  text.setBold(start, endInclusive, bold);
  text.setForegroundColor(start, endInclusive, foreground);
}

function highlightSegments(segments : Array<CodeSegment>) {
  for (let segment of segments) highlightSegment(segment);
}

function highlightSegment(segment : CodeSegment) {
  let paras = segment.paragraphs;
  let lines : Array<string> = [];
  for (let para of paras) {
    lines.push(...para.getText().split("\r"));
  }
  let current_index = 0;  // The index of the current paragraph.
  let offset = 0;  // The offset within the paragraph.
  codemirror.runMode(lines, "toit", function(token, style, lineNumber, start) {
    let current = paras[current_index];
    let str = current.getText();
    if (offset == str.length) {
      if (token != "\n" || style !== undefined) {
        throw "Unexpected token";
      }
      current_index++;
      offset = 0;
      return;
    }
    let text = current.editAsText();
    applyStyle(text, offset, token, style);
    offset += token.length;
  });
}
