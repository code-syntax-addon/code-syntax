# Themes

The Code Syntax add-on for Google Docs and Google Slides allows you to change
the theme of the syntax highlighting.

Due to technical limitations, the theming UI is very low level. Add-ons that
use advanced UIs need more permissions, which is not desirable for this add-on.

Themes can be stored as document themes or user themes. Document themes are
stored in the document itself, while user themes are stored in the user's
settings. As soon as a document was colorized with a custom theme, the document
theme is set to the custom theme.

Document themes have precedence over user themes. If a document has a custom
theme, the user theme is ignored.

## Using Themes

If you only want to use a theme, head over to the [Theme Gallery](theme-gallery.html)
and copy the theme-string of the theme you want to use.

Then, in Google Docs/Slides, go to
`Extensions > Code Syntax > Advanced > Set {document|user} theme` and paste the
theme-string into the text box.

If you want to remove the custom theme, set the theme-string to an empty string.

If a new theme changes a mode color (the background color of a code block),
the add-on will not recognize old code blocks with the old mode color anymore.
You will need to re-colorize these code blocks (using `Change Mode to` in
the add-on menu) to apply the new mode color.

## Creating Themes

 Themes are defined using JSON and follow a hierarchical structure, allowing
 for both global and language-specific customizations.

Themes follow the [theme json-schema](schemas/theme/v1.json). Vscode, and other
editors, automatically provide code completion and diagnostics as soon as the
theme file has an entry `$schema` with the value
`https://code-syntax-addon.github.io/code-syntax/schemas/theme/v1.json`:

```json
{
  "$schema": "https://code-syntax-addon.github.io/code-syntax/schemas/theme/v1.json",
}
```
### Theme Structure

A theme consists of several main sections:

1. `default`: Defines the default style for all code.
2. `codeMirror`: Specifies syntax highlighting for code sections.
3. `spans`: Defines styles for inline code spans.
4. `modes`: Contains configurations for specific programming languages. Each mode
   can have:
   - `modeColor`: Background color for code blocks (must be unique per mode)
   - `style`: Default style for the mode
   - `codeMirror`: Syntax highlighting rules for the mode

#### Style Properties

When defining styles in any section of the theme, you can use either of
these formats:

1. A string representing a color in hex format (for example, "#ff0000" for red).
2. An object with one or more of the following properties:
   - `fontFamily`: Specifies the font family
   - `italic`: Boolean to set italic style
   - `bold`: Boolean to set bold style
   - `foreground`: Text color (hex format)
   - `background`: Background color (hex format)

These properties can be used in the `default` section, within `modes`, and
for individual CodeMirror tokens.

### Hierarchy and Overriding

The theme system uses a hierarchical approach to determine the final appearance
of code elements. This hierarchy allows for flexible customization while
maintaining a consistent look. Here's how it works:

#### For General Styles and Syntax Highlighting

The system applies styles in layers, with each layer adding to or overriding
the previous ones:

1. It starts with the default theme's default style and CodeMirror settings.
   This forms the base layer of styling.

2. Next, it applies your custom theme's default style and CodeMirror settings.
   These settings are merged with the base layer. For instance, if the base
   layer sets a font family and your custom theme sets a text color, the result
   will have both the custom font family and the custom text color.

3. Finally, for specific programming languages, it applies any mode-specific
   style and CodeMirror settings from your custom theme. These are merged with
   the previous layers. For example, if your mode-specific style sets text to
   bold, but doesn't specify a color, it will inherit the color from the previous
   layers while applying the bold style.

This layered approach allows you to make broad changes in your default settings
while fine-tuning specific languages or elements as needed. You don't need to
specify every property at every level - unspecified properties will be
inherited from the previous layers.

#### For Inline Code Spans

When styling inline code spans, the system uses a very similar approach:

1. It first categorizes the span using a regex pattern (for instance,
   as a path, number, string, etc.). See the json-schema or the default
   theme for the full list of supported categories.

2. Then, it looks for a matching style in this order:
   - First, in the `spans` section of your custom theme.
   - If not found, it checks the `spans` section of the default theme.
   - If still not found, it uses the custom theme's `default` style.
   - If that's not found, it uses the default theme's `default` style.

