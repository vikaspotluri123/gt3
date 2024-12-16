// @ts-check

/**
 * @typedef {import('./ast/types.js').SourceLocation} SourceLocation
 * @typedef {{
  themePath: string;
  visitor: {
    textToTranslate: Map<string, SourceLocation[]>;
    translatedStrings: Map<string, import('./ast/visitors/translated-strings.js').TranslatedString>;
  };
  files: Array<{
    path: string;
    contents: string;
  }>;
  locales: {
    [locale: string]: {
      [key: string]: string;
    };
  };
 }} ParsedTheme
 */

module.exports = {};
