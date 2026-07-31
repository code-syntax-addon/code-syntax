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
  for (let mode of theme.getModeList()) {
    // There is no way to pass a parameter from the menu to a function.
    // We therefore dynamically create individual functions that can be used
    // as targets. (See below for the actual creation of the functions.)
    subSelection.addItem(mode, colorizeSelectionNameFor(mode))
    subMode.addItem(mode, changeColorNameFor(mode))
  }
  menu.addSubMenu(subSelection);
  menu.addSubMenu(subMode);
  let advanced = ui.createMenu("Advanced");
  advanced.addItem("Show themes", "showThemes");
  advanced.addItem("Set document theme", "setDocumentTheme");
  advanced.addItem("Set user theme", "setUserTheme");
  menu.addSubMenu(advanced);
  menu.addItem("License", "showLicense");
  menu.addToUi();
}

function showThemes() {
  theme.showThemes(
      DocumentApp.getUi(),
      PropertiesService.getDocumentProperties().getProperty(theme.THEME_PROPERTY_KEY),
      PropertiesService.getUserProperties().getProperty(theme.THEME_PROPERTY_KEY)
    );
}

function setDocumentTheme() {
  setTheme("document", PropertiesService.getDocumentProperties());
}

function setUserTheme() {
  setTheme("user", PropertiesService.getUserProperties());
}

function setTheme(type : string, properties : GoogleAppsScript.Properties.Properties) {
  theme.setTheme(DocumentApp.getUi(), type, (newTheme : string) => {
    if (newTheme === "") {
      properties.deleteProperty(theme.THEME_PROPERTY_KEY);
    } else {
      properties.setProperty(theme.THEME_PROPERTY_KEY, newTheme);
    }
  });
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

let MODE_TO_STYLE : Map<string, theme.SegmentStyle> | null = null;
let COLOR_TO_MODE : Map<string, string> | null = null;

let themer : theme.Themer | null = null;

function getThemer() : theme.Themer {
  if (!themer) {
    let documentTheme = PropertiesService.getDocumentProperties().getProperty(theme.THEME_PROPERTY_KEY);
    let userTheme = PropertiesService.getUserProperties().getProperty(theme.THEME_PROPERTY_KEY);
    themer = theme.newThemer(documentTheme, userTheme);
  }
  return themer;
}

function setMaps() {
  if (MODE_TO_STYLE) return;
  COLOR_TO_MODE = new Map<string, string>();
  MODE_TO_STYLE = new Map<string, theme.SegmentStyle>();
  let themer = getThemer();
  for (let mode of theme.getModeList()) {
    let segmentStyle = themer.getSegmentStyle(mode);
    let color = segmentStyle.background;
    // We don't want to deal with different casing later on.
    COLOR_TO_MODE.set(color.toLowerCase(), mode);
    COLOR_TO_MODE.set(color.toUpperCase(), mode);
    MODE_TO_STYLE.set(mode, segmentStyle);
  }
}

function getModeToStyle() : Map<string, theme.SegmentStyle> {
  setMaps();
  return MODE_TO_STYLE!;
}

function getColorToMode() : Map<string, string> {
  setMaps();
  return COLOR_TO_MODE!;
}

function getActiveSelection() : docs.Range | null {
  const retryDelays = [100, 300];
  for (let attempt = 0; ; attempt++) {
    try {
      return DocumentApp.getActiveDocument().getSelection();
    } catch (e) {
      if (attempt >= retryDelays.length) throw e;
      Utilities.sleep(retryDelays[attempt]);
    }
  }
}

for (let mode of theme.getModeList()) {
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
    const selection = getActiveSelection();
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
  let paragraphs : Array<Paragraph> = [];
  let codeSegments = findCodeSegments(document.getBody(), paragraphs);
  // Highlight code spans before we filter out the unknown code segments.
  // We don't want to modify unknown segments at all.
  highlightCodeSpansAndHeadings(codeSegments, paragraphs);

  // Filter out segments where we don't know the mode.
  // Otherwise we would remove the mode line, without giving the user a chance
  // to fix it.
  codeSegments = codeSegments.filter(function(segment) {
    return getModeToStyle().has(segment.mode);
  });
  boxSegments(codeSegments);
  highlightSegments(codeSegments);
}

function colorizeSelectionAs(mode : string) {
  let selection = getActiveSelection();
  if (selection == null) return;
  let rangeElements = selection.getRangeElements();
  let lines : Array<string> = []
  let texts : Array<{text : Text, offset : number}> = []
  let runs : Array<TextStyleRun> = [];

  let codeMirrorStyle = getModeToStyle().get(mode)!;

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
      applyStyle(text, from, to, codeMirrorStyle.defaultStyle);
      let elementLines = content.split("\r");
      let offset = from;
      for (let line of elementLines) {
        lines.push(line);
        texts.push({text: text, offset: offset});
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
    appendTextStyleRun(
        runs,
        current.text,
        current.offset + lineOffset,
        token.length,
        codeMirrorStyle.codeMirrorStyleToStyleDelta(style));
    lineOffset += token.length;
  });
  applyTextStyleRuns(runs);
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
  let mode = getColorToMode().get(backColor) || "<unknown>";
  let codeSegment = new CodeSegment(paras, mode);
  codeSegment.cell = cell;
  return codeSegment;
}

