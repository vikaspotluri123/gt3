// @ts-check
/**
 * @typedef {import('handlebars').Visitor} Visitor
 * @typedef {Parameters<Visitor['accept']>[0]} Node
 * @typedef {Parameters<Visitor['MustacheStatement']>[0]} MustacheStatement
 * @typedef {Parameters<Visitor['SubExpression']>[0]} SubExpression
 * @typedef {Parameters<Visitor['PathExpression']>[0]} PathExpression
 * @typedef {Parameters<Visitor['StringLiteral']>[0]} StringLiteral
 * @typedef {Parameters<Visitor['Program']>[0]} Program
 * @typedef {Program['loc']} SourceLocation
 * @typedef {SourceLocation['start']} Position
 */

// Trigger typescript to interpret this file as a module
module.exports = {};
