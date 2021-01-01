// Copyright (C) 2020 Florian Loitsch. All rights reserved.

// So we can import this file in the other libraries.
export {
  themer,
  SegmentStyle,
  Style,
  Themer,
}

class Style {
  fontFamily : string;
  italic : boolean;
  bold : boolean;
  foreground : string;
  background : string;
}

class SegmentStyle extends Style {
  mode : string;
  codeMirrorMode : string;

  public constructor(mode : string, cmMode : string) {
    super();
    this.mode = mode;
    this.codeMirrorMode = cmMode;
  }

  public codeMirrorStyleToStyle(cmStyle : string) : Style  {
    let result = new Style;
    if (cmStyle === undefined || cmStyle === null) return result;
    if (!(cmStyle in CODE_MIRROR_STYLES)) return result;
    let entry = CODE_MIRROR_STYLES[cmStyle];
    if (typeof entry == "string") {
      result.foreground = entry;
    } else {
      result.italic = entry.italic;
      result.bold = entry.bold;
      result.foreground = entry.color;
    }
    return result;
  }
}

class Themer {
  public getSegmentStyle(mode : string) : SegmentStyle {
    let entry = MODES[mode];
    if (!entry) return new SegmentStyle(mode, "");
    let cmMode : string;
    let color : string;
    if (typeof entry === "string") {
      cmMode = mode;
      color = entry;
    } else {
      cmMode = entry.cm;
      color = entry.color;
    }
    let result = new SegmentStyle(mode, cmMode);
    result.background = color;
    result.fontFamily = FONT_FAMILY;
    return result;
  }
  public getCodeSpanStyle(text : string) : Style {
    let foundColor : string = null;
    for (let i = 0; i < SPAN_COLORS.length; i++) {
      let entry = SPAN_COLORS[i]
      let re : RegExp = entry[0] as RegExp;
      let color : string = entry[1] as string;
      if (re.test(text)) {
        let result = new Style();
        result.foreground = color;
        result.fontFamily = FONT_FAMILY;
        return result;
      }
    }
    return null;
  }
  public getModeList() : Array<string> {
    return Object.keys(MODES);
  }
}

const themer = new Themer();

const FONT_FAMILY = "Roboto Mono";

const SPAN_COLORS = [
  [/^[a-zA-Z_0-9<>]+(\/[a-zA-Z_0-9<>]+)+$/, "#3c003c"], // Path.
  [/^(([0-9]+(\.[0-9]*)?)|(\.[0-9]+))$/, "#008c0c"], // Number.
  [/^(["]([^"\\]|[\\]["\\])*["])$/, "#38008c"], // String.
  [/^([']([^"\\]|[\\]['\\])*['])$/, "#38008c"], // String/Char.
  [/^(null|undefined|true|false|nil)$/, "#8c0008"], // Keywords.
  [/^[12]?[0-9]?[0-9](\.[12]?[0-9]?[0-9]){3}$/, "#8c3028"], // IPv4.
  [/.*/, "#000c8c"], // Rest.
];

const MODES = {
  "none" : "#f7f7f7",  // No specified mode.
  "toit" : "#f2f8ff",
  "dart" : "#f7fff7",
  "shell": "#fff7f2",
  "go": "#f7ffff",
  "python": "#f7f7ff",
  "java": {
    color: "#fffff7",
    cm: "text/x-java"
  }
};

const CODE_MIRROR_STYLES = {
  "comment": {
    italic: true,
    bold: true,
    color: "#498bf1",
  },
  "def": "#16aa65",
  "variable": "#1ab1cd",
  "operator": {
    bold: true,
    color: "#ee11ff",
  },
  "type": "#74cce1",
  "string": "#1ab1ad",
  "number": "#a73d14",
  "keyword": {
    bold: true,
    color: "#663344",
  },
  "error": "#ff0c0c",
};
