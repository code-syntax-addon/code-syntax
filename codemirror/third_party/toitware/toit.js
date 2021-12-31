// Copyright (C) 2021 Toitware ApS. All rights reserved.
// Use of this source code is governed by an MIT-style license that can be
// found in the LICENSE file.

(function (mod) {
  if (typeof window === "undefined" || typeof window.navigator == 'undefined')
    import("codemirror").then(mod);
  else if ( typeof module == "object" && module.hot)
    import("codemirror").then(mod);
  else if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function (CodeMirror) {
  "use strict";

  CodeMirror.defineMode("toit", function (config) {
    function last(array) {
      return array[array.length - 1];
    }
    function set_last(array, val) {
      array[array.length - 1] = val;
    }

    function subState(state) {
      return last(state.subState);
    }
    function setSubState(state, subState) {
      state.subState[state.subState.length - 1] = subState;
    }

    function makeJsObject(str) {
      var result = {};
      var split = str.split("|");
      for (var i = 0; i < split.length; i++) result[split[i]] = true;
      return result;
    }
    var keywords = makeJsObject(
      "assert|and|or|not|if|for|else|try|finally|" +
      "while|break|continue|throw|static|abstract|return|unreachable");
    var atoms = makeJsObject("true|false|null");
    var specialVars = makeJsObject("this|super|it");

    var IDENTIFIER = /[a-zA-Z_]\w*/;
    var TYPE = /[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)?/;
    var OVERRIDABLE_OPERATOR = /==|>=|<=|<<|>>>|>>|\*|\+|-|%|\/|<|>|&|\||\^|~|\[\]\=|\[\]|\[\.\.\]/

    var CONSTANT_HEURISTIC = /_?[A-Z][A-Z_0-9]+/;
    var TYPE_HEURISTIC = /_?[A-Z]\w*[a-z]\w*/;
    var CONTROL = /[?:;]/;

    function isKeyword(str) {
      return keywords.propertyIsEnumerable(str);
    }
    function isAtom(str) {
      return atoms.propertyIsEnumerable(str);
    }
    function isSpecialVar(str) {
      return specialVars.propertyIsEnumerable(str);
    }
    function isReserved(str) {
      return isKeyword(str) || isAtom(str) || isSpecialVar(str);
    }

    function tryComments(stream, state) {
      // TODO: once code-mirror supports doc-comments, adjust.
      if (stream.match("//")) {
        stream.skipToEnd();
        return "comment";
      }
      if (stream.match("/*")) {
        return tokenizeMultilineComment(stream, state);
      }
      return null;
    }

    function tokenizeMultilineComment(stream, state) {
      state.context.push([tokenizeMultilineCommentEnd, -1]);
      state.subState.push(null);
      return tokenizeMultilineCommentEnd(stream, state);
    }

    function tokenizeMultilineCommentEnd(stream, state) {
      while (true) {
        if (stream.match("/*")) {
          return tokenizeMultilineComment(stream, state);
        }
        if (stream.match("*/")) {
          state.context.pop();
          state.subState.pop();
          return "comment";
        }
        if (!stream.next()) {
          // End of line.
          return "comment";
        }
      }
    }

    var STRING_PART = 0;
    var STRING_ESCAPE_DOLLAR = 1;
    var STRING_ESCAPE_EXPRESSION = 2;
    var STRING_ESCAPE_AFTER_PAREN = 3;
    var STRING_ESCAPE_AFTER_IDENTIFIER = 4;
    var STRING_ESCAPE_AFTER_FORMAT = 5;
    function tryString(stream, state) {
      if (stream.match('"')) {
        if (stream.match('""')) {
          // Multiline string.
          state.context.push([tokenizeMultilineString, -1]);
          state.subState.push(STRING_PART);
          return tokenizeMultilineString(stream, state);
        }
        state.context.push([tokenizeSinglelineString, 9999]);
        state.subState.push(STRING_PART);
        return tokenizeSinglelineString(stream, state);
      }
      return null;
    }

    function tokenizeDelimited(stream, state) {
      var closing = subState(state);
      var expression_result = tryExpression(stream, state);
      if (expression_result) return expression_result;
      while (true) {
        var peek = stream.peek();
        if (!peek || peek == ' ') return "enclosed";
        if (closing == "]" && stream.match("..")) {
          // We assume it's the slice operator.
          return "op_slice";
        }
        var next = stream.next();
        if (next == closing) {
          state.context.pop();
          state.subState.pop();
          switch (closing) {
            case ")": return "paren";
            case "}": return "brace";
            case "]": return "bracket";
          }
          return "error";
        } else if (next == ',') {
          if (closing == ")") return "error";
          return "separator";
        } else {
          return "error";
        }
      }
    }

    function tryDelimited(stream, state) {
      if (stream.match(/[({[]|#[[]/)) {
        state.context.push([tokenizeDelimited, -1]);
        // Abusing `subState` to store the delimiter.
        var closing;
        var style;
        switch (stream.current()) {
          case "(": closing = ")"; style = "paren"; break;
          case "{": closing = "}"; style = "brace"; break;
          case "[": closing = "]"; style = "bracket"; break;
          case "#[": closing = "]"; style = "bracket"; break;
        }
        state.subState.push(closing);
        return style;
      }
    }

    function tryControl(stream, state) {
      if (stream.match(CONTROL)) {
        return "control";
      }
    }

    function tokenizeIs(stream, state) {
      state.context.pop();
      state.subState.pop();
      state.context.push([tokenizeIsAs, -1]);
      state.subState.push(null);
      if (stream.match(/not\b/)) {
        return "is_as";
      } else {
        tokenizeIsAs(stream, state)
      }
    }

    function tokenizeIsAs(stream, state) {
      state.context.pop();
      state.subState.pop();
      if (!stream.match(TYPE, false)) {
        return "is_as_error";
      }
      return tokenizeType(stream, state);
    }

    function tryIsAs(stream, state) {
      if (stream.match(/is\b/)) {
        state.context.push([tokenizeIs, -1]);
        state.subState.push(null);
        return "is_as";
      }
      if (stream.match(/as\b/)) {
        state.context.push([tokenizeIsAs, -1]);
        state.subState.push(null);
        return "is_as";
      }
    }

    function tokenizeEscape(stream, state) {
      switch (subState(state)) {
        case STRING_ESCAPE_DOLLAR:
          stream.next();
          var peek = stream.peek();
          if (!peek || (peek != "(" && !peek.match(/[a-zA-Z_]/))) {
            setSubState(state, STRING_PART);
            return "missing_escape_expression";
          }
          setSubState(state, STRING_ESCAPE_EXPRESSION);
          return "string_dollar";

        case STRING_ESCAPE_EXPRESSION:
          if (stream.match('(')) {
            setSubState(state, STRING_ESCAPE_AFTER_PAREN);
            return "paren";
          }
          // Use `tryIdentifier` to get special handling of identifiers.
          var identifier_result = tryIdentifier(stream, state);
          // TODO(florian): this is brittle, since we might want to return
          // different styles for different keywords.
          if (identifier_result == "keyword") {
            identifier_result = "error";
          }
          setSubState(state, STRING_ESCAPE_AFTER_IDENTIFIER);
          return identifier_result;

        case STRING_ESCAPE_AFTER_IDENTIFIER:
          if (stream.match(/\.[a-zA-Z_]/, false)) {
            stream.next();
            // We can use `STRING_ESCAPE_DOLLAR` as we know that we will
            // hit an identifier.
            setSubState(state, STRING_ESCAPE_EXPRESSION);
            return "dot";
          }
          if (stream.match('[')) {
            stream.next();
            // Keeping the current substate, as we want to continue as if
            // we just finished parsing an identifier.
            state.context.push([tokenizeDelimited, -1]);
            // Abusing `subState` to store the delimiter.
            state.subState.push("]");
            return "bracket";
          }
          setSubState(state, STRING_PART);
          return null;

        case STRING_ESCAPE_AFTER_PAREN:
          if (stream.peek() == '%') {
            stream.eatWhile(/[^ ]/);
            setSubState(state, STRING_ESCAPE_AFTER_FORMAT);
            return "string_format";
          }
        // Fall through:
        case STRING_ESCAPE_AFTER_FORMAT:
          setSubState(state, STRING_PART);  // When we come back.
          state.context.push([tokenizeDelimited, -1]);
          // Abusing `subState` to store the delimiter.
          state.subState.push(")");
          return tokenizeDelimited(stream, state);

        default:
          throw "INTERNAL ERROR";
      }
    }

    function tokenizeSinglelineString(stream, state) {
      if (subState(state) != STRING_PART) {
        var escape_result = tokenizeEscape(stream, state);
        if (escape_result) return escape_result;
        // Otherwise continue as string part.
      }
      while (true) {
        stream.eatWhile(/[^"$\\]/);
        if (stream.eol()) return "unfinished_string";
        // TODO: we could highlight escapes. (Especially \x and \u).
        if (stream.match("\\")) {
          stream.next();  // Consume the escaped character.
          continue;
        }
        if (stream.peek() == '$') {
          setSubState(state, STRING_ESCAPE_DOLLAR);
          return "singleline_string";
        }
        stream.match('"');
        state.context.pop();
        state.subState.pop();
        return "singleline_string";
      }
    }

    function tokenizeMultilineString(stream, state) {
      if (subState(state) != STRING_PART) {
        var escape_result = tokenizeEscape(stream, state);
        if (escape_result) return escape_result;
        // Otherwise continue as string part.
      }
      while (true) {
        stream.eatWhile(/[^"$\\]/);
        if (stream.eol()) return "multiline_string";
        // TODO: we could highlight escapes. (Especially \x and \u).
        if (stream.match("\\")) stream.next();  // Consume the escaped character.
        if (stream.peek() == '$') {
          setSubState(state, STRING_ESCAPE_DOLLAR);
          return "multiline_string";
        }
        stream.next();
        if (stream.match('""')) {
          state.context.pop();
          state.subState.pop();
          return "multiline_string";
        }
      }
    }

    function tryChar(stream, state) {
      if (stream.match("'")) {
        while (true) {
          if (stream.match("'")) {
            return "character";
          }
          stream.match("\\");  // If there is a backslash, consume it and the next character.
          stream.next();
          if (stream.eol()) {
            return "unfinished_character";
          }
        }
      }
      return null;
    }

    function tryNumber(stream, state) {
      if (stream.match(/(\d(\d|_\d)*)?\.\d(\d|_\d)*([eE][+-]?\d(\d|_\d)*)?/)) return "float";  // 0.5e10 and .5e+10
      if (stream.match(/\d(\d|_\d)*[eE][+-]?\d(\d|_\d)*/)) return "float";  // 1e+10
      if (stream.match(/0[xX]([\da-fA-F]([\da-fA-F]|_[\da-fA-F])*)?\.[\da-fA-F]([\da-fA-F]|_[\da-fA-F])*[pP][+-]?\d(\d|_\d)*/)) return "hex_float";  // 0x.D7P-3 and 0xAb.D7p+10
      if (stream.match(/0[xX][\da-fA-F]([\da-fA-F]|_[\da-fA-F])*[pP][+-]?\d(\d|_\d)*/)) return "hex_float";  // 0xap+10
      if (stream.match(/0[xX][\da-fA-F]([\da-fA-F]|_[\da-fA-F])*/)) return "hex";
      if (stream.match(/0[bB][01a-fA-F]([01a-fA-F]|_[01a-fA-F])*/)) return "binary";
      if (stream.match(/\d(\d|_\d)*/)) return "integer";
      return null;
    }

    function tryNamedArgument(stream, state) {
      if (stream.match("--")) {
        if (stream.match(IDENTIFIER)) return "named_argument";
        stream.backUp(2);
      }
      return null;
    }

    function tryOperator(stream, state) {
      if (stream.match(/\*|\+|-|%|\/|<<|>>>|>>|&|\||\^|~/)) {
        if (stream.match("=")) {
          return "op_assig";
        }
        return "overridable_op"
      }
      if (stream.match(/==|!=|>=|<=|<|>/)) {
        return "relational";
      }
      if (stream.match("=")) {
        return "assig"
      }
      if (stream.match(/:=|::=/)) {
        return "define";
      }
      return null;
    }

    var LOCAL_ANNOTATION_DIV = 0;
    var LOCAL_ANNOTATION_TYPE = 1;
    function localAnnotation(stream, state) {
      var sub = subState(state);
      if (sub == LOCAL_ANNOTATION_DIV) {
        if (stream.match("/")) {
          setSubState(state, LOCAL_ANNOTATION_TYPE)
          return "type_div";
        }
        throw "Internal Error"
      }
      if (sub != LOCAL_ANNOTATION_TYPE) {
        throw "Internal Error"
      }
      state.context.pop();
      state.subState.pop();
      if (stream.match(TYPE, false)) {
        return tokenizeType(stream, state, true);
      }
      return null;
    }

    function tryPostfixMemberOrIdentifier(stream, state) {
      return tryIdentifier(stream, state, true);
    }

    function tryIdentifier(stream, state, allowPrefixedDot) {
      // If we allow a prefixed dot, consume it (but put it back if
      // it's not followed by an identifier).
      if (allowPrefixedDot && stream.match(".")) {
        if (!stream.match(IDENTIFIER, false)) {
          stream.backUp(1);
          return null;
        }
        return "dot";
      }
      if (!stream.match(IDENTIFIER)) return null;
      var id = stream.current();
      if (isKeyword(id)) return "keyword";
      if (isSpecialVar(id)) return "special_var";
      if (isAtom(id)) return "atom";
      if (id.match(CONSTANT_HEURISTIC)) {
        return "constant";
      }
      if (id.match(TYPE_HEURISTIC)) {
        return "type";
      }
      if (stream.match(/[ ]*:?:=/, false)) {
        return "declaration";
      }
      if (stream.match(/[ ]*[/][ ]*[\w_.]+[?]?[ ]*:?:=/, false)) {
        state.context.push([localAnnotation, -1]);
        state.subState.push(LOCAL_ANNOTATION_DIV);
        return "declaration";
      }
      return "identifier";
    }

    function tryPrimitive(stream, state) {
      if (stream.match(/#primitive\b/)) {
        return "primitive";
      }
      return null;
    }

    var TYPE_START = 0;
    var TYPE_START_NULLABLE = 1;
    var TYPE_AFTER_PREFIX = 2;
    var TYPE_AFTER_PREFIX_NULLABLE = 3;
    // Assumes that we are currently at an identifier, or a prefixed identifier.
    // Colors the prefix as prefix, and the last identifier as type.
    function tokenizeType(stream, state, allowNullable) {
      if (!stream.match(TYPE, false)) {
        throw "INTERNAL ERROR";
      }
      if (stream.match(/any\b/) || stream.match(/none\b/)) {
        return "type_special";
      }
      if (stream.match(/int\b\??/) || stream.match(/float\b\??/) || stream.match(/bool\b\??/) || stream.match(/string\b\??/)) {
        return "type_short";
      }
      state.context.push([tokenizeType2, -1]);
      state.subState.push(allowNullable ? TYPE_START_NULLABLE : TYPE_START);
      return tokenizeType2(stream, state);
    }

    function tokenizeType2(stream, state) {
      var sub = subState(state);
      if (sub == TYPE_START || sub == TYPE_START_NULLABLE) {
        stream.match(TYPE);
        var indexOfDot = stream.current().indexOf('.');
        if (indexOfDot >= 0) {
          // Backup.
          setSubState(state, sub == TYPE_START ? TYPE_AFTER_PREFIX : TYPE_AFTER_PREFIX_NULLABLE);
          stream.backUp(stream.current().length - indexOfDot);
          return "type_prefix";
        }
        if (sub == TYPE_START_NULLABLE) stream.match("?");
        state.context.pop();
        state.subState.pop();
        return "type_name";
      }
      if (stream.match(".")) return "type_dot";
      state.context.pop();
      state.subState.pop();
      stream.match(IDENTIFIER);
      if (sub == TYPE_AFTER_PREFIX_NULLABLE) stream.match("?");
      return "type_name";
    }

    var IMPORT_AFTER_IMPORT = 0;
    var IMPORT_AFTER_PATH = 1;
    var IMPORT_AFTER_SHOW = 2;
    var IMPORT_AFTER_AS = 3;
    var IMPORT_ERROR = 4;
    function tryImport(stream, state) {
      if (stream.match(/import\b/)) {
        state.context.push([tokenizeImport, 2]);
        state.subState.push(IMPORT_AFTER_IMPORT);
        return "keyword"
      }
      return null;
    }
    function tokenizeImport(stream, state) {
      var comment_result = tryComments(stream, state);
      if (comment_result) return comment_result;

      function importError() {
        setSubState(state, IMPORT_ERROR);
        stream.skipToEnd();
        return "error";
      }

      switch (subState(state)) {
        case IMPORT_AFTER_IMPORT:
          if (!stream.match(/\.*(\.?[a-zA-Z_]\w*)+/)) return importError();
          setSubState(state, IMPORT_AFTER_PATH);
          return "import_path";
        case IMPORT_AFTER_PATH:
          if (stream.match(/as\b/)) {
            setSubState(state, IMPORT_AFTER_AS);
            return "keyword";
          }
          if (stream.match(/show\b/)) {
            setSubState(state, IMPORT_AFTER_SHOW);
            return "keyword";
          }
          return importError();
        case IMPORT_AFTER_AS:
          if (!stream.match(IDENTIFIER)) return importError();
          // Anything that follows is an error.
          setSubState(state, IMPORT_ERROR);
          return "import_prefix_name";
        case IMPORT_AFTER_SHOW:
          if (stream.match("*")) {
            setSubState(state, IMPORT_ERROR);
            return "import_star";
          }
          if (!stream.match(IDENTIFIER)) return importError();
          return "import_show_identifier";
        case IMPORT_ERROR:
        default:
          stream.skipToEnd();
          return "import_error";
      }
    }

    var EXPORT_AFTER_EXPORT = 0;
    var EXPORT_ERROR = 1;
    function tryExport(stream, state) {
      if (stream.match(/export\b/)) {
        state.context.push([tokenizeExport, 2]);
        state.subState.push(EXPORT_AFTER_EXPORT);
        return "keyword"
      }
      return null;
    }
    function tokenizeExport(stream, state) {
      var comment_result = tryComments(stream, state);
      if (comment_result) return comment_result;

      switch (subState(state)) {
        case EXPORT_AFTER_EXPORT:
          if (stream.match("*")) {
            setSubState(state, EXPORT_ERROR);
            return "export_star";
          }
          if (stream.match(IDENTIFIER)) {
            return "export_identifier";
          }
          setSubState(state, EXPORT_ERROR);
        // Fall through.
        case EXPORT_ERROR:
        default:
          stream.skipToEnd();
          return "export_error";
      }
    }

    var CLASS_SIGNATURE_AFTER_CLASS = 0;
    var CLASS_SIGNATURE_AFTER_NAME = 1;
    var CLASS_SIGNATURE_AFTER_EXTENDS = 2;
    var CLASS_SIGNATURE_AFTER_EXTENDS_TYPE = 3
    var CLASS_SIGNATURE_AFTER_IMPLEMENTS = 4;
    var CLASS_SIGNATURE_AFTER_FIRST_IMPLEMENTS_NAME = 5;
    var CLASS_BODY = 6;
    function tryClass(stream, state) {
      if (stream.match(/(abstract[ ]+)?class\b/) || stream.match(/interface\b/)) {
        state.context.push([tokenizeClass, 2]);
        state.subState.push(CLASS_SIGNATURE_AFTER_CLASS);
        return "keyword"
      }
      return null;
    }

    function tokenizeClassError(stream, state) {
      // This function will be popped by indentation.
      stream.skipToEnd();
      return "class_error";
    }

    function tokenizeClass(stream, state) {
      var comment_result = tryComments(stream, state);
      if (comment_result) return comment_result;

      function signatureError() {
        setSubState(state, CLASS_BODY); // Once the error function is popped.
        // Eat everything until we are back to 2-indentation.
        state.context.push([tokenizeClassError, 4]);
        state.subState.push(null)
        return tokenizeClassError(stream, state);
      }

      switch (subState(state)) {
        case CLASS_SIGNATURE_AFTER_CLASS:
          if (!stream.match(IDENTIFIER)) return signatureError();
          setSubState(state, CLASS_SIGNATURE_AFTER_NAME);
          return "class_name";

        case CLASS_SIGNATURE_AFTER_NAME:
          if (stream.match(/extends\b/)) {
            setSubState(state, CLASS_SIGNATURE_AFTER_EXTENDS);
            return "keyword";
          }
        // Fall through.

        case CLASS_SIGNATURE_AFTER_EXTENDS_TYPE:
          if (stream.match(/implements\b/)) {
            setSubState(state, CLASS_SIGNATURE_AFTER_IMPLEMENTS);
            return "keyword";
          }
          if (stream.match(":")) {
            setSubState(state, CLASS_BODY);
            return "class_body_colon";
          }
          return signatureError();

        case CLASS_SIGNATURE_AFTER_EXTENDS:
          if (!stream.match(TYPE, false)) return signatureError();
          setSubState(state, CLASS_SIGNATURE_AFTER_EXTENDS_TYPE);
          return tokenizeType(stream, state, false);

        case CLASS_SIGNATURE_AFTER_IMPLEMENTS:
          // The first *requires* an type.
          if (!stream.match(TYPE, false)) return signatureError();
          setSubState(state, CLASS_SIGNATURE_AFTER_FIRST_IMPLEMENTS_NAME);
          return tokenizeType(stream, state, false);

        case CLASS_SIGNATURE_AFTER_FIRST_IMPLEMENTS_NAME:
          if (stream.match(TYPE, false)) {
            return tokenizeType(stream, state, false);
          }
          if (stream.match(":")) {
            setSubState(state, CLASS_BODY);
            return "class_body_colon";
          }
          return signatureError();

        case CLASS_BODY:
          state.context.push([tokenizeMemberDeclaration, 4]);
          state.subState.push(MEMBER_DECLARATION_START);
          return tokenizeMemberDeclaration(stream, state);

        default:
          stream.skipToEnd();
          return "unformatted";
      }
    }

    var MEMBER_DECLARATION_START = 0;
    var MEMBER_DECLARATION_AFTER_STATIC_ABSTRACT = 1;
    var MEMBER_DECLARATION_AFTER_OPERATOR = 2;
    var MEMBER_DECLARATION_AFTER_NAMED_CONSTRUCTOR = 3;
    function tokenizeMemberDeclaration(stream, state) {
      var comment_result = tryComments(stream, state);
      if (comment_result) return comment_result;

      if (subState(state) == MEMBER_DECLARATION_START) {
        if (stream.match(/abstract\b/) || stream.match(/static\b/)) {
          setSubState(state, MEMBER_DECLARATION_AFTER_STATIC_ABSTRACT);
          return "keyword";
        }
        if (stream.match(/operator\b/)) {
          setSubState(state, MEMBER_DECLARATION_AFTER_OPERATOR);
          return "keyword";
        }
        if (stream.match(/constructor\b/)) {
          if (stream.match(/\.[a-zA-Z_]\w*/, false)) {
            setSubState(state, MEMBER_DECLARATION_AFTER_NAMED_CONSTRUCTOR);
          } else {
            state.context.push([tokenizeFunctionBody, 4]);
            state.subState.push(null);
            state.context.push([tokenizeFunctionSignature, 6]);
            state.subState.push(null);
          }
          return "constructor_keyword"
        }
      } else if (subState(state) == MEMBER_DECLARATION_AFTER_NAMED_CONSTRUCTOR) {
        stream.match(/\.[a-zA-Z_]\w*/);
        state.context.push([tokenizeFunctionBody, 4]);
        state.subState.push(null);
        state.context.push([tokenizeFunctionSignature, 6]);
        state.subState.push(null);
        return "member_named_constructor"
      }

      var currentSubState = subState(state);

      // Even if things go wrong, assume that we are going to parse the rest of
      // the signature first, followed by the body.
      // If we find a `:` we will pop the signature by hand.
      state.context.push([tokenizeFunctionBody, 4]);
      state.subState.push(null);
      state.context.push([tokenizeFunctionSignature, 6]);
      state.subState.push(null);
      if (currentSubState == MEMBER_DECLARATION_AFTER_OPERATOR && stream.match(OVERRIDABLE_OPERATOR)) {
        return "member_operator_name"
      } else if (stream.match(IDENTIFIER)) {
        if (isReserved(stream.current())) {
          return "member_name_error";
        }
        if (stream.match(".")) {
          if (stream.match(IDENTIFIER)) {
            if (subState(state) == MEMBER_DECLARATION_AFTER_STATIC_ABSTRACT) {
              return "member_name_error";
            }
            return "named_constructor";
          }
          return "member_name_error";
        } else if (stream.match("=")) {
          return "member_name_setter";
        } else {
          return "member_name";
        }
      }
      stream.eatWhile(/[^ ]/); // Skip to the next whitespace.
      return "member_name_error";
    }

    function tokenizeFunctionBody(stream, state) {
      var matched_result = tryExpression(stream, state);
      if (matched_result) return matched_result;

      stream.eatWhile(/[^ ]/);
      return "unformatted";
    }

    function tryDefaultValue(stream, state) {
      var expression_result = tryNumber(stream, state) ||
        tryString(stream, state) ||
        tryChar(stream, state) ||
        tryDelimited(stream, state);
      if (expression_result) return expression_result;
      var identifier_result = tryIdentifier(stream, state);
      if (identifier_result) {
        var lastIndentation = last(state.context)[1];
        state.context.push([tokenizeDefaultValueContinuation, lastIndentation]);
        state.subState.push(DEFAULT_VALUE_AFTER_IDENTIFIER);
        return identifier_result;
      }
      return null;
    }

    var DEFAULT_VALUE_AFTER_IDENTIFIER = 0;
    var DEFAULT_VALUE_AFTER_DOT = 1;
    function tokenizeDefaultValueContinuation(stream, state) {
      switch (subState(state)) {
        case DEFAULT_VALUE_AFTER_IDENTIFIER:
          if (stream.match(".")) {
            if (stream.match(IDENTIFIER, false)) {
              setSubState(state, DEFAULT_VALUE_AFTER_DOT);
              return "dot";
            }
            state.context.pop();
            state.subState.pop();
            return "default_value_dot_error";
          }
          if (stream.peek() == '[') {
            setSubState(state, DEFAULT_VALUE_AFTER_IDENTIFIER);  // When we return;
            return tryDelimited(stream, state);
          }
          // Not part of the default value anymore.
          state.context.pop();
          state.subState.pop();
          return last(state.context)[0](stream, state);

        case DEFAULT_VALUE_AFTER_DOT:
          setSubState(state, DEFAULT_VALUE_AFTER_IDENTIFIER);
          return tryIdentifier(stream, state);
      }
    }

    var SIGNATURE_EXPECTING_DEFAULT_VALUE = 0;
    var SIGNATURE_EXPECTING_TYPE = 1;
    var SIGNATURE_AFTER_BRACKET_BLOCK = 2;
    function tokenizeFunctionSignature(stream, state) {
      var comment_result = tryComments(stream, state);
      if (comment_result) return comment_result;

      function error(kind) {
        if (!result) {
          stream.eatWhile(/[^ ]/); // Skip to the next whitespace.
          result = kind || "parameter_error";
        }
      }

      if (stream.match("::=") || stream.match(":=")) {
        state.context.pop();
        state.subState.pop();
        return "field_assig";
      }
      if (stream.match(":")) {
        state.context.pop();
        state.subState.pop();
        return "function_colon";
      }

      switch (subState(state)) {
        case SIGNATURE_EXPECTING_DEFAULT_VALUE:
          setSubState(state, null);  // For when the sub-expression returns.
          // TODO: tokenize default values.
          var result = tryDefaultValue(stream, state);
          if (!result) return error("default_value_error");
          return result;
        case SIGNATURE_EXPECTING_TYPE:
          setSubState(state, null);
          if (!stream.match(TYPE, false)) return error();
          return tokenizeType(stream, state, true);

        default:
        // Continue after the `switch`.
      }
      if (stream.match("/")) {
        setSubState(state, SIGNATURE_EXPECTING_TYPE);
        return "type_div";
      }
      if (stream.match("->")) {
        setSubState(state, SIGNATURE_EXPECTING_TYPE);
        return "type_return";
      }
      if (stream.match("=")) {
        setSubState(state, SIGNATURE_EXPECTING_DEFAULT_VALUE);
        return "default_equals"
      }
      if (stream.match("[")) {
        setSubState(state, SIGNATURE_AFTER_BRACKET_BLOCK);
        return "bracket_block_open";
      }
      if (stream.match("]")) {
        setSubState(state, null);
        return "bracket_block_close";
      }
      var isNamed = false;
      if (stream.match("--")) {
        isNamed = true;
      }
      var isSetting = false;
      if (stream.match(".")) {
        // Setting parameter.
        isSetting = true;
      }
      var prefix = stream.current();
      if (!stream.match(IDENTIFIER)) return error();
      var name = stream.current().slice(prefix.length);
      if (name == "this") {
        if (isSetting || !stream.match(".") || !stream.match(IDENTIFIER)) {
          return error();
        }
        name = stream.current().slice((name + ".").length);
        if (isReserved(name)) return error();
        return "parameter";
      }
      if (isReserved(stream.current().slice(prefix.length))) {
        return error();
      }
      if (isNamed) {
        return "named_parameter";
      } else {
        return "parameter";
      }
    }

    function tryToplevelDeclaration(stream, state) {
      if (stream.match(IDENTIFIER)) {
        state.context.push([tokenizeFunctionBody, 2]);
        state.subState.push(null);
        state.context.push([tokenizeFunctionSignature, 4]);
        state.subState.push(null);
        if (isReserved(stream.current())) {
          return "toplevel_name_error";
        }
        if (stream.match("=")) {
          return "toplevel_name_setter";
        }
        if (stream.current().match(CONSTANT_HEURISTIC)) {
          return "toplevel_constant";
        }
        return "toplevel_name";
      }
      return null;
    }

    // For code snippets that have an indent on the very first
    // line we assume that we are implicitly inside a function
    // like "main".
    function tryImpliedTopLevelFunction(stream, state) {
      if (state.startOfLine && stream.indentation() == 2) {
        state.context.push([tokenizeFunctionBody, 2]);
        state.subState.push(null);
        return "null";
      }
      return null;
    }


    function tokenizeError(stream, state) {
      // We could try to be more aggressive (like trying to highlight numbers,
      // strings, ...), but the most important thing is that we make progress.
      stream.skipToEnd();
      return "error";
    }

    function tryExpression(stream, state) {
      return tryComments(stream, state) ||
        tryNumber(stream, state) ||
        tryChar(stream, state) ||
        tryNamedArgument(stream, state) ||
        tryOperator(stream, state) ||
        tryString(stream, state) ||
        tryIsAs(stream, state) ||
        // In theory we need to check whether the postfix member is
        // prefixed by another expression but for the syntax highlighter we
        // just assume that was the case.
        tryPostfixMemberOrIdentifier(stream, state) ||
        tryIdentifier(stream, state) ||
        tryPrimitive(stream, state) ||
        tryDelimited(stream, state) ||
        tryControl(stream, state);
    }

    function tokenizeTopLevel(stream, state) {
      return tryComments(stream, state) ||
        tryImport(stream, state) ||
        tryExport(stream, state) ||
        tryClass(stream, state) ||
        tryImpliedTopLevelFunction(stream, state) ||
        tryToplevelDeclaration(stream, state) ||
        tokenizeError(stream, state);
    }

    return {
      startState: function (basecolumn) {
        return {
          startOfLine: true,
          readNonWhitespace: false,
          // If the last parsed token was a `:` stores the indentation at that point.
          // Is reset every time we parse a non-whitespace token.
          // Used for indentation.
          atColonIndentation: -1,
          context: [[tokenizeTopLevel, -1]],
          subState: [null]
        };
      },

      token: function (stream, state) {
        if (stream.sol()) {
          state.startOfLine = true;
          state.readNonWhitespace = false;
        } else if (state.readNonWhitespace) {
          state.startOfLine = false;
        }
        if (stream.eatSpace()) return null;
        if (stream.peek() == ":") {
          state.atColonIndentation = stream.indentation();
        } else {
          state.atColonIndentation = -1;
        }
        // Next time we aren't at the beginning of the line anymore.
        state.readNonWhitespace = true;

        if (state.startOfLine) {
          // Drop contexts if there is a dedent.
          while (last(state.context)[1] > stream.indentation()) {
            state.context.pop();
            state.subState.pop();
          }
        }

        var tokenizer = last(state.context)[0];
        var result = tokenizer(stream, state);
        if (!result) return result;
        // We have a more nuanced parsing, allowing for better highlighting
        // (once that's supported, or if there is a better style).
        // Simplify here, so that the standard CSS works.

        // CodeMirror highlighting styles:
        //  - meta
        //  - keyword
        //  - atom
        //  - number
        //  - def
        //  - variable, variable-2, variable-3
        //  - type
        //  - property
        //  - operator
        //  - comment
        //  - string, string-2
        //  - qualifier
        //  - builtin
        //  - bracket
        //  - tag
        //  - attribute
        //  - link
        //  - error

        switch (result) {
          case "unformatted":
          case "import_path":
          case "export_identifier":
            result = null;
            break;

          case "type_special":
          case "keyword":
          case "is_as":
          case "constructor_keyword":
          case "control":
            result = "keyword";
            break;

          case "atom":
          case "constant":
          case "toplevel_constant":
            result = "atom";
            break;

          case "float":
          case "hex_float":
          case "integer":
          case "hex":
          case "binary":
            result = "number";
            break;

          case "member_name":
          case "member_name_setter":
          case "member_named_constructor":
          case "declaration":
          case "toplevel_name":
          case "toplevel_name_setter":
          case "class_name":
          case "member_operator_name":
              result = "def";
            break;

          case "import_show_identifier":
          case "named_constructor":
          case "named_parameter":
          case "parameter":
            result = "variable";
            break;

          case "identifier":
            result = "variable-2";
            break;

          case "type":
          case "type_name":
          case "type_short":
            result = "type";
            break;

          case "import_star":
          case "export_star":
          case "type_dot":
          case "default_equals":
          case "function_colon":
          case "field_assig": // Also for globals.
          case "type_div":
          case "type_return":
          case "class_body_colon":
          case "dot":
          case "string_dollar":
          case "colon":
          case "relational":
          case "op_assig":
          case "overridable_op":
          case "op_slice":
          case "assig":
          case "define":
          case "separator":
            result = "operator";
            break;

          case "singleline_string":
          case "multiline_string":
          case "character":
            result = "string";
            break;

          case "unfinished_string":
          case "missing_escape_expression":
          case "unfinished_character":
            result = "string error";
            break;

          case "string_format":
          case "named_argument":
          case "import_prefix_name":
          case "type_prefix":
            result = "qualifier";
            break;

          case "special_var":
          case "primitive":
            result = "builtin";
            break;

          case "bracket_block_open":
          case "bracket_block_close":
          case "paren":
          case "bracket":
            result = "bracket";
            break;

          case "import_error":
          case "export_error":
          case "class_error":
          case "member_name_error":
          case "parameter_error":
          case "default_value_error":
          case "toplevel_name_error":
          case "default_value_dot_error":
          case "is_as_error":
            result = "error"; // Might want to just not color.
            break;

          default:
            /* do nothing. */
            break;
        }
        return result;
      },

      indent: function (state, textAfter) {
        if (state.atColonIndentation == -1) return CodeMirror.Pass;
        // We don't use `config.indentUnit`. Toit is 2 chars.
        return state.atColonIndentation + 2;
      },

      closeBrackets: { triples: "\"" },
      lineComment: "//",
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
      fold: "indent",
    };
  });

  CodeMirror.defineMIME("text/x-toit", "toit");

});
