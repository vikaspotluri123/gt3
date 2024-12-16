const Rule = require('./base');
const {getNodeName, classifyNode, transformLiteralToPath} = require('../helpers');

module.exports = class MarkUsedHelpers extends Rule {
    _markUsedHelpers(node) {
        transformLiteralToPath(node); // Prevents issue when the helper name is double-quoted
        const nodeName = getNodeName(node);
        const helperType = classifyNode(node);

        // helper nodes will break the rendering if there is no matching helper
        // ambiguous nodes simply won't appear if there is no matching helper and no matching context
        if (helperType === 'helper' || helperType === 'ambiguous') {
            this.scanner.context.helpers.push({
                node: nodeName,
                type: node.type,
                helperType,
                loc: node.loc,
                parameters: node.params ? node.params.map(p => p.original) : null
            });
        }
    }

    _analyze() {
        if (!this._textContent) {
            return;
        }

        const cheerio = require('cheerio');
        const $ = cheerio.load(this._textContent, {sourceCodeLocationInfo: true});
        for (const element of $(':not(style):not(script)').contents()) {
            if (element.type !== 'text') {
                continue
            }

            const text = $(element).text();
            for (const token of text.trim().split('__TT__')) {
                if (!token.trim()) {
                    continue;
                }

                console.log(`${this._fileName}: "${token}"`);
            }
        }

        // const leafNodes = $('body *:not(:has(*))');
        // leafNodes.each((i, el) => {
        //     this;

        //     if (el.tagName === 'script' || el.tagName === 'style') {
        //         return;
        //     }

        //     const $el = $(el);
        //     $el.parent.name;
        //     const text = $el.text();
        //     if (!text) {
        //         return;
        //     }
        // });
    }

    set scanner (scanner) {
        this._scanner = scanner;
        scanner.context.cleanupHandlers.push(this._analyze.bind(this));
    }

    get scanner () {
        return this._scanner;
    }

    visitor() {
        this._textContent = '';

        return {
            BlockStatement: this._markUsedHelpers.bind(this),
            MustacheStatement: this._markUsedHelpers.bind(this),
            SubExpression: this._markUsedHelpers.bind(this),
            ContentStatement: (node) => {
                this._fileName = node.loc.source;
                /** @type {string} */
                const text = node.value.trim();
                if (!text) {
                    return;
                }


                if (this._textContent) {
                    this._textContent += '__TT__';
                }

                this._textContent += node.value;
            },
        };
    }
};
