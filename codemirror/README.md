# codemirror_gas

Google Apps Script (GAS) version of CodeMirror.
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

The script is supposed to be used as library from other scripts.
