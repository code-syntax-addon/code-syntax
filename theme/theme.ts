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
    if (!(cmStyle in CODE_MIRROR_STYLES)) {
      console.log("Missing style for " + cmStyle);
      return result;
    }
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
  "python": "#f3faff",
  "yaml": "#f3fbfe",
  "c": {
    color: "#fffbf6",
    cm: "text/x-csrc"
  },
  "c++": {
    color: "#fffbf7",
    cm: "text/x-c++src"
  },
  "css": {
    color: "#fffdf5",
    cm: "text/x-c++src"
  },
  "js": {
    color: "#f8f8ff",
    cm: "text/javascript"
  },
  "jsx": {
    color: "#f8f9ff",
    cm: "text/jsx"
  },
  "ts": {
    color: "#f8f8fe",
    cm: "text/typescript"
  },
  "json": {
    color: "#f2fbfe",
    cm: "application/json"
  },
  "java": {
    color: "#fffff7",
    cm: "text/x-java"
  },
  "kotlin": {
    color: "#f3f9ff",
    cm: "text/x-kotlin"
  },
  "c#": {
    color: "#fffff6",
    cm: "text/x-csharp"
  },
  "objective-c": {
    color: "#f5f6ff",
    cm: "text/x-objectivec"
  },
  "scala": {
    color: "#fffff5",
    cm: "text/x-scala"
  },
  "html": {
    color: "#fffdf4",
    cm: "text/html"
  },
  "xml": {
    color: "#fffef4",
    cm: "text/xml"
  },
  "dockerfile": "#fffef5",
};

const CODE_MIRROR_STYLES = {
  "header": {
    bold: true,
    color: "#0000ff",
  },
  "quote": "#009000",
  "negative": "#d04040",
  "positive": "#209020",
  "strong": {
    bold: true,
  },
  "em": {
    italic: true,
  },
  "keyword": {
    bold: true,
    color: "#700080",
  },
  "atom": "#201090",
  "number": "#106040",
  "def": "#0000f0",
  "variable": "#1ab1cd",
  "punctuation": "#0f5057",
  "property": "#572000",
  "operator": {
    bold: true,
    color: "#ee11ff",
  },
  "variable-2": "#0050a0",
  "variable-3": "#008050",
  "type": "#008050",
  "comment": {
    italic: true,
    color: "#a05000",
  },
  "string": "#a01010",
  "string-2": "#f05000",
  "meta": "#505050",
  "qualifier": "#505050",
  "builtin": "#3000a0",
  "bracket": "#909070",
  "tag": "#107000",
  "attribute": "#0000c0",
  "hr": "#909090",
  "link": "#0000c0",
  "error": "#f00000",
  "invalidchar": "#f00000",
};
