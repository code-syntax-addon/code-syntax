# Google Docs Add-On for Syntax Highlighting
This add-on add support for code segments and code spans.

Similarly to markdown one can write code segments with triple quotes and
code spans with single back-ticks:
```
  ```
  A code segment.
  ```
  And a `code` span.
```

Additionally, the add-on changes `# Heading` lines to their corresponding
Google Docs headings.

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

## Limitations of GAS
- There is no nice way to change the background color of a paragraph [back].
- One can use the `batchUpdate` calls [batch0][batch1][batch2] to change
  the paragraphs, but that comes with two severe annoyances:
  * the script needs more permissions. (There is no way to get API permissions
    for just the one document).
  * UNDO doesn't work for API calls.
- There is no way to change the indentation of a table. (I ended up moving the
  code segments into another "hidden" table when they needed to be indented).
Notes:

Changed from doing RPC calls to creating a table (box) around code segments.
Even there, the GAS API is missing calls: no way to indent the table.
So we are storing indented code segments in another table.


[back]: https://developers.google.com/apps-script/reference/document/attribute

[batch0]: https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
[batch1]: https://stackoverflow.com/a/60423698
[batch2]: https://stackoverflow.com/questions/60432342
