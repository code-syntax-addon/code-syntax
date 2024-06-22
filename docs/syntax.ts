/**
 * @OnlyCurrentDoc
 */
// Copyright (C) 2020 Florian Loitsch. All rights reserved.

import "google-apps-script";
import * as theme from "../theme/theme";
declare var codemirror;

// If another 3rd party library is used, concatenate the license here.
var thirdPartyLicenses = "CodeMirror" + codemirror.license;

import docs = GoogleAppsScript.Document;

function onInstall(e) {
  onOpen(e);
}

function modeToValidIdentifier(mode : string) : string {
  if (mode == "c++") return "cpp";
  if (mode == "c#") return "c_sharp"
  return mode.replace(/[^a-zA-Z]/g, "_")
}
function changeColorNameFor(mode : string) : string {
  return "changeColorTo_" + modeToValidIdentifier(mode);
}

function colorizeSelectionNameFor(mode : string) : string{
  return "colorizeSelectionAs_" + modeToValidIdentifier(mode);
}

function onOpen(e) {
  let ui = DocumentApp.getUi();
  let menu = ui.createAddonMenu();
  menu.addItem("Colorize", "colorize");
  let subSelection = ui.createMenu("Colorize Selection as")
  let subMode = ui.createMenu("Change Mode to");
  for (let mode of theme.themer.getModeList()) {
    // There is no way to pass a parameter from the menu to a function.
    // We therefore dynamically create individual functions that can be used
    // as targets. (See below for the actual creation of the functions.)
    subSelection.addItem(mode, colorizeSelectionNameFor(mode))
    subMode.addItem(mode, changeColorNameFor(mode))
  }
  menu.addSubMenu(subSelection);
  menu.addSubMenu(subMode);
  menu.addItem("License", "showLicense");
  menu.addToUi();
}

function showLicense() {
  let str = "This project is made possible by open source software:\n"
  str += "\n"
  str += thirdPartyLicenses
  let ui = DocumentApp.getUi();
  ui.alert(str);
}

type Document = docs.Document;
type Body = docs.Body;
type Container = docs.ContainerElement;
type Paragraph = docs.Paragraph;
type Element = docs.Element;
type Table = docs.Table;
type TableCell = docs.TableCell;
type Text = docs.Text;
type RangeElement = docs.RangeElement;

const MODE_TO_STYLE : Map<string, theme.SegmentStyle> = new Map();
const COLOR_TO_MODE : Map<string, string> = new Map();

for (let mode of theme.themer.getModeList()) {
  let segmentStyle = theme.themer.getSegmentStyle(mode);
  let color = segmentStyle.background;
  // We don't want to deal with different casing later on.
  COLOR_TO_MODE.set(color.toLowerCase(), mode);
  COLOR_TO_MODE.set(color.toUpperCase(), mode);
  MODE_TO_STYLE.set(mode, segmentStyle);
  // There is no way to pass a parameter from the menu to a function.
  // We therefore dynamically create individual functions that can be used
  // as targets.
  let self : any = this;
  self[changeColorNameFor(mode)] = function() {
    changeColorTo(mode);
  }
  self[colorizeSelectionNameFor(mode)] = function() {
    colorizeSelectionAs(mode);
  }
}

function changeColorTo(mode : string) {
  const cursor = DocumentApp.getActiveDocument().getCursor();
  let element: Element | null = null;
  if (cursor != null) {
    element = cursor.getElement();
  } else {
    const selection = DocumentApp.getActiveDocument().getSelection();
    if (selection != null) {
      const rangeElements = selection.getRangeElements();
      if (rangeElements.length == 1) {
        element = rangeElements[0].getElement();
      }
    }
  }
  if (element == null) {
    return;
  }
  while (element && element.getType() !== DocumentApp.ElementType.TABLE) {
    element = element.getParent();
  }
  if (!element) return;
  let table = element.asTable();
  if (!isCodeTable(table)) return;
  let segment = codeSegmentFromCodeTable(table);
  segment.mode = mode;
  let segments = [segment];
  boxSegments(segments);
  highlightSegments(segments);
}

