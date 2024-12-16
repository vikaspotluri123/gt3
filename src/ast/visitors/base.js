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
	if (Visitor.prototype[nodeName] === implementation) {
		return implementation;
	}

	return function (...args) {
		Visitor.prototype[nodeName].apply(this, args);
		return implementation.apply(this, args);
	};
}

/**
 * @abstract
 * @template TContext
 */
class BaseVisitor extends Visitor {
	/**
	 * @abstract
	 * @returns {any} actually returns `TContext`, but that's not allowed in Typescript
	 */
	static createContext() {
		throw new Error('Not implemented');
	}

	/**
	 * @param {Object} options
	 * @param {string} options.source - The source code to verify
	 * @param {string} options.fileName - Name of the source code to identify by.
	 * @param {TContext} context
	 */
	constructor(options, context) {
		super();
		this.source = options.source;
		this.fileName = options.fileName;

		for (const method of VISITOR_METHODS) {
			this[method] = wrappedVisitor(method, this[method]);
		}
	}

	/**
	 * @param {import('../types.js').Node} node
	 */
	enter(node) {
		this.accept(node);
		this.afterEnter();
	}

	/**
	 * @abstract
	 */
	afterEnter() {
		// Noop
	}
}

module.exports.BaseVisitor = BaseVisitor;
module.exports.VISITOR_METHODS = VISITOR_METHODS;