function findCodeSegmentsInTable(table : Table, paragraphs : Array<Paragraph>) : Array<CodeSegment> {
  let result : Array<CodeSegment> = [];
  for (let i = 0; i < table.getNumRows(); i++) {
    let row = table.getRow(i);
    for (let j = 0; j < row.getNumCells(); j++) {
      let cell = row.getCell(j);
      let segments = findCodeSegments(cell, paragraphs);
      result.push(...segments);
    }
  }
  return result;
}

function findCodeSegments(container : Body | TableCell, paragraphs : Array<Paragraph>) : Array<CodeSegment> {
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
        let segment = codeSegmentFromCodeTable(table);
        result.push(segment);
        paragraphs.push(...segment.paragraphs);
      } else {
        let nested = findCodeSegmentsInTable(element.asTable(), paragraphs);
        result.push(...nested);
      }
    }
    if (element.getType() != DocumentApp.ElementType.PARAGRAPH) continue;

    let paragraph = element.asParagraph();
    paragraphs.push(paragraph);
    let text = paragraph.getText()
    if (text.startsWith("```")) {
      if (!inCodeSegment) {
        let modeLine = text.split("\r")[0].trim();
        let mode = modeLine.substring("```".length).trim();
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

  let movedParagraphs : Array<Paragraph> = [];
  for (let para of paras) {
    let indentStart = para.getIndentStart();
    let indentFirstLine = para.getIndentFirstLine();
    para.removeFromParent();
    let movedParagraph = cell.appendParagraph(para);
    movedParagraphs.push(movedParagraph);
    if (minStart !== null) {
      // Remove the indentation. We will indent the table instead.
      movedParagraph.setIndentStart(indentStart - minStart);
      movedParagraph.setIndentFirstLine(indentFirstLine - minStart);
    }
    // No need to change the right indentation, since it's absolute and
    // thus works in the table.
  }

  // Remove the automatically inserted empty paragraph.
  cell.removeChild(cell.getChild(0));
  segment.paragraphs = movedParagraphs;

  if (minStart !== null && minStart !== 0) {
    // We can't change the indentation of tables in Google Apps Script.
    // As a work-around we create another invisible table. It's an ugly hack, but
    //   unfortunately seems to be the only way.
    let indentTable = insertTableAt(parent, index);
    let indentAttributes : any = {};
    indentAttributes[DocumentApp.Attribute.BORDER_WIDTH] = 0;
    indentTable.setAttributes(indentAttributes);

    let row = indentTable.appendTableRow();
    row.appendTableCell().setWidth(minStart);
    let secondCell = row.appendTableCell();
    let secondCellAttributes : any = {};
    secondCellAttributes[DocumentApp.Attribute.PADDING_TOP] = 0;
    secondCellAttributes[DocumentApp.Attribute.PADDING_BOTTOM] = 0;
    secondCellAttributes[DocumentApp.Attribute.PADDING_LEFT] = 0;
    secondCellAttributes[DocumentApp.Attribute.PADDING_RIGHT] = 0;
    secondCell.setAttributes(secondCellAttributes);
    secondCell.setWidth(computeDefaultWidth() - minStart - 2);
    table.removeFromParent();
    table = secondCell.appendTable(table);
    // appendTable inserts a copy. Keep references to the elements that are
    // actually attached to the document.
    cell = table.getCell(0, 0);
    segment.cell = cell;
    segment.paragraphs = [];
    for (let i = 0; i < cell.getNumChildren(); i++) {
      segment.paragraphs.push(cell.getChild(i).asParagraph());
    }
    // Tables seem to require a lines around a table. Add a second one and change
    // their size to 0.
    secondCell.appendParagraph("");
    secondCell.getChild(0).asParagraph().editAsText().setFontSize(0);
    secondCell.getChild(2).asParagraph().editAsText().setFontSize(0);
  }
}

function hasBacktickDelimiters(segment : CodeSegment) : boolean {
  let paragraphs = segment.paragraphs;
  if (paragraphs.length == 0) return false;
  let first = paragraphs[0];
  let firstText = first.getText();
  if (!firstText.startsWith("```")) return false;
  let last = paragraphs[paragraphs.length - 1]
  let lastText = last.getText();
  let lineBreak = lastText.lastIndexOf("\r");
  if (lineBreak != -1) {
    return lastText.substring(lineBreak + 1, lineBreak + 4) == "```";
  }
  // A segment contained in one paragraph needs separate opening and closing
  // lines. Otherwise this is only an opening delimiter.
  if (first === last) return false;
  return lastText.startsWith("```");
}

function removeBackticks(segment : CodeSegment) {
  // The document may have changed since findCodeSegments ran.
  if (!hasBacktickDelimiters(segment)) return;

  let paragraphs = segment.paragraphs;
  let first = paragraphs[0];
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
    last.editAsText().deleteText(lineBreak, lastText.length - 1);  // deleteText is inclusive.
  } else {
    last.removeFromParent();
    paragraphs.length--;
  }
  // If we removed all paragraphs, add a fresh one, as Google Docs will otherwise
  // add one anyway, and we won't change the styling of that one.
  if (paragraphs.length == 0) {
    let para = segment.cell!.appendParagraph("");
    segment.paragraphs = [para];
  }
}

