// Copyright (C) 2020 Florian Loitsch. All rights reserved.

function runMode(stringOrLines, modespec, callback, options) {
  var mode = CodeMirror.getMode(CodeMirror.defaults, modespec);
  var lines = (typeof stringOrLines) == "string"
    ? CodeMirror.splitLines(stringOrLines)
    : stringOrLines
  var state = (options && options.state) || CodeMirror.startState(mode);

  for (var i = 0, e = lines.length; i < e; ++i) {
    if (i) callback("\n", null);
    var stream = new CodeMirror.StringStream(lines[i], null, {
      lookAhead : function(n) { return lines[i + n] },
      baseToken: function() {}
    });
    if (!stream.string && mode.blankLine) mode.blankLine(state);
    while (!stream.eol()) {
      var style = mode.token(stream, state);
      callback(stream.current(), style, i, stream.start, state);
      stream.start = stream.pos;
    }
  }
}
