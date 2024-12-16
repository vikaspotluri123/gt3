// @ts-check
const {LocationResolver} = require('../../util/location-resolver.js');
const {BaseVisitor} = require('./base.js');

/**
 * @typedef {import('../types.js').Position} Position
 * @typedef {import('../types.js').Visitor} Visitor
 * @typedef {import('../types.js').SourceLocation} SourceLocation
 * @typedef {import('../types.js').Node} Node
 */


const MARKER_START = '__TT';
const MARKER_END = '__';
const MIN_MARKER_WIDTH = MARKER_START.length + MARKER_END.length;
const LEADING_WHITESPACE = /^\s+/;
const TRAILING_WHITESPACE = /\s+$/;
const MARKER_REGEX = new RegExp(`${MARKER_START}[.\n]+${MARKER_END}`,'g');

function markerOfWidth(width) {
    if (width < MIN_MARKER_WIDTH) {
        throw new Error('Unexpected string width');
    }

    if (width === MIN_MARKER_WIDTH) {
        return MARKER_START + MARKER_END;
    }

    return MARKER_START + '.'.repeat(width - MIN_MARKER_WIDTH) + MARKER_END;
}

/**
 * @param {Node} node
 * @returns {never}
 */
function notImplemented(node) {
    debugger;
    node;
    throw new Error('Not implemented');
}

/**
 * @param {Position} left
 * @param {Position} right
 */
function isLocSame(left, right) {
    return left.line === right.line && left.column === right.column;
}

class TextExtractorVisitor extends BaseVisitor {
    static createContext() {
        return {
            textToTranslate: new Map(),
        };
    }

    /**
     * @param {ConstructorParameters<typeof BaseVisitor>[0]} options
     * @param {{textToTranslate: Map<string, SourceLocation[]>}} context
     */
    constructor(options, context) {
        super(options, context);
        this.sourceLines = this.source.split('\n');
        this.originalSourceLines = this.sourceLines.slice();
        this.textToTranslate = context.textToTranslate;
    }

    /**
     * @param {Node} node
     */
    enter(node) {
        super.enter(node);
        this.analyze();
    }

    /**
     * @private
     */
    analyze() {
        globalThis.writeDebugFile?.(this.fileName, this.sourceLines);

        const cheerio = require('cheerio');
        const $ = cheerio.load(this.sourceLines.join('\n'), {sourceCodeLocationInfo: true});
        for (const element of $(':not(style):not(script)').contents()) {
            if (element.type !== 'text') {
                continue
            }

            const sourceCodeLocation = element.sourceCodeLocation;

            if (!sourceCodeLocation) {
                throw new Error('Unexpected state');
            }

            this.analyzeTextBlock($(element).text(), sourceCodeLocation);
        }
    }

    /**
     * @private
     * @param {string} text
     * @param {NonNullable<import('domhandler').Node['sourceCodeLocation']>} sourceCodeLocation
     */
    analyzeTextBlock(text, {startLine, startCol}) {
        let lastIndex = 0;
        const locationResolver = new LocationResolver(this.fileName, text, startLine, startCol);

        if (text.replaceAll(MARKER_REGEX, '').trim().length === 0) {
            return;
        }

        while (true) {
            const match = MARKER_REGEX.exec(text);
            let textStart;
            let textEnd;
            let nextIndex;

            if (match !== null) {
                textStart = lastIndex;
                textEnd = match.index;
                nextIndex = match.index + match[0].length;

                // CASE: back-to-back marker
                // CASE: marker at the start of the text
                if (match.index === lastIndex || textStart === textEnd) {
                    lastIndex = nextIndex;

                    if (nextIndex === text.length) {
                        break;
                    }

                    continue;
                }
            } else if (lastIndex !== text.length) {
                textStart = lastIndex;
                textEnd = text.length;
                nextIndex = text.length;
            } else {
                // Type safety
                throw new Error('Unexpected state');
            }

            this.storeText(text.slice(textStart, textEnd), textStart, textEnd, locationResolver);

            lastIndex = nextIndex;

            if (nextIndex === text.length) {
                break;
            }
        }
    }

    /**
     * @private
     * @description Stores a text block for translation, calculating the location in the source code.
     * @param {string} text the sliced text to store
     * @param {number} startingIndex the index in the unsliced text of the first character in the sliced text
     * @param {number} endingIndex the index in the unsliced text of the last character in the sliced text
     * @param {LocationResolver} locationResolver the line tracker for the unsliced text
     */
    storeText(text, startingIndex, endingIndex, locationResolver) {
        const leadingWhitespace = LEADING_WHITESPACE.exec(text);
        if (leadingWhitespace !== null) {
            text = text.slice(leadingWhitespace[0].length);
            startingIndex += leadingWhitespace[0].length;
        }

        const trailingWhitespace = TRAILING_WHITESPACE.exec(text);
        if (trailingWhitespace !== null) {
            text = text.slice(0, -trailingWhitespace[0].length);
            endingIndex -= trailingWhitespace[0].length;
        }

        // CASE: text was only whitespace, nothing to do
        if (text.length === 0) {
            return;
        }

        const location = locationResolver.getLocationForRange(startingIndex, endingIndex);

        console.log(`${this.fileName}: ${text}`);
        const translationStore = this.textToTranslate.get(text) || [];
        this.textToTranslate.set(text, translationStore);
        translationStore.push(location);
    }

    /**
     * @private
     * @param {Node} node
     */
    markSourceVisitor (node) {
        this.markSource(node.loc.start, node.loc.end);
    }

    PartialStatement = this.markSourceVisitor.bind(this);
    PartialBlockStatement = notImplemented;
    DecoratorBlock = notImplemented;
    Decorator = notImplemented;
    MustacheStatement = this.markSourceVisitor.bind(this);
    CommentStatement = this.markSourceVisitor.bind(this);
    SubExpression = this.markSourceVisitor.bind(this);

    /**
     * @type {Visitor['BlockStatement']}
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

module.exports = TextExtractorVisitor;