function boxSegments(segments : Array<CodeSegment>) {
  for (let segment of segments) {
    if (!segment.cell) {
      // The document may have changed since findCodeSegments ran. Do not
      // restructure a segment unless both delimiters are still present.
      if (!hasBacktickDelimiters(segment)) continue;
      moveParagraphsIntoTables(segment);
      // By removing the backticks, we might remove all paragraphs of it.
      removeBackticks(segment);
    }

    let style = getModeToStyle().get(segment.mode)!;
    let cell = segment.cell!;
    let cellAttributes : any = {};
    cellAttributes[DocumentApp.Attribute.BACKGROUND_COLOR] = style.background;
    cellAttributes[DocumentApp.Attribute.PADDING_TOP] = 10;
    cellAttributes[DocumentApp.Attribute.PADDING_BOTTOM] = 10;
    cellAttributes[DocumentApp.Attribute.PADDING_LEFT] = 10;
    cellAttributes[DocumentApp.Attribute.PADDING_RIGHT] = 10;
    cell.setAttributes(cellAttributes);
    cell.getParentTable().setBorderColor("#e0e0e0");
    let defaultStyle = style.defaultStyle;
    for (let para of segment.paragraphs) {
      applyStyleToWholeText(para.editAsText(), defaultStyle);
    }
  }
}

type TextStyleRun = {
  text : Text,
  start : number,
  endInclusive : number,
  style : theme.Style,
  key : string,
};

function styleKey(style : theme.Style) : string {
  let values : Array<any> = [];
  if (style.fontFamily) values.push("fontFamily", style.fontFamily);
  if (style.foreground) values.push("foreground", style.foreground);
  if (style.background) values.push("background", style.background);
  if (style.bold !== undefined) values.push("bold", style.bold);
  if (style.italic !== undefined) values.push("italic", style.italic);
  return JSON.stringify(values);
}

function appendTextStyleRun(
    runs : Array<TextStyleRun>,
    text : Text,
    start : number,
    length : number,
    style : theme.Style) {
  if (length == 0) return;
  let key = styleKey(style);
  if (key == "[]") return;
  let previous = runs.length == 0 ? null : runs[runs.length - 1];
  if (previous &&
      previous.text === text &&
      previous.endInclusive + 1 == start &&
      previous.key == key) {
    previous.endInclusive += length;
    return;
  }
  runs.push({
    text: text,
    start: start,
    endInclusive: start + length - 1,
    style: style,
    key: key,
  });
}

