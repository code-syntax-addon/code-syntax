Use `clasp` to compile and upload.

```
clasp login
clasp status
clasp push
```

The script id is stored in .clasp.json.
Not sure where it came from.

Needs Resources -> Advanced Google Services -> Docs (for the batchUpdate)

Current plan: (2020-12-12)
- documents.get  -- done.
- identify which paragraphs need syntax.
  * because they start with three backticks
    -- needs to handle cases, where there are \n in the paragraph.
  * because they have a color.
    -- looks like the color is undefined when it's not set. That needs to be handled.
- change syntax.
  * start with monofont
  * clear old formatting?
  * add colors: start by alternating colors
  * remove ``` lines.
- find single backticks and make them monofont and colored.
- real syntax highlighting...

Notes:

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

