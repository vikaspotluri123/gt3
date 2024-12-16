// @ts-check

const {Visitor} = require('handlebars');

module.exports = class BaseRule extends Visitor {
   /**
    * @param {Object} options
    * @param {string} options.source - The source code to verify
    * @param {string} options.fileName - Name of the source code to identify by.
    */
    constructor(options) {
        super();
        this.source = options.source;
        this.fileName = options.fileName;
    }
};