class CodeSegment {
  // Once this code segment is boxed, this field points to the surrounding
  // table cell.
  cell : TableCell | undefined = undefined;
  mode : string;
  paragraphs : Array<Paragraph>;

  constructor(paragraphs : Array<Paragraph>, mode : string) {
    this.paragraphs = paragraphs;
    this.mode = mode;
  }
}

function colorize() {
  let document = DocumentApp.getActiveDocument();
  let codeSegments = findCodeSegments(document.getBody());
  // Highlight code spans before we filter out the unknown code segments.
  // We don't want to modify unknown segments at all.
  highlightCodeSpansAndHeadings(codeSegments);

  // Filter out segments where we don't know the mode.
  // Otherwise we would remove the mode line, without giving the user a chance
  // to fix it.
  codeSegments = codeSegments.filter(function(segment) {
    return MODE_TO_STYLE.has(segment.mode);
  });
  boxSegments(codeSegments);
  highlightSegments(codeSegments);
}

function colorizeSelectionAs(mode : string) {
  let selection = DocumentApp.getActiveDocument().getSelection();
  if (selection == null) return;
  let rangeElements = selection.getRangeElements();
  let lines : Array<string> = []
  let texts : Array<Array<any>> = []

  let codeMirrorStyle = MODE_TO_STYLE.get(mode)!;

  for (let rangeElement of rangeElements) {
    let element = rangeElement.getElement();
    let type = element.getType();
    if (type == DocumentApp.ElementType.LIST_ITEM) {
      element = element.asListItem().editAsText();
      type = DocumentApp.ElementType.TEXT;
    } else if (type == DocumentApp.ElementType.PARAGRAPH) {
      element = element.asParagraph().editAsText()
      type = DocumentApp.ElementType.TEXT;
    }
    if (type == DocumentApp.ElementType.TEXT) {
      let text = element.asText();
      let content : string;
      let from : number;
      let length : number;
      if (rangeElement.isPartial()) {
        from = rangeElement.getStartOffset();
        length = rangeElement.getEndOffsetInclusive() + 1 - from
        content = text.getText().substring(from, from + length);
      } else {
        from = 0
        content = text.getText();
        length = content.length;
      }
      if (length == 0) continue;

      let to = from + length - 1;
      let defaultStyle = codeMirrorStyle.defaultStyle;
      let fontFamily = defaultStyle.fontFamily;
      if (fontFamily) text.setFontFamily(from, to, fontFamily);
      let foreground = defaultStyle.foreground;
      if (foreground) text.setForegroundColor(from, to, foreground);
      let background = defaultStyle.background;
      if (background) text.setBackgroundColor(from, to, background);
      if (defaultStyle.bold !== undefined) text.setBold(from, to, defaultStyle.bold);
      if (defaultStyle.italic !== undefined) text.setItalic(from, to, defaultStyle.italic);
      let elementLines = content.split("\r");
      let offset = from;
      for (let line of elementLines) {
        lines.push(line);
        texts.push([text, offset]);
        offset += line.length + 1;
      }
    }
  }
  let lineIndex = 0;
  let lineOffset = 0;
  codemirror.runMode(lines, codeMirrorStyle.codeMirrorMode, function(token : string, style : string) {
    if (token == "\n") {
      lineIndex++;
      lineOffset = 0;
      return;
    }
    let current = texts[lineIndex];
    let text = current[0];
    let offset = current[1];
    applyCodeMirrorStyle(codeMirrorStyle, text, offset + lineOffset, token, style)
    lineOffset += token.length;
  });
}

let defaultWidth : number | null = null;

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

