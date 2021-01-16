/**
 * @OnlyCurrentDoc
 */
// Copyright (C) 2021 Florian Loitsch. All rights reserved.

import "google-apps-script";
import slides = GoogleAppsScript.Slides;
import * as theme from "../theme/theme";

declare var codemirror;

type Slide = slides.Slide;
type Shape = slides.Shape;

class CodeShape {
  shape : Shape;
  mode : string;
  hasBackticks : boolean;

  constructor(shape : Shape, mode : string, hasBackticks : boolean) {
    this.shape = shape;
    this.mode = mode;
    this.hasBackticks = hasBackticks;
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
  /*
  // There is no way to pass a parameter from the menu to a function.
  // We therefore dynamically create individual functions that can be used
  // as targets.
  let self : any = this;
  self[changeColorNameFor(mode)] = function() {
    changeColorTo(mode);
  }
  */
}

function main() {
  let pres = SlidesApp.getActivePresentation();
  let slides = pres.getSlides();
  let codeShapes : Array<CodeShape> = [];
  for (let slide of slides) {
    codeShapes.push(...findCodeShapes(slide));
  }
  for (let shape of codeShapes) {
    if (shape.hasBackticks && MODE_TO_STYLE.get(shape.mode)) {
      removeBackticksAndBox(shape);
    }
  }
}

function modeFromColor(color : string) : string {
  return COLOR_TO_MODE.get(color) || "<unknown>";
}

function findCodeShapes(slide : Slide) : Array<CodeShape> {
  let result : Array<CodeShape> = [];
  let shapes = slide.getShapes();
  for (let shape of shapes) {
    if (shape.getShapeType() != SlidesApp.ShapeType.TEXT_BOX) continue;
    let background = shape.getFill().getSolidFill();
    if (background) {
      // If the text box has some background color we assume it's a
      // code shape. We will skip it, if it doesn't have a color we
      // recognize.
      let mode = modeFromColor(background.getColor().asRgbColor().asHexString());
      result.push(new CodeShape(shape, mode, false));
      continue;
    }
    let str = shape.getText().asString();
    if (str.startsWith("```") &&
        (str.endsWith("\n```") || str.endsWith("\n```\n"))) {
      let firstLine = str.substring(0, str.indexOf("\n"));
      let mode = firstLine.substring(3).trim();  // Skip the triple-quotes.
      if (mode === "") mode = "none";
      result.push(new CodeShape(shape, mode, true));
    }
  }
  return result;
}

function removeBackticksAndBox(codeShape : CodeShape) {
  let shape = codeShape.shape;
  let text = shape.getText();
  let style = MODE_TO_STYLE.get(codeShape.mode);
  shape.getFill().setSolidFill(style.background);
  let textStyle = text.getTextStyle();
  if (style.fontFamily) textStyle.setFontFamily(style.fontFamily);
  // TODO(florian): would be nice if we could get the default color from the
  // template. That said: it's probably ok if the code doesn't use the same color.
  textStyle.setForegroundColor(style.foreground || "#000000");
  textStyle.setBold(style.bold || false);
  textStyle.setItalic(style.italic || false);

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
