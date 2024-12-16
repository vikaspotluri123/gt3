// @ts-check
const Rule = require('./base');

/**
 * @typedef {Parameters<import('handlebars').Visitor['Program']>[0]} Program
 * @typedef {Parameters<import('handlebars').Visitor['BlockStatement']>[0]['loc']} SourceLocation
 * @typedef {SourceLocation['start']} Position
 */

const MARKER_START = '__TT';
const MARKER_END = '__';
const MIN_MARKER_WIDTH = MARKER_START.length + MARKER_END.length;

function markerOfWidth(width) {
    if (width < MIN_MARKER_WIDTH) {
        throw new Error('Unexpected string width');
    }

    if (width === MIN_MARKER_WIDTH) {
        return MARKER_START + MARKER_END;
    }

    return MARKER_START + '.'.repeat(width - MIN_MARKER_WIDTH) + MARKER_END;
}

function notImplemented(node) {
    debugger;
    throw new Error('Not implemented');
}

/**
 * @param {Position} left
 * @param {Position} right
 */
function isLocSame(left, right) {
    return left.line === right.line && left.column === right.column;
}

class MarkUsedHelpers extends Rule {
    /**
     * @param {ConstructorParameters<typeof Rule>} args
     */
    constructor(...args) {
        super(...args);
        this.sourceLines = this.source.split('\n');
        this.originalSourceLines = this.sourceLines.slice();
        this._textContent = '';
    }

    /**
     * @param {Parameters<import('handlebars').Visitor['accept']>} args
     */
    enter(...args) {
        super.enter(...args);
        this._analyze();
    }

    /**
     * @private
     */
    _analyze() {
        if (!this._textContent) {
            return;
        }

        globalThis.writeDebugFile?.(this.fileName, this.sourceLines);

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

                console.log(`${this.fileName}: "${token}"`);
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

    /**
     * @private
     * @param {Parameters<import('handlebars').Visitor['accept']>[0]} node
     */
    markSourceVisitor (node) {
        this.markSource(node.loc.start, node.loc.end);
    }

    /**
     * @override
     * @type {import('handlebars').Visitor['ContentStatement']}
     */
    ContentStatement(node) {
        const text = node.value.trim();
        if (!text) {
            return;
        }


        if (this._textContent) {
            this._textContent += MARKER_START + MARKER_END;
        }

        this._textContent += node.value;
    }

    PartialStatement = this.markSourceVisitor.bind(this);
    PartialBlockStatement = notImplemented;
    DecoratorBlock = notImplemented;
    Decorator = notImplemented;
    MustacheStatement = this.markSourceVisitor.bind(this);
    CommentStatement = this.markSourceVisitor.bind(this);
    SubExpression = notImplemented;

    /**
     * @type {import('handlebars').Visitor['BlockStatement']}
     */
    BlockStatement(node) {
        const ifTrue = node.program;
        const ifFalse = node.inverse;
        const loc = node.loc;

        if (ifTrue && ifFalse) {
            this.markSource(loc.start, ifTrue.loc.start);
            this.markSource(ifTrue.loc.end, ifFalse.loc.start);

            // CASE: If we're processing a multi-block statement (if/else)
            // the end of the `ifFalse` block will not have a closing tag.
            // In this case there's nothing to add markers to
            if (!isLocSame(ifFalse.loc.end, loc.end)) {
                this.markSource(ifFalse.loc.end, loc.end)
            }
        } else if (ifTrue) {
            this.markSource(loc.start, ifTrue.loc.start);
            this.markSource(ifTrue.loc.end, loc.end);
        } else if (ifFalse) {
            this.markSource(loc.start, ifFalse.loc.start);
            this.markSource(ifFalse.loc.end, loc.end);
        } else {
            throw new Error('Unexpected state');
        }
    }

    /**
     * Replaces a section of the source code with a marker
     * @private
     * @param {Position} start
     * @param {Position} end
     */
    markSource(start, end) {
        const startLine = start.line;
        const startColumn = start.column;
        const endLine = end.line;
        const endColumn = end.column;

        // CASE: single line
        if (startLine === endLine) {
            const line = this.sourceLines[startLine - 1];

            this.sourceLines[startLine - 1] = line.slice(0, startColumn)
                + markerOfWidth(endColumn - startColumn)
                + line.slice(endColumn);

            if (line.length !== this.sourceLines[startLine - 1].length) {
                throw new Error('Unexpected state');
            }

            return;
        }

        // CASE: multi-line block. Create a marker that spans every line so we
        // can't create a marker that's longer than a single line
        let markerWidth = 0;

        // Pass 1: Calculate the total width of the marker
        for (let i = startLine; i <= endLine; i++) {
            const line = this.sourceLines[i - 1];
            const startingIndex = i === startLine ? startColumn : 0;
            const endingIndex = i === endLine ? endColumn : line.length;
            markerWidth += endingIndex - startingIndex;
        }

        const marker = markerOfWidth(markerWidth);
        let markerIndex = 0;

        // Pass 2: Replace the lines with the marker
        for (let i = startLine; i <= endLine; i++) {
            const line = this.sourceLines[i - 1];
            const startingIndex = i === startLine ? startColumn : 0;
            const endingIndex = i === endLine ? endColumn : line.length;
            const width = endingIndex - startingIndex;
            this.sourceLines[i - 1] = line.slice(0, startingIndex)
                + marker.slice(markerIndex, markerIndex + width)
                + line.slice(endingIndex);
            markerIndex += width;
        }
    }
}

module.exports = MarkUsedHelpers;