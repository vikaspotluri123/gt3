// @ts-check
const BaseVisitor = require('./visitors/base.js');

class Linter {
  /**
   * @template TContext
   * @param {Object} options
   * @param {string} options.source - The source code to verify.
   * @param {Object} options.parsed - The parsing results.
   * @param {Object} options.parsed.ast - The ast tree to lint.
   * @param {Object} options.parsed.error - An error that happened when parsing.
   * @param {string} options.fileName - Name of the source code to identify by.
   * @param {typeof BaseVisitor<TContext>} options.visitor - Array of Rule class instances to use for verification.
   * @param {TContext} context - Global context for the visitor.
   *
   * @returns {LintResult[]} messages - lint results.
   */
    verify(options, context) {
        const messages = [];

        function addToMessages(_message) {
            let message = Object.assign({}, {file: options.fileName}, _message);
            messages.push(message);
        }

        if (options.parsed.error) {
            const err = options.parsed.error;
            addToMessages({
                message: err.message,
                fatal: true,
                column: err.column,
                line: err.lineNumber
            });

            return messages;
        }

        const visitor = new options.visitor({
            fileName: options.fileName,
            source: options.source,
        }, context);

        visitor.enter(options.parsed.ast);

        return messages;
    }
}

module.exports = Linter;

/**
 * @typedef {Object} LintResult
 *  @prop {string} rule - The name of the rule that triggered this warning/error.
 *  @prop {string} message - The message that should be output.
 *  @prop {number} line - The line on which the error occurred.
 *  @prop {number} column - The column on which the error occurred.
 *  @prop {string} moduleId - The module path for the file containing the error.
 *  @prop {string} source - The source that caused the error.
 *  @prop {string} fix - An object describing how to fix the error.
 */
