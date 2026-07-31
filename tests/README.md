# Tests

The local tests transpile the real Apps Script TypeScript with `ts2gas` and
execute it in a Node VM with small mocks for the Google Docs and Slides
services. This keeps the tests fast and deterministic while exercising the
same functions that are deployed.

Run them with:

```sh
cd tests
npm ci
npm test
```

## Demo fixtures

`fixtures/demo.json` is a compact text fixture derived from the demo Document
and Presentation. It contains the fenced code modes, code-span examples,
malformed delimiters, and Slides text shapes that use both newline and
vertical-tab separators. Tests do not contact Google or modify the live demos.

The source documents are recorded in the fixture so it can be refreshed
manually when the demos change. Export the Document as DOCX and the
Presentation as PPTX, then update only the relevant text cases. Do not commit
the exported Office files.

## What is covered

- Mode and delimiter recognition using the demo content.
- Empty and malformed backtick segments.
- Empty Docs code spans.
- Retrying transient Docs selection failures.
- A missing Slides page-element range.
- Shapes for which Slides rejects `getText()`.
- Invalid custom theme colors.
- Batched Docs attributes and coalesced token style runs.
- Applying Slides defaults once and coalescing syntax deltas.

## End-to-end testing

The production add-ons use `documents.currentonly` and
`presentations.currentonly`. That is desirable for users, but it means an API
execution cannot call `openById()` on a fixture. A `clasp run` invocation also
has no active editor context, so `getActiveDocument()` or
`getActivePresentation()` cannot target one of the demos.

Use disposable copies for a real smoke test:

1. Deploy the development versions of the theme, CodeMirror, and add-on.
2. Make copies of the demo Document and Presentation.
3. Open each copy and invoke **Colorize** from the add-on menu.
4. Confirm that headings, spans, fenced blocks, empty blocks, tables, groups,
   and vertical-tab line breaks still render correctly.
5. Check the Apps Script execution log for errors and compare execution time.
6. Delete the copies.

Fully automated Drive integration testing would require a separate test-only
Apps Script project with broader Docs, Slides, and Drive scopes. That harness
should create a copy, invoke test-specific code against it, assert the result,
and delete the copy. Those broader scopes should not be added to the production
add-ons.
