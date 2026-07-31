const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
async function loadAppScript(relativePath, globals = {}) {
  const {default: ts2gas} = await import("ts2gas");
  const sourcePath = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(sourcePath, "utf8");
  const context = vm.createContext({
    console: {
      log() {},
      error() {},
    },
    theme: {
      getModeList() {
        return [];
      },
    },
    ...globals,
  });
  vm.runInContext(ts2gas(source), context, {filename: sourcePath});
  return {
    context,
    evaluate(expression) {
      return vm.runInContext(expression, context);
    },
  };
}

module.exports = {loadAppScript};
