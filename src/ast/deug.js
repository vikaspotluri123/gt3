function writeDebugFile(fileName, contents) {
    const fs = require('fs');
    const path = require('path');

    const filePath = path.join(process.cwd(), 'source-debug', fileName);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(filePath, contents.join('\n'));
}

let debugOriginalSource = false;

/**
 * Serializes a location based on `sourceLines`
 * @param {MarkUsedHelpers} instance the current rule
 * @param {Parameters<import('handlebars').Visitor['accept']>[0] | Position} nodeOrStart either a node or a start position
 * @param {Position} [end] When provided, assumes that `nodeOrStart` is a start position
 * @example `debugGetSource(rule, node)`
 * @example `debugGetSource(rule, nodeA.loc.start, nodeB.loc.end)`
 */
function debugGetSource(instance, nodeOrStart, end) {
    /** @type {Parameters<import('handlebars').Visitor['accept']>[0]} */
    let node;
    if (end) {
        // @ts-ignore this is a debug function, we don't strictly type check
        node = {loc: {start: nodeOrStart, end}};
    } else {
        // @ts-ignore this is a debug function, we don't strictly type check
        node = nodeOrStart;
    }

    const lineStore = debugOriginalSource ? instance.originalSourceLines : instance.sourceLines;
    const lines = lineStore.slice(node.loc.start.line - 1, node.loc.end.line);
    // Process the ending line first so the index doesn't need to be normalized
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, node.loc.end.column);
    lines[0] = lines[0].slice(node.loc.start.column);
    return lines.join('\n');
}

function setDebugOriginalSource (value) {
  debugOriginalSource = Boolean(value);
}

function register() {
  globalThis.debugGetSource = debugGetSource;
  globalThis.writeDebugFile = writeDebugFile;
  globalThis.setDebugOriginalSource = setDebugOriginalSource;
}

module.exports = {
  register,
  debugGetSource,
  writeDebugFile,
  setDebugOriginalSource,
};