// @ts-check

const {Visitor} = require('handlebars');

module.exports = class BaseRule extends Visitor {
    constructor(options) {
        super();
        this.ruleName = options.name;
        this._log = options.log;
        this.source = options.source;
    }

    log(result) {
        const defaults = {
            rule: this.ruleName
        };

        const reportedResult = Object.assign({}, defaults, result);

        this._log(reportedResult);
    }
};
