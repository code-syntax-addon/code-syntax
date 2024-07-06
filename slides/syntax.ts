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
  menu.addItem("License", "showLicense")
  menu.addToUi();
}

function showThemes() {
  theme.showThemes(
      SlidesApp.getUi(),
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
  theme.setTheme(SlidesApp.getUi(), type, (newTheme : string) => {
    if (newTheme === "") {
      properties.deleteProperty(theme.THEME_PROPERTY_KEY);
    } else {
      properties.setProperty(theme.THEME_PROPERTY_KEY, newTheme);
    }
  });
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
    let lineEnd = indexOfLineSeparator(str);
    let firstLine = str.substring(0, lineEnd);
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
  let style = getModeToStyle().get(mode)!;
  let defaultStyle = style.defaultStyle;
  if (defaultStyle.fontFamily) textStyle.setFontFamily(defaultStyle.fontFamily);
  if (defaultStyle.foreground) textStyle.setForegroundColor(defaultStyle.foreground);
  if (defaultStyle.background) textStyle.setBackgroundColor(defaultStyle.background);
  if (defaultStyle.bold !== undefined) textStyle.setBold(defaultStyle.bold);
  if (defaultStyle.italic !== undefined) textStyle.setItalic(defaultStyle.italic);
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
    if (!getModeToStyle().has(codeShape.mode)) return
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
  return getColorToMode().get(color) || "<unknown>";
}

function isBoxedCodeShape(shape : Shape) : boolean {
  if (shape.getShapeType() != SlidesApp.ShapeType.TEXT_BOX) return false;
  const fill = shape.getFill().getSolidFill();
  if (!fill) return false;
  // Could be a template color.
  const color = fill.getColor();
  if (color.getColorType() != SlidesApp.ColorType.RGB) return false;
  const rgbColor = color.asRgbColor();
  if (!rgbColor) return false;
  const hexColor = rgbColor.asHexString();
  return getColorToMode().has(hexColor);
}

function isTextCodeShape(shape : Shape) : boolean {
  let str = shape.getText().asString();
  if (!str.startsWith("```")) return false;
  let lastTicksN = str.lastIndexOf('\n```');
  let lastTicksV = str.lastIndexOf('\v```'); // Vertical tab.
  let lastTicks = Math.max(lastTicksN, lastTicksV);
  if (lastTicks == -1) return false;
  for (let i = lastTicks + 4; i < str.length; i++) {
    if (str.charAt(i) != ' ' && str.charAt(i) != '\n' && str.charAt(i) != '\v') return false;
  }
  return true;
}

function boxShape(codeShape : CodeShape) {
  let shape = codeShape.shape;
  let style = getModeToStyle().get(codeShape.mode)!;
  shape.getFill().setSolidFill(style.background);

  let text = shape.getText();
  if (text.isEmpty()) return;
  let textStyle = text.getTextStyle();
  let defaultStyle = style.defaultStyle;
  if (defaultStyle.fontFamily) textStyle.setFontFamily(defaultStyle.fontFamily);
  if (defaultStyle.foreground) textStyle.setForegroundColor(defaultStyle.foreground);
  if (defaultStyle.background) textStyle.setBackgroundColor(defaultStyle.background);
  if (defaultStyle.bold !== undefined) textStyle.setBold(defaultStyle.bold);
  if (defaultStyle.italic !== undefined) textStyle.setItalic(defaultStyle.italic);
}

function indexOfLineSeparator(str : string) : number {
  let n = str.indexOf('\n');
  let v = str.indexOf('\v');
  if (n == -1) return v;
  if (v == -1) return n;
  return Math.min(n, v);
}

function removeTripleBackticks(codeShape : CodeShape) {
  let shape = codeShape.shape;
  let text = shape.getText();
  let str = text.asString();
  let endOfFirstLine = indexOfLineSeparator(str);
  let startOfLastLineN = str.lastIndexOf('\n```');
  let startOfLastLineV = str.lastIndexOf('\v```');  // Vertical tab.
  let startOfLastLine = Math.max(startOfLastLineN, startOfLastLineV);
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
  let codeMirrorStyle = getModeToStyle().get(mode)!;
  let offset = 0;
  codemirror.runMode(str, codeMirrorStyle.codeMirrorMode, function(token : string, tokenStyle : string) {
    let range = text.getRange(offset, offset + token.length);
    let style = codeMirrorStyle.codeMirrorStyleToStyle(tokenStyle);
    applyStyle(range, style)
    offset += token.length;
  });
}

function colorizeSpans(shape : Shape) {
  let text : TextRange | null = null;
  try {
    text = shape.getText();
  } catch (e) {
    // We don't know why this happens, but we have seen stack traces
    // with it.
    return;
  }
  if (text == null) return;
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
  let themer = getThemer();
  for (let i = spans.length - 1; i >= 0; i--) {
    let span = spans[i];
    let rangeText = text.asString().substring(span.from + 1, span.to)
    let style = themer.getCodeSpanStyle(rangeText);
    // We change the section with the back-ticks, and then remove the ticks afterwards.
    // This way we never have to deal with empty strings.
    let range = text.getRange(span.from, span.to);
    applyStyle(range, style);
    text.getRange(span.from, span.from + 1).clear();
    text.getRange(span.to - 1, span.to).clear();
  }
}

function applyStyle(range : TextRange, style : theme.Style) {
  let textStyle = range.getTextStyle();
  // For some reason we sometimes get "The object (gb66c79a860_0_8) has no text."
  // when setting the foreground. We can see that the text is "\x0a", but we
  // don't know why it happens. Just catch the exception.
  try {
    if (style.foreground) textStyle.setForegroundColor(style.foreground);
    if (style.background) textStyle.setBackgroundColor(style.background);
    if (style.fontFamily) textStyle.setFontFamily(style.fontFamily);
    if (style.italic !== undefined) textStyle.setItalic(style.italic);
    if (style.bold !== undefined) textStyle.setBold(style.bold);
  } catch (e) {
    // Do nothing.
  }
}
