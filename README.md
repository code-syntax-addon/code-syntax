Use `clasp` to compile and upload.

```
clasp login
clasp status
clasp push
```

The script id is stored in .clasp.json.
Not sure where it came from.


Looks like we need to go with RPC calls :(
There doesn't seem to be a way to change the paragraph shading through
  Google Apps script.

https://developers.google.com/apps-script/reference/document/attribute

Need to go through `batchUpdate`:
https://stackoverflow.com/a/60423698
https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
Sucks, as `batchUpdate` doesn't support Undo, but there just doesn't seem to be a good way :(

https://developers.google.com/docs/api/reference/rest/v1/documents/request#UpdateParagraphStyleRequest

Might be easier to just do a `documents.get` request with a structured version of the document, and then do a `batchUpdate` on it.
