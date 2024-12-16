// @ts-check

const {Visitor} = require('handlebars');

const VISITOR_METHODS = [
    'Program',
    'BlockStatement',
    'PartialStatement',
    'PartialBlockStatement',
    'DecoratorBlock',
    'Decorator',
    'MustacheStatement',
    'ContentStatement',
    'CommentStatement',
    'SubExpression',
    'PathExpression',
    'StringLiteral',
    'NumberLiteral',
    'BooleanLiteral',
    'UndefinedLiteral',
    'NullLiteral',
    'Hash',
];

/**
 * @param {string} nodeName
 * @param {Function} implementation
 */
function wrappedVisitor(nodeName, implementation) {
    return function (...args) {
        Visitor.prototype[nodeName].apply(this, args);
        return implementation.apply(this, args);
    };
}

class BaseRule extends Visitor {
   /**
    * @param {Object} options
    * @param {string} options.source - The source code to verify
    * @param {string} options.fileName - Name of the source code to identify by.
    */
    constructor(options) {
        super();
        this.source = options.source;
        this.fileName = options.fileName;

        for (const method of VISITOR_METHODS) {
            this[method] = wrappedVisitor(method, this[method]);
        }
    }

    /**
     * @param {Parameters<import('handlebars').Visitor['accept']>[0]} node
     */
    enter(node) {
        this.accept(node);
    }
};

module.exports = BaseRule;