# codemirror_gas

Google Apps Script (GAS) version of [https://codemirror.net/](CodeMirror).
The resulting library can be used by GAS scripts to syntax highlight code.

# Notes:
The order of the files is important: the shim must be first, followed by the
codemirror.js library.

The script should be uploaded with clasp:

```
clasp login
clasp status
clasp push
```

Create a new version with `clasp version [description]`.

Deploy it with `clasp deploy [version] [description]`.

The script is supposed to be used as library from other scripts.
