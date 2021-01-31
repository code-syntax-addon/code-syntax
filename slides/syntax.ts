/**
 * @OnlyCurrentDoc
 */
// Copyright (C) 2021 Florian Loitsch. All rights reserved.

import "google-apps-script";
import * as theme from "../theme/theme";
declare var codemirror;

// If another 3rd party library is used, concatenate the license here.
var thirdPartyLicenses = "CodeMirror: " + codemirror.license;

import slides = GoogleAppsScript.Slides;

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
  let ui = SlidesApp.getUi();
  let menu = ui.createAddonMenu();
  menu.addItem("Colorize", "colorize");
  menu.addItem("Colorize Slide", "colorizeSlide");
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
  menu.addItem("License", "showLicense")
  menu.addToUi();
}

function showLicense() {
  let str = "This project is made possible by open source software:\n";
  str += "\n";
  str += thirdPartyLicenses;
  let ui = SlidesApp.getUi();
  ui.alert(str);
}

type Slide = slides.Slide;
type Shape = slides.Shape;
type TextRange = slides.TextRange;
type PageElement = slides.PageElement;

class CodeShape {
  shape : Shape;
  mode : string;

  constructor(shape : Shape, mode : string) {
    this.shape = shape;
    this.mode = mode;
  }

  static fromBoxed(shape : Shape) : CodeShape {
    let background = shape.getFill().getSolidFill();
    let mode = modeFromColor(background.getColor().asRgbColor().asHexString());
    return new CodeShape(shape, mode);
  }

  static fromText(shape : Shape) : CodeShape {
    let str = shape.getText().asString();
    let firstLine = str.substring(0, str.indexOf("\n"));
    let mode = firstLine.substring(3).trim();  // Skip the triple-quotes.
    if (mode === "") mode = "none";
    return new CodeShape(shape, mode);
  }
}

class CodeSpan {
  from : number;
  to : number;

  constructor(from : number, to : number) {
    this.from = from;
    this.to = to;
  }
}

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
  let selection = SlidesApp.getActivePresentation().getSelection();
  let elementRange = selection.getPageElementRange();
  elementRange.getPageElements().forEach(function(pe) {
     changeColorOfPageElement(pe, mode);
  });
}

function colorizeSelectionAs(mode : string) {
  let selection = SlidesApp.getActivePresentation().getSelection();
  let text = selection.getTextRange();
  if (!text) return;
  if (text.isEmpty()) return;
  let textStyle = text.getTextStyle();
  let style = MODE_TO_STYLE.get(mode)
  if (style.fontFamily) textStyle.setFontFamily(style.fontFamily);
  textStyle.setBold(style.bold || false);
  textStyle.setItalic(style.italic || false);
  colorizeText(text, mode)
}

function changeColorOfPageElement(pageElement : PageElement, mode : string) {
  // TODO(florian): deal with groups?
  if (pageElement.getPageElementType() == SlidesApp.PageElementType.SHAPE) {
    let shape = pageElement.asShape();
    if (!isBoxedCodeShape(shape)) return;
    let codeShape = CodeShape.fromBoxed(shape);
    codeShape.mode = mode;
    boxShape(codeShape);  // Applies the color.
    colorizeCodeShape(codeShape);
  } else if (pageElement.getPageElementType() == SlidesApp.PageElementType.GROUP) {
    pageElement.asGroup().getChildren().forEach(function(pe) {
      changeColorOfPageElement(pe, mode);
    });
  }
}

function colorize() {
  let pres = SlidesApp.getActivePresentation();
  pres.getSlides().forEach(doSlide);
}

function colorizeSlide() {
  let selection = SlidesApp.getActivePresentation().getSelection();
  let currentPage = selection.getCurrentPage();
  if (currentPage.getPageType() != SlidesApp.PageType.SLIDE) return;
  let slide = currentPage.asSlide();
  doSlide(slide);
}

function doSlide(slide : Slide) {
  slide.getPageElements().forEach(doPageElement);
}

function doPageElement(element : PageElement) {
  if (element.getPageElementType() == SlidesApp.PageElementType.SHAPE) {
    doShape(element.asShape());
  } else if (element.getPageElementType() == SlidesApp.PageElementType.GROUP) {
    let group = element.asGroup();
    let children = group.getChildren()
    children.forEach(doPageElement);
  }
}

function doShape(shape : Shape) {
  let codeShape : CodeShape;
  if (isBoxedCodeShape(shape)) {
    codeShape = CodeShape.fromBoxed(shape);
    colorizeCodeShape(codeShape);
  } else if (isTextCodeShape(shape)) {
    codeShape = CodeShape.fromText(shape);
    if (!MODE_TO_STYLE.has(codeShape.mode)) return
    // Box first, as this makes it easier to apply text styles.
    // GAS doesn't like it when there is no text.
    boxShape(codeShape);
    removeTripleBackticks(codeShape);
    colorizeCodeShape(codeShape);
  } else {
    colorizeSpans(shape);
  }
}

