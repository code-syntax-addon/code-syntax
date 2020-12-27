Use `clasp` to compile and upload.

```
clasp login
clasp status
clasp push
```

The script id is stored in .clasp.json.
Not sure where it came from.

Current plan: (2020-12-12)
- documents.get  -- done.
- identify which paragraphs need syntax.
  * because they start with three backticks
    -- needs to handle cases, where there are \r in the paragraph.
      Now works if the last line starts with ```.
  * because they have are in a CodeBox.
- remove ``` lines.
- change syntax.
  * start with monofont. -- done.
  * clear old formatting?
  * add colors: start by alternating colors

- find single backticks and make them monofont and colored.
- real syntax highlighting...

Notes:

Changed from doing RPC calls to creating a table (box) around code segments.
Even there, the GAS API is missing calls: no way to indent the table.
So we are storing indented code segments in another table.


-------------------------------------------------
Old, abandoned approach:
Abandoned, because it required extra permissions, and there was no way to
easily undo (ctrl-z) the changes from the script.

Looks like we need to go with RPC calls :(
There doesn't seem to be a way to change the paragraph shading through
  Google Apps script.

https://developers.google.com/apps-script/reference/document/attribute

Need to go through `batchUpdate`:
https://stackoverflow.com/a/60423698 and https://stackoverflow.com/questions/60432342
https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
Sucks, as `batchUpdate` doesn't support Undo, but there just doesn't seem to be a good way :(

https://developers.google.com/docs/api/reference/rest/v1/documents/request#UpdateParagraphStyleRequest

Might be easier to just do a `documents.get` request with a structured version of the document, and then do a `batchUpdate` on it.
Actually, we need to change the syntax of the code segments. This is much easier with JS instead of batch-updates. (I believe)