// A code table has exactly one cell with a background color.
function isCodeTable(table : Table) : boolean {
  if (table.getNumRows() != 1 || table.getRow(0).getNumCells() != 1) return false;
  let cell = table.getCell(0, 0);
  if (!cell.getBackgroundColor()) return false;  // Must have some color, but we don't check whether it's a valid one.
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
  let backColor = cell.getBackgroundColor();
  let mode = COLOR_TO_MODE.get(backColor) || "<unknown>";
  let codeSegment = new CodeSegment(paras, mode);
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
  let accumulated : Array<Paragraph> | null = [];
  let currentMode = "";

  function startCodeSegment(mode : string) {
    currentMode = mode;
    accumulated = [];
    inCodeSegment = true;
  }

  function finishCodeSegment() {
    result.push(new CodeSegment(accumulated!, currentMode));
    inCodeSegment = false;
    accumulated = null;
  }

  function abortCodeSegment() {
    // Unfinished/aborted code segments are closed, but not modified.
    // By setting an unknown mode, we won't touch it.
    result.push(new CodeSegment(accumulated!, "<aborted>"));
    inCodeSegment = false;
    accumulated = null;
  }

  for (let i = 0; i < container.getNumChildren(); i++) {
    let element = container.getChild(i);
    if (inCodeSegment && element.getType() != DocumentApp.ElementType.PARAGRAPH) {
      abortCodeSegment();
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
    let text = paragraph.getText()
    if (text === "```" || text.startsWith("```\r") || text.startsWith("``` ")) {
      if (!inCodeSegment) {
        let modeLine = text.split("\r")[0].trim();
        if (modeLine == "```") modeLine += " "
        let mode = modeLine.substring("``` ".length);
        if (mode === "") mode = "none";
        startCodeSegment(mode);
      } else {
        accumulated.push(paragraph);
        finishCodeSegment();
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
  if (inCodeSegment) {
    abortCodeSegment();
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

  let minStart : number | null = 999999;

  for (let para of paras) {
    let start = para.getIndentStart();
    if (start === null) minStart = null;
    if (minStart !== null && start < minStart) minStart = start;
  }

  // We need to be careful here: if the code segment is the last entry in a
  // document, then we are not allowed to remove the last paragraph. There
  // must always be a paragraph at the end.
  let lastIndex = parent.getChildIndex(paras[paras.length - 1]);
  if (parent.getType() == DocumentApp.ElementType.BODY_SECTION &&
      lastIndex == parent.getNumChildren() - 1) {
    // This is the last entry, and we are going to replace the paragraphs
    // with a table. We thus need to add a new paragraph, just to make sure
    // there is always a paragraph at the end.
    parent.asBody().appendParagraph("");
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

    let style = MODE_TO_STYLE.get(segment.mode)!;
    segment.cell.setBackgroundColor(style.background);
    segment.cell.getParentTable().setBorderColor("#e0e0e0");
    segment.cell.setPaddingTop(10);
    segment.cell.setPaddingBottom(10);
    segment.cell.setPaddingLeft(10);
    segment.cell.setPaddingRight(10);
    let defaultStyle = style.defaultStyle;
    for (let para of segment.paragraphs) {
      let text = para.editAsText();
      if (defaultStyle.foreground) text.setForegroundColor(defaultStyle.foreground);
      if (defaultStyle.background) text.setBackgroundColor(defaultStyle.background);
      if (defaultStyle.fontFamily) text.setFontFamily(defaultStyle.fontFamily);
      if (defaultStyle.bold !== undefined) text.setBold(defaultStyle.bold);
      if (defaultStyle.italic !== undefined) text.setItalic(defaultStyle.italic);
    }
  }
}

function applyCodeMirrorStyle(segmentStyle : theme.SegmentStyle, text : Text, start : number, token : string, cmStyle : string) {
  let style = segmentStyle.codeMirrorStyleToStyle(cmStyle);
  let endInclusive = start + token.length - 1;
  applyStyle(text, start, endInclusive, style);
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
  let segmentStyle = MODE_TO_STYLE.get(segment.mode);
  if (segmentStyle === undefined) return;  // This happens when the user wrote their own code segment.
  codemirror.runMode(lines, segmentStyle.codeMirrorMode, function(token, style) {
    let current = paras[current_index];
    let str = current.getText();
    if (offset === str.length) {
      if (token != "\n" || style !== null) {
        throw "Unexpected token";
      }
      current_index++;
      offset = 0;
      return;
    }
    let text = current.editAsText();
    applyCodeMirrorStyle(segmentStyle, text, offset, token, style);
    offset += token.length;
  });
}

// Assumes that the element is part of the document.
// We don't check that the parent eventually ends up being the document.
function computeElementPath(element : Element) : string {
  let result = "";
  while (true) {
    let parent = element.getParent();
    if (!parent) return result;
    result += ":" + parent.getChildIndex(element);
    element = parent;
  }
}

const HEADINGS = {
  "#": DocumentApp.ParagraphHeading.TITLE,
  "##": DocumentApp.ParagraphHeading.HEADING1,
  "###": DocumentApp.ParagraphHeading.HEADING2,
  "####": DocumentApp.ParagraphHeading.HEADING3,
}

function highlightCodeSpansAndHeadings(segments : Array<CodeSegment>) {
  let inCodeSegments = new Set<string>();

  // Mark the paragraphs that are inside a code segment, so we don't change
  // them.
  for (let segment of segments) {
    for (let para of segment.paragraphs) {
      inCodeSegments.add(computeElementPath(para));
    }
  }

  // We don't change the headings right away, as this would change the paths
  // of the paragraphs.
  // Instead we record the changes we would like to do, and then do them
  // once we have run through all paragraphs.
  let headingsToChange : Array<any> = [];
  for (let para of DocumentApp.getActiveDocument().getBody().getParagraphs()) {
    if (inCodeSegments.has(computeElementPath(para))) {
      continue;
    }
    let text = para.getText();
    // We go from back to front, so that we can remove the ticks without needing to worry
    // about the fact that we modify the paragraph in the meantime.
    let lastTick = text.length + 1;
    while (lastTick > 1) {  // We need at least two characters.
      let endTick = text.lastIndexOf("`", lastTick - 1);
      if (endTick === -1) break;
      let startTick = text.lastIndexOf("`", endTick - 1);
      if (startTick === -1) break;  // We don't support backticks that span multiple paragraphs.
      if (startTick + 1 === endTick) {
        // If we have two backticks next to each other, just consume all backticks that are
        // there without doing anything.
        // This makes ``` in a text less dangerous.
        let i = startTick - 1;
        while (i >= 0 && text[i] === '`') i--;
        lastTick = i + 1;
        continue;
      }
      highlightCodeSpan(para, startTick, endTick);
      lastTick = startTick;
    }
    for (let heading of Object.keys(HEADINGS)) {
      if (text.startsWith(heading + " ")) {
        headingsToChange.push({
          para: para,
          heading: heading,
        })
        break;
      }
    }
  }
  // Now we can change the paragraphs to headings without worrying about
  // their paths.
  for (let headingToChange of headingsToChange) {
    let para = headingToChange.para;
    let heading = headingToChange.heading;

    para.setHeading(HEADINGS[heading]);
    // `deleteText` is inclusive, so no need for +1 for the space.
    para.editAsText().deleteText(0, heading.length);
    // If the previous sibling is just an empty paragraph, then we remove it.
    // The new heading adds spacing by itself.
    let sibling = para.getPreviousSibling();
    if (sibling) {
      if (sibling.getType() === DocumentApp.ElementType.PARAGRAPH &&
          sibling.asParagraph().getText() == "") {
        sibling.removeFromParent();
      }
    }
  }
}

function highlightCodeSpan(para : Paragraph, startTick : number, endTick : number) {
  let text = para.editAsText();
  let str = para.getText().substring(startTick + 1, endTick);
  let style = theme.themer.getCodeSpanStyle(str);
  applyStyle(text, startTick, endTick, style);

  // Delete the end-tick first, as removing the start-tick first, would change the
  // position of the end tick.
  text.deleteText(endTick, endTick);
  text.deleteText(startTick, startTick);
}

function applyStyle(text : docs.Text, start : number, endInclusive : number, style : theme.Style) {
  if (!style) {
    // Shouldn't happen with the current theme, but we treat this
    // as "don't change anything".
    return;
  }
  if (style.fontFamily) text.setFontFamily(start, endInclusive, style.fontFamily);
  if (style.foreground) text.setForegroundColor(start, endInclusive, style.foreground);
  if (style.background) text.setBackgroundColor(start, endInclusive, style.background);
  if (style.bold !== undefined) text.setBold(start, endInclusive, style.bold);
  if (style.italic !== undefined) text.setItalic(start, endInclusive, style.italic);
}
