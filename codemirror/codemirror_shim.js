// Copyright (C) 2020 Florian Loitsch. All rights reserved.

// Shim to make CodeMirror run on Google Apps Script.

var navigator = {
  userAgent: "GAS",
  platform: "GAS",
}

var document = {
  createElement: function() {
    var fakeElement = {
      setAttribute: function() {}
    }
    return fakeElement;
  }
};

var window = {};

// This declaration makes it possible to access the variable when
// this project is used as a library.
var CodeMirror;
