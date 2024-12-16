/**
 * @typedef {import('handlebars').Visitor} Visitor
 * @typedef {Parameters<Visitor['accept']>[0]} Node
 * @typedef {Parameters<Visitor['Program']>[0]} Program
 * @typedef {Program['loc']} SourceLocation
 * @typedef {SourceLocation['start']} Position
 */

// Trigger typescript to interpret this file as a module
module.exports = {};