function modeFromColor(color : string) : string {
  return COLOR_TO_MODE.get(color) || "<unknown>";
}

function isBoxedCodeShape(shape : Shape) : boolean {
  if (shape.getShapeType() != SlidesApp.ShapeType.TEXT_BOX) return false;
  // If the text box has some background color we assume it's a
  // code shape. We will skip it, if it doesn't have a color we
  // recognize.
  return shape.getFill().getSolidFill() && true;
}

function isTextCodeShape(shape : Shape) : boolean {
  if (shape.getShapeType() != SlidesApp.ShapeType.TEXT_BOX) return false;
  let str = shape.getText().asString();
  return str.startsWith("```") &&
      (str.endsWith("\n```") || str.endsWith("\n```\n"));
}

function boxShape(codeShape : CodeShape) {
  let shape = codeShape.shape;
  let style = MODE_TO_STYLE.get(codeShape.mode);
  shape.getFill().setSolidFill(style.background);

  let text = shape.getText();
  if (text.isEmpty()) return;
  let textStyle = text.getTextStyle();
  if (style.fontFamily) textStyle.setFontFamily(style.fontFamily);
  // TODO(florian): would be nice if we could get the default color from the
  // template. That said: it's probably ok if the code doesn't use the same color.
  textStyle.setForegroundColor(style.foreground || "#000000");
  textStyle.setBold(style.bold || false);
  textStyle.setItalic(style.italic || false);
}

function removeTripleBackticks(codeShape : CodeShape) {
  let shape = codeShape.shape;
  let text = shape.getText();
  let str = text.asString();
  let endOfFirstLine = str.indexOf('\n');
  let startOfLastLine = str.lastIndexOf('\n```');
  if (endOfFirstLine === startOfLastLine) {
    text.clear();
  } else {
    // First remove the trailing ticks, as removing the leading one changes the positions.
    text.getRange(startOfLastLine, startOfLastLine + 4).clear();
    text.getRange(0, endOfFirstLine + 1).clear();
  }
}

function colorizeCodeShape(codeShape : CodeShape) {
  let shape = codeShape.shape;
  let mode = codeShape.mode;
  let text = shape.getText()
  colorizeText(text, mode)
}

function colorizeText(text : TextRange, mode : string) {
  let str = text.asString();
  str = str.replace(/\x0B/g, "\n")
  let codeMirrorStyle = MODE_TO_STYLE.get(mode);
  let offset = 0;
  codemirror.runMode(str, codeMirrorStyle.codeMirrorMode, function(token, tokenStyle) {
    let range = text.getRange(offset, offset + token.length);
    let style = codeMirrorStyle.codeMirrorStyleToStyle(tokenStyle);
    applyStyle(range, style)
    offset += token.length;
  });
}

function colorizeSpans(shape : Shape) {
  let text = shape.getText();
  if (text.isEmpty()) return;
  let str = text.asString();
  let spans : Array<CodeSpan> = [];
  let currentOffset = -1
  while (currentOffset < str.length) {
    let start = str.indexOf('`', currentOffset);
    if (start === -1) break;
    let end = str.indexOf('`', start + 1);
    if (end === -1) break;
    let newline = str.indexOf('\n', start);
    // We don't allow code spans to go over multiple lines.
    // TODO(florian): maybe we should?
    if (newline < end) {
      currentOffset = newline;
      continue;
    }
    // If we have backticks next to each other, just consume all of them.
    if (start === end - 1) {
      while (str[end] === '`') end++;
      currentOffset = end + 1;
    }
    spans.push(new CodeSpan(start, end));
    currentOffset = end + 1;
  }
  // Handle the spans from the last to the first, so we don't change the positions
  // in the wrong order.
  for (let i = spans.length - 1; i >= 0; i--) {
    let span = spans[i];
    let rangeText = text.asString().substring(span.from + 1, span.to - 1)
    let style = theme.themer.getCodeSpanStyle(rangeText);
    // We change the section with the back-ticks, and then remove the ticks afterwards.
    // This way we never have to deal with empty strings.
    let range = text.getRange(span.from, span.to);
    applyStyle(range, style);
    text.getRange(span.from, span.from + 1).clear();
    text.getRange(span.to - 1, span.to).clear();
  }
}

function applyStyle(range : TextRange, style : theme.Style) {
  if (!style) return;
  let textStyle = range.getTextStyle();
  // We are setting the values, even if they are undefined, to revert them
  // to the default (in case they have been set before).
  if (style.italic !== undefined) textStyle.setItalic(style.italic);
  if (style.bold !== undefined) textStyle.setBold(style.bold);
  if (style.foreground !== undefined) textStyle.setForegroundColor(style.foreground);
  if (style.background !== undefined) textStyle.setBackgroundColor(style.background);
  if (style.fontFamily !== undefined) textStyle.setFontFamily(style.fontFamily);
}
