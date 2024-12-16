// @ts-check

/**
 * @typedef {{sourceLines: string[]; originalSourceLines: string[]}} MinimalRule
 * @typedef {Parameters<import('handlebars').Visitor['BlockStatement']>[0]['loc']} SourceLocation
 * @typedef {SourceLocation['start']} Position
 * @typedef {{loc: SourceLocation}} MinimalLocation
 */

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
 * @param {MinimalRule | string[]} instance the current rule, or an array of lines
 * @param {MinimalLocation | Position} nodeOrStart either a node or a start position
 * @param {Position} [end] When provided, assumes that `nodeOrStart` is a start position
 * @example `debugGetSource(rule, node)`
 * @example `debugGetSource(rule, nodeA.loc.start, nodeB.loc.end)`
 */
function debugGetSource(instance, nodeOrStart, end) {
    /** @type {MinimalLocation} */
    let node;
    if (end) {
        /** @type {Position} */
        // @ts-expect-error this is a debug function, we don't strictly type check
        const start = nodeOrStart;
        node = {loc: {source: '', start, end}};
    } else {
        // @ts-expect-error this is a debug function, we don't strictly type check
        node = nodeOrStart;
    }

    const lineStore = Array.isArray(instance) ? instance : debugOriginalSource ? instance.originalSourceLines : instance.sourceLines;
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