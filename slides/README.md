# Google Slides Add-On for Syntax Highlighting
This add-on provides support for code segments and code spans.

Similarly to markdown code segments are delimited with triple back-ticks and code spans with single back-ticks:
~~~
```
A code segment.
```
And a `code` span.
~~~

Code segments mast be in their own text boxes.

## Examples
Before | After
------ | -----
![Before 1](screens/screen1.png) | ![After 1](screens/screen2.png)
![Before 2](screens/screen3.png) | ![After 2](screens/screen4.png)

## Compilation/Upload
Use `clasp` to compile and upload.

```
clasp login
clasp status
clasp push
```

The script id is stored in .clasp.json.

Note: we now depend on codemirror library, and a theme library.
The dependencies are written into the appsscript.json.