### Customization Examples

#### Minimal Theme

Here's an example of a minimal theme that changes the font for all code to "Courier New":

```json
{
  "default": {
     "fontFamily": "Courier New"
  }
}
```

#### Mode-Specific Customization

This example demonstrates how to customize the 'shell' mode with a dark background:

```json
{
  "modes": {
    "shell": {
      "modeColor": "#000101",
      "style": {
        "foreground": "#ffffff"
      },
      "codeMirror": {
        "keyword": {
          "bold": true,
          "foreground": "#ff80ff"
        },
        "string": "#ff4040",
        // ... other syntax highlighting rules
      }
    }
  }
}
```

#### Changing Background Color for a Specific Mode

To change the background color for Python code blocks, you can use the `modeColor` property:

```json
{
  "modes": {
    "python": {
      "modeColor": "#f7fff8"
    }
  }
}
```

This will set a light green background for all Python code blocks.

Remember that the `modeColor` must be unique for each mode.

### Contributing Your Theme

We encourage users to share their custom themes with the community. If
you've created a theme you're proud of, please consider submitting it
as a pull request to our [theme gallery](theme-gallery.html).

### The Default Theme

For reference, here is the default scheme:

``` json
{
  "default": {
    "fontFamily": "Roboto Mono",
    "italic": false,
    "bold": false,
    "foreground": "#000000"
  },
  "codeMirror": {
    "header": {
      "bold": true,
      "foreground": "#0000ff"
    },
    "quote": "#009000",
    "negative": "#d04040",
    "positive": "#209020",
    "strong": {
      "bold": true
    },
    "em": {
      "italic": true
    },
    "keyword": {
      "bold": true,
      "foreground": "#700080"
    },
    "atom": "#201090",
    "number": "#106040",
    "def": "#0000f0",
    "variable": "#1ab1cd",
    "punctuation": "#0f5057",
    "property": "#572000",
    "operator": {
      "bold": true,
      "foreground": "#ee11ff"
    },
    "variable-2": "#0050a0",
    "variable-3": "#008050",
    "type": "#008050",
    "comment": {
      "italic": true,
      "foreground": "#a05000"
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
    "invalidchar": "#f00000"
  },
  "spans": {
    "path": "#3c003c",
    "number": "#008c0c",
    "string": "#38008c",
    "keyword": "#8c0008",
    "ipv4": "#8c3028",
    "rest": "#000c8c"
  },
  "modes": {
    "none": {
      "modeColor": "#f7f7f7"
    },
    "toit": {
      "modeColor": "#f2f8ff"
    },
    "dart": {
      "modeColor": "#f7fff7"
    },
    "shell": {
      "modeColor": "#fff7f2"
    },
    "go": {
      "modeColor": "#f7ffff"
    },
    "python": {
      "modeColor": "#f3faff"
    },
    "yaml": {
      "modeColor": "#f3fbfe"
    },
    "c": {
      "modeColor": "#fffbf6"
    },
    "c++": {
      "modeColor": "#fffbf7"
    },
    "css": {
      "modeColor": "#fffdf5"
    },
    "js": {
      "modeColor": "#f8f8ff"
    },
    "jsx": {
      "modeColor": "#f8f9ff"
    },
    "ts": {
      "modeColor": "#f8f8fe"
    },
    "json": {
      "modeColor": "#f2fbfe"
    },
    "java": {
      "modeColor": "#fffff7"
    },
    "kotlin": {
      "modeColor": "#f3f9ff"
    },
    "c#": {
      "modeColor": "#fffff6"
    },
    "objective-c": {
      "modeColor": "#f5f6ff"
    },
    "scala": {
      "modeColor": "#fffff5"
    },
    "html": {
      "modeColor": "#fffdf4"
    },
    "xml": {
      "modeColor": "#fffef4"
    },
    "dockerfile": {
      "modeColor": "#fffef5"
    },
    "julia": {
      "modeColor": "#f6fbff"
    },
    "rust": {
      "modeColor": "#effffc"
    },
    "r": {
      "modeColor": "#f3f3ff"
    }
  }
}
```
