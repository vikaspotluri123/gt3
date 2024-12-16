// @ts-check
const {BaseVisitor, VISITOR_METHODS} = require('./base.js');


/**
 * @param {Array<typeof BaseVisitor<any>>} visitors
 */
function multiVisitor(visitors) {
  class MultiVisitor extends BaseVisitor {
    static createContext() {
      const context = {};
      for (const visitor of visitors) {
        Object.assign(context, visitor.createContext());
      }

      return context;
    }

    constructor(options, context) {
      super(options, context);

      const visitorInstances = [];
      this.visitors = visitorInstances;

      for (const Visitor of visitors) {
        visitorInstances.push(new Visitor(options, context));
      }
    }

    afterEnter() {
      for (const visitor of this.visitors) {
        visitor.afterEnter();
      }
    }
  }

  for (const method of VISITOR_METHODS) {
    MultiVisitor.prototype[method] = function (...args) {
      for (const visitor of this.visitors) {
        visitor[method](...args);
      }
    };
  }

  return MultiVisitor;
}

module.exports.multiVisitor = multiVisitor;
