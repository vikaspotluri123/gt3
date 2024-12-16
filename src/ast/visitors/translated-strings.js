// @ts-check
const {BaseVisitor} = require('./base');

/**
 * @typedef {import('../types.js').Visitor} Visitor
 * @typedef {import('../types.js').Node} Node
 * @typedef {import('../types.js').MustacheStatement} MustacheStatement
 * @typedef {import('../types.js').SubExpression} SubExpression
 * @typedef {import('../types.js').PathExpression} PathExpression
 * @typedef {import('../types.js').StringLiteral} StringLiteral
 * @typedef {import('../types.js').SourceLocation} SourceLocation
 * @typedef {import('../../types.js').ParsedTheme['visitor']} VisitorContext
 */

/**
 * @typedef {Object} TranslatedString
 * @property {Set<string>} parameters
 * @property {(SourceLocation & {parameters: string[]})[]} locations
 */

/**
 * @param {Node} node
 * @returns {node is PathExpression}
 */
function isPathExpressionNode(node) {
  return node.type === 'PathExpression';
}

/**
 * @param {Node} node
 * @returns {node is StringLiteral}
 */
function isStringLiteralNode(node) {
  return node.type === 'StringLiteral';
}

/**
 * @returns {never}
 */
function notImplemented() {
  debugger;
  throw new Error('Not implemented');
}

class TranslatedStringsVisitor extends BaseVisitor {
  static createContext () {
    return {
      translatedStrings: new Map(),
    };
  }

  /**
   * @param {Object} options
   * @param {Pick<VisitorContext, 'translatedStrings'>} context
   */
  constructor(options, context) {
    super(options, context);
    this.sourceLines = options.source.split('\n');
    this.translatedStrings = context.translatedStrings;
    this.seenLocs = new WeakSet();
  }

  MustacheStatement = this.consumeTHelper.bind(this);
  SubExpression = this.consumeTHelper.bind(this);


  /**
   * @param {MustacheStatement | SubExpression} node
   */
  consumeTHelper(node) {
    if (this.seenLocs.has(node.loc)) {
      return;
    }

    this.seenLocs.add(node.loc);

    const path = node.path;
    const blockName = isPathExpressionNode(path) ? path.original : notImplemented();
    if (blockName !== 't') {
      return;
    }

    if (node.params.length !== 1) {
      notImplemented();
    }

    const parameter = node.params[0];
    const translationKey = isStringLiteralNode(parameter) ? parameter.original : notImplemented();

    const store = this.translatedStrings.get(translationKey) ?? {
      parameters: new Set(),
      locations: [],
    };

    /** @type {string[]} */
    const parameters = [];

    store.locations.push({parameters, ...node.loc});
    this.translatedStrings.set(translationKey, store);

    if (node.hash) {
      for (const param of node.hash.pairs) {
        parameters.push(param.key);
        store.parameters.add(param.key);
      }
    }
  }
}

module.exports.TranslatedStringsVisitor = TranslatedStringsVisitor;