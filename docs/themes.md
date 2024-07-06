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

## Creating Themes

Themes follow the [theme json-schema](schemas/theme/v1.json). Vscode, and other
editors, automatically provide code completion and diagnostics as soon as the
theme file has an entry `$schema` with the value
`https://code-syntax-addon.github.io/code-syntax/schemas/theme/v1.json`:

```json
{
  "$schema": "https://code-syntax-addon.github.io/code-syntax/schemas/theme/v1.json",
}
```

### Hierarchy

A theme has the following structure:

``` ts
type Theme = {
  "default": StyleOrColor;
  "syntax": Record<string, StyleOrColor>;
  "spanColors": Record<string, StyleOrColor>;
  "modes": Record<string, Mode>;
};
```

with