function applyTextStyleRuns(runs : Array<TextStyleRun>) {
  for (let run of runs) {
    applyStyle(run.text, run.start, run.endInclusive, run.style);
  }
}

function highlightSegments(segments : Array<CodeSegment>) {
  for (let segment of segments) highlightSegment(segment);
}

function highlightSegment(segment : CodeSegment) {
  let paras = segment.paragraphs;
  let lines : Array<string> = [];
  let texts : Array<{text : Text, offset : number}> = [];
  for (let para of paras) {
    let content = para.getText();
    let text = para.editAsText();
    let offset = 0;
    for (let line of content.split("\r")) {
      lines.push(line);
      texts.push({text: text, offset: offset});
      offset += line.length + 1;
    }
  }
  let lineIndex = 0;
  let lineOffset = 0;
  let runs : Array<TextStyleRun> = [];
  let segmentStyle = getModeToStyle().get(segment.mode);
  if (segmentStyle === undefined) return;  // This happens when the user wrote their own code segment.
  codemirror.runMode(lines, segmentStyle.codeMirrorMode, function(token, style) {
    if (token == "\n") {
      lineIndex++;
      lineOffset = 0;
      return;
    }
    let current = texts[lineIndex];
    appendTextStyleRun(
        runs,
        current.text,
        current.offset + lineOffset,
        token.length,
        segmentStyle!.codeMirrorStyleToStyleDelta(style));
    lineOffset += token.length;
  });
  applyTextStyleRuns(runs);
}

const HEADINGS = {
  "#": DocumentApp.ParagraphHeading.TITLE,
  "##": DocumentApp.ParagraphHeading.HEADING1,
  "###": DocumentApp.ParagraphHeading.HEADING2,
  "####": DocumentApp.ParagraphHeading.HEADING3,
}

function highlightCodeSpansAndHeadings(
    segments : Array<CodeSegment>, paragraphs : Array<Paragraph>) {
  let inCodeSegments = new Set<Paragraph>();

  // Mark the paragraphs that are inside a code segment, so we don't change
  // them.
  for (let segment of segments) {
    for (let para of segment.paragraphs) {
      inCodeSegments.add(para);
    }
  }

  // Record heading changes and apply them after scanning every paragraph.
  let headingsToChange : Array<any> = [];
  for (let para of paragraphs) {
    if (inCodeSegments.has(para)) {
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
  let currentText = text.getText();
  if (startTick < 0 ||
      endTick >= currentText.length ||
      currentText.charAt(startTick) != "`" ||
      currentText.charAt(endTick) != "`") {
    // The paragraph changed after its code spans were identified.
    return;
  }
  let str = currentText.substring(startTick + 1, endTick);
  let style = getThemer().getCodeSpanStyle(str);
  applyStyle(text, startTick, endTick, style);

  // Delete the end-tick first, as removing the start-tick first, would change the
  // position of the end tick.
  text.deleteText(endTick, endTick);
  text.deleteText(startTick, startTick);
}

function documentAttributesForStyle(style : theme.Style) : any {
  let attributes : any = {};
  if (style.fontFamily) attributes[DocumentApp.Attribute.FONT_FAMILY] = style.fontFamily;
  if (style.foreground) attributes[DocumentApp.Attribute.FOREGROUND_COLOR] = style.foreground;
  if (style.background) attributes[DocumentApp.Attribute.BACKGROUND_COLOR] = style.background;
  if (style.bold !== undefined) attributes[DocumentApp.Attribute.BOLD] = style.bold;
  if (style.italic !== undefined) attributes[DocumentApp.Attribute.ITALIC] = style.italic;
  return attributes;
}

function applyStyleToWholeText(text : docs.Text, style : theme.Style) {
  let attributes = documentAttributesForStyle(style);
  if (Object.keys(attributes).length == 0) return;
  text.setAttributes(attributes);
}

function applyStyle(text : docs.Text, start : number, endInclusive : number, style : theme.Style) {
  if (start > endInclusive) return;
  let attributes = documentAttributesForStyle(style);
  if (Object.keys(attributes).length == 0) return;
  text.setAttributes(start, endInclusive, attributes);
}
