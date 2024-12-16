// @ts-check

class LocationResolver {
  /**
    * @param {string} text
    */
  static getNewlineIndices(text) {
      const response = [];
      let lastIndex = -1;

      while (true) {
          const index = text.indexOf('\n', lastIndex + 1);
          if (index === -1) {
              break;
          }

          response.push(index);
          lastIndex = index;
      }

      return response;
  }

  /**
   * @param {string} fileName
   * @param {string} source
   * @param {number} [lineOffset]
   * @param {number} [fistColumnOffset]
   */
  constructor (fileName, source, lineOffset = 0, fistColumnOffset = 0) {
    this.fileName = fileName;
    this.offset = lineOffset;
    this.firstColumnOffset = fistColumnOffset;
    /** @private */
    this.newlineIndices = LocationResolver.getNewlineIndices(source);
    /** @private */
    this.previousNewLineArrayIndex = -1;
    /** @private */
    this.currentNewlineArrayIndex = 0;
  }

  /**
   * @param {number} startingIndex
   * @param {number} endingIndex
   * @returns {import('../ast/rules/mark-used-helpers.js').SourceLocation}
   */
  getLocationForRange(startingIndex, endingIndex) {
    if (startingIndex > endingIndex) {
      throw new RangeError('Starting index is after ending index');
    }

    if (startingIndex < this.newlineIndices[this.previousNewLineArrayIndex]) {
      throw new RangeError('Starting index is before the last newline');
    }

    const location = {
      source: this.fileName,
      start: {
        line: -1,
        column: -1,
      },
      end: {
        line: -1,
        column: -1,
      },
    };

    this.advanceTo(startingIndex);
    location.start.line = this.currentNewlineArrayIndex + this.offset;
    location.start.column = startingIndex - this.previousNewLineTextIndex - 1;

    this.advanceTo(endingIndex);
    location.end.line = this.currentNewlineArrayIndex + this.offset;
    location.end.column = endingIndex - this.previousNewLineTextIndex - 1;

    return location;
  }

  get previousNewLineTextIndex() {
    return this.newlineIndices[this.previousNewLineArrayIndex] ?? (this.firstColumnOffset * -1);
  }

  /**
   * @private
   * @param {number} index
   */
  advanceTo(index) {
    let nextNewLineTextIndex = this.newlineIndices[this.currentNewlineArrayIndex];

    // CASE: index is not on this line, move forward until it is
    while (index > nextNewLineTextIndex) {
      this.previousNewLineArrayIndex = this.currentNewlineArrayIndex;
      this.currentNewlineArrayIndex++;
      nextNewLineTextIndex = this.newlineIndices[this.currentNewlineArrayIndex];
    }
  }
}

module.exports.LocationResolver = LocationResolver;
