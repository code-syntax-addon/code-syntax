// Copyright (C) 2020 Florian Loitsch. All rights reserved.

// So we can import this file in the other libraries.
export {
  SegmentStyle,
  Style, THEME_PROPERTY_KEY, Themer,
  getModeList,
  newThemer,
  setTheme,
  showThemes
};

// Maps the mode to the CodeMirror mode, if the name is not the same.
const MODE_TO_CODE_MIRROR = {
  "c": "text/x-csrc",
  "c++": "text/x-c++src",
  "css": "text/x-gss",
  "js": "text/javascript",
  "jsx": "text/jsx",
  "ts": "text/typescript",
  "json": "application/json",
  "java": "text/x-java",
  "kotlin": "text/x-kotlin",
  "c#": "text/x-csharp",
  "objective-c": "text/x-objectivec",
  "scala": "text/x-scala",
  "html": "text/html",
  "xml": "text/xml",
  "julia": "text/x-julia",
  "rust": "text/x-rustsrc",
  "r": "text/x-rsrc",
};

const SPAN_REGEX = [
  [/^[a-zA-Z_0-9<>]+(\/[a-zA-Z_0-9<>]+)+$/, "path"],
  [/^(([0-9]+(\.[0-9]*)?)|(\.[0-9]+))$/, "number"],
  [/^(["]([^"\\]|[\\]["\\])*["])$/, "string"],
  [/^([']([^"\\]|[\\]['\\])*['])$/, "string"],
  [/^(null|undefined|true|false|nil)$/, "keyword"],
  [/^[12]?[0-9]?[0-9](\.[12]?[0-9]?[0-9]){3}$/, "ipv4"],
  [/.*/, "rest"],
]

function checkRecord(path: Array<string>, value: any, check: (path: Array<string>, value: any) => void): void {
  if (typeof value !== 'object') {
    throw new Error(`Invalid Record ${path.join('.')}: ${JSON.stringify(value)}`);
  }
  for (const key in value) {
    check([...path, key], value[key]);
  }
}

type Mode = {
  modeColor? : string;
  style? : StyleOrColor;  // The default style for the mode.
  codeMirror? : Record<string, StyleOrColor>;
}

function checkMode(path: Array<string>, value: any): void {
  if (typeof value !== 'object') {
    throw new Error(`Invalid Syntax ${path.join('.')}: ${JSON.stringify(value)}`);
  }
  if (value.default !== undefined) {
    checkStyleOrColor([...path, 'default'], value.default);
  }
  if (value.syntax !== undefined) {
    checkRecord([...path, 'syntax'], value.syntax, checkStyleOrColor);
  }
  if (value.modeColor !== undefined && typeof value.modeColor !== 'string') {
    throw new Error(`Invalid 'modeColor' in Mode ${path.join('.')}: ${JSON.stringify(value.modeColor)}`);
  }
}

// The colors are either strings (representing the color), or objects.
type Style = {
  fontFamily? : string;
  italic? : boolean;
  bold? : boolean;
  foreground? : string;
  background? : string;
}

function checkStyle(path: Array<string>, value: any): void {
  if (typeof value !== 'object') {
    throw new Error(`Invalid Style ${path.join('.')}: ${JSON.stringify(value)}`);
  }
  if (value.fontFamily !== undefined && typeof value.fontFamily !== 'string') {
    throw new Error(`Invalid 'fontFamily' in Style ${path.join('.')}: ${JSON.stringify(value.fontFamily)}`);
  }
  if (value.italic !== undefined && typeof value.italic !== 'boolean') {
    throw new Error(`Invalid 'italic' in Style ${path.join('.')}: ${JSON.stringify(value.italic)}`);
  }
  if (value.bold !== undefined && typeof value.bold !== 'boolean') {
    throw new Error(`Invalid 'bold' in Style ${path.join('.')}: ${JSON.stringify(value.bold)}`);
  }
  if (value.foreground !== undefined && typeof value.foreground !== 'string') {
    throw new Error(`Invalid 'foreground' in Style ${path.join('.')}: ${JSON.stringify(value.foreground)}`);
  }
  if (value.background !== undefined && typeof value.background !== 'string') {
    throw new Error(`Invalid 'background' in Style ${path.join('.')}: ${JSON.stringify(value.background)}`);
  }
}

type StyleOrColor = string | Style;

function checkStyleOrColor(path: Array<string>, value: any): void {
  if (typeof value === 'string') return;
  checkStyle(path, value);
}

type Theme = {
  default?: StyleOrColor;
  codeMirror?: Record<string, StyleOrColor>;
  spans?: Record<string, StyleOrColor>;
  modes?: Record<string, Mode>;
};

function checkTheme(path: Array<string>, value: any): void {
  if (typeof value !== 'object') {
    throw new Error(`Invalid Theme ${path.join('.')}: ${JSON.stringify(value)}`);
  }
  if (value.default !== undefined) {
    checkStyleOrColor([...path, 'default'], value.default);
  }
  if (value.syntax !== undefined) {
    checkRecord([...path, 'syntax'], value.syntax, checkStyleOrColor);
  }
  if (value.spans !== undefined) {
    checkRecord([...path, 'spans'], value.spans, checkStyleOrColor);
  }
  if (value.modes !== undefined) {
    checkRecord([...path, 'modes'], value.modes, checkMode);
  }
}

// Combines the styles, and returns a new style.
// The most precise style must be last.
function mergeStyles(...styles : (StyleOrColor | undefined)[]) : Style {
  let result : Style = {};
  for (let i = 0; i < styles.length; i++) {
    let style = styles[i];
    if (!style) continue;
    if (typeof style == "string") {
      result.foreground = style;
      continue;
    }
    // If the object contains an entry (even undefined) for the key, we use it.
    // This way, we can override the default style and allow it stay unchanged.
    if (style.hasOwnProperty("fontFamily")) result.fontFamily = style.fontFamily;
    if (style.hasOwnProperty("italic")) result.italic = style.italic;
    if (style.hasOwnProperty("bold")) result.bold = style.bold;
    if (style.hasOwnProperty("foreground")) result.foreground = style.foreground;
    if (style.hasOwnProperty("background")) result.background = style.background;
  }
  return result;
}

function mergeCodeMirror(...cmirrors : (Record<string, StyleOrColor> | undefined)[]) : Record<string, StyleOrColor> {
  let result : Record<string, StyleOrColor> = {};
  for (let i = 0; i < cmirrors.length; i++) {
    let cmirror = cmirrors[i];
    if (!cmirror) continue;
    for (let key in cmirror) {
      result[key] = cmirror[key];
    }
  }
  return result;
}

class SegmentStyle {
  public mode : string;
  public codeMirrorMode : string;
  public background : string;
  public defaultStyle : Style;
  private syntax? : Record<string, StyleOrColor>;

  public constructor(
      mode : string,
      cmMode : string,
      background : string,
      defaultStyle : Style,
      syntax? : Record<string, StyleOrColor>,
      ) {
    this.mode = mode;
    this.codeMirrorMode = cmMode;
    this.background = background;
    this.defaultStyle = defaultStyle;
    this.syntax = syntax;
  }

  public codeMirrorStyleToStyle(cmStyle : string | null) : Style  {
    if (!cmStyle) return this.defaultStyle;
    let entry = this.syntax ? this.syntax[cmStyle] : undefined
    if (!entry) {
      console.log("No entry for " + cmStyle);
    }
    return mergeStyles(this.defaultStyle, entry);
  }
}

class Themer {
  private theme : Theme;
  private cachedSegmentStyles : Record<string, SegmentStyle> = {};

  public constructor(theme : Theme) {
    this.theme = theme;
  }

  private toStyle(config : StyleOrColor) : Style {
    if (typeof config == "string") {
      return { foreground: config };
    }
    return config;
  }

  private getDefaultStyle() : Style {
    return mergeStyles(DEFAULT_THEME.default, this.theme.default);
  }

  public getSegmentStyle(mode : string) : SegmentStyle {
    let cached = this.cachedSegmentStyles[mode];
    if (cached) return cached;

    let cmMode : string = MODE_TO_CODE_MIRROR[mode] ?? mode;

    let globalDefaultEntry = DEFAULT_THEME.default;
    let themeDefaultEntry = this.theme.default;

    let globalModeEntry = DEFAULT_THEME.modes![mode];
    let themeModeEntry = this.theme?.modes?.[mode];

    let style = mergeStyles(
      globalDefaultEntry,
      themeDefaultEntry,
      globalModeEntry?.style,
      themeModeEntry?.style
    );

    let modeColor = themeModeEntry?.modeColor ?? globalModeEntry?.modeColor;

    if (!modeColor) {
      // Shouldn't happen.
      return new SegmentStyle(mode, "", "#FFFFFF", style);
    }

    let codeMirror = mergeCodeMirror(
      DEFAULT_THEME.codeMirror,
      this.theme.codeMirror,
      globalModeEntry?.codeMirror,
      themeModeEntry?.codeMirror,

    );
    let result = new SegmentStyle(mode, cmMode, modeColor, style, codeMirror);
    this.cachedSegmentStyles[mode] = result;
    return result;
  }

  public getCodeSpanStyle(text : string) : Style {
    let defaultStyle = this.getDefaultStyle();
    for (let i = 0; i < SPAN_REGEX.length; i++) {
      let entry = SPAN_REGEX[i]
      let re : RegExp = entry[0] as RegExp;
      let spanName : string = entry[1] as string;
      let style = this.theme.spans?.[spanName]
      if (!style) style = DEFAULT_THEME.spans![spanName];
      if (!style) continue;  // Should not happen.
      if (re.test(text)) {
        return mergeStyles(defaultStyle, style);
      }
    }
    return defaultStyle;
  }
}

function getModeList() : Array<string> {
  return Object.keys(DEFAULT_STYLES);
}

// We have the following hierarchy. Styles are merged from top to bottom, with
// the last style being the most precise.
//
// For spans:
// - Theme default style (lower).
// - Span style.
//
// For modes:
// - Theme default style.
// - Mode default style.
// - CodeMirror style ("syntax").

const GLOBAL_DEFAULT_STYLE = {
  fontFamily: "Roboto Mono",
  italic: false,
  bold: false,
  foreground: "#000000",
};

const DEFAULT_SPAN_STYLES : Record<string, StyleOrColor> = {
  "path": "#3c003c",
  "number": "#008c0c",
  "string": "#38008c",
  "keyword": "#8c0008",
  "ipv4": "#8c3028",
  "rest": "#000c8c",
};

const DEFAULT_STYLES : Record<string, Mode> = {
  "none" : { modeColor: "#f7f7f7" },  // No specified mode.
  "toit" : { modeColor: "#f2f8ff" },
  "dart" : { modeColor: "#f7fff7" },
  "shell": { modeColor: "#fff7f2" },
  "go": { modeColor: "#f7ffff" },
  "python": { modeColor: "#f3faff" },
  "yaml": { modeColor: "#f3fbfe" },
  "c": { modeColor: "#fffbf6" },
  "c++": { modeColor: "#fffbf7" },
  "css": { modeColor: "#fffdf5" },
  "js": { modeColor: "#f8f8ff" },
  "jsx": { modeColor: "#f8f9ff" },
  "ts": { modeColor: "#f8f8fe" },
  "json": { modeColor: "#f2fbfe" },
  "java": { modeColor: "#fffff7" },
  "kotlin": { modeColor: "#f3f9ff" },
  "c#": { modeColor: "#fffff6" },
  "objective-c": { modeColor: "#f5f6ff" },
  "scala": { modeColor: "#fffff5" },
  "html": { modeColor: "#fffdf4" },
  "xml": { modeColor: "#fffef4" },
  "dockerfile": { modeColor: "#fffef5" },
  "julia": { modeColor: "#f6fbff" },
  "rust": { modeColor: "#effffc" },
  "r": { modeColor: "#f3f3ff" },
};

const DEFAULT_COLORS : Record<string, StyleOrColor> = {
  "header": {
    bold: true,
    foreground: "#0000ff",
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
    foreground: "#700080",
  },
  "atom": "#201090",
  "number": "#106040",
  "def": "#0000f0",
  "variable": "#1ab1cd",
  "punctuation": "#0f5057",
  "property": "#572000",
  "operator": {
    bold: true,
    foreground: "#ee11ff",
  },
  "variable-2": "#0050a0",
  "variable-3": "#008050",
  "type": "#008050",
  "comment": {
    italic: true,
    foreground: "#a05000",
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

const DEFAULT_THEME : Theme = {
  default: GLOBAL_DEFAULT_STYLE,
  codeMirror: DEFAULT_COLORS,
  spans: DEFAULT_SPAN_STYLES,
  modes: DEFAULT_STYLES,
}

const THEME_PROPERTY_KEY = "theme";

function newThemer(documentTheme : string | null, userTheme : string | null) : Themer {
  if (documentTheme) {
    return new Themer(JSON.parse(documentTheme));
  } else if (userTheme) {
    return new Themer(JSON.parse(userTheme));
  } else {
    return new Themer(DEFAULT_THEME);
  }
}

function showThemes(
    ui : GoogleAppsScript.Base.Ui,
    documentTheme : string | null,
    userTheme : string | null) {
  if (!userTheme) userTheme = "<none>";
  if (!documentTheme) documentTheme = "<none>";
  let str = "See https://code-syntax-addon.github.io/code-syntax/theme-gallery.html for\n"
  str += "available themes and how to create your own.\n\n";
  str += "User theme: " + userTheme + "\n";
  str += "Document theme: " + documentTheme + "\n";
  ui.alert(str);
}

// Properties need to be set by the main script.
// We thus take a 'setter' as argument.
function setTheme(ui : GoogleAppsScript.Base.Ui, type : string, setter : (newTheme : string) => void) {
  let result = ui.prompt("Set " + type + " theme", "Enter a theme", ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() == ui.Button.OK) {
    let newTheme = result.getResponseText();
    if (newTheme !== "") {
      try {
        let parsed = JSON.parse(newTheme);
        checkTheme([], parsed);
      } catch (e) {
        ui.alert("Invalid theme: " + e.message);
        return;
      }
    }
    setter(newTheme);
  }
}
