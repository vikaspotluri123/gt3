// @ts-check

const {Visitor} = require('handlebars');

module.exports = class BaseRule extends Visitor {
    constructor(options) {
        super();
        this.ruleName = options.name;
        this._log = options.log;
        this.source = options.source;
        this.partials = options.partials;
        this.helpers = options.helpers;
        this.inlinePartials = options.inlinePartials || [];
        this.customThemeSettings = options.customThemeSettings;
        // TODO: remove hardcoded list of known page builder properties once we have a way to get them from the spec
        this.knownPageBuilderProperties = options.knownPageBuilderProperties || ['show_title_and_feature_image'];
    }

    log(result) {
        const defaults = {
            rule: this.ruleName
        };

        const reportedResult = Object.assign({}, defaults, result);

        this._log(reportedResult);
    }
};